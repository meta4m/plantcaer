'use client';

import { TASK_TYPE_ICONS, TASK_TYPE_LABELS, type Plant, type CareTask, type TaskType } from '@/lib/types';
import Link from 'next/link';
import { getPhotoUrl } from '@/lib/storage';

interface PlantCardProps {
  plant: Plant & { care_tasks?: CareTask[] };
  primaryPhotoUrl?: string | null;
}

export function PlantCard({ plant, primaryPhotoUrl }: PlantCardProps) {
  const tasksDue = plant.care_tasks?.filter((t) => t.is_active) ?? [];

  return (
    <Link
      href={`/plant/${plant.slug}`}
      className="glass-card group rounded-2xl p-5 block transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-emerald-500/5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-stone-800 group-hover:text-emerald-600 transition-colors truncate">
            {plant.nickname || plant.common_name}
          </h3>
          {plant.nickname && plant.common_name && (
            <p className="text-sm text-stone-400 truncate mt-0.5">{plant.common_name}</p>
          )}
          {!plant.nickname && plant.scientific_name && (
            <p className="text-sm text-stone-400 italic mt-0.5 truncate">{plant.scientific_name}</p>
          )}
        </div>
        {/* Primary photo thumbnail or placeholder */}
        {primaryPhotoUrl ? (
          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 ml-3 ring-1 ring-white/10">
            <img
              src={getPhotoUrl(primaryPhotoUrl)}
              alt={plant.nickname || plant.common_name}
              className="w-full h-full object-cover transition-all duration-300 group-hover:scale-110"
            />
          </div>
        ) : (
          <span className="text-2xl opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-3">
            🪴
          </span>
        )}
      </div>

      {plant.location && (
        <p className="text-sm text-stone-500 mb-3">
          📍 {plant.location}
        </p>
      )}

      {tasksDue.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tasksDue.slice(0, 4).map((task) => (
            <span
              key={task.id}
              className="inline-flex items-center gap-1 rounded-full bg-amber-50/50 px-2 py-0.5 text-xs text-stone-500"
            >
              <span>{TASK_TYPE_ICONS[task.task_type as TaskType]}</span>
              <span>{TASK_TYPE_LABELS[task.task_type as TaskType]}</span>
            </span>
          ))}
          {tasksDue.length > 4 && (
            <span className="text-xs text-stone-400">+{tasksDue.length - 4} more</span>
          )}
        </div>
      )}
    </Link>
  );
}
