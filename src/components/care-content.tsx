'use client';

import type { Plant, CareTask, CareLog, TaskType } from '@/lib/types';
import { TASK_TYPE_LABELS } from '@/lib/types';
import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { TaskIcon } from '@/components/ui/task-icon';
import { UI_ICONS } from '@/lib/icons';
import { getPhotoUrl } from '@/lib/storage';

interface CareContentProps {
  plants: Plant[];
  careTasks: CareTask[];
  careLogs: CareLog[];
  primaryPhotoMap?: Record<string, string>;
}

export function CareContent({ plants, careTasks, careLogs, primaryPhotoMap = {} }: CareContentProps) {
  const [logging, setLogging] = useState<string | null>(null);
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogCare = async (taskId: string, taskType: TaskType, plantId: string) => {
    setLogging(taskId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('care_logs').insert({
        plant_id: plantId,
        task_id: taskId,
        task_type: taskType,
        logged_by: user.id,
        logged_at: new Date().toISOString(),
      });

      router.refresh();
    } finally {
      setLogging(null);
    }
  };

  const today = new Date();

  // Build a list of tasks with computed state
  const tasksWithPlants = careTasks
    .map((task) => {
      const plant = plants.find((p) => p.id === task.plant_id);
      if (!plant) return null;

      const logsForTask = careLogs
        .filter((l) => l.task_id === task.id)
        .sort(
          (a, b) =>
            new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
        );
      const lastLog = logsForTask[0];
      const daysSinceLast = lastLog
        ? Math.floor(
            (today.getTime() - new Date(lastLog.logged_at).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null;

      const isOverdue = task.frequency_days
        ? daysSinceLast !== null && daysSinceLast >= task.frequency_days
        : false;

      const daysUntilDue = task.frequency_days
        ? daysSinceLast !== null
          ? task.frequency_days - daysSinceLast
          : task.frequency_days
        : null;

      return {
        ...task,
        plant,
        lastLog,
        daysSinceLast,
        isOverdue,
        daysUntilDue,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  // Plant filter: chips show only plants that currently have tasks
  const plantsWithTasks = plants.filter((p) =>
    tasksWithPlants.some((t) => t.plant_id === p.id)
  );
  const visibleTasks = selectedPlantId
    ? tasksWithPlants.filter((t) => t.plant_id === selectedPlantId)
    : tasksWithPlants;

  // Group tasks
  const overdueTasks = visibleTasks.filter((t) => t.isOverdue);
  const todayTasks = visibleTasks.filter(
    (t) => !t.isOverdue && t.daysUntilDue !== null && t.daysUntilDue <= 1
  );
  const upcomingTasks = visibleTasks.filter(
    (t) => !t.isOverdue && t.daysUntilDue !== null && t.daysUntilDue > 1 && t.daysUntilDue <= 7
  );
  const otherTasks = visibleTasks.filter(
    (t) => !t.isOverdue && (t.daysUntilDue === null || t.daysUntilDue > 7)
  );

  return (
    <div className="space-y-6">
      {/* Plant filter chips — horizontal scroll on mobile */}
      {plantsWithTasks.length > 1 && (
        <div className="-mx-4 px-4 overflow-x-auto">
          <div className="flex w-max flex-nowrap gap-2">
            <FilterChip
              active={selectedPlantId === null}
              onClick={() => setSelectedPlantId(null)}
              label="All plants"
            />
            {plantsWithTasks.map((plant) => (
              <FilterChip
                key={plant.id}
                active={selectedPlantId === plant.id}
                onClick={() =>
                  setSelectedPlantId(selectedPlantId === plant.id ? null : plant.id)
                }
                label={plant.nickname || plant.common_name}
              />
            ))}
          </div>
        </div>
      )}

      {tasksWithPlants.length === 0 && plants.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <img
            src="/illustrations/empty-plants.webp"
            alt=""
            width={160}
            height={160}
            className="mx-auto mb-4"
          />
          <h3 className="text-xl font-semibold text-stone-700 mb-2">No plants yet</h3>
          <p className="text-stone-400 text-sm mb-6">
            Add a plant first, then configure its care schedule.
          </p>
          <Link
            href="/plants/new"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-400 transition-all"
          >
            Add Plant
          </Link>
        </div>
      ) : tasksWithPlants.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <img
            src="/illustrations/empty-care.webp"
            alt=""
            width={160}
            height={160}
            className="mx-auto mb-4"
          />
          <h3 className="text-xl font-semibold text-stone-700 mb-2">No care tasks yet</h3>
          <p className="text-stone-400 text-sm mb-6">
            Configure care schedules for your plants to see them here.
          </p>
          <Link
            href="/plants"
            className="text-emerald-600 text-sm hover:text-emerald-500 transition-colors"
          >
            Go to Plants
          </Link>
        </div>
      ) : (
        <>
          {/* Overdue */}
          {overdueTasks.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-amber-600 mb-4 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Overdue ({overdueTasks.length})
              </h2>
              <div className="space-y-2">
                {overdueTasks.map((task) => (
                  <div
                    key={task.id}
                    className="glass-card rounded-xl p-4 border border-amber-500/20"
                  >
                    <TaskRow
                      task={task}
                      photoUrl={primaryPhotoMap[task.plant_id] ?? null}
                      onLog={() => handleLogCare(task.id, task.task_type as TaskType, task.plant_id)}
                      logging={logging === task.id}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Today */}
          {todayTasks.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-stone-800 mb-4">
                Due Today ({todayTasks.length})
              </h2>
              <div className="space-y-2">
                {todayTasks.map((task) => (
                  <div key={task.id} className="glass-card rounded-xl p-4">
                    <TaskRow
                      task={task}
                      photoUrl={primaryPhotoMap[task.plant_id] ?? null}
                      onLog={() => handleLogCare(task.id, task.task_type as TaskType, task.plant_id)}
                      logging={logging === task.id}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* This week */}
          {upcomingTasks.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-stone-500 mb-4">
                Later This Week ({upcomingTasks.length})
              </h2>
              <div className="space-y-2">
                {upcomingTasks.map((task) => (
                  <div key={task.id} className="glass-card rounded-xl p-4">
                    <TaskRow
                      task={task}
                      photoUrl={primaryPhotoMap[task.plant_id] ?? null}
                      onLog={() => handleLogCare(task.id, task.task_type as TaskType, task.plant_id)}
                      logging={logging === task.id}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Other */}
          {otherTasks.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-stone-400 mb-4">
                All Tasks ({otherTasks.length})
              </h2>
              <div className="space-y-2">
                {otherTasks.map((task) => (
                  <div key={task.id} className="glass-card rounded-xl p-4">
                    <TaskRow
                      task={task}
                      photoUrl={primaryPhotoMap[task.plant_id] ?? null}
                      onLog={() => handleLogCare(task.id, task.task_type as TaskType, task.plant_id)}
                      logging={logging === task.id}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label }: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[44px] items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all ${
        active
          ? 'bg-[var(--color-forest)] text-white shadow-sm'
          : 'glass-card text-stone-500 hover:text-stone-800'
      }`}
    >
      <UI_ICONS.plants size={14} aria-hidden="true" />
      {label}
    </button>
  );
}

function TaskRow({ task, photoUrl, onLog, logging }: {
  task: CareTask & { plant: Plant; lastLog: CareLog | undefined; daysSinceLast: number | null; isOverdue: boolean; daysUntilDue: number | null };
  photoUrl: string | null;
  onLog: () => void;
  logging: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
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
      <TaskIcon type={task.task_type as TaskType} size={20} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <Link
          href={`/plant/${task.plant.slug}`}
          className="text-sm font-medium text-stone-800 hover:text-[var(--color-forest)] transition-colors"
        >
          {task.plant.nickname || task.plant.common_name}
        </Link>
        <p className="text-xs text-stone-400">
          {TASK_TYPE_LABELS[task.task_type as TaskType]}
          {task.frequency_days && ` · every ${task.frequency_days}d`}
          {task.daysSinceLast !== null &&
            ` · ${task.daysSinceLast}d since last`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {task.daysUntilDue !== null && (
          <span
            className={`text-xs ${
              task.daysUntilDue <= 2
                ? 'text-amber-600'
                : 'text-stone-400'
            }`}
          >
            {task.daysUntilDue === 0
              ? 'Due today'
              : task.daysUntilDue === 1
              ? 'Due tomorrow'
              : `${task.daysUntilDue}d`}
          </span>
        )}
        {/* Inline Done — 48px touch target */}
        <button
          onClick={onLog}
          disabled={logging}
          aria-label={`Mark ${TASK_TYPE_LABELS[task.task_type as TaskType]} done for ${task.plant.nickname || task.plant.common_name}`}
          className="flex h-12 w-12 items-center justify-center rounded-full text-[var(--color-forest)] hover:bg-[var(--color-forest)]/10 active:bg-[var(--color-forest)]/20 disabled:opacity-40 transition-colors"
        >
          <UI_ICONS.check size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
