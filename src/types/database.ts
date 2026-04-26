/**
 * Database type definitions for the FC Barcelona Fan Portal.
 *
 * Hand-written, kept in sync with `supabase/migrations/002_schema.sql`.
 * The `Database` generic mirrors the structure produced by
 * `supabase gen types typescript`, so the Supabase JS client receives
 * full type inference for table queries.
 */

// ----------------------------------------------------------------------------
// Enums / unions
// ----------------------------------------------------------------------------

export type UserRole = 'user' | 'admin'
export type OrderStatus = 'processing' | 'shipped' | 'delivered' | 'cancelled'
export type DiscountType = 'percentage' | 'fixed' | 'free_shipping'
export type ReactionTarget = 'post' | 'comment'

// ----------------------------------------------------------------------------
// Shared JSON helper (matches Supabase's generated types)
// ----------------------------------------------------------------------------

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ----------------------------------------------------------------------------
// Row interfaces (one per table)
// ----------------------------------------------------------------------------

export interface Profile {
  id: string
  email: string
  username: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
}

export interface Article {
  id: string
  title: string
  content: string
  category: string | null
  image_url: string | null
  author_id: string | null
  created_at: string
  updated_at: string
}

export interface Player {
  id: string
  api_football_id: number | null
  name: string
  position: string | null
  number: number | null
  image_url: string | null
  bio: string | null
  stats: Json
  season: number | null
  updated_at: string
}

export interface Product {
  id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  category: string | null
  created_at: string
}

export interface ProductVariant {
  id: string
  product_id: string
  size: string | null
  color: string | null
  stock: number
}

export interface CartItem {
  id: string
  user_id: string
  variant_id: string
  quantity: number
  created_at: string
}

export interface ShippingAddress {
  full_name: string
  country: string
  city: string
  postal_code: string
  street: string
  phone?: string
}

export interface Order {
  id: string
  user_id: string
  total_price: number
  status: OrderStatus
  shipping_address: ShippingAddress | null
  coupon_id: string | null
  created_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  variant_id: string
  quantity: number
  unit_price: number
}

export interface Review {
  id: string
  product_id: string
  user_id: string
  rating: number
  comment: string | null
  is_visible: boolean
  created_at: string
}

export interface Wishlist {
  id: string
  user_id: string
  product_id: string
  created_at: string
}

export interface Match {
  id: string
  api_football_id: number | null
  home_team: string
  away_team: string
  date: string
  venue: string | null
  status: string | null
}

export interface MatchSector {
  id: string
  match_id: string
  sector_name: string
  total_seats: number
  sold_seats: number
  price: number
}

export interface Ticket {
  id: string
  user_id: string
  sector_id: string
  seat_number: number
  purchased_at: string
}

export interface Post {
  id: string
  author_id: string
  content: string
  image_url: string | null
  created_at: string
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
}

export interface Reaction {
  id: string
  user_id: string
  target_type: ReactionTarget
  target_id: string
  emoji: string
  created_at: string
}

export interface PollOption {
  label: string
  // Free-form metadata (e.g. score predictions). Kept open by design.
  [key: string]: Json | undefined
}

export interface Poll {
  id: string
  question: string
  options: PollOption[]
  correct_option: number | null
  is_active: boolean
  match_id: string | null
  created_at: string
}

export interface Vote {
  id: string
  poll_id: string
  user_id: string
  selected_option: number
  created_at: string
}

export interface UserPoints {
  id: string
  user_id: string
  balance: number
  total_earned: number
}

export interface PointTransaction {
  id: string
  user_id: string
  amount: number
  reason: string
  poll_id: string | null
  created_at: string
}

export interface Coupon {
  id: string
  name: string
  description: string | null
  discount_type: DiscountType
  discount_value: number
  point_cost: number
  is_active: boolean
}

export interface RedeemedCoupon {
  id: string
  user_id: string
  coupon_id: string
  code: string
  is_used: boolean
  redeemed_at: string
}

export interface PageView {
  id: string
  user_id: string | null
  page_path: string
  product_id: string | null
  cookie_id: string | null
  created_at: string
}

export interface CookieConsent {
  id: string
  cookie_id: string
  consented: boolean
  created_at: string
}

// ----------------------------------------------------------------------------
// Supabase Database generic
// ----------------------------------------------------------------------------

/**
 * Per-table shape: Row (returned by SELECT), Insert (accepted by INSERT),
 * Update (accepted by UPDATE).
 *
 * Insert types make server-defaulted columns optional; Update types make
 * everything optional.
 */
type Row<T> = { Row: T; Insert: Partial<T> & Omit<T, OptionalOnInsert<T>>; Update: Partial<T> }
// We use `Partial<T>` for Insert and let callers supply only the required
// columns. This keeps the type definitions lightweight without losing safety.
type OptionalOnInsert<T> = never & T

export interface Database {
  public: {
    Tables: {
      profiles:           { Row: Profile;          Insert: ProfileInsert;          Update: Partial<Profile> }
      articles:           { Row: Article;          Insert: ArticleInsert;          Update: Partial<Article> }
      players:            { Row: Player;           Insert: PlayerInsert;           Update: Partial<Player> }
      products:           { Row: Product;          Insert: ProductInsert;          Update: Partial<Product> }
      product_variants:   { Row: ProductVariant;   Insert: ProductVariantInsert;   Update: Partial<ProductVariant> }
      cart_items:         { Row: CartItem;         Insert: CartItemInsert;         Update: Partial<CartItem> }
      orders:             { Row: Order;            Insert: OrderInsert;            Update: Partial<Order> }
      order_items:        { Row: OrderItem;        Insert: OrderItemInsert;        Update: Partial<OrderItem> }
      reviews:            { Row: Review;           Insert: ReviewInsert;           Update: Partial<Review> }
      wishlist:           { Row: Wishlist;         Insert: WishlistInsert;         Update: Partial<Wishlist> }
      matches:            { Row: Match;            Insert: MatchInsert;            Update: Partial<Match> }
      match_sectors:      { Row: MatchSector;      Insert: MatchSectorInsert;      Update: Partial<MatchSector> }
      tickets:            { Row: Ticket;           Insert: TicketInsert;           Update: Partial<Ticket> }
      posts:              { Row: Post;             Insert: PostInsert;             Update: Partial<Post> }
      comments:           { Row: Comment;          Insert: CommentInsert;          Update: Partial<Comment> }
      reactions:          { Row: Reaction;         Insert: ReactionInsert;         Update: Partial<Reaction> }
      polls:              { Row: Poll;             Insert: PollInsert;             Update: Partial<Poll> }
      votes:              { Row: Vote;             Insert: VoteInsert;             Update: Partial<Vote> }
      user_points:        { Row: UserPoints;       Insert: UserPointsInsert;       Update: Partial<UserPoints> }
      point_transactions: { Row: PointTransaction; Insert: PointTransactionInsert; Update: Partial<PointTransaction> }
      coupons:            { Row: Coupon;           Insert: CouponInsert;           Update: Partial<Coupon> }
      redeemed_coupons:   { Row: RedeemedCoupon;   Insert: RedeemedCouponInsert;   Update: Partial<RedeemedCoupon> }
      page_views:         { Row: PageView;         Insert: PageViewInsert;         Update: Partial<PageView> }
      cookie_consents:    { Row: CookieConsent;    Insert: CookieConsentInsert;    Update: Partial<CookieConsent> }
    }
    Views: Record<string, never>
    Functions: {
      purchase_tickets: {
        Args: {
          p_user_id: string
          p_sector_id: string
          p_quantity: number
        }
        Returns: Json
      }
      resolve_poll: {
        Args: {
          p_poll_id: string
          p_correct_option: number
        }
        Returns: Json
      }
      redeem_coupon: {
        Args: {
          p_user_id: string
          p_coupon_id: string
        }
        Returns: Json
      }
      apply_coupon_to_order: {
        Args: {
          p_order_id: string
          p_user_id: string
          p_code: string
        }
        Returns: Json
      }
      consume_coupon: {
        Args: {
          p_user_id: string
          p_code: string
        }
        Returns: Json
      }
    }
    Enums: Record<string, never>
  }
}

// ----------------------------------------------------------------------------
// Insert types — server-defaulted columns are optional.
// ----------------------------------------------------------------------------

export type ProfileInsert = Omit<Profile, 'created_at' | 'role'> & {
  role?: UserRole
  created_at?: string
}

export type ArticleInsert = Omit<Article, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type PlayerInsert = Omit<Player, 'id' | 'updated_at' | 'stats'> & {
  id?: string
  updated_at?: string
  stats?: Json
}

export type ProductInsert = Omit<Product, 'id' | 'created_at'> & {
  id?: string
  created_at?: string
}

export type ProductVariantInsert = Omit<ProductVariant, 'id' | 'stock'> & {
  id?: string
  stock?: number
}

export type CartItemInsert = Omit<CartItem, 'id' | 'created_at'> & {
  id?: string
  created_at?: string
}

export type OrderInsert = Omit<Order, 'id' | 'created_at' | 'status'> & {
  id?: string
  created_at?: string
  status?: OrderStatus
}

export type OrderItemInsert = Omit<OrderItem, 'id'> & { id?: string }

export type ReviewInsert = Omit<Review, 'id' | 'created_at' | 'is_visible'> & {
  id?: string
  created_at?: string
  is_visible?: boolean
}

export type WishlistInsert = Omit<Wishlist, 'id' | 'created_at'> & {
  id?: string
  created_at?: string
}

export type MatchInsert = Omit<Match, 'id'> & { id?: string }

export type MatchSectorInsert = Omit<MatchSector, 'id' | 'sold_seats'> & {
  id?: string
  sold_seats?: number
}

export type TicketInsert = Omit<Ticket, 'id' | 'purchased_at'> & {
  id?: string
  purchased_at?: string
}

export type PostInsert = Omit<Post, 'id' | 'created_at'> & {
  id?: string
  created_at?: string
}

export type CommentInsert = Omit<Comment, 'id' | 'created_at'> & {
  id?: string
  created_at?: string
}

export type ReactionInsert = Omit<Reaction, 'id' | 'created_at'> & {
  id?: string
  created_at?: string
}

export type PollInsert = Omit<Poll, 'id' | 'created_at' | 'is_active'> & {
  id?: string
  created_at?: string
  is_active?: boolean
}

export type VoteInsert = Omit<Vote, 'id' | 'created_at'> & {
  id?: string
  created_at?: string
}

export type UserPointsInsert = Omit<UserPoints, 'id' | 'balance' | 'total_earned'> & {
  id?: string
  balance?: number
  total_earned?: number
}

export type PointTransactionInsert = Omit<PointTransaction, 'id' | 'created_at'> & {
  id?: string
  created_at?: string
}

export type CouponInsert = Omit<Coupon, 'id' | 'is_active'> & {
  id?: string
  is_active?: boolean
}

export type RedeemedCouponInsert = Omit<RedeemedCoupon, 'id' | 'is_used' | 'redeemed_at'> & {
  id?: string
  is_used?: boolean
  redeemed_at?: string
}

export type PageViewInsert = Omit<PageView, 'id' | 'created_at'> & {
  id?: string
  created_at?: string
}

export type CookieConsentInsert = Omit<CookieConsent, 'id' | 'created_at'> & {
  id?: string
  created_at?: string
}

// ----------------------------------------------------------------------------
// Convenience aliases (mirror the supabase-js generated helpers)
// ----------------------------------------------------------------------------

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
