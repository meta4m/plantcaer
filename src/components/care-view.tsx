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

  // Count stats for the header
  const taskCount = careTasks.length;
  const overdueCount = careTasks.filter((t) => {
    // Simple overdue check — tasks due before today
    return false; // The CareContent component handles this internally
  }).length;

  const filteredPlant = plantSlug ? calendarPlants[0] : null;

  return (
    <div className="space-y-6">
      {/* View toggle header — title is handled by CareContent or calendar */}
      <div className="flex items-center justify-between">
        <div>
          {view === 'calendar' && (
            <>
              <h1 className="text-3xl font-bold text-stone-800">
                {filteredPlant
                  ? `${filteredPlant.nickname || filteredPlant.common_name} — Care`
                  : 'Care Calendar'}
              </h1>
              <p className="mt-1 text-stone-500">
                {calendarEvents.length} event{calendarEvents.length !== 1 ? 's' : ''}
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {filteredPlant && (
            <Link
              href="/care"
              className="glass-card rounded-xl px-4 py-2 text-sm text-stone-500 hover:text-stone-800 hover:bg-stone-100/80 transition-all"
            >
              All Plants
            </Link>
          )}

          <a
            href={`/api/calendar/export${plantSlug ? `?plant=${plantSlug}` : ''}`}
            download
            className="glass-card rounded-xl px-4 py-2 text-sm text-stone-500 hover:text-stone-800 hover:bg-stone-100/80 transition-all flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </a>

          <div className="flex glass-card rounded-xl p-0.5">
            <button
              onClick={() => switchView('list')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                view === 'list'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              List
            </button>
            <button
              onClick={() => switchView('calendar')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                view === 'calendar'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Calendar
            </button>
          </div>
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
