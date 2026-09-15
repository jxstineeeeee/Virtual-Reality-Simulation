/** Resolves a `public/` path (e.g. "/video/clip.webm") against Vite's base URL, so assets load both
 * from the dev server root and from a sub-path deployment such as GitHub Pages. */
export function publicAsset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}
