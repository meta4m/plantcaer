'use client';

import { useState } from 'react';
import type { Plant, CareLog, CareTask, TaskType } from '@/lib/types';
import { TASK_TYPE_ICONS, TASK_TYPE_LABELS } from '@/lib/types';
import Link from 'next/link';
import { PlantCard } from './plant-card';

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
    .filter((t) => t.plant)
    .sort((a, b) => {
      // Overdue first, then by days since last done
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return (b.daysSinceLastDone ?? 0) - (a.daysSinceLastDone ?? 0);
    })
    .slice(0, 8);

  const recentActivity = careLogs.slice(0, 10);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-white/50">
            {totalPlants} plant{totalPlants !== 1 ? 's' : ''} · {activeTasks} active care task{activeTasks !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/plants/new"
          className="glass-card rounded-xl px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-all active:scale-[0.98] flex items-center gap-2"
        >
          <span className="text-lg">+</span>
          Add Plant
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-2xl font-bold text-white">{totalPlants}</p>
          <p className="text-xs text-white/50 mt-1">Total Plants</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-2xl font-bold text-emerald-400">{activeTasks}</p>
          <p className="text-xs text-white/50 mt-1">Active Tasks</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-2xl font-bold text-amber-400">
            {upcomingTasks.filter((t) => t.isOverdue).length}
          </p>
          <p className="text-xs text-white/50 mt-1">Overdue</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-2xl font-bold text-white">{careLogs.length}</p>
          <p className="text-xs text-white/50 mt-1">Care Logs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upcoming care tasks */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Upcoming Care</h2>
          {upcomingTasks.length === 0 ? (
            <div className="glass-card rounded-2xl p-6 text-center">
              <p className="text-white/30 text-sm">No care tasks configured yet.</p>
              <Link
                href="/plants/new"
                className="text-emerald-400 text-sm hover:text-emerald-300 mt-2 inline-block transition-colors"
              >
                Add your first plant
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingTasks.map((task) => (
                <Link
                  key={`${task.id}-${task.plant?.slug}`}
                  href={`/plant/${task.plant?.slug}`}
                  className={`glass-card rounded-xl p-4 flex items-center gap-3 transition-all hover:bg-white/[0.08] ${
                    task.isOverdue ? 'border-amber-500/20' : ''
                  }`}
                >
                  <span className="text-xl">{TASK_TYPE_ICONS[task.task_type as TaskType]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {TASK_TYPE_LABELS[task.task_type as TaskType]}
                    </p>
                    <p className="text-xs text-white/40 truncate">
                      {task.plant?.nickname || task.plant?.common_name}
                      {task.daysSinceLastDone !== null &&
                        ` · ${task.daysSinceLastDone}d since last`}
                    </p>
                  </div>
                  {task.isOverdue && (
                    <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      Overdue
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <div className="glass-card rounded-2xl p-6 text-center">
              <p className="text-white/30 text-sm">No care logged yet.</p>
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
                    <span className="text-lg">
                      {TASK_TYPE_ICONS[log.task_type as TaskType]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">
                        <span className="font-medium">
                          {TASK_TYPE_LABELS[log.task_type as TaskType]}
                        </span>
                        <span className="text-white/40"> on </span>
                        <span className="text-emerald-300">
                          {logPlant?.nickname || logPlant?.common_name || 'Unknown plant'}
                        </span>
                      </p>
                      {log.notes && (
                        <p className="text-xs text-white/30 mt-0.5 truncate">{log.notes}</p>
                      )}
                    </div>
                    <span className="text-xs text-white/30 whitespace-nowrap">{timeAgo}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Plant grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Your Plants</h2>
        {plants.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <span className="text-5xl mb-4 block">🪴</span>
            <h3 className="text-xl font-semibold text-white mb-2">No plants yet</h3>
            <p className="text-white/40 text-sm mb-6">
              Add your first plant to start tracking its care.
            </p>
            <Link
              href="/plants/new"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 transition-all"
            >
              <span>+</span>
              Add your first plant
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plants.map((plant) => (
              <PlantCard key={plant.id} plant={plant} primaryPhotoUrl={primaryPhotoMap[plant.id] ?? null} />
            ))}
          </div>
        )}
      </div>
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
