'use client';

import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { slugify, LIGHT_REQUIREMENT_LABELS, type LightRequirement } from '@/lib/types';
import { PhotoUpload } from '@/components/photo-upload';
import { uploadPlantPhoto } from '@/lib/storage';
import { identifyPlantAction } from '@/app/actions/identify-plant';
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { AiPlantSuggestion } from '@/lib/ai/types';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:image/...;base64, prefix
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

  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // AI identify states
  const [aiIdentifying, setAiIdentifying] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiPlantSuggestion | null>(null);
  const [aiApplied, setAiApplied] = useState(false);

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

  const handlePhotoSelect = (file: File) => {
    setSelectedPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoError(null);
    setAiResult(null);
    setAiApplied(false);
    setAiError(null);
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
    setPhotoError(null);
    setAiResult(null);
    setAiApplied(false);
    setAiError(null);
  };

  const handleAiIdentify = useCallback(async () => {
    if (!selectedPhoto) return;

    setAiIdentifying(true);
    setAiError(null);
    setAiResult(null);

    try {
      const base64 = await fileToBase64(selectedPhoto);
      const result = await identifyPlantAction(base64, selectedPhoto.type);

      if (result.error) {
        setAiError(result.error);
        return;
      }

      if (!result.data) {
        setAiError('AI returned no data. Please try again.');
        return;
      }

      setAiResult(result.data);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to identify plant');
    } finally {
      setAiIdentifying(false);
    }
  }, [selectedPhoto]);

  const applyAiSuggestion = useCallback(() => {
    if (!aiResult) return;

    setFormData({
      common_name: aiResult.common_name || '',
      scientific_name: aiResult.scientific_name || '',
      nickname: '',
      species: '',
      location: '',
      adopted_at: formData.adopted_at,
      light_requirement: aiResult.light_requirement || '',
      min_temp: aiResult.min_temp ? String(aiResult.min_temp) : '',
      max_temp: aiResult.max_temp ? String(aiResult.max_temp) : '',
      humidity_min: aiResult.humidity_min ? String(aiResult.humidity_min) : '',
      notes: aiResult.notes || '',
    });

    setAiApplied(true);
  }, [aiResult, formData.adopted_at]);

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
      if (aiResult?.care_tasks && aiResult.care_tasks.length > 0 && plant) {
        for (const task of aiResult.care_tasks) {
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Add a Plant</h1>
        <p className="mt-1 text-white/50">Add a new plant to your collection.</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Photo upload + AI identify */}
        <div className="space-y-3">
          <PhotoUpload
            onFileSelect={handlePhotoSelect}
            onFileClear={handlePhotoClear}
            previewUrl={photoPreview}
            uploading={photoUploading}
            error={photoError}
            plantName={formData.common_name || undefined}
          />

          {/* AI Identify button */}
          {selectedPhoto && !aiIdentifying && !aiResult && (
            <button
              type="button"
              onClick={handleAiIdentify}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 transition-all"
            >
              <Sparkles className="h-4 w-4" />
              AI Identify Plant from Photo
            </button>
          )}

          {/* AI identifying state */}
          {aiIdentifying && (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-3 text-sm text-white/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              Identifying plant with AI...
            </div>
          )}

          {/* AI error */}
          {aiError && (
            <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">AI identification failed</p>
                <p className="text-red-300/70 mt-0.5">{aiError}</p>
                <button
                  type="button"
                  onClick={handleAiIdentify}
                  className="mt-1.5 text-xs text-red-300 hover:text-red-200 underline underline-offset-2 transition-colors"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* AI result preview */}
          {aiResult && !aiApplied && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <p className="text-sm font-medium text-emerald-300">AI identified this plant as:</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-xs text-white/40">Name</span>
                  <p className="text-white font-medium">{aiResult.common_name}</p>
                </div>
                {aiResult.scientific_name && (
                  <div>
                    <span className="text-xs text-white/40">Scientific</span>
                    <p className="text-white/80 italic">{aiResult.scientific_name}</p>
                  </div>
                )}
                {aiResult.light_requirement && (
                  <div>
                    <span className="text-xs text-white/40">Light</span>
                    <p className="text-white">{LIGHT_REQUIREMENT_LABELS[aiResult.light_requirement]}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs text-white/40">Temperature</span>
                  <p className="text-white">{aiResult.min_temp}°C – {aiResult.max_temp}°C</p>
                </div>
                <div>
                  <span className="text-xs text-white/40">Humidity</span>
                  <p className="text-white">{aiResult.humidity_min}%+</p>
                </div>
                <div>
                  <span className="text-xs text-white/40">Care tasks</span>
                  <p className="text-white">{aiResult.care_tasks?.length || 0} tasks suggested</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={applyAiSuggestion}
                  className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-400 transition-all active:scale-[0.98]"
                >
                  Apply Suggestions
                </button>
                <button
                  type="button"
                  onClick={() => setAiResult(null)}
                  className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/50 hover:text-white hover:bg-white/5 transition-all"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* AI applied confirmation */}
          {aiApplied && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              AI suggestions applied! Review and adjust the fields below.
              <button
                type="button"
                onClick={() => {
                  setAiApplied(false);
                  setAiResult(null);
                }}
                className="ml-auto text-xs text-emerald-400/60 hover:text-emerald-300 underline underline-offset-2"
              >
                Undo
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Common Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.common_name}
              onChange={(e) => handleChange('common_name', e.target.value)}
              placeholder="e.g. Monstera Deliciosa"
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Scientific Name</label>
            <input
              type="text"
              value={formData.scientific_name}
              onChange={(e) => handleChange('scientific_name', e.target.value)}
              placeholder="e.g. Monstera deliciosa"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Nickname</label>
            <input
              type="text"
              value={formData.nickname}
              onChange={(e) => handleChange('nickname', e.target.value)}
              placeholder="e.g. Big Mama"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="e.g. Living room window"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Adoption Date</label>
            <input
              type="date"
              value={formData.adopted_at}
              onChange={(e) => handleChange('adopted_at', e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all [color-scheme:dark]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Light Requirement</label>
            <select
              value={formData.light_requirement}
              onChange={(e) => handleChange('light_requirement', e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all"
            >
              <option value="" className="bg-[#0a1f1a]">Select...</option>
              {(Object.entries(LIGHT_REQUIREMENT_LABELS) as [LightRequirement, string][]).map(
                ([key, label]) => (
                  <option key={key} value={key} className="bg-[#0a1f1a]">
                    {label}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Min Temp (°C)</label>
            <input
              type="number"
              value={formData.min_temp}
              onChange={(e) => handleChange('min_temp', e.target.value)}
              placeholder="e.g. 15"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Max Temp (°C)</label>
            <input
              type="number"
              value={formData.max_temp}
              onChange={(e) => handleChange('max_temp', e.target.value)}
              placeholder="e.g. 30"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Min Humidity (%)
            </label>
            <input
              type="number"
              value={formData.humidity_min}
              onChange={(e) => handleChange('humidity_min', e.target.value)}
              placeholder="e.g. 60"
              min={0}
              max={100}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-white/70 mb-1.5">Notes</label>
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
            className="rounded-xl border border-white/10 px-6 py-2.5 text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !formData.common_name}
            className="flex-1 sm:flex-none rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
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
    </div>
  );
}
