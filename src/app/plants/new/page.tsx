'use client';

import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { slugify, LIGHT_REQUIREMENT_LABELS, type LightRequirement } from '@/lib/types';
import { PhotoUpload } from '@/components/photo-upload';
import { uploadPlantPhoto } from '@/lib/storage';
import { AiSuggestionOverlay, AiIdentifyButton, AiNicknameButton } from '@/components/ai-suggestion-overlay';
import { Loader2 } from 'lucide-react';
import type { AiPlantSuggestion } from '@/lib/ai/types';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AddPlantPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true); // default is enabled (preset default always works)

  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // AI overlay state
  const [showAiOverlay, setShowAiOverlay] = useState(false);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [aiAppliedWarning, setAiAppliedWarning] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    common_name: '',
    scientific_name: '',
    nickname: '',
    species: '',
    location: '',
    adopted_at: '',
    light_requirement: '' as LightRequirement | '',
    min_temp: '',
    max_temp: '',
    humidity_min: '',
    notes: '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // AI can work with photo OR with just a plant name
  const canUseAi = aiEnabled && (!!selectedPhoto || formData.common_name.trim().length > 0);

  const handlePhotoSelect = async (file: File) => {
    setSelectedPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoError(null);
    setShowAiOverlay(false);

    // Pre-convert to base64 for AI
    const base64 = await fileToBase64(file);
    setPhotoBase64(base64);
  };

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handlePhotoClear = () => {
    setSelectedPhoto(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setPhotoBase64(null);
    setPhotoError(null);
  };

  const handleOpenAiOverlay = () => {
    setShowAiOverlay(true);
  };

  const [aiCareTasks, setAiCareTasks] = useState<AiPlantSuggestion['care_tasks'] | null>(null);

  const handleAcceptSuggestion = useCallback((suggestion: AiPlantSuggestion) => {
    setFormData((prev) => ({
      common_name: suggestion.common_name || prev.common_name,
      scientific_name: suggestion.scientific_name || '',
      nickname: prev.nickname, // Keep existing nickname
      species: '',
      location: prev.location,
      adopted_at: prev.adopted_at,
      light_requirement: suggestion.light_requirement || '',
      min_temp: suggestion.min_temp ? String(suggestion.min_temp) : '',
      max_temp: suggestion.max_temp ? String(suggestion.max_temp) : '',
      humidity_min: suggestion.humidity_min ? String(suggestion.humidity_min) : '',
      notes: suggestion.notes || '',
    }));

    setShowAiOverlay(false);
    setAiAppliedWarning('AI suggestions applied! Review the fields below. You can verify details using the links shown in the popup.');
    setTimeout(() => setAiAppliedWarning(null), 6000);

    // If AI provided care tasks, store them for submission
    if (suggestion.care_tasks && suggestion.care_tasks.length > 0) {
      setAiCareTasks(suggestion.care_tasks);
    }
  }, []);

  const handleNicknameGenerated = useCallback((nickname: string) => {
    handleChange('nickname', nickname);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const baseSlug = slugify(formData.common_name);
      const slug = `${baseSlug}-${Date.now().toString(36)}`;

      const payload = {
        owner_id: user.id,
        slug,
        common_name: formData.common_name,
        scientific_name: formData.scientific_name || null,
        nickname: formData.nickname || null,
        species: formData.species || null,
        location: formData.location || null,
        adopted_at: formData.adopted_at || null,
        light_requirement: (formData.light_requirement as LightRequirement) || null,
        min_temp: formData.min_temp ? parseFloat(formData.min_temp) : null,
        max_temp: formData.max_temp ? parseFloat(formData.max_temp) : null,
        humidity_min: formData.humidity_min ? parseInt(formData.humidity_min) : null,
        notes: formData.notes || null,
      };

      const { data: plant, error: insertError } = await supabase
        .from('plants')
        .insert(payload)
        .select()
        .single();

      if (insertError) throw insertError;

      // Upload photo if one was selected
      if (selectedPhoto && plant) {
        setPhotoUploading(true);
        const result = await uploadPlantPhoto(supabase, selectedPhoto, plant.id, user.id);
        if (result.error) {
          setPhotoError(result.error);
        } else {
          await supabase.from('plant_photos').insert({
            plant_id: plant.id,
            url: result.url,
            is_primary: true,
          });
        }
        setPhotoUploading(false);
      }

      // If AI provided care tasks, create them
      if (aiCareTasks && aiCareTasks.length > 0 && plant) {
        for (const task of aiCareTasks) {
          await supabase.from('care_tasks').insert({
            plant_id: plant.id,
            task_type: task.task_type,
            frequency_days: task.frequency_days || 7,
            amount: task.amount || null,
            notes: task.notes || null,
            is_active: true,
          });
        }
      }

      router.push(`/plant/${plant.slug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create plant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 sm:text-3xl">Add a Plant</h1>
          <p className="mt-1 text-stone-500">Add a new plant to your collection.</p>
        </div>
        {/* AI Identify button in the header */}
        <AiIdentifyButton
          enabled={canUseAi}
          loading={false}
          onClick={handleOpenAiOverlay}
        />
      </div>

      <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200/50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {aiAppliedWarning && (
          <div className="rounded-xl bg-amber-50 border border-amber-200/50 px-4 py-3 text-sm text-amber-700">
            {aiAppliedWarning}
          </div>
        )}

        {/* Photo upload */}
        <div className="space-y-3">
          <PhotoUpload
            onFileSelect={handlePhotoSelect}
            onFileClear={handlePhotoClear}
            previewUrl={photoPreview}
            uploading={photoUploading}
            error={photoError}
            plantName={formData.common_name || undefined}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-stone-600 mb-1.5">
              Common Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.common_name}
              onChange={(e) => handleChange('common_name', e.target.value)}
              placeholder="e.g. Monstera Deliciosa"
              required
              className="w-full rounded-xl border border-stone-200/50 bg-white/80 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1.5">Scientific Name</label>
            <input
              type="text"
              value={formData.scientific_name}
              onChange={(e) => handleChange('scientific_name', e.target.value)}
              placeholder="e.g. Monstera deliciosa"
              className="w-full rounded-xl border border-stone-200/50 bg-white/80 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1.5">Nickname</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.nickname}
                onChange={(e) => handleChange('nickname', e.target.value)}
                placeholder="e.g. Big Mama"
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all"
              />
              <AiNicknameButton
                enabled={aiEnabled && !!formData.common_name}
                plantName={formData.common_name || formData.scientific_name}
                onGenerated={handleNicknameGenerated}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1.5">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="e.g. Living room window"
              className="w-full rounded-xl border border-stone-200/50 bg-white/80 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1.5">Adoption Date</label>
            <input
              type="date"
              value={formData.adopted_at}
              onChange={(e) => handleChange('adopted_at', e.target.value)}
              className="w-full rounded-xl border border-stone-200/50 bg-white/80 px-4 py-2.5 text-sm text-stone-900 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1.5">Light Requirement</label>
            <select
              value={formData.light_requirement}
              onChange={(e) => handleChange('light_requirement', e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all"
            >
              <option value="" className="bg-white">Select...</option>
              {(Object.entries(LIGHT_REQUIREMENT_LABELS) as [LightRequirement, string][]).map(
                ([key, label]) => (
                  <option key={key} value={key} className="bg-white">
                    {label}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1.5">Min Temp (°C)</label>
            <input
              type="number"
              value={formData.min_temp}
              onChange={(e) => handleChange('min_temp', e.target.value)}
              placeholder="e.g. 15"
              className="w-full rounded-xl border border-stone-200/50 bg-white/80 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1.5">Max Temp (°C)</label>
            <input
              type="number"
              value={formData.max_temp}
              onChange={(e) => handleChange('max_temp', e.target.value)}
              placeholder="e.g. 30"
              className="w-full rounded-xl border border-stone-200/50 bg-white/80 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1.5">
              Min Humidity (%)
            </label>
            <input
              type="number"
              value={formData.humidity_min}
              onChange={(e) => handleChange('humidity_min', e.target.value)}
              placeholder="e.g. 60"
              min={0}
              max={100}
              className="w-full rounded-xl border border-stone-200/50 bg-white/80 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-stone-600 mb-1.5">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Any additional notes about this plant..."
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border border-stone-200/50 px-6 py-2.5 text-sm font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-100/50 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !formData.common_name}
            className="flex-1 sm:flex-none rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Adding...
              </span>
            ) : (
              'Add Plant'
            )}
          </button>
        </div>
      </form>

      {/* AI Suggestion Overlay */}
      {showAiOverlay && (
        <AiSuggestionOverlay
          photoBase64={photoBase64}
          photoMimeType={selectedPhoto?.type ?? null}
          plantName={formData.common_name.trim()}
          onAccept={handleAcceptSuggestion}
          onDismiss={() => setShowAiOverlay(false)}
          aiEnabled={aiEnabled}
        />
      )}
    </div>
  );
}
