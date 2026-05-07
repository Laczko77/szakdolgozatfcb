// @vitest-environment jsdom
/**
 * CartProvider unit tests.
 *
 * shop-api and AuthProvider are mocked so no network / Supabase calls happen.
 * AuthProvider is replaced with a minimal context stub that lets us control
 * the `user` and `isLoading` values per test.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { createContext, useContext } from 'react';

// ---------------------------------------------------------------------------
// Mock @/providers/AuthProvider before importing CartProvider
// ---------------------------------------------------------------------------
vi.mock('@/providers/AuthProvider', () => {
  return {
    useAuth: vi.fn(),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// ---------------------------------------------------------------------------
// Mock @/lib/shop-api
// ---------------------------------------------------------------------------
vi.mock('@/lib/shop-api', () => ({
  fetchCart: vi.fn(),
  fetchWishlist: vi.fn(),
  addToCart: vi.fn(),
  addToWishlist: vi.fn(),
  removeCartItem: vi.fn(),
  removeWishlistItem: vi.fn(),
  updateCartItem: vi.fn(),
}));

import { useAuth } from '@/providers/AuthProvider';
import * as shopApi from '@/lib/shop-api';
import { CartProvider, useCart } from '@/providers/CartProvider';
import type { CartLineItem, WishlistRow } from '@/lib/shop-api';

// ---------------------------------------------------------------------------
// Typed mock references
// ---------------------------------------------------------------------------
const mockUseAuth = useAuth as Mock;
const mockFetchCart = shopApi.fetchCart as Mock;
const mockFetchWishlist = shopApi.fetchWishlist as Mock;
const mockRemoveCartItem = shopApi.removeCartItem as Mock;
const mockUpdateCartItem = shopApi.updateCartItem as Mock;
const mockAddToCart = shopApi.addToCart as Mock;
const mockAddToWishlist = shopApi.addToWishlist as Mock;
const mockRemoveWishlistItem = shopApi.removeWishlistItem as Mock;

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeLineItem(overrides: Partial<CartLineItem> = {}): CartLineItem {
  return {
    id: 'item-1',
    user_id: 'user-1',
    variant_id: 'v-1',
    quantity: 2,
    created_at: new Date().toISOString(),
    variant: {
      id: 'v-1',
      product_id: 'p-1',
      size: 'M',
      color: 'Blue',
      stock: 10,
      sku: 'SKU-001',
      created_at: new Date().toISOString(),
      product: {
        id: 'p-1',
        name: 'Test Shirt',
        price: 5000,
        image_url: null,
        category: 'jersey',
      },
    },
    ...overrides,
  } as CartLineItem;
}

function makeWishlistRow(overrides: Partial<WishlistRow> = {}): WishlistRow {
  return {
    id: 'wl-1',
    user_id: 'user-1',
    product_id: 'prod-1',
    created_at: new Date().toISOString(),
    product: null,
    ...overrides,
  } as WishlistRow;
}

/** Renders a child component that exposes the cart context via data-testid spans */
function CartFixture() {
  const {
    cartItems,
    cartCount,
    cartTotal,
    isCartOpen,
    openCart,
    closeCart,
    toggleCart,
    removeItem,
    updateItem,
    clearLocalCart,
    wishlist,
    isOnWishlist,
    isCartLoading,
  } = useCart();

  return (
    <div>
      <span data-testid="count">{cartCount}</span>
      <span data-testid="total">{cartTotal}</span>
      <span data-testid="items">{cartItems.map((i) => i.id).join(',')}</span>
      <span data-testid="loading">{isCartLoading ? 'loading' : 'idle'}</span>
      <span data-testid="cart-open">{isCartOpen ? 'open' : 'closed'}</span>
      <span data-testid="wishlist">{wishlist.map((w) => w.product_id).join(',')}</span>
      <span data-testid="on-wishlist-prod1">{isOnWishlist('prod-1') ? 'yes' : 'no'}</span>
      <button data-testid="btn-open-cart" onClick={openCart}>openCart</button>
      <button data-testid="btn-close-cart" onClick={closeCart}>closeCart</button>
      <button data-testid="btn-toggle-cart" onClick={toggleCart}>toggleCart</button>
      <button data-testid="btn-remove" onClick={() => removeItem('item-1')}>remove</button>
      <button data-testid="btn-update" onClick={() => updateItem('item-1', 5)}>update</button>
      <button data-testid="btn-clear" onClick={clearLocalCart}>clear</button>
    </div>
  );
}

function renderCart() {
  return render(
    <CartProvider>
      <CartFixture />
    </CartProvider>,
  );
}

// ---------------------------------------------------------------------------
// beforeEach: default stubs
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();

  // Default: authenticated user, not loading
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    isLoading: false,
  });

  // Default: empty cart & wishlist
  mockFetchCart.mockResolvedValue({ items: [], total: 0, itemCount: 0 });
  mockFetchWishlist.mockResolvedValue({ items: [] });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CartProvider', () => {
  describe('useCart outside provider', () => {
    it('throws when used outside CartProvider', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<CartFixture />)).toThrow(
        'useCart must be used inside <CartProvider />',
      );
      spy.mockRestore();
    });
  });

  describe('initial state — unauthenticated user', () => {
    it('does not fetch cart when user is null', async () => {
      mockUseAuth.mockReturnValue({ user: null, isLoading: false });
      renderCart();
      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('0');
      });
      expect(mockFetchCart).not.toHaveBeenCalled();
    });

    it('does not fetch wishlist when user is null', async () => {
      mockUseAuth.mockReturnValue({ user: null, isLoading: false });
      renderCart();
      await waitFor(() => {
        expect(screen.getByTestId('wishlist').textContent).toBe('');
      });
      expect(mockFetchWishlist).not.toHaveBeenCalled();
    });
  });

  describe('initial state — auth still loading', () => {
    it('does not fetch while authLoading is true', () => {
      mockUseAuth.mockReturnValue({ user: null, isLoading: true });
      renderCart();
      expect(mockFetchCart).not.toHaveBeenCalled();
    });
  });

  describe('initial hydration — authenticated', () => {
    it('fetches cart and wishlist on mount when user is present', async () => {
      renderCart();
      await waitFor(() => {
        expect(mockFetchCart).toHaveBeenCalledOnce();
        expect(mockFetchWishlist).toHaveBeenCalledOnce();
      });
    });

    it('populates cartItems from fetchCart result', async () => {
      const item = makeLineItem();
      mockFetchCart.mockResolvedValue({ items: [item], total: 5000, itemCount: 1 });
      renderCart();
      await waitFor(() => {
        expect(screen.getByTestId('items').textContent).toBe('item-1');
      });
    });
  });

  describe('derived values — cartCount', () => {
    it('sums quantities from all cart items', async () => {
      const items = [
        makeLineItem({ id: 'a', quantity: 3 }),
        makeLineItem({ id: 'b', quantity: 2 }),
      ];
      mockFetchCart.mockResolvedValue({ items, total: 0, itemCount: 5 });
      renderCart();
      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('5');
      });
    });

    it('returns 0 when cart is empty', async () => {
      renderCart();
      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('0');
      });
    });
  });

  describe('derived values — cartTotal', () => {
    it('multiplies price × quantity for each item and sums', async () => {
      const items = [
        makeLineItem({ id: 'a', quantity: 2 }), // price 5000 × 2 = 10000
        makeLineItem({ id: 'b', quantity: 1, variant: { ...makeLineItem().variant, product: { ...makeLineItem().variant.product, price: 3000 } } as CartLineItem['variant'] }),
      ];
      mockFetchCart.mockResolvedValue({ items, total: 0, itemCount: 3 });
      renderCart();
      await waitFor(() => {
        // item-a: 5000*2=10000  item-b: 3000*1=3000 → total 13000
        expect(screen.getByTestId('total').textContent).toBe('13000');
      });
    });

    it('returns 0 for empty cart', async () => {
      renderCart();
      await waitFor(() => {
        expect(screen.getByTestId('total').textContent).toBe('0');
      });
    });
  });

  describe('clearLocalCart', () => {
    it('empties cartItems immediately without a network call', async () => {
      const user = userEvent.setup();
      mockFetchCart.mockResolvedValue({ items: [makeLineItem()], total: 5000, itemCount: 1 });
      renderCart();
      await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));
      await user.click(screen.getByTestId('btn-clear'));
      expect(screen.getByTestId('count').textContent).toBe('0');
    });
  });

  describe('removeItem — optimistic update', () => {
    it('removes the item optimistically before the API call resolves', async () => {
      const user = userEvent.setup();
      // Make the API call hang so we can observe the optimistic state
      let resolveRemove!: () => void;
      mockRemoveCartItem.mockReturnValue(
        new Promise<void>((res) => { resolveRemove = res; }),
      );
      mockFetchCart.mockResolvedValue({ items: [makeLineItem()], total: 5000, itemCount: 1 });
      renderCart();
      await waitFor(() => expect(screen.getByTestId('items').textContent).toBe('item-1'));

      await user.click(screen.getByTestId('btn-remove'));
      // Optimistic: item removed before API settles
      expect(screen.getByTestId('items').textContent).toBe('');

      // Settle the API call cleanly
      await act(async () => { resolveRemove(); });
    });

    it('rolls back the item when the API call fails (BUG-006)', async () => {
      mockRemoveCartItem.mockRejectedValue(new Error('Network error'));
      mockFetchCart.mockResolvedValue({ items: [makeLineItem()], total: 5000, itemCount: 1 });

      function RollbackFixture() {
        const { cartItems, removeItem } = useCart();
        const handleRemove = () => {
          removeItem('item-1').catch(() => {
            // swallow — we only care about the UI rollback
          });
        };
        return (
          <div>
            <span data-testid="items">{cartItems.map((i) => i.id).join(',')}</span>
            <button data-testid="rm" onClick={handleRemove}>rm</button>
          </div>
        );
      }

      render(<CartProvider><RollbackFixture /></CartProvider>);
      await waitFor(() => expect(screen.getByTestId('items').textContent).toBe('item-1'));

      await act(async () => {
        screen.getByTestId('rm').click();
      });

      // After the rejection the item should be restored
      await waitFor(() => {
        expect(screen.getByTestId('items').textContent).toBe('item-1');
      });
    });

    it('restores the item at its original index on rollback', async () => {
      mockRemoveCartItem.mockRejectedValue(new Error('fail'));
      const items = [
        makeLineItem({ id: 'item-0' }),
        makeLineItem({ id: 'item-1' }),
        makeLineItem({ id: 'item-2' }),
      ];
      mockFetchCart.mockResolvedValue({ items, total: 0, itemCount: 3 });

      function TargetFixture() {
        const { cartItems, removeItem } = useCart();
        const handleRemove = () => {
          removeItem('item-1').catch(() => {
            // swallow — we care only about UI rollback order
          });
        };
        return (
          <div>
            <span data-testid="order">{cartItems.map((i) => i.id).join(',')}</span>
            <button data-testid="rm" onClick={handleRemove}>rm</button>
          </div>
        );
      }

      render(
        <CartProvider>
          <TargetFixture />
        </CartProvider>,
      );
      await waitFor(() =>
        expect(screen.getByTestId('order').textContent).toBe('item-0,item-1,item-2'),
      );

      await act(async () => { screen.getByTestId('rm').click(); });

      await waitFor(() => {
        expect(screen.getByTestId('order').textContent).toBe('item-0,item-1,item-2');
      });
    });
  });

  describe('updateItem — optimistic update', () => {
    it('updates quantity optimistically before API resolves', async () => {
      const user = userEvent.setup();
      let resolveUpdate!: () => void;
      mockUpdateCartItem.mockReturnValue(
        new Promise<void>((res) => { resolveUpdate = res; }),
      );
      mockFetchCart.mockResolvedValue({ items: [makeLineItem({ quantity: 2 })], total: 0, itemCount: 2 });

      function UpdateFixture() {
        const { cartItems, updateItem } = useCart();
        return (
          <div>
            <span data-testid="qty">{cartItems[0]?.quantity ?? 0}</span>
            <button data-testid="upd" onClick={() => updateItem('item-1', 7)}>upd</button>
          </div>
        );
      }
      render(<CartProvider><UpdateFixture /></CartProvider>);
      await waitFor(() => expect(screen.getByTestId('qty').textContent).toBe('2'));

      await user.click(screen.getByTestId('upd'));
      expect(screen.getByTestId('qty').textContent).toBe('7');

      await act(async () => { resolveUpdate(); });
    });

    it('refreshes cart (rolls back) when API call fails', async () => {
      const user = userEvent.setup();
      mockUpdateCartItem.mockRejectedValue(new Error('stock exceeded'));
      // The refresh will return the original quantity
      mockFetchCart
        .mockResolvedValueOnce({ items: [makeLineItem({ quantity: 2 })], total: 0, itemCount: 2 })
        .mockResolvedValue({ items: [makeLineItem({ quantity: 2 })], total: 0, itemCount: 2 });

      function UpdateFixture() {
        const { cartItems, updateItem } = useCart();
        return (
          <div>
            <span data-testid="qty">{cartItems[0]?.quantity ?? 0}</span>
            <button data-testid="upd" onClick={() => updateItem('item-1', 99).catch(() => {})}>upd</button>
          </div>
        );
      }
      render(<CartProvider><UpdateFixture /></CartProvider>);
      await waitFor(() => expect(screen.getByTestId('qty').textContent).toBe('2'));

      await user.click(screen.getByTestId('upd'));
      // After rejection, refreshCart is called and quantity returns to 2
      await waitFor(() => {
        expect(screen.getByTestId('qty').textContent).toBe('2');
      });
    });
  });

  describe('cart drawer controls', () => {
    it('openCart sets isCartOpen to true', async () => {
      const user = userEvent.setup();
      renderCart();
      await waitFor(() => expect(screen.getByTestId('cart-open').textContent).toBe('closed'));
      await user.click(screen.getByTestId('btn-open-cart'));
      expect(screen.getByTestId('cart-open').textContent).toBe('open');
    });

    it('closeCart sets isCartOpen to false', async () => {
      const user = userEvent.setup();
      renderCart();
      await user.click(screen.getByTestId('btn-open-cart'));
      await user.click(screen.getByTestId('btn-close-cart'));
      expect(screen.getByTestId('cart-open').textContent).toBe('closed');
    });

    it('toggleCart flips open state', async () => {
      const user = userEvent.setup();
      renderCart();
      await user.click(screen.getByTestId('btn-toggle-cart'));
      expect(screen.getByTestId('cart-open').textContent).toBe('open');
      await user.click(screen.getByTestId('btn-toggle-cart'));
      expect(screen.getByTestId('cart-open').textContent).toBe('closed');
    });
  });

  describe('isOnWishlist', () => {
    it('returns false for a product not in the wishlist', async () => {
      renderCart();
      await waitFor(() =>
        expect(screen.getByTestId('on-wishlist-prod1').textContent).toBe('no'),
      );
    });

    it('returns true for a product that IS in the wishlist', async () => {
      mockFetchWishlist.mockResolvedValue({ items: [makeWishlistRow({ product_id: 'prod-1' })] });
      renderCart();
      await waitFor(() =>
        expect(screen.getByTestId('on-wishlist-prod1').textContent).toBe('yes'),
      );
    });
  });
});
