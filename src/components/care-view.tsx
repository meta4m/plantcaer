'use client';

import { useState } from 'react';
import type { Plant, CareTask, CareLog } from '@/lib/types';
import { CareContent } from '@/components/care-content';
import { PlantCareCalendar, type CalendarEvent } from '@/components/plant-care-calendar';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { UI_ICONS } from '@/lib/icons';

interface CareViewProps {
  plants: Plant[];
  careTasks: CareTask[];
  careLogs: CareLog[];
  calendarEvents: CalendarEvent[];
  calendarPlants: { id: string; slug: string; nickname: string | null; common_name: string }[];
  primaryPhotoMap?: Record<string, string>;
  defaultView: 'list' | 'calendar';
  plantSlug?: string;
  hasPlants: boolean;
}

export function CareView({
  plants,
  careTasks,
  careLogs,
  calendarEvents,
  calendarPlants,
  primaryPhotoMap = {},
  defaultView,
  plantSlug,
  hasPlants,
}: CareViewProps) {
  const [view, setView] = useState<'list' | 'calendar'>(defaultView);
  const router = useRouter();
  const searchParams = useSearchParams();

  const switchView = (newView: 'list' | 'calendar') => {
    setView(newView);
    const params = new URLSearchParams(searchParams.toString());
    if (newView === 'calendar') {
      params.set('view', 'calendar');
    } else {
      params.delete('view');
    }
    router.replace(`/care?${params.toString()}`, { scroll: false });
  };

  const filteredPlant = plantSlug ? calendarPlants[0] : null;
  const title = view === 'calendar'
    ? filteredPlant
      ? `${filteredPlant.nickname || filteredPlant.common_name} — Care`
      : 'Care Calendar'
    : 'Care Overview';
  const subtitle = view === 'calendar'
    ? `${calendarEvents.length} event${calendarEvents.length !== 1 ? 's' : ''}`
    : `${careTasks.length} active task${careTasks.length !== 1 ? 's' : ''}`;

  return (
    <div className="space-y-6">
      {/* One consistent header for both list and calendar views */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-stone-500 sm:text-base">{subtitle}</p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <div className="flex glass-card rounded-xl p-0.5">
            <button
              onClick={() => switchView('list')}
              className={`px-3 py-1.5 min-h-[44px] min-w-[64px] rounded-lg text-sm font-medium transition-all ${
                view === 'list'
                  ? 'bg-[var(--color-forest)]/12 text-[var(--color-forest)]'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              List
            </button>
            <button
              onClick={() => switchView('calendar')}
              className={`px-3 py-1.5 min-h-[44px] min-w-[76px] rounded-lg text-sm font-medium transition-all ${
                view === 'calendar'
                  ? 'bg-[var(--color-forest)]/12 text-[var(--color-forest)]'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Calendar
            </button>
          </div>

          {filteredPlant && (
            <Link
              href="/care"
              className="glass-card rounded-xl px-4 py-2 min-h-[44px] inline-flex items-center text-sm text-stone-500 hover:text-stone-800 hover:bg-stone-100/80 transition-all"
            >
              All Plants
            </Link>
          )}

          <a
            href={`/api/calendar/export${plantSlug ? `?plant=${plantSlug}` : ''}`}
            download
            className="glass-card rounded-xl px-4 py-2 min-h-[44px] text-sm text-stone-500 hover:text-stone-800 hover:bg-stone-100/80 transition-all flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </a>
        </div>
      </div>

      {/* List view */}
      {view === 'list' && (
        <CareContent
          plants={plants}
          careTasks={careTasks}
          careLogs={careLogs}
          primaryPhotoMap={primaryPhotoMap}
        />
      )}

      {/* Calendar view */}
      {view === 'calendar' && (
        hasPlants ? (
          <PlantCareCalendar events={calendarEvents} plants={calendarPlants} />
        ) : (
          <div className="text-center py-20">
            <UI_ICONS.care size={48} className="mx-auto mb-4 text-stone-300" aria-hidden="true" />
            <h2 className="text-xl font-semibold text-stone-700 mb-2">No plants yet</h2>
            <p className="text-stone-400 mb-6">
              Add plants and configure care tasks to see them on the calendar.
            </p>
            <Link
              href="/plants/new"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 transition-all"
            >
              Add your first plant
            </Link>
          </div>
        )
      )}
    </div>
  );
}
