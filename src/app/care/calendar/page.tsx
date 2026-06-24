import { createClient } from '@/lib/supabase-server';
import { createDataClient } from '@/lib/data-client';
import { redirect } from 'next/navigation';
import { getAuthedUser } from '@/lib/get-user';
import { PlantCareCalendar, type CalendarEvent } from '@/components/plant-care-calendar';
import { estimateNextDue } from '@/lib/types';
import { TASK_TYPE_LABELS } from '@/lib/types';
import type { TaskType } from '@/lib/types';
import Link from 'next/link';

export default async function CareCalendarPage(props: {
  searchParams: Promise<{ plant?: string }>;
}) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) redirect('/auth/login');

  const db = await createDataClient();

  const { data: plants } = await db
    .from('plants')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  if (!plants || plants.length === 0) {
    return (
      <div className="text-center py-20">
        <span className="text-5xl mb-4 block">📅</span>
        <h1 className="text-2xl font-bold text-white mb-2">Care Calendar</h1>
        <p className="text-white/40 mb-6">
          Add plants and configure care tasks to see them on the calendar.
        </p>
        <Link
          href="/plants/new"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 transition-all"
        >
          Add your first plant
        </Link>
      </div>
    );
  }

  // Filter to a single plant if ?plant=slug is provided
  const plantSlug = searchParams.plant;
  const filteredPlants = plantSlug
    ? plants.filter((p) => p.slug === plantSlug)
    : plants;

  if (plantSlug && filteredPlants.length === 0) {
    redirect('/care/calendar');
  }

  const plantIds = filteredPlants.map((p) => p.id);

  const { data: careTasks } = await db
    .from('care_tasks')
    .select('*')
    .in('plant_id', plantIds)
    .eq('is_active', true);

  const { data: careLogs } = await db
    .from('care_logs')
    .select('*')
    .in('plant_id', plantIds)
    .order('logged_at', { ascending: false });

  const tasks = careTasks ?? [];
  const logs = careLogs ?? [];

  // Build a map: task_id → most recent log
  const latestLogByTask = new Map<string, (typeof logs)[0]>();
  for (const log of logs) {
    if (log.task_id && !latestLogByTask.has(log.task_id)) {
      latestLogByTask.set(log.task_id, log);
    }
  }

  const events: CalendarEvent[] = [];
  const now = new Date();

  // 1. Generate upcoming due / overdue events for each active task
  for (const task of tasks) {
    const plant = filteredPlants.find((p) => p.id === task.plant_id);
    if (!plant) continue;

    const lastLog = latestLogByTask.get(task.id);
    const nextDue = estimateNextDue(
      lastLog?.logged_at ?? null,
      task.frequency_days,
      task.seasonal_adjustment as Record<string, number> | undefined,
    );

    if (!nextDue) continue;

    const isOverdue = nextDue < now;
    const eventType = isOverdue ? ('overdue' as const) : ('due' as const);
    const color = isOverdue ? '#dc2626' : getTaskColor(task.task_type as TaskType);

    events.push({
      id: `due-${task.id}`,
      title: `${TASK_TYPE_LABELS[task.task_type as TaskType]}`,
      start: nextDue.toISOString().split('T')[0],
      allDay: true,
      backgroundColor: color,
      borderColor: color,
      textColor: '#ffffff',
      extendedProps: {
        type: eventType,
        plantId: plant.id,
        plantSlug: plant.slug,
        plantName: plant.nickname || plant.common_name,
        taskId: task.id,
        taskType: task.task_type as TaskType,
      },
    });
  }

  // 2. Show past care logs as completed events (last 3 months)
  for (const log of logs) {
    const plant = filteredPlants.find((p) => p.id === log.plant_id);
    if (!plant) continue;

    const logDate = new Date(log.logged_at);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    if (logDate < threeMonthsAgo) continue;

    events.push({
      id: `log-${log.id}`,
      title: `✓ ${TASK_TYPE_LABELS[log.task_type as TaskType]}`,
      start: logDate.toISOString().split('T')[0],
      allDay: true,
      backgroundColor: '#6b7280',
      borderColor: '#6b7280',
      textColor: '#ffffff',
      extendedProps: {
        type: 'logged',
        plantId: plant.id,
        plantSlug: plant.slug,
        plantName: plant.nickname || plant.common_name,
        taskType: log.task_type as TaskType,
        logId: log.id,
        careLogNotes: log.notes ?? undefined,
      },
    });
  }

  // Page title based on filter
  const filteredPlant = plantSlug ? filteredPlants[0] : null;
  const pageTitle = filteredPlant
    ? `${filteredPlant.nickname || filteredPlant.common_name} — Care Calendar`
    : 'Care Calendar';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{pageTitle}</h1>
          <p className="mt-1 text-white/50">
            {filteredPlant
              ? `${tasks.length} active task${tasks.length !== 1 ? 's' : ''}`
              : `${tasks.length} active task${tasks.length !== 1 ? 's' : ''} across ${filteredPlants.length} plant${filteredPlants.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {filteredPlant && (
            <Link
              href="/care/calendar"
              className="glass-card rounded-xl px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/10 transition-all"
            >
              All Plants
            </Link>
          )}
          <Link
            href="/care"
            className="glass-card rounded-xl px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/10 transition-all"
          >
            List View
          </Link>
        </div>
      </div>

      <PlantCareCalendar events={events} plants={filteredPlants} />
    </div>
  );
}

function getTaskColor(taskType: string): string {
  const colors: Record<string, string> = {
    watering: '#0ea5e9',
    fertilizing: '#10b981',
    repotting: '#f59e0b',
    pruning: '#8b5cf6',
    pest_disease: '#ef4444',
    propagation: '#ec4899',
  };
  return colors[taskType] || '#6b7280';
}
