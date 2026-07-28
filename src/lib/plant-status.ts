import type { CareTask, CareLog, TaskType } from './types';
import { estimateNextDue } from './types';

/** Aggregated due status for one plant, computed from its active tasks + logs. */
export interface PlantDueSummary {
  /** Number of tasks past their due date. */
  overdue: number;
  /** Number of tasks due within the next 2 days (not overdue). */
  dueSoon: number;
  /** Days until the earliest upcoming due date (null when nothing scheduled). */
  nextDueInDays: number | null;
  /** Task type of the earliest upcoming due item (for badge text). */
  nextTaskType: TaskType | null;
}

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Compute the due status for a single plant from its active care tasks and logs.
 * Pass only the tasks/logs belonging to that plant.
 */
export function getPlantDueSummary(
  tasks: CareTask[],
  logs: CareLog[],
  now: Date = new Date(),
): PlantDueSummary {
  const latestLogByTask = new Map<string, CareLog>();
  for (const log of logs) {
    if (log.task_id && !latestLogByTask.has(log.task_id)) {
      latestLogByTask.set(log.task_id, log);
    }
  }

  let overdue = 0;
  let dueSoon = 0;
  let nextDueInDays: number | null = null;
  let nextTaskType: TaskType | null = null;

  for (const task of tasks) {
    const nextDue = estimateNextDue(
      latestLogByTask.get(task.id)?.logged_at ?? null,
      task.frequency_days,
      task.seasonal_adjustment as Record<string, number> | undefined,
    );
    if (!nextDue) continue;

    const days = Math.ceil((nextDue.getTime() - now.getTime()) / DAY_MS);
    if (days < 0) {
      overdue++;
    } else if (days <= 2) {
      dueSoon++;
    }

    if (days >= 0 && (nextDueInDays === null || days < nextDueInDays)) {
      nextDueInDays = days;
      nextTaskType = task.task_type;
    }
  }

  return { overdue, dueSoon, nextDueInDays, nextTaskType };
}

/** Card status color: red (overdue) → amber (due soon) → forest (healthy). */
export function getStatusColor(summary: PlantDueSummary): string {
  if (summary.overdue > 0) return '#dc2626';
  if (summary.dueSoon > 0) return 'var(--color-overdue, #d97706)';
  return 'var(--color-forest)';
}

/** Compact one-line badge text for the plant card, or null when nothing is due. */
export function formatDueBadge(summary: PlantDueSummary): string | null {
  if (summary.overdue > 0) {
    return `${summary.overdue} task${summary.overdue !== 1 ? 's' : ''} overdue`;
  }
  if (summary.nextDueInDays === null || !summary.nextTaskType) return null;
  const label = summary.nextTaskType === 'watering' ? 'Water'
    : summary.nextTaskType === 'fertilizing' ? 'Fertilize'
    : summary.nextTaskType === 'repotting' ? 'Repot'
    : summary.nextTaskType === 'pruning' ? 'Prune'
    : summary.nextTaskType === 'pest_disease' ? 'Check pests'
    : 'Propagate';
  if (summary.nextDueInDays === 0) return `${label} today`;
  if (summary.nextDueInDays === 1) return `${label} tomorrow`;
  return `${label} in ${summary.nextDueInDays} days`;
}
