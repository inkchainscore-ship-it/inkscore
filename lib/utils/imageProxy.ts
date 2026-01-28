/**
 * Generates a proxied image URL to avoid CORS issues
 * @param url - The original image URL
 * @returns Proxied URL through our API route
 */
export function getProxiedImageUrl(url: string | undefined | null): string {
  if (!url) {
    return '';
  }

  // If it's already a relative URL or data URL, return as-is
  if (url.startsWith('/') || url.startsWith('data:')) {
    return url;
  }

  // Proxy external URLs through our API route
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

/**
 * Generates a fallback avatar URL
 * @param name - Name to generate avatar for
 * @param size - Size of the avatar (default: 32)
 * @returns Avatar URL
 */
export function getFallbackAvatarUrl(name: string, size: number = 32): string {
  const initial = name.charAt(0).toUpperCase();
  return `https://ui-avatars.com/api/?name=${initial}&background=334155&color=94a3b8&size=${size}`;
}
