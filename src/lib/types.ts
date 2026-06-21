// Plantcaer TypeScript types matching the Supabase schema

export type LightRequirement = 'direct_sun' | 'bright_indirect' | 'low_light' | 'shade';

export type TaskType = 'watering' | 'fertilizing' | 'repotting' | 'pruning' | 'pest_disease' | 'propagation';

export type SharePermission = 'view' | 'contribute';

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Plant {
  id: string;
  owner_id: string;
  slug: string;
  common_name: string;
  scientific_name: string | null;
  nickname: string | null;
  species: string | null;
  location: string | null;
  adopted_at: string | null;
  light_requirement: LightRequirement | null;
  min_temp: number | null;
  max_temp: number | null;
  humidity_min: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlantPhoto {
  id: string;
  plant_id: string;
  url: string;
  is_primary: boolean;
  uploaded_at: string;
}

export interface CareTask {
  id: string;
  plant_id: string;
  task_type: TaskType;
  frequency_days: number | null;
  seasonal_adjustment: Record<string, number>;
  amount: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CareLog {
  id: string;
  plant_id: string;
  task_id: string | null;
  task_type: TaskType;
  logged_by: string;
  logged_at: string;
  notes: string | null;
  created_at: string;
}

export interface GrowthRecord {
  id: string;
  plant_id: string;
  recorded_at: string;
  height_cm: number | null;
  leaf_count: number | null;
  notes: string | null;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  plant_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

export interface PlantShare {
  id: string;
  plant_id: string;
  shared_with: string;
  permission: SharePermission;
  created_at: string;
}

// Composite types for UI
export interface PlantWithDetails extends Plant {
  photos: PlantPhoto[];
  care_tasks: CareTask[];
  next_care?: {
    task_type: TaskType;
    due_at: string;
  };
}

export interface UpcomingCareTask {
  plant_id: string;
  plant_slug: string;
  plant_name: string;
  task_type: TaskType;
  task_id: string;
  last_done_at: string | null;
  estimated_next_due: string;
  is_overdue: boolean;
}

// Slug generation helper
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

// Compute estimated next due date based on frequency and last care log
export function estimateNextDue(
  lastDoneAt: string | null,
  frequencyDays: number | null,
  seasonalAdjustment?: Record<string, number>
): Date | null {
  if (!frequencyDays) return null;

  const baseDate = lastDoneAt ? new Date(lastDoneAt) : new Date();
  let adjustedFrequency = frequencyDays;

  // Apply seasonal adjustment if available
  if (seasonalAdjustment) {
    const season = getCurrentSeason();
    const multiplier = seasonalAdjustment[season];
    if (multiplier) {
      adjustedFrequency = Math.round(frequencyDays * multiplier);
    }
  }

  const due = new Date(baseDate);
  due.setDate(due.getDate() + adjustedFrequency);
  return due;
}

export function getCurrentSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  watering: 'Watering',
  fertilizing: 'Fertilizing',
  repotting: 'Repotting',
  pruning: 'Pruning',
  pest_disease: 'Pest / Disease',
  propagation: 'Propagation',
};

export const TASK_TYPE_ICONS: Record<TaskType, string> = {
  watering: '💧',
  fertilizing: '🌿',
  repotting: '🪴',
  pruning: '✂️',
  pest_disease: '🐛',
  propagation: '🌱',
};

export const LIGHT_REQUIREMENT_LABELS: Record<LightRequirement, string> = {
  direct_sun: 'Direct Sun',
  bright_indirect: 'Bright Indirect',
  low_light: 'Low Light',
  shade: 'Shade',
};
