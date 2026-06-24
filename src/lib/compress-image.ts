/**
 * Client-side image compression using the Canvas API.
 * Resizes and compresses images before upload to reduce storage usage.
 *
 * Usage:
 *   const compressed = await compressImage(file);
 *   // Upload compressed instead of original file
 */

interface CompressOptions {
  /** Max width/height on the longest side. Default 1920. */
  maxDimension?: number;
  /** JPEG quality 0–1. Default 0.8. */
  quality?: number;
  /** Output format. Default 'image/jpeg'. */
  format?: 'image/jpeg' | 'image/webp';
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 1200,
  quality: 0.7,
  format: 'image/webp',
};

/**
 * Compress an image file client-side using Canvas API.
 * Returns a compressed JPEG/WebP Blob (or the original if compression fails).
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<Blob> {
  const { maxDimension, quality, format } = { ...DEFAULTS, ...options };

  // If it's not an image, return as-is
  if (!file.type.startsWith('image/')) return file;

  // Small files — skip compression (threshold lowered to 50KB)
  if (file.size < 50 * 1024) return file;

  // HEIC/HEIF may not decode in Canvas on all browsers — skip
  if (file.type === 'image/heic' || file.type === 'image/heif') return file;

  try {
    const bitmap = await createImageBitmap(file);

    const { width, height } = bitmap;
    const aspectRatio = width / height;

    let newWidth: number;
    let newHeight: number;

    if (width > height) {
      newWidth = Math.min(width, maxDimension);
      newHeight = Math.round(newWidth / aspectRatio);
    } else {
      newHeight = Math.min(height, maxDimension);
      newWidth = Math.round(newHeight * aspectRatio);
    }

    // Don't upscale
    if (newWidth >= width && newHeight >= height) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }

    // Smooth resize
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);

    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b),
        format,
        quality
      );
    });

    canvas.width = 0;
    canvas.height = 0;

    if (!blob) return file;

    // Only return compressed if it's actually smaller
    return blob.size < file.size ? blob : file;
  } catch {
    // If Canvas fails (e.g. tainted canvas), return original
    return file;
  }
}

/**
 * Convert a compressed Blob back into a File with the original name.
 */
export function blobToFile(blob: Blob, original: File): File {
  // Use .jpg extension for JPEG output
  const name = original.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], name, { type: blob.type });
}
