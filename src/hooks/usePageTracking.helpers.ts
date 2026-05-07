/**
 * Pure helper for the {@link usePageTracking} hook. Extracted so the URL
 * parsing logic can be unit-tested without React or Next.js navigation.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRODUCT_PATH_RE = /^\/shop\/([^/?#]+)/i;

export function extractProductId(pathname: string): string | null {
  const match = pathname.match(PRODUCT_PATH_RE);
  if (!match) return null;
  const candidate = match[1];
  if (!UUID_RE.test(candidate)) return null;
  return candidate.toLowerCase();
}
