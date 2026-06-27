'use client';

import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LIGHT_REQUIREMENT_LABELS,
  TASK_TYPE_LABELS,
  type LightRequirement,
  type TaskType,
  type CareTask,
} from '@/lib/types';

/** Get PIN token from cookie (httpOnly: false, readable by client JS) */
function getPinToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)plantcaer_pin=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Fetch plant data — uses API route for PIN mode, Supabase client for regular auth */
async function fetchPlantData(slug: string): Promise<{
  plant: Record<string, unknown>;
  careTasks: CareTask[];
} | null> {
  // Try API route first (works with PIN cookie via Authorization header or cookies)
  try {
    const headers: Record<string, string> = {};
    const pinToken = getPinToken();
    if (pinToken) {
      headers['Authorization'] = `Bearer ${pinToken}`;
    }
    const res = await fetch(`/api/plant/${slug}`, { headers });
    if (res.ok) {
      const data = await res.json();
      return { plant: data.plant, careTasks: data.careTasks ?? [] };
    }
  } catch {
    // Fall through to Supabase client
  }

  // Fallback: direct Supabase query (requires Supabase session)
  const supabase = createClient();
  const { data: plant } = await supabase
    .from('plants')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!plant) return null;

  const { data: tasks } = await supabase
    .from('care_tasks')
    .select('*')
    .eq('plant_id', plant.id);

  return { plant, careTasks: (tasks ?? []) as CareTask[] };
}

export default function EditPlantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
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

  const [careTasks, setCareTasks] = useState<
    { task_type: TaskType; frequency_days: string; amount: string; notes: string }[]
  >([]);

  useEffect(() => {
    const fetchPlant = async () => {
      const slug = (await params).slug;
      const result = await fetchPlantData(slug);

      if (!result) {
        router.push('/plants');
        return;
      }

      const { plant, careTasks: tasks } = result;

      setFormData({
        common_name: (plant.common_name as string) || '',
        scientific_name: (plant.scientific_name as string) || '',
        nickname: (plant.nickname as string) || '',
        species: (plant.species as string) || '',
        location: (plant.location as string) || '',
        adopted_at: (plant.adopted_at as string) || '',
        light_requirement: (plant.light_requirement as LightRequirement) || '',
        min_temp: (plant.min_temp?.toString()) || '',
        max_temp: (plant.max_temp?.toString()) || '',
        humidity_min: (plant.humidity_min?.toString()) || '',
        notes: (plant.notes as string) || '',
      });

      if (tasks) {
        setCareTasks(
          tasks.map((t: CareTask) => ({
            task_type: t.task_type as TaskType,
            frequency_days: t.frequency_days?.toString() || '',
            amount: t.amount || '',
            notes: t.notes || '',
          }))
        );
      }

      setFetching(false);
    };

    fetchPlant();
  }, [params, router]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateCareTask = (
    taskType: TaskType,
    field: string,
    value: string
  ) => {
    setCareTasks((prev) => {
      const existing = prev.find((t) => t.task_type === taskType);
      if (existing) {
        return prev.map((t) =>
          t.task_type === taskType ? { ...t, [field]: value } : t
        );
      }
      const defaults: {
        task_type: TaskType;
        frequency_days: string;
        amount: string;
        notes: string;
      } = {
        task_type: taskType,
        frequency_days: '',
        amount: '',
        notes: '',
        [field]: value,
      };
      return [...prev, defaults];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const slug = (await params).slug;

      // Try API route first (works with PIN cookie via Authorization header)
      const putHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      const pinToken = getPinToken();
      if (pinToken) {
        putHeaders['Authorization'] = `Bearer ${pinToken}`;
      }
      const res = await fetch(`/api/plant/${slug}`, {
        method: 'PUT',
        headers: putHeaders,
        body: JSON.stringify({
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
          careTasks: careTasks.map(t => ({
            task_type: t.task_type,
            frequency_days: t.frequency_days,
            amount: t.amount,
            notes: t.notes,
          })),
        }),
      });

      if (res.ok) {
        router.push(`/plant/${slug}`);
        router.refresh();
        return;
      }

      // Fallback: direct Supabase mutation (requires Supabase session)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const errData = await res.json();
        throw new Error(errData.error || 'Not authenticated');
      }

      const { data: plant } = await supabase
        .from('plants')
        .select('id')
        .eq('slug', slug)
        .single();
      if (!plant) throw new Error('Plant not found');

      const { error: updateError } = await supabase
        .from('plants')
        .update({
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
          updated_at: new Date().toISOString(),
        })
        .eq('id', plant.id);

      if (updateError) throw updateError;

      for (const task of careTasks) {
        if (task.frequency_days) {
          const { error: taskError } = await supabase.from('care_tasks').upsert(
            {
              plant_id: plant.id,
              task_type: task.task_type,
              frequency_days: parseInt(task.frequency_days) || null,
              amount: task.amount || null,
              notes: task.notes || null,
              is_active: true,
            },
            { onConflict: 'plant_id,task_type' }
          );
          if (taskError) throw taskError;
        }
      }

      router.push(`/plant/${slug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update plant');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
      </div>
    );
  }

  const allTaskTypes: TaskType[] = [
    'watering',
    'fertilizing',
    'repotting',
    'pruning',
    'pest_disease',
    'propagation',
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-stone-800">Edit Plant</h1>
        <p className="mt-1 text-stone-500">{formData.common_name || 'Unnamed plant'}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic info */}
        <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-lg font-semibold text-stone-800">Basic Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-stone-600 mb-1.5">
                Common Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.common_name}
                onChange={(e) => handleChange('common_name', e.target.value)}
                required
                className="w-full rounded-xl border border-stone-200/50 bg-white/80 px-4 py-2.5 text-sm text-stone-900 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
            <input placeholder="Scientific name" value={formData.scientific_name} onChange={(e) => handleChange('scientific_name', e.target.value)} className="w-full rounded-xl border border-stone-200/50 bg-white/80 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
            <input placeholder="Nickname" value={formData.nickname} onChange={(e) => handleChange('nickname', e.target.value)} className="w-full rounded-xl border border-stone-200/50 bg-white/80 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
            <input placeholder="Location" value={formData.location} onChange={(e) => handleChange('location', e.target.value)} className="w-full rounded-xl border border-stone-200/50 bg-white/80 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
            <input type="date" value={formData.adopted_at} onChange={(e) => handleChange('adopted_at', e.target.value)} className="w-full rounded-xl border border-stone-200/50 bg-white/80 px-4 py-2.5 text-sm text-stone-900 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
            <select value={formData.light_requirement} onChange={(e) => handleChange('light_requirement', e.target.value)} className="w-full rounded-xl border border-stone-200/50 bg-white/80 px-4 py-2.5 text-sm text-stone-900 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all">
              <option value="" className="bg-white">Light requirement...</option>
              {(Object.entries(LIGHT_REQUIREMENT_LABELS) as [LightRequirement, string][]).map(([k, l]) => (
                <option key={k} value={k} className="bg-white">{l}</option>
              ))}
            </select>
            <input type="number" placeholder="Min temp (°C)" value={formData.min_temp} onChange={(e) => handleChange('min_temp', e.target.value)} className="w-full rounded-xl border border-stone-200/50 bg-white/80 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
            <input type="number" placeholder="Max temp (°C)" value={formData.max_temp} onChange={(e) => handleChange('max_temp', e.target.value)} className="w-full rounded-xl border border-stone-200/50 bg-white/80 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
            <input type="number" placeholder="Min humidity (%)" value={formData.humidity_min} onChange={(e) => handleChange('humidity_min', e.target.value)} min={0} max={100} className="w-full rounded-xl border border-stone-200/50 bg-white/80 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
            <div className="sm:col-span-2">
              <textarea placeholder="Notes..." value={formData.notes} onChange={(e) => handleChange('notes', e.target.value)} rows={3} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all resize-none" />
            </div>
          </div>
        </div>

        {/* Care Tasks */}
        <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-lg font-semibold text-stone-800">Care Schedule</h2>
          <p className="text-sm text-stone-400">Configure how often each care task should be done.</p>

          <div className="space-y-3">
            {allTaskTypes.map((taskType) => {
              const task = careTasks.find((t) => t.task_type === taskType);
              return (
                <div key={taskType} className="glass-card rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{getTaskIcon(taskType)}</span>
                    <span className="text-sm font-medium text-stone-800">
                      {TASK_TYPE_LABELS[taskType]}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-stone-400 mb-1">Frequency (days)</label>
                      <input
                        type="number"
                        value={task?.frequency_days || ''}
                        onChange={(e) => updateCareTask(taskType, 'frequency_days', e.target.value)}
                        placeholder="e.g. 7"
                        min={1}
                        className="w-full rounded-lg border border-stone-200/50 bg-white/80 px-3 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500/50 focus:outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-400 mb-1">Amount</label>
                      <input
                        type="text"
                        value={task?.amount || ''}
                        onChange={(e) => updateCareTask(taskType, 'amount', e.target.value)}
                        placeholder="e.g. 200ml"
                        className="w-full rounded-lg border border-stone-200/50 bg-white/80 px-3 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500/50 focus:outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-400 mb-1">Notes</label>
                      <input
                        type="text"
                        value={task?.notes || ''}
                        onChange={(e) => updateCareTask(taskType, 'notes', e.target.value)}
                        placeholder="Optional instructions"
                        className="w-full rounded-lg border border-stone-200/50 bg-white/80 px-3 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500/50 focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200/50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex gap-3">
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
            className="flex-1 sm:flex-none rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function getTaskIcon(taskType: TaskType): string {
  const icons: Record<TaskType, string> = {
    watering: '💧',
    fertilizing: '🌿',
    repotting: '🪴',
    pruning: '✂️',
    pest_disease: '🐛',
    propagation: '🌱',
  };
  return icons[taskType];
}
