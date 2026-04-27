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
    product: Pick<Product, "id" | "name" | "price" | "image_url" | "category">;
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

export interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ProductDetailResponse {
  product: Product;
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
