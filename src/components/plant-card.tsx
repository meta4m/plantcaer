'use client';

import { TASK_TYPE_ICONS, TASK_TYPE_LABELS, type Plant, type CareTask, type TaskType } from '@/lib/types';
import Link from 'next/link';

interface PlantCardProps {
  plant: Plant & { care_tasks?: CareTask[] };
}

export function PlantCard({ plant }: PlantCardProps) {
  const tasksDue = plant.care_tasks?.filter((t) => t.is_active) ?? [];

  return (
    <Link
      href={`/plant/${plant.slug}`}
      className="glass-card group rounded-2xl p-5 block transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-emerald-500/5"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-white group-hover:text-emerald-300 transition-colors">
            {plant.nickname || plant.common_name}
          </h3>
          {plant.scientific_name && (
            <p className="text-sm text-white/40 italic mt-0.5">{plant.scientific_name}</p>
          )}
        </div>
        <span className="text-2xl opacity-60 group-hover:opacity-100 transition-opacity">
          🪴
        </span>
      </div>

      {plant.location && (
        <p className="text-sm text-white/50 mb-3">
          📍 {plant.location}
        </p>
      )}

      {tasksDue.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tasksDue.slice(0, 4).map((task) => (
            <span
              key={task.id}
              className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/50"
            >
              <span>{TASK_TYPE_ICONS[task.task_type as TaskType]}</span>
              <span>{TASK_TYPE_LABELS[task.task_type as TaskType]}</span>
            </span>
          ))}
          {tasksDue.length > 4 && (
            <span className="text-xs text-white/30">+{tasksDue.length - 4} more</span>
          )}
        </div>
      )}
    </Link>
  );
}
