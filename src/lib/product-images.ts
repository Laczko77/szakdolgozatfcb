import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, ProductImage } from '@/types/database'

/**
 * Helpers for resolving product image galleries on the public API.
 *
 * The cover image is also mirrored into `products.image_url` (kept in sync by
 * a DB trigger), so list endpoints can avoid joining `product_images` if they
 * only need the cover. The detail endpoint fetches the full ordered gallery.
 */

export const MAX_IMAGES_PER_PRODUCT = 10

/**
 * Public-facing image shape returned by the API. Smaller than the DB row —
 * `product_id` and `created_at` are intentionally omitted because the caller
 * always knows which product the gallery belongs to.
 */
export type ProductImagePublic = {
  id: string
  image_url: string
  display_order: number
  is_cover: boolean
}

export function toPublicImage(row: ProductImage): ProductImagePublic {
  return {
    id: row.id,
    image_url: row.image_url,
    display_order: row.display_order,
    is_cover: row.is_cover,
  }
}

/**
 * Fetch the cover image only for a set of products. Returns a map keyed by
 * product_id. Products without any image_row simply don't appear in the map.
 */
export async function fetchCoverImagesByProductIds(
  supabase: SupabaseClient<Database>,
  productIds: string[]
): Promise<Map<string, ProductImagePublic>> {
  const result = new Map<string, ProductImagePublic>()
  if (productIds.length === 0) return result

  const { data, error } = await supabase
    .from('product_images')
    .select('id, product_id, image_url, display_order, is_cover')
    .in('product_id', productIds)
    .eq('is_cover', true)

  if (error) {
    throw new Error(`Cover images lekérése sikertelen: ${error.message}`)
  }

  for (const row of (data ?? []) as Array<
    Pick<
      ProductImage,
      'id' | 'product_id' | 'image_url' | 'display_order' | 'is_cover'
    >
  >) {
    result.set(row.product_id, {
      id: row.id,
      image_url: row.image_url,
      display_order: row.display_order,
      is_cover: row.is_cover,
    })
  }

  return result
}

/**
 * Fetch the full ordered gallery for a single product.
 */
export async function fetchProductGallery(
  supabase: SupabaseClient<Database>,
  productId: string
): Promise<ProductImagePublic[]> {
  const { data, error } = await supabase
    .from('product_images')
    .select('id, image_url, display_order, is_cover')
    .eq('product_id', productId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Termékképek lekérése sikertelen: ${error.message}`)
  }

  return (data ?? []) as ProductImagePublic[]
}
