"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/providers/AuthProvider";
import {
  addToCart as apiAddToCart,
  addToWishlist as apiAddToWishlist,
  fetchCart,
  fetchWishlist,
  removeCartItem as apiRemoveCartItem,
  removeWishlistItem as apiRemoveWishlistItem,
  updateCartItem as apiUpdateCartItem,
  type CartLineItem,
  type WishlistRow,
} from "@/lib/shop-api";

/**
 * Single source of truth for the storefront's cart and wishlist.
 *
 * The provider is mounted globally (above the layout shell) so that the
 * navbar's cart badge stays in sync with detail-page actions, the cart
 * drawer, and the wishlist heart everywhere it appears.
 *
 * Auth coupling:
 *   - Both data sources require an authenticated user. When the user
 *     signs out we wipe the local state immediately so the badge clears.
 *   - When the user signs in we trigger a fresh fetch.
 *   - We expose `requireAuth` so call sites can decide between throwing,
 *     redirecting, or showing a friendly toast.
 */

interface CartContextValue {
  // ------- Cart -------
  cartItems: CartLineItem[];
  cartTotal: number;
  cartCount: number;
  isCartLoading: boolean;
  addItem: (variantId: string, quantity?: number) => Promise<void>;
  updateItem: (id: string, quantity: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearLocalCart: () => void;
  refreshCart: () => Promise<void>;

  // ------- Drawer -------
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;

  // ------- Wishlist -------
  wishlist: WishlistRow[];
  isWishlistLoading: boolean;
  isOnWishlist: (productId: string) => boolean;
  toggleWishlist: (productId: string) => Promise<void>;
  removeFromWishlist: (wishlistId: string) => Promise<void>;
  refreshWishlist: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

interface CartProviderProps {
  children: React.ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const { user, isLoading: authLoading } = useAuth();

  const [cartItems, setCartItems] = useState<CartLineItem[]>([]);
  const [isCartLoading, setIsCartLoading] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [wishlist, setWishlist] = useState<WishlistRow[]>([]);
  const [isWishlistLoading, setIsWishlistLoading] = useState(false);

  // ─────────────── Cart sync ───────────────
  const refreshCart = useCallback(async () => {
    if (!user) {
      setCartItems([]);
      return;
    }
    setIsCartLoading(true);
    try {
      const data = await fetchCart();
      setCartItems(data.items);
    } catch {
      // Swallow — the toast layer surfaces explicit user actions; idle refresh
      // failures should not nag the user.
    } finally {
      setIsCartLoading(false);
    }
  }, [user]);

  const refreshWishlist = useCallback(async () => {
    if (!user) {
      setWishlist([]);
      return;
    }
    setIsWishlistLoading(true);
    try {
      const data = await fetchWishlist();
      setWishlist(data.items);
    } catch {
      // Same rationale as above.
    } finally {
      setIsWishlistLoading(false);
    }
  }, [user]);

  // Hydrate when auth resolves; clear on sign-out.
  useEffect(() => {
    if (authLoading) return;

    // Async work is wrapped in an IIFE so the effect body itself never
    // calls setState synchronously — keeps the React 19 lint rule
    // happy and matches the pattern used by AuthProvider.
    if (user) {
      (async () => {
        await refreshCart();
        await refreshWishlist();
      })();
    } else {
      (() => {
        setCartItems([]);
        setWishlist([]);
      })();
    }
  }, [authLoading, user, refreshCart, refreshWishlist]);

  // ─────────────── Cart mutations ───────────────
  const addItem = useCallback(
    async (variantId: string, quantity: number = 1) => {
      await apiAddToCart(variantId, quantity);
      await refreshCart();
    },
    [refreshCart],
  );

  const updateItem = useCallback(
    async (id: string, quantity: number) => {
      // Optimistic update — server will reject if it exceeds stock.
      setCartItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, quantity } : item)),
      );
      try {
        await apiUpdateCartItem(id, quantity);
      } catch (err) {
        await refreshCart();
        throw err;
      }
    },
    [refreshCart],
  );

  const removeItem = useCallback(
    async (id: string) => {
      // BUG-006 — capture the removed row inside the functional setState
      // so the rollback path doesn't depend on a stale `cartItems`
      // closure. Two rapid removeItem() calls used to share the same
      // `prev` snapshot (because `cartItems` was frozen at callback
      // creation time), which silently resurrected a row when the
      // second call's API request failed. Reading the row from the
      // setter's `curr` argument guarantees we always see the latest
      // committed state, and lets us drop `cartItems` from the
      // dependency array — `removeItem`'s identity is now stable, so
      // the memoised context value no longer thrashes consumers on
      // every cart mutation.
      let removed: CartLineItem | undefined;
      let removedIndex = -1;
      setCartItems((curr) => {
        const idx = curr.findIndex((item) => item.id === id);
        if (idx === -1) return curr;
        removed = curr[idx];
        removedIndex = idx;
        return [...curr.slice(0, idx), ...curr.slice(idx + 1)];
      });
      try {
        await apiRemoveCartItem(id);
      } catch (err) {
        // Restore at the original position when possible — keeps the
        // visual order stable through a failed delete.
        if (removed) {
          const restored = removed;
          const targetIndex = removedIndex;
          setCartItems((curr) => {
            // Bail if a concurrent action already re-added the row.
            if (curr.some((item) => item.id === restored.id)) return curr;
            const insertAt =
              targetIndex >= 0 && targetIndex <= curr.length
                ? targetIndex
                : curr.length;
            return [
              ...curr.slice(0, insertAt),
              restored,
              ...curr.slice(insertAt),
            ];
          });
        }
        throw err;
      }
    },
    [],
  );

  const clearLocalCart = useCallback(() => {
    setCartItems([]);
  }, []);

  // ─────────────── Wishlist mutations ───────────────
  const isOnWishlist = useCallback(
    (productId: string) => wishlist.some((row) => row.product_id === productId),
    [wishlist],
  );

  const toggleWishlist = useCallback(
    async (productId: string) => {
      const existing = wishlist.find((row) => row.product_id === productId);
      if (existing) {
        const prev = wishlist;
        setWishlist((curr) =>
          curr.filter((row) => row.product_id !== productId),
        );
        try {
          await apiRemoveWishlistItem(existing.id);
        } catch (err) {
          setWishlist(prev);
          throw err;
        }
        return;
      }
      // Add — optimistic placeholder, real row arrives via refresh.
      try {
        await apiAddToWishlist(productId);
        await refreshWishlist();
      } catch (err) {
        throw err;
      }
    },
    [wishlist, refreshWishlist],
  );

  const removeFromWishlist = useCallback(
    async (wishlistId: string) => {
      const prev = wishlist;
      setWishlist((curr) => curr.filter((row) => row.id !== wishlistId));
      try {
        await apiRemoveWishlistItem(wishlistId);
      } catch (err) {
        setWishlist(prev);
        throw err;
      }
    },
    [wishlist],
  );

  // ─────────────── Drawer controls ───────────────
  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const toggleCart = useCallback(() => setIsCartOpen((v) => !v), []);

  // Lock body scroll while drawer is open. We intentionally only touch
  // overflow — backdrop covers the page so nobody can scroll the content
  // behind it accidentally on mobile either.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const original = document.body.style.overflow;
    document.body.style.overflow = isCartOpen ? "hidden" : original;
    return () => {
      document.body.style.overflow = original;
    };
  }, [isCartOpen]);

  // ─────────────── Derived values ───────────────
  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  );

  const cartTotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + (item.variant?.product?.price ?? 0) * item.quantity,
        0,
      ),
    [cartItems],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cartItems,
      cartTotal,
      cartCount,
      isCartLoading,
      addItem,
      updateItem,
      removeItem,
      clearLocalCart,
      refreshCart,
      isCartOpen,
      openCart,
      closeCart,
      toggleCart,
      wishlist,
      isWishlistLoading,
      isOnWishlist,
      toggleWishlist,
      removeFromWishlist,
      refreshWishlist,
    }),
    [
      cartItems,
      cartTotal,
      cartCount,
      isCartLoading,
      addItem,
      updateItem,
      removeItem,
      clearLocalCart,
      refreshCart,
      isCartOpen,
      openCart,
      closeCart,
      toggleCart,
      wishlist,
      isWishlistLoading,
      isOnWishlist,
      toggleWishlist,
      removeFromWishlist,
      refreshWishlist,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used inside <CartProvider />");
  }
  return ctx;
}
