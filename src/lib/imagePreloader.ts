/**
 * Global Image Memory Cache & Background Preloader
 * Ensures contest posters, cashback campaign banners, and event images
 * are loaded into memory ahead of time so page transitions feel firm and instantaneous.
 */

const IMAGE_LOADED_CACHE = new Set<string>();
const ACTIVE_PRELOADS = new Map<string, HTMLImageElement>();

export function isImageLoaded(url: string | null | undefined): boolean {
  if (!url) return false;
  return IMAGE_LOADED_CACHE.has(url);
}

export function markImageLoaded(url: string | null | undefined): void {
  if (!url) return;
  IMAGE_LOADED_CACHE.add(url);
}

export function preloadImage(url: string | null | undefined): Promise<void> {
  if (!url || typeof url !== 'string' || IMAGE_LOADED_CACHE.has(url) || ACTIVE_PRELOADS.has(url)) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        IMAGE_LOADED_CACHE.add(url);
        ACTIVE_PRELOADS.set(url, img);
        resolve();
      };
      img.onerror = () => {
        ACTIVE_PRELOADS.delete(url);
        resolve();
      };
      img.src = url;
      ACTIVE_PRELOADS.set(url, img);
    } catch {
      resolve();
    }
  });
}

export function preloadImages(urls: (string | null | undefined)[]): void {
  const validUrls = Array.from(
    new Set(
      urls.filter(
        (u): u is string =>
          Boolean(u && typeof u === 'string' && (u.startsWith('http') || u.startsWith('/')))
      )
    )
  );

  if (validUrls.length === 0) return;

  const schedulePreload = () => {
    validUrls.forEach((url) => {
      preloadImage(url);
    });
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as any).requestIdleCallback(schedulePreload, { timeout: 2000 });
  } else {
    setTimeout(schedulePreload, 100);
  }
}
