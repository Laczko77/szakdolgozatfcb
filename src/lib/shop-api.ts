/**
 * Frontend client for the F8 webshop endpoints.
 *
 * All functions throw on non-2xx responses with the server-provided error
 * message so callers can `catch` and surface it via the toast system.
 *
 * The server routes live under /api/products, /api/cart, /api/wishlist,
 * /api/orders and /api/products/[id]/reviews — see the F5 backend iteration.
 */

import type {
  CartItem,
  Order,
  OrderItem,
  Product,
  ProductVariant,
  Review,
  ShippingAddress,
  Wishlist,
} from "@/types/database";

// ----------------------------------------------------------------------------
// Joined response types — match the shapes the server actually returns.
// ----------------------------------------------------------------------------

export type CartLineItem = CartItem & {
  variant: ProductVariant & {
    product: Pick<
      Product,
      | "id"
      | "name"
      | "price"
      | "image_url"
      | "category"
      // Iter25 (F29) — sale-pricing fields. The cart API joins these in so
      // the drawer / checkout can render strikethrough originals next to
      // the snapshot price the customer actually pays.
      | "sale_price"
      | "sale_starts_at"
      | "sale_ends_at"
    >;
  };
};

export interface CartResponse {
  items: CartLineItem[];
  total: number;
  itemCount: number;
}

export type WishlistRow = Wishlist & { product: Product | null };

export interface WishlistResponse {
  items: WishlistRow[];
}

/**
 * Product row enriched with the aggregate review fields the listing
 * endpoint (`/api/products`) joins in.
 *
 * `average_rating` is `null` when the product has no visible reviews —
 * the UI uses this to differentiate "no rating yet" from "rated 0/5".
 *
 * Iter24 (F28): every product also carries `view_count` (0 if never
 * tracked) so the listing can show "X megtekintés" hints and the
 * "Legnépszerűbb" sort can rank by it server-side.
 */
export type ProductWithRating = Product & {
  average_rating: number | null;
  review_count: number;
  view_count: number;
  // Iter25 (F29) — server-computed sale fields. `effective_price` equals
  // `price` when no sale is active so callers can render it unconditionally.
  effective_price: number;
  is_on_sale: boolean;
  // Iter28 (F30) — gallery. The list endpoint includes only the cover
  // image (one entry); /api/products/[id] returns the full ordered gallery.
  images: ProductImagePublic[];
};

/**
 * Public-facing shape for a single product image. Mirrors the server-side
 * type in `src/lib/product-images.ts` so both halves of the wire contract
 * stay aligned.
 */
export interface ProductImagePublic {
  id: string;
  image_url: string;
  display_order: number;
  is_cover: boolean;
}

/** Available sort keys mirrored from /api/products. */
export const PRODUCT_SORT_KEYS = [
  "newest",
  "popular",
  "price_asc",
  "price_desc",
] as const;
export type ProductSortKey = (typeof PRODUCT_SORT_KEYS)[number];

export interface ProductListResponse {
  products: ProductWithRating[];
  total: number;
  page: number;
  totalPages: number;
  /**
   * IDs of the three globally most-viewed products, ordered most → least.
   * Independent of pagination/filters — the storefront uses these to badge
   * top-3 cards regardless of which page or filter is active.
   */
  top_products: string[];
}

/**
 * `product` carries the same `effective_price` / `is_on_sale` envelope the
 * listing endpoint adds (Iter25 / F29) so the detail page can render the
 * sale block without recomputing pricing on the client.
 */
export type ProductDetail = Product & {
  effective_price: number;
  is_on_sale: boolean;
  // Iter28 (F30/F32) — full ordered gallery (display_order ASC). The legacy
  // `image_url` field stays in sync with the cover via a DB trigger so older
  // single-image consumers keep working without joining `product_images`.
  images: ProductImagePublic[];
};

export interface ProductDetailResponse {
  product: ProductDetail;
  variants: ProductVariant[];
  reviews: Review[];
  averageRating: number;
  reviewCount: number;
}

export interface ReviewsResponse {
  reviews: Review[];
  averageRating: number;
  reviewCount: number;
}

export type OrderWithItems = Order & {
  items: (OrderItem & { variant: ProductVariant | null })[];
};

export interface OrdersListResponse {
  orders: OrderWithItems[];
}

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    let errMsg: string = `HTTP ${res.status}`;
    if (
      parsed &&
      typeof parsed === "object" &&
      "error" in parsed &&
      typeof (parsed as { error: unknown }).error === "string"
    ) {
      errMsg = (parsed as { error: string }).error;
    }
    throw new Error(errMsg);
  }
  return parsed as T;
}

const jsonHeaders = { "Content-Type": "application/json" } as const;

// ----------------------------------------------------------------------------
// Products
// ----------------------------------------------------------------------------

export interface ProductListQuery {
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
  /** Optional sort. Omitting (or passing `"newest"`) keeps default ordering. */
  sort?: ProductSortKey;
}

export async function fetchProducts(
  query: ProductListQuery = {},
): Promise<ProductListResponse> {
  const params = new URLSearchParams();
  if (query.category) params.set("category", query.category);
  if (query.search) params.set("search", query.search);
  if (typeof query.minPrice === "number")
    params.set("minPrice", String(query.minPrice));
  if (typeof query.maxPrice === "number")
    params.set("maxPrice", String(query.maxPrice));
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  // Only forward a non-default sort so legacy callers stay byte-identical.
  if (query.sort && query.sort !== "newest") params.set("sort", query.sort);

  const qs = params.toString();
  const res = await fetch(`/api/products${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  return parseJson<ProductListResponse>(res);
}

export async function fetchProduct(
  id: string,
): Promise<ProductDetailResponse> {
  const res = await fetch(`/api/products/${id}`, { cache: "no-store" });
  return parseJson<ProductDetailResponse>(res);
}

// ----------------------------------------------------------------------------
// Cart
// ----------------------------------------------------------------------------

export async function fetchCart(): Promise<CartResponse> {
  const res = await fetch(`/api/cart`, { cache: "no-store" });
  return parseJson<CartResponse>(res);
}

export async function addToCart(
  variantId: string,
  quantity: number = 1,
): Promise<CartItem> {
  const res = await fetch(`/api/cart`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ variant_id: variantId, quantity }),
  });
  return parseJson<CartItem>(res);
}

export async function updateCartItem(
  id: string,
  quantity: number,
): Promise<CartItem> {
  const res = await fetch(`/api/cart/${id}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify({ quantity }),
  });
  return parseJson<CartItem>(res);
}

export async function removeCartItem(id: string): Promise<void> {
  const res = await fetch(`/api/cart/${id}`, { method: "DELETE" });
  await parseJson<{ success: true }>(res);
}

// ----------------------------------------------------------------------------
// Wishlist
// ----------------------------------------------------------------------------

export async function fetchWishlist(): Promise<WishlistResponse> {
  const res = await fetch(`/api/wishlist`, { cache: "no-store" });
  return parseJson<WishlistResponse>(res);
}

export async function addToWishlist(productId: string): Promise<Wishlist> {
  const res = await fetch(`/api/wishlist`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ product_id: productId }),
  });
  return parseJson<Wishlist>(res);
}

export async function removeWishlistItem(id: string): Promise<void> {
  const res = await fetch(`/api/wishlist/${id}`, { method: "DELETE" });
  await parseJson<{ success: true }>(res);
}

// ----------------------------------------------------------------------------
// Orders
// ----------------------------------------------------------------------------

export interface CheckoutPayload {
  shipping_address: ShippingAddress;
  coupon_code?: string | null;
}

export interface CreateOrderResponse {
  order: Order;
  coupon: { code: string; discount: number } | null;
  warning?: string;
}

export async function createOrder(
  payload: CheckoutPayload,
): Promise<CreateOrderResponse> {
  const res = await fetch(`/api/orders`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  return parseJson<CreateOrderResponse>(res);
}

export async function fetchOrders(): Promise<OrdersListResponse> {
  const res = await fetch(`/api/orders`, { cache: "no-store" });
  return parseJson<OrdersListResponse>(res);
}

export async function cancelOrder(orderId: string): Promise<{ order: Order }> {
  const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
  return parseJson<{ order: Order }>(res);
}

// ----------------------------------------------------------------------------
// Reviews
// ----------------------------------------------------------------------------

export async function fetchReviews(productId: string): Promise<ReviewsResponse> {
  const res = await fetch(`/api/products/${productId}/reviews`, {
    cache: "no-store",
  });
  return parseJson<ReviewsResponse>(res);
}

export async function postReview(
  productId: string,
  rating: number,
  comment: string | null,
): Promise<Review> {
  const res = await fetch(`/api/products/${productId}/reviews`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ rating, comment }),
  });
  return parseJson<Review>(res);
}
