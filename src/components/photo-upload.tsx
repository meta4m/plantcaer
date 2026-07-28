'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { compressImage, blobToFile } from '@/lib/compress-image';

interface PhotoUploadProps {
  /** Called when a file is selected (but not yet uploaded) */
  onFileSelect: (file: File) => void;
  /** Called to remove the selected file */
  onFileClear: () => void;
  /** The currently selected file preview URL */
  previewUrl: string | null;
  /** Whether an upload is in progress */
  uploading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** The plant name for the upload label */
  plantName?: string;
}

export function PhotoUpload({
  onFileSelect,
  onFileClear,
  previewUrl,
  uploading = false,
  error = null,
  plantName,
}: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        return;
      }
      // Compress large images client-side before upload
      const compressed = await compressImage(file);
      if (compressed !== file) {
        onFileSelect(blobToFile(compressed, file));
      } else {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-stone-600">
        Photo
      </label>

      {previewUrl ? (
        /* Preview */
        <div className="relative rounded-xl overflow-hidden">
          <img
            src={previewUrl}
            alt={plantName ? `Preview of ${plantName}` : 'Plant photo preview'}
            className="w-full h-48 sm:h-64 object-cover rounded-xl"
          />
          <button
            type="button"
            onClick={onFileClear}
            disabled={uploading}
            className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/70 transition-all disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </button>
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
              <div className="flex items-center gap-2 text-white text-sm font-medium">
                <Loader2 className="h-5 w-5 animate-spin" />
                Uploading...
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Upload area */
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all ${
            dragOver
              ? 'border-emerald-400 bg-emerald-50'
              : 'border-stone-200/50 bg-amber-50/30 hover:border-stone-300/50 hover:bg-amber-50/60'
          }`}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            {dragOver ? (
              <Upload className="h-8 w-8 text-emerald-400" />
            ) : (
              <Camera className="h-8 w-8 text-stone-400" />
            )}
            <div>
              <p className="text-sm font-medium text-stone-600">
                {dragOver ? 'Drop photo here' : 'Upload a photo'}
              </p>
              <p className="text-xs text-stone-400 mt-1">
                Tap to browse or drag & drop
              </p>
              <p className="text-xs text-stone-400 mt-1">
                JPEG, PNG, or WebP · Max 20MB · Auto-compressed
              </p>
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            capture="environment"
            onChange={handleChange}
            className="hidden"
          />
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
