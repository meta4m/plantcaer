'use client';

import { useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, X, Star, Trash2, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { uploadPlantPhoto, deletePlantPhoto } from '@/lib/storage';
import { compressImage, blobToFile } from '@/lib/compress-image';
import type { PlantPhoto } from '@/lib/types';

interface PhotoGalleryProps {
  plantId: string;
  photos: PlantPhoto[];
  onPhotosChanged: () => void;
}

export function PhotoGallery({ plantId, photos, onPhotosChanged }: PhotoGalleryProps) {
  const supabase = createClient();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Compress large images client-side before upload
      const compressed = await compressImage(file);
      const uploadFile = compressed !== file ? blobToFile(compressed, file) : file;

      // Upload to storage
      const result = await uploadPlantPhoto(supabase, uploadFile, plantId, user.id);
      if (result.error) {
        setUploadError(result.error);
        return;
      }

      // If this is the first photo, set as primary
      const isPrimary = photos.length === 0;

      // Save reference in plant_photos table
      const { error: insertError } = await supabase
        .from('plant_photos')
        .insert({
          plant_id: plantId,
          url: result.url,
          is_primary: isPrimary,
        });

      if (insertError) {
        setUploadError(`Failed to save photo: ${insertError.message}`);
        return;
      }

      onPhotosChanged();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      // Reset the input so the same file can be selected again
      e.target.value = '';
    }
  };

  const handleSetPrimary = async (photoId: string) => {
    try {
      // Unset all primary
      await supabase
        .from('plant_photos')
        .update({ is_primary: false })
        .eq('plant_id', plantId);

      // Set the selected one as primary
      await supabase
        .from('plant_photos')
        .update({ is_primary: true })
        .eq('id', photoId);

      onPhotosChanged();
    } catch (err) {
      console.error('Failed to set primary photo:', err);
    }
  };

  const handleDelete = async (photo: PlantPhoto) => {
    setDeletingId(photo.id);
    try {
      // Delete from storage
      await deletePlantPhoto(supabase, photo.url);

      // Delete from database
      await supabase
        .from('plant_photos')
        .delete()
        .eq('id', photo.id);

      // If the deleted photo was primary and there are other photos, make the first one primary
      if (photo.is_primary && photos.length > 1) {
        const remaining = photos.filter(p => p.id !== photo.id);
        await supabase
          .from('plant_photos')
          .update({ is_primary: true })
          .eq('id', remaining[0].id);
      }

      onPhotosChanged();
    } catch (err) {
      console.error('Failed to delete photo:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const sortedPhotos = [...photos].sort((a, b) => {
    // Primary first, then by upload date
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">
          Photos
          {photos.length > 0 && (
            <span className="text-sm font-normal text-white/40 ml-2">
              ({photos.length})
            </span>
          )}
        </h2>
        <label className="cursor-pointer">
          <div className="glass-card rounded-xl px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5">
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            {uploading ? 'Uploading...' : 'Add Photo'}
          </div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            capture="environment"
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />
        </label>
      </div>

      {uploadError && (
        <p className="text-xs text-red-400 mb-3">{uploadError}</p>
      )}

      {photos.length === 0 ? (
        <div className="glass-card rounded-2xl p-6 text-center">
          <Camera className="h-8 w-8 mx-auto text-white/20 mb-2" />
          <p className="text-sm text-white/30">No photos yet</p>
          <p className="text-xs text-white/20 mt-1">
            Add photos to track your plant&apos;s growth over time
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {sortedPhotos.map((photo) => (
            <div
              key={photo.id}
              className="relative group rounded-xl overflow-hidden aspect-square cursor-pointer"
              onClick={() => setLightboxIndex(sortedPhotos.indexOf(photo))}
            >
              <img
                src={photo.url}
                alt="Plant"
                className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span className="text-white text-xs font-medium">Tap to view</span>
              </div>

              {/* Badges */}
              <div className="absolute top-2 left-2 flex gap-1">
                {photo.is_primary && (
                  <span className="bg-emerald-500/80 backdrop-blur-sm text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                    <Star className="h-2.5 w-2.5" />
                    Primary
                  </span>
                )}
              </div>

              {/* Actions (visible on hover) */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                {!photo.is_primary && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetPrimary(photo.id);
                    }}
                    className="rounded-full bg-black/60 p-1.5 text-white/80 hover:text-yellow-400 hover:bg-black/80 transition-all"
                    title="Set as primary"
                  >
                    <Star className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(photo);
                  }}
                  disabled={deletingId === photo.id}
                  className="rounded-full bg-black/60 p-1.5 text-white/80 hover:text-red-400 hover:bg-black/80 transition-all disabled:opacity-50"
                  title="Delete photo"
                >
                  {deletingId === photo.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              </div>

              {/* Upload date */}
              <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-all">
                <span className="text-[10px] text-white/60 bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-md">
                  {new Date(photo.uploaded_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-all"
          >
            <X className="h-6 w-6" />
          </button>

          {sortedPhotos.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((lightboxIndex - 1 + sortedPhotos.length) % sortedPhotos.length);
                }}
                className="absolute left-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 transition-all"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((lightboxIndex + 1) % sortedPhotos.length);
                }}
                className="absolute right-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 transition-all"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <img
            src={sortedPhotos[lightboxIndex].url}
            alt="Plant photo"
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />

          <div className="absolute bottom-4 text-center">
            <p className="text-sm text-white/60">
              {lightboxIndex + 1} / {sortedPhotos.length}
              {sortedPhotos[lightboxIndex].is_primary && (
                <span className="ml-2 text-emerald-400">★ Primary</span>
              )}
            </p>
            <p className="text-xs text-white/30 mt-1">
              {new Date(sortedPhotos[lightboxIndex].uploaded_at).toLocaleDateString(undefined, {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
