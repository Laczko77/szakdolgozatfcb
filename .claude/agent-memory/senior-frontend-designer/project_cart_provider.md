---
name: CartProvider canonical
description: useCart() from src/providers/CartProvider.tsx is the single source of truth for cart + wishlist; navbar badge, drawer, wishlist heart all read from it
type: project
---

CartProvider is mounted globally in `src/app/layout.tsx` (inside ToastProvider, outside the main content). It owns cart state, wishlist state, and drawer open/closed state. All three are accessed via `useCart()`.

**Why:** The cart count must update in real-time across the navbar badge, the cart drawer, and any product page that adds an item. Threading callbacks through every component would be painful and error-prone. Co-locating wishlist with cart matches the user mental model ("things I want to buy") and lets the heart icon on product cards stay in sync.

**How to apply:** Whenever a new shop-adjacent surface is built (admin order detail, dashboard widget, profile rendelések tab), reach for `useCart()` first instead of fetching cart/wishlist from `/api/cart` or `/api/wishlist` directly. The provider already handles auth gating, optimistic updates, and refresh-on-mutation.
