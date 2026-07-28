'use client';

import { useState } from 'react';
import type { Plant, CareLog, CareTask, TaskType } from '@/lib/types';
import { TASK_TYPE_LABELS } from '@/lib/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { PlantCard } from './plant-card';
import { TaskIcon } from '@/components/ui/task-icon';
import { UI_ICONS } from '@/lib/icons';
import { getPhotoUrl } from '@/lib/storage';
import { getPlantDueSummary } from '@/lib/plant-status';

interface DashboardContentProps {
  plants: Plant[];
  careLogs: CareLog[];
  careTasks: CareTask[];
  userEmail: string;
  primaryPhotoMap?: Record<string, string>;
}

export function DashboardContent({ plants, careLogs, careTasks, primaryPhotoMap = {} }: DashboardContentProps) {
  const totalPlants = plants.length;
  const activeTasks = careTasks.length;
  const [today] = useState(() => new Date());
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const router = useRouter();
  const supabase = createClient();

  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // Inline quick-log: optimistic check, then persist + refresh
  const handleQuickLog = async (taskId: string, taskType: TaskType, plantId: string) => {
    setDoneIds((prev) => new Set(prev).add(taskId));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      await supabase.from('care_logs').insert({
        plant_id: plantId,
        task_id: taskId,
        task_type: taskType,
        logged_by: user.id,
        logged_at: new Date().toISOString(),
      });

      router.refresh();
    } catch {
      // Roll back the optimistic state on failure
      setDoneIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  // Compute upcoming / overdue care
  const upcomingTasks = careTasks
    .map((task) => {
      const logsForTask = careLogs
        .filter((l) => l.task_id === task.id)
        .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());
      const lastDone = logsForTask[0]?.logged_at ?? null;
      const daysSinceLastDone = lastDone
        ? Math.floor(
            (today.getTime() - new Date(lastDone).getTime()) / (1000 * 60 * 60 * 24)
          )
        : null;
      const nextDue = task.frequency_days
        ? (daysSinceLastDone !== null ? daysSinceLastDone : 0) >= task.frequency_days
        : false;

      return {
        ...task,
        plant: plants.find((p) => p.id === task.plant_id),
        lastDone,
        daysSinceLastDone,
        isOverdue: nextDue,
      };
    })
    .filter((t) => t.plant && !doneIds.has(t.id))
    .sort((a, b) => {
      // Overdue first, then by days since last done
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return (b.daysSinceLastDone ?? 0) - (a.daysSinceLastDone ?? 0);
    })
    .slice(0, 8);

  const recentActivity = careLogs.slice(0, 10);
  const overdueCount = upcomingTasks.filter((t) => t.isOverdue).length;

  return (
    <div className="space-y-8">
      {/* Header — stacks on mobile */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-800">{greeting}</h1>
          <p className="mt-1 text-stone-500">
            {totalPlants} plant{totalPlants !== 1 ? 's' : ''} · {activeTasks} active care task{activeTasks !== 1 ? 's' : ''}
            {overdueCount > 0 && (
              <span className="text-[var(--color-overdue,#d97706)] font-medium"> · {overdueCount} overdue</span>
            )}
          </p>
        </div>
        <Link
          href="/plants/new"
          className="glass-card rounded-xl px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100/80 transition-all active:scale-[0.98] flex items-center justify-center gap-2 sm:w-auto w-full"
        >
          <UI_ICONS.add size={16} aria-hidden="true" />
          Add Plant
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={UI_ICONS.plants} iconClass="text-[var(--color-forest)]" value={totalPlants} label="Total Plants" />
        <StatCard icon={UI_ICONS.care} iconClass="text-[var(--color-forest)]" value={activeTasks} label="Active Tasks" />
        <StatCard icon={UI_ICONS.warning} iconClass="text-[var(--color-overdue,#d97706)]" value={overdueCount} label="Overdue" />
        <StatCard icon={UI_ICONS.success} iconClass="text-[var(--color-forest)]" value={careLogs.length} label="Care Logs" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upcoming care tasks with inline quick-log */}
        <div>
          <h2 className="text-lg font-semibold text-stone-800 mb-4">Upcoming Care</h2>
          {upcomingTasks.length === 0 ? (
            <div className="glass-card rounded-2xl p-6 text-center">
              <p className="text-stone-400 text-sm">No care tasks configured yet.</p>
              <Link
                href="/plants/new"
                className="text-[var(--color-forest)] text-sm hover:text-[var(--color-forest-hover)] mt-2 inline-block transition-colors"
              >
                Add your first plant
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingTasks.map((task) => {
                const photoUrl = task.plant ? primaryPhotoMap[task.plant.id] : null;
                return (
                  <div
                    key={`${task.id}-${task.plant?.slug}`}
                    className={`glass-card rounded-xl p-3 flex items-center gap-3 ${
                      task.isOverdue ? 'border-amber-500/20' : ''
                    }`}
                  >
                    {/* Plant photo thumb */}
                    {photoUrl ? (
                      <img
                        src={getPhotoUrl(photoUrl)}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-forest)]/10 text-[var(--color-forest)] flex-shrink-0">
                        <UI_ICONS.plants size={16} aria-hidden="true" />
                      </span>
                    )}
                    <TaskIcon type={task.task_type as TaskType} size={20} className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/plant/${task.plant?.slug}`}
                        className="text-sm font-medium text-stone-800 hover:text-[var(--color-forest)] transition-colors truncate block"
                      >
                        {task.plant?.nickname || task.plant?.common_name}
                      </Link>
                      <p className="text-xs text-stone-400 truncate">
                        {TASK_TYPE_LABELS[task.task_type as TaskType]}
                        {task.daysSinceLastDone !== null &&
                          ` · ${task.daysSinceLastDone}d since last`}
                      </p>
                    </div>
                    {task.isOverdue && (
                      <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full flex-shrink-0">
                        Overdue
                      </span>
                    )}
                    {/* Inline Done — 48px touch target */}
                    <button
                      onClick={() => handleQuickLog(task.id, task.task_type as TaskType, task.plant_id)}
                      aria-label={`Mark ${TASK_TYPE_LABELS[task.task_type as TaskType]} done for ${task.plant?.nickname || task.plant?.common_name}`}
                      className="flex h-12 w-12 items-center justify-center rounded-full text-[var(--color-forest)] hover:bg-[var(--color-forest)]/10 active:bg-[var(--color-forest)]/20 transition-colors flex-shrink-0"
                    >
                      <UI_ICONS.check size={20} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div>
          <h2 className="text-lg font-semibold text-stone-800 mb-4">Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <div className="glass-card rounded-2xl p-6 text-center">
              <p className="text-stone-400 text-sm">No care logged yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((log) => {
                const logPlant = plants.find((p) => p.id === log.plant_id);
                const timeAgo = getTimeAgo(new Date(log.logged_at));
                return (
                  <div
                    key={log.id}
                    className="glass-card rounded-xl p-4 flex items-center gap-3"
                  >
                    <TaskIcon type={log.task_type as TaskType} size={18} className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-700">
                        <span className="font-medium">
                          {TASK_TYPE_LABELS[log.task_type as TaskType]}
                        </span>
                        <span className="text-stone-400"> on </span>
                        <span className="text-[var(--color-forest)]">
                          {logPlant?.nickname || logPlant?.common_name || 'Unknown plant'}
                        </span>
                      </p>
                      {log.notes && (
                        <p className="text-xs text-stone-400 mt-0.5 truncate">{log.notes}</p>
                      )}
                    </div>
                    <span className="text-xs text-stone-400 whitespace-nowrap">{timeAgo}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Plant grid */}
      <div>
        <h2 className="text-lg font-semibold text-stone-800 mb-4">Your Plants</h2>
        {plants.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <UI_ICONS.plants size={48} className="mx-auto mb-4 text-stone-300" aria-hidden="true" />
            <h3 className="text-xl font-semibold text-stone-700 mb-2">No plants yet</h3>
            <p className="text-stone-400 text-sm mb-6">
              Add your first plant to start tracking its care.
            </p>
            <Link
              href="/plants/new"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-forest)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[rgba(61,122,90,0.3)] hover:bg-[var(--color-forest-hover)] transition-all"
            >
              <UI_ICONS.add size={16} aria-hidden="true" />
              Add your first plant
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plants.map((plant) => (
              <PlantCard
                key={plant.id}
                plant={plant}
                primaryPhotoUrl={primaryPhotoMap[plant.id] ?? null}
                dueSummary={getPlantDueSummary(
                  careTasks.filter((t) => t.plant_id === plant.id),
                  careLogs.filter((l) => l.plant_id === plant.id),
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, iconClass, value, label }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconClass: string;
  value: number;
  label: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-2xl font-bold text-stone-800">{value}</p>
        <Icon size={18} className={iconClass} />
      </div>
      <p className="text-xs text-stone-500 mt-1">{label}</p>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
