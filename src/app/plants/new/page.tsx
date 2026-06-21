'use client';

import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { slugify, LIGHT_REQUIREMENT_LABELS, type LightRequirement } from '@/lib/types';

export default function AddPlantPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
