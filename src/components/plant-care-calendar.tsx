'use client';

import { useState, useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, DateSelectArg } from '@fullcalendar/core';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, X, Check } from 'lucide-react';
import type { TaskType } from '@/lib/types';
import { TASK_TYPE_LABELS, TASK_TYPE_ICONS } from '@/lib/types';

// Import FullCalendar styles
import '@fullcalendar/daygrid/main.css';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  allDay: boolean;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: {
    type: 'due' | 'overdue' | 'logged';
    plantId: string;
    plantSlug: string;
    plantName: string;
    taskId?: string;
    taskType: TaskType;
    logId?: string;
    careLogNotes?: string;
  };
}

interface PlantCareCalendarProps {
  events: CalendarEvent[];
  plants: { id: string; slug: string; nickname: string | null; common_name: string }[];
}

const TASK_COLORS: Record<TaskType, string> = {
  watering: '#0ea5e9',       // sky blue
  fertilizing: '#10b981',    // emerald
  repotting: '#f59e0b',      // amber
  pruning: '#8b5cf6',        // violet
  pest_disease: '#ef4444',   // red
  propagation: '#ec4899',    // pink
};

const OVERDUE_COLOR = '#dc2626';
const LOGGED_COLOR = '#6b7280';

export function PlantCareCalendar({ events, plants }: PlantCareCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const router = useRouter();
  const supabase = createClient();
  const [logging, setLogging] = useState<string | null>(null);

  // Modal state
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Navigate calendar
  const goNext = () => {
    const api = calendarRef.current?.getApi();
    api?.next();
  };
  const goPrev = () => {
    const api = calendarRef.current?.getApi();
    api?.prev();
  };
  const goToday = () => {
    const api = calendarRef.current?.getApi();
    api?.today();
  };

  // Log care from event click
  const handleLogCare = async (event: CalendarEvent) => {
    if (!event.extendedProps.taskId) return;
    setLogging(event.extendedProps.taskId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('care_logs').insert({
        plant_id: event.extendedProps.plantId,
        task_id: event.extendedProps.taskId,
        task_type: event.extendedProps.taskType,
        logged_by: user.id,
        logged_at: new Date().toISOString(),
      });

      setSelectedEvent(null);
      router.refresh();
    } finally {
      setLogging(null);
    }
  };

  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    const event = clickInfo.event;
    const calEvent: CalendarEvent = {
      id: event.id,
      title: event.title,
      start: event.startStr,
      allDay: event.allDay,
      backgroundColor: event.backgroundColor,
      borderColor: event.borderColor,
      textColor: event.textColor,
      extendedProps: event.extendedProps as CalendarEvent['extendedProps'],
    };
    setSelectedEvent(calEvent);
  }, []);

  // Custom event rendering
  const renderEventContent = (eventInfo: {
    event: {
      title: string;
      extendedProps: Record<string, unknown>;
      backgroundColor: string;
    };
    timeText: string;
    view: { type: string };
  }) => {
    const props = eventInfo.event.extendedProps as CalendarEvent['extendedProps'];
    const isMonthView = eventInfo.view.type === 'dayGridMonth';
    const dotColor = eventInfo.event.backgroundColor;

    return (
      <div
        className={`flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity ${
          isMonthView ? 'text-[11px] px-1' : 'text-sm px-2 py-1'
        }`}
        title={`${eventInfo.event.title} - ${props.plantName}`}
      >
        <span
          className={`shrink-0 rounded-full ${
            isMonthView ? 'h-1.5 w-1.5' : 'h-2 w-2'
          }`}
          style={{ backgroundColor: dotColor }}
        />
        {!isMonthView && (
          <>
            <span className="truncate text-white/80">{eventInfo.event.title}</span>
            <span className="text-white/40 truncate">· {props.plantName}</span>
          </>
        )}
      </div>
    );
  };

  // Filter events to a reasonable range for the current view
  const now = new Date();
  const threeMonthsFromNow = new Date(now.getFullYear(), now.getMonth() + 3, 1);
  const filteredEvents = events.filter((e) => {
    const eventDate = new Date(e.start);
    return eventDate <= threeMonthsFromNow;
  });

  return (
    <div>
      {/* Custom toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className="glass-card rounded-xl px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all"
          >
            ← Prev
          </button>
          <button
            onClick={goToday}
            className="glass-card rounded-xl px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all"
          >
            Today
          </button>
          <button
            onClick={goNext}
            className="glass-card rounded-xl px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all"
          >
            Next →
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] text-white/40">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TASK_COLORS.watering }} />
            Due
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: OVERDUE_COLOR }} />
            Overdue
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-gray-500" />
            Logged
          </div>
        </div>
      </div>

      {/* FullCalendar */}
      <div className="glass-card rounded-2xl p-3 sm:p-4 overflow-hidden">
        <div className="plant-care-calendar">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={filteredEvents}
            eventContent={renderEventContent}
            eventClick={handleEventClick}
            height="auto"
            headerToolbar={false}
            dayHeaderClassNames="text-white/50 text-xs font-medium uppercase tracking-wider py-2 border-0"
            dayCellClassNames="bg-transparent border-white/5 hover:bg-white/[0.03] transition-colors"
            dayCellContent={(info) => (
              <span
                className={`text-sm ${
                  info.isToday
                    ? 'bg-emerald-500 text-white font-bold rounded-full h-7 w-7 flex items-center justify-center mx-auto'
                    : info.date.getMonth() !== new Date().getMonth()
                    ? 'text-white/20'
                    : 'text-white/60'
                }`}
              >
                {info.dayNumberText}
              </span>
            )}
            moreLinkText={(num) => `+${num} more`}
            moreLinkClassNames="text-emerald-400 text-xs hover:text-emerald-300 transition-colors"
            noEventsText="No care tasks or logs"
            dayMaxEvents={3}
            fixedWeekCount={false}
          />
        </div>
      </div>

      {/* Event detail modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="glass-card rounded-2xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {TASK_TYPE_ICONS[selectedEvent.extendedProps.taskType]}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {selectedEvent.title}
                  </h3>
                  <Link
                    href={`/plant/${selectedEvent.extendedProps.plantSlug}`}
                    className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    {selectedEvent.extendedProps.plantName}
                  </Link>
                </div>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="rounded-full bg-white/10 p-1.5 text-white/60 hover:text-white hover:bg-white/20 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/40">Date:</span>
                <span className="text-white/80">
                  {new Date(selectedEvent.start).toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/40">Status:</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    selectedEvent.extendedProps.type === 'overdue'
                      ? 'bg-red-500/20 text-red-300'
                      : selectedEvent.extendedProps.type === 'logged'
                      ? 'bg-gray-500/20 text-gray-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {selectedEvent.extendedProps.type === 'overdue'
                    ? 'Overdue'
                    : selectedEvent.extendedProps.type === 'logged'
                    ? 'Completed'
                    : 'Due'}
                </span>
              </div>
              {selectedEvent.extendedProps.careLogNotes && (
                <div>
                  <span className="text-white/40 text-sm">Notes:</span>
                  <p className="text-white/70 text-sm mt-0.5 italic">
                    &ldquo;{selectedEvent.extendedProps.careLogNotes}&rdquo;
                  </p>
                </div>
              )}
            </div>

            {selectedEvent.extendedProps.type !== 'logged' && (
              <button
                onClick={() => handleLogCare(selectedEvent!)}
                disabled={logging === selectedEvent.extendedProps.taskId}
                className="w-full rounded-xl bg-emerald-500/20 px-4 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {logging === selectedEvent.extendedProps.taskId ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Logging...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Log as Done
                  </>
                )}
              </button>
            )}

            <div className="mt-3">
              <Link
                href={`/plant/${selectedEvent.extendedProps.plantSlug}`}
                className="block text-center rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all"
              >
                View Plant Details
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
