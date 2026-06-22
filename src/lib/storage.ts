/**
 * Supabase Storage helpers for plant photos.
 * Handles upload, deletion, and URL management.
 */

const BUCKET = 'plant-photos';

/**
 * Upload a plant photo to Supabase Storage.
 * @param file - The image file to upload
 * @param plantId - The plant's UUID
 * @param userId - The authenticated user's ID
 * @returns The public URL of the uploaded photo
 */
export async function uploadPlantPhoto(
  supabase: ReturnType<typeof import('./supabase')['createClient']>,
  file: File,
  plantId: string,
  userId: string
): Promise<{ url: string; error: null } | { url: null; error: string }> {
  // Validate file
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  if (!allowedTypes.includes(file.type)) {
    return { url: null, error: `Unsupported file type: ${file.type}. Use JPEG, PNG, or WebP.` };
  }

  if (file.size > 20 * 1024 * 1024) {
    return { url: null, error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 20MB.` };
  }

  // Generate a unique file path: {plantId}/{timestamp}-{random}.{ext}
  const ext = file.name.split('.').pop() || 'jpg';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const filePath = `${plantId}/${timestamp}-${random}.${ext}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) {
    return { url: null, error: `Upload failed: ${error.message}` };
  }

  // Get the public URL
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return { url: urlData.publicUrl, error: null };
}

/**
 * Delete a plant photo from Supabase Storage.
 */
export async function deletePlantPhoto(
  supabase: ReturnType<typeof import('./supabase')['createClient']>,
  url: string
): Promise<{ error: string | null }> {
  // Extract the file path from the URL
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    // The path is after the bucket name in the URL
    // URL format: /storage/v1/object/public/plant-photos/{plantId}/{filename}
    const bucketIndex = pathParts.indexOf(BUCKET);
    if (bucketIndex === -1) {
      return { error: 'Could not parse file path from URL' };
    }
    const filePath = pathParts.slice(bucketIndex + 1).join('/');

    const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
    if (error) return { error: `Delete failed: ${error.message}` };
    return { error: null };
  } catch {
    return { error: 'Invalid URL format' };
  }
}

/**
 * Get a thumbnail-friendly URL (adds transform params if supported).
 * For now returns the public URL directly — Supabase Storage
 * image transformation is a Pro plan feature.
 */
export function getPhotoUrl(url: string): string {
  return url;
}
