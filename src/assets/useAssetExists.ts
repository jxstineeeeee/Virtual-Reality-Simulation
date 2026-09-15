import { useEffect, useState } from "react";

const cache = new Map<string, boolean>();

/**
 * HEAD-checks whether a public asset exists, caching the result so repeated mounts don't re-fetch.
 * Returns `undefined` while the check is pending — callers should treat that as "not ready" and
 * render their procedural fallback rather than flash content once the real asset resolves.
 */
export function useAssetExists(url: string | undefined): boolean | undefined {
  const [exists, setExists] = useState<boolean | undefined>(() => (url ? cache.get(url) : false));

  useEffect(() => {
    if (!url) {
      setExists(false);
      return;
    }
    if (cache.has(url)) {
      setExists(cache.get(url));
      return;
    }
    let cancelled = false;
    fetch(url, { method: "HEAD" })
      .then((res) => {
        if (cancelled) return;
        // A dev server's SPA fallback (and some static hosts' catch-all routing) returns 200 with
        // `index.html` for *any* unmatched path, extension included — so `res.ok` alone is a false
        // positive. Real static assets never come back as `text/html`.
        const ok = res.ok && !(res.headers.get("content-type") ?? "").includes("text/html");
        cache.set(url, ok);
        setExists(ok);
      })
      .catch(() => {
        if (cancelled) return;
        cache.set(url, false);
        setExists(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return exists;
}
