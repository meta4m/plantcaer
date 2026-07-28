'use client';

import { type Plant } from '@/lib/types';
import Link from 'next/link';
import { getPhotoUrl } from '@/lib/storage';
import { UI_ICONS } from '@/lib/icons';
import {
  getStatusColor,
  formatDueBadge,
  type PlantDueSummary,
} from '@/lib/plant-status';

interface PlantCardProps {
  plant: Plant;
  primaryPhotoUrl?: string | null;
  /** Due status computed by the parent (tasks + logs). Omit for a neutral card. */
  dueSummary?: PlantDueSummary;
}

export function PlantCard({ plant, primaryPhotoUrl, dueSummary }: PlantCardProps) {
  const badge = dueSummary ? formatDueBadge(dueSummary) : null;
  const statusColor = dueSummary ? getStatusColor(dueSummary) : 'var(--color-forest)';

  return (
    <Link
      href={`/plant/${plant.slug}`}
      className="glass-card group relative block overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-lg hover:shadow-[rgba(80,60,40,0.12)]"
    >
      {/* Status left border: forest → amber → red */}
      <span
        className="absolute left-0 top-0 bottom-0 w-1 z-10"
        style={{ backgroundColor: statusColor }}
        aria-hidden="true"
      />

      <div className="relative aspect-[16/10] w-full overflow-hidden">
        {primaryPhotoUrl ? (
          <img
            src={getPhotoUrl(primaryPhotoUrl)}
            alt={plant.nickname || plant.common_name}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-forest)]/8 text-[var(--color-forest)]/40">
            <UI_ICONS.plants size={56} aria-hidden="true" />
          </div>
        )}

        {/* Name / status overlay with gradient fade */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-4 pb-3 pt-12">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-white truncate">
                {plant.nickname || plant.common_name}
              </h3>
              {(plant.nickname && plant.common_name) || plant.scientific_name ? (
                <p className="text-xs text-white/70 truncate mt-0.5">
                  {plant.nickname && plant.common_name
                    ? plant.common_name
                    : plant.scientific_name}
                </p>
              ) : null}
            </div>
            {badge && (
              <span
                className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  dueSummary!.overdue > 0
                    ? 'bg-red-500/90 text-white'
                    : 'bg-white/90 text-stone-700'
                }`}
              >
                {badge}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
