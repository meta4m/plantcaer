'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, DatesSetArg } from '@fullcalendar/core';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, X, Check, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import type { TaskType } from '@/lib/types';
import { TASK_TYPE_LABELS } from '@/lib/types';
import { TaskIcon } from '@/components/ui/task-icon';

// FullCalendar v6 injects styles automatically via JS — no CSS import needed

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
  watering: '#0ea5e9',
  fertilizing: '#10b981',
  repotting: '#f59e0b',
  pruning: '#8b5cf6',
  pest_disease: '#ef4444',
  propagation: '#ec4899',
};

const OVERDUE_COLOR = '#dc2626';

/** Format a date like "27-Jun-2026" for the calendar header */
function formatViewDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

/** Format a friendly date for the modal */
function formatFriendlyDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Get all events that fall on a specific date string (YYYY-MM-DD) */
function getEventsForDay(events: CalendarEvent[], dateStr: string): CalendarEvent[] {
  return events.filter((e) => e.start === dateStr);
}

/** Get the next/previous date string that has events */
function getAdjacentEventDate(
  events: CalendarEvent[],
  currentDateStr: string,
  direction: 'prev' | 'next',
): string | null {
  const uniqueDates = [...new Set(events.map((e) => e.start))].sort();
  const idx = uniqueDates.indexOf(currentDateStr);
  if (direction === 'prev') return idx > 0 ? uniqueDates[idx - 1] : null;
  if (direction === 'next') return idx < uniqueDates.length - 1 ? uniqueDates[idx + 1] : null;
  return null;
}

export function PlantCareCalendar({ events, plants }: PlantCareCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const router = useRouter();
  const supabase = createClient();
  const [logging, setLogging] = useState<string | null>(null);

  // Track current view range for the date header — shows first visible day in DD-MMM-YYYY
  const [currentTitle, setCurrentTitle] = useState(() => formatViewDate(new Date()));

  // Modal state — stores the selected day's date string + current event index
  const [modalState, setModalState] = useState<{
    dateStr: string;
    eventIndex: number;
  } | null>(null);

  // Derived: all events for the modal's current day
  const modalEvents = useMemo(() => {
    if (!modalState) return [];
    return getEventsForDay(events, modalState.dateStr);
  }, [modalState, events]);

  // Derived: the currently selected event in the modal
  const selectedEvent = useMemo(() => {
    if (!modalState) return null;
    return modalEvents[modalState.eventIndex] ?? null;
  }, [modalState, modalEvents]);

  // Navigate calendar
  const goNext = () => {
    calendarRef.current?.getApi()?.next();
  };
  const goPrev = () => {
    calendarRef.current?.getApi()?.prev();
  };
  const goToday = () => {
    calendarRef.current?.getApi()?.today();
  };

  // Track date changes to update the header
  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setCurrentTitle(formatViewDate(arg.start));
  }, []);

  // Log care from event
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
      setModalState(null);
      router.refresh();
    } finally {
      setLogging(null);
    }
  };

  // Click an event badge → open modal at that event
  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    const dateStr = clickInfo.event.startStr.split('T')[0];
    const dayEvents = getEventsForDay(events, dateStr);
    const idx = dayEvents.findIndex((e) => e.id === clickInfo.event.id);
    setModalState({
      dateStr,
      eventIndex: idx >= 0 ? idx : 0,
    });
  }, [events]);

  // Click a day cell (empty area) → open modal at first event, or just show the day
  const handleDateClick = useCallback((info: { dateStr: string }) => {
    const dayEvents = getEventsForDay(events, info.dateStr);
    setModalState({
      dateStr: info.dateStr,
      eventIndex: 0,
    });
  }, [events]);

  // Navigate events within the current day
  const goToPrevEvent = () => {
    setModalState((prev) => {
      if (!prev) return null;
      return { ...prev, eventIndex: Math.max(0, prev.eventIndex - 1) };
    });
  };
  const goToNextEvent = () => {
    setModalState((prev) => {
      if (!prev) return null;
      return { ...prev, eventIndex: Math.min(modalEvents.length - 1, prev.eventIndex + 1) };
    });
  };

  // ESC key to dismiss modal
  useEffect(() => {
    if (!modalState) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalState(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalState]);

  // Navigate to adjacent days that have events
  const goToPrevDay = () => {
    if (!modalState) return;
    const prevDate = getAdjacentEventDate(events, modalState.dateStr, 'prev');
    if (prevDate) {
      const dayEvents = getEventsForDay(events, prevDate);
      setModalState({ dateStr: prevDate, eventIndex: 0 });
    }
  };
  const goToNextDay = () => {
    if (!modalState) return;
    const nextDate = getAdjacentEventDate(events, modalState.dateStr, 'next');
    if (nextDate) {
      const dayEvents = getEventsForDay(events, nextDate);
      setModalState({ dateStr: nextDate, eventIndex: 0 });
    }
  };

  // Custom event rendering — oval badge with plant name
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
    const bgColor = eventInfo.event.backgroundColor;
    const isMonthView = eventInfo.view.type === 'dayGridMonth';

    if (isMonthView) {
      // Compact oval badge for month view
      return (
        <div
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-tight cursor-pointer hover:opacity-80 transition-opacity truncate max-w-full"
          style={{ backgroundColor: bgColor + '33', color: bgColor }}
          title={`${props.plantName} — ${eventInfo.event.title}`}
        >
          {props.plantName}
        </div>
      );
    }

    // Detailed badge for non-month views
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity truncate max-w-full"
        style={{ backgroundColor: bgColor + '33', color: bgColor }}
        title={`${props.plantName} — ${eventInfo.event.title}`}
      >
        <TaskIcon type={props.taskType} size={12} className="shrink-0" />
        <span className="truncate">{eventInfo.event.title}</span>
        <span className="opacity-60 truncate">· {props.plantName}</span>
      </div>
    );
  };

  // Filter events to a reasonable range
  const now = new Date();
  const threeMonthsFromNow = new Date(now.getFullYear(), now.getMonth() + 3, 1);
  const filteredEvents = events.filter((e) => {
    const eventDate = new Date(e.start);
    return eventDate <= threeMonthsFromNow;
  });

  // Check if modal day has prev/next event days
  const hasPrevDay = modalState ? getAdjacentEventDate(events, modalState.dateStr, 'prev') !== null : false;
  const hasNextDay = modalState ? getAdjacentEventDate(events, modalState.dateStr, 'next') !== null : false;

  return (
    <div>
      {/* Custom toolbar with full date */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={goPrev}
            className="glass-card flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stone-500 hover:text-stone-800 hover:bg-stone-100/80 transition-all"
            title="Previous month"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goToday}
            className="glass-card min-h-11 shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-100/80 transition-all"
          >
            Today
          </button>
          <button
            onClick={goNext}
            className="glass-card flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stone-500 hover:text-stone-800 hover:bg-stone-100/80 transition-all"
            title="Next month"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h2 className="ml-1 min-w-0 truncate text-base font-semibold text-stone-800 sm:ml-2 sm:text-lg">
            {currentTitle}
          </h2>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-stone-500 sm:gap-3 sm:text-[11px] sm:text-stone-400">
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
          {/* Global styles for day header visibility */}
          <style>{`
            .plant-care-calendar .fc-col-header-cell {
              padding: 4px 0;
            }
            .plant-care-calendar .fc-col-header-cell-cushion {
              color: rgba(87, 83, 78, 0.7) !important;
              font-size: 0.75rem;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              text-decoration: none !important;
            }
            .plant-care-calendar .fc-daygrid-day-number {
              color: rgba(87, 83, 78, 0.6) !important;
              font-size: 0.875rem;
              text-decoration: none !important;
            }
            .plant-care-calendar .fc-daygrid-day.fc-day-today {
              background: transparent !important;
            }
            .plant-care-calendar .fc-daygrid-day.fc-day-other .fc-daygrid-day-number {
              color: rgba(168, 162, 158, 0.4) !important;
            }
            .plant-care-calendar .fc-daygrid-day-frame {
              cursor: pointer;
            }
            .plant-care-calendar .fc-more-link {
              color: #059669 !important;
              font-size: 0.75rem;
            }
            .plant-care-calendar .fc-more-link:hover {
              color: #10b981 !important;
            }
            .plant-care-calendar .fc-daygrid-day-events {
              min-height: 0 !important;
            }
            .plant-care-calendar .fc-daygrid-event-harness {
              margin-bottom: 1px !important;
            }
            .plant-care-calendar .fc-event {
              border: none !important;
              background: transparent !important;
            }
            .plant-care-calendar td {
              border-color: rgba(214, 211, 209, 0.3) !important;
            }
            .plant-care-calendar .fc-scrollgrid {
              border-color: rgba(214, 211, 209, 0.3) !important;
            }
            .plant-care-calendar .fc-daygrid-body tr {
              border-bottom: 1px solid rgba(214, 211, 209, 0.3);
            }
          `}</style>
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={filteredEvents}
            eventContent={renderEventContent}
            eventClick={handleEventClick}
            dateClick={handleDateClick}
            datesSet={handleDatesSet}
            height="auto"
            headerToolbar={false}
            dayMaxEvents={3}
            fixedWeekCount={false}
            noEventsText="No care tasks or logs"
            dayCellContent={(info) => {
              const isToday = info.date.toDateString() === new Date().toDateString();
              const isOtherMonth = info.date.getMonth() !== new Date().getMonth();
              return (
                <span
                  className={`text-sm ${
                    isToday
                      ? 'bg-[var(--color-forest)] text-white font-bold rounded-full h-7 w-7 flex items-center justify-center mx-auto'
                      : isOtherMonth
                      ? 'text-stone-300'
                      : 'text-stone-600'
                  }`}
                >
                  {info.dayNumberText}
                </span>
              );
            }}
          />
        </div>
      </div>

      {/* Day/Event detail modal */}
      {modalState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={() => setModalState(null)}
        >
          <div
            className="glass-card rounded-2xl p-6 pt-10 max-w-sm w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button — top-right corner */}
            <button
              onClick={() => setModalState(null)}
              className="absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-all z-10"
              title="Close (ESC)"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Day navigation header */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={goToPrevDay}
                disabled={!hasPrevDay}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Previous day with events"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="text-center">
                <p className="text-sm font-medium text-stone-800">
                  {formatFriendlyDate(modalState.dateStr)}
                </p>
                {modalEvents.length > 0 && (
                  <p className="text-xs text-stone-400">
                    {modalEvents.length} task{modalEvents.length !== 1 ? 's' : ''}
                    {modalEvents.length > 1 && ` · ${modalState.eventIndex + 1} of ${modalEvents.length}`}
                  </p>
                )}
              </div>
              <button
                onClick={goToNextDay}
                disabled={!hasNextDay}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next day with events"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* No events for this day */}
            {modalEvents.length === 0 ? (
              <div className="text-center py-6">
                <Calendar size={28} className="mx-auto mb-2 text-white/40" aria-hidden="true" />
                <p className="text-white/40 text-sm">No tasks for this day</p>
              </div>
            ) : selectedEvent ? (
              <>
                {/* Event navigation within the day */}
                {modalEvents.length > 1 && (
                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={goToPrevEvent}
                      disabled={modalState.eventIndex <= 0}
                      className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs text-white/30">
                      {TASK_TYPE_LABELS[selectedEvent.extendedProps.taskType]}
                    </span>
                    <button
                      onClick={goToNextEvent}
                      disabled={modalState.eventIndex >= modalEvents.length - 1}
                      className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Event details — no inline X button, it's in the top-right */}
                <div className="flex items-start gap-3 mb-3">
                  <TaskIcon type={selectedEvent.extendedProps.taskType} size={24} className="shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-lg font-semibold text-stone-800">
                      {selectedEvent.title}
                    </h3>
                    <Link
                      href={`/plant/${selectedEvent.extendedProps.plantSlug}`}
                      className="text-sm text-emerald-600 hover:text-emerald-500 transition-colors"
                    >
                      {selectedEvent.extendedProps.plantName}
                    </Link>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-stone-500">Status:</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        selectedEvent.extendedProps.type === 'overdue'
                          ? 'bg-red-100 text-red-700'
                          : selectedEvent.extendedProps.type === 'logged'
                          ? 'bg-stone-200 text-stone-600'
                          : 'bg-emerald-100 text-emerald-700'
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
                      <span className="text-stone-500 text-sm">Notes:</span>
                      <p className="text-stone-600 text-sm mt-0.5 italic">
                        &ldquo;{selectedEvent.extendedProps.careLogNotes}&rdquo;
                      </p>
                    </div>
                  )}
                </div>

                {selectedEvent.extendedProps.type !== 'logged' && (
                  <button
                    onClick={() => handleLogCare(selectedEvent)}
                    disabled={logging === selectedEvent.extendedProps.taskId}
                    className="w-full rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
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
                    className="block text-center rounded-xl bg-amber-50/50 px-4 py-2.5 text-sm font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-100/80 transition-all"
                  >
                    View Plant Details
                  </Link>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
