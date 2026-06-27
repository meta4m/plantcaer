import { Suspense } from 'react';
import { createClient } from '@/lib/supabase-server';
import { createDataClient } from '@/lib/data-client';
import { redirect } from 'next/navigation';
import { getAuthedUser } from '@/lib/get-user';
import { CareView } from '@/components/care-view';
import type { CalendarEvent } from '@/components/plant-care-calendar';
import { estimateNextDue } from '@/lib/types';
import { TASK_TYPE_LABELS } from '@/lib/types';
import type { TaskType } from '@/lib/types';

async function CarePageContent({ searchParams }: {
  searchParams: { view?: string; plant?: string };
}) {
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) redirect('/auth/login');

  const db = await createDataClient();

  const { data: plants } = await db
    .from('plants')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  const plantIds = plants?.map((p) => p.id) ?? [];

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

  // Build calendar events
  const plantSlug = searchParams.plant;
  const filteredPlants = plantSlug
    ? (plants ?? []).filter((p) => p.slug === plantSlug)
    : (plants ?? []);

  if (plantSlug && filteredPlants.length === 0 && plants && plants.length > 0) {
    redirect('/care');
  }

  const filteredPlantIds = filteredPlants.map((p) => p.id);
  const filteredTasks = tasks.filter((t) => filteredPlantIds.includes(t.plant_id));
  const filteredLogs = logs.filter((l) => filteredPlantIds.includes(l.plant_id));

  const latestLogByTask = new Map<string, (typeof filteredLogs)[0]>();
  for (const log of filteredLogs) {
    if (log.task_id && !latestLogByTask.has(log.task_id)) {
      latestLogByTask.set(log.task_id, log);
    }
  }

  const events: CalendarEvent[] = [];
  const now = new Date();

  for (const task of filteredTasks) {
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

  for (const log of filteredLogs) {
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

  const view = searchParams.view === 'calendar' ? 'calendar' : 'list';

  return (
    <CareView
      plants={plants ?? []}
      careTasks={tasks}
      careLogs={logs}
      calendarEvents={events}
      calendarPlants={filteredPlants}
      defaultView={view}
      plantSlug={plantSlug}
      hasPlants={!!plants && plants.length > 0}
    />
  );
}

export default async function CarePage(props: {
  searchParams: Promise<{ view?: string; plant?: string }>;
}) {
  const searchParams = await props.searchParams;
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    }>
      <CarePageContent searchParams={searchParams} />
    </Suspense>
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
