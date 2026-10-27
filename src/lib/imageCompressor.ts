export interface CompressOptions {
  maxDimension?: number; // Maximum width or height in px (default: 1400)
  quality?: number;      // Compression quality 0.0 - 1.0 (default: 0.82)
  mimeType?: string;     // Target mime type (default: 'image/jpeg')
}

/**
 * Automatically compresses an image File or Blob before uploading.
 * Drastically reduces upload payload (e.g. 10MB phone photos -> ~150KB-250KB)
 * while preserving high visual quality on mobile and desktop screens.
 */
export async function compressImageFile(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  // Pass non-images or SVGs through without changes
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file;
  }

  // Already tiny (under 120KB) - no need to re-encode
  if (file.size <= 120 * 1024) {
    return file;
  }

  const maxDim = options.maxDimension || 1400;
  const quality = options.quality ?? 0.82;
  const outMime = options.mimeType || 'image/jpeg';

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Resize proportionally if dimensions exceed max
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              return resolve(file);
            }
            const cleanName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
            const compressedFile = new File([blob], cleanName, {
              type: outMime,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          outMime,
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}
