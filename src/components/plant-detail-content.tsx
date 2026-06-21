'use client';

import type { Plant, CareTask, CareLog, JournalEntry, TaskType } from '@/lib/types';
import {
  TASK_TYPE_ICONS,
  TASK_TYPE_LABELS,
  LIGHT_REQUIREMENT_LABELS,
} from '@/lib/types';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PlantDetailContentProps {
  plant: Plant;
  careTasks: CareTask[];
  careLogs: CareLog[];
  journalEntries: (JournalEntry & { profiles?: { display_name: string | null; avatar_url: string | null } })[];
  isOwner: boolean;
}

export function PlantDetailContent({
  plant,
  careTasks,
  careLogs,
  journalEntries,
  isOwner,
}: PlantDetailContentProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loggingTask, setLoggingTask] = useState<string | null>(null);
  const [journalText, setJournalText] = useState('');
  const [savingJournal, setSavingJournal] = useState(false);
  const [now] = useState(Date.now);

  const handleLogCare = async (taskId: string, taskType: TaskType) => {
    setLoggingTask(taskId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('care_logs').insert({
        plant_id: plant.id,
        task_id: taskId,
        task_type: taskType,
        logged_by: user.id,
        logged_at: new Date().toISOString(),
      });

      router.refresh();
    } finally {
      setLoggingTask(null);
    }
  };

  const handleAddJournalEntry = async () => {
    if (!journalText.trim()) return;
    setSavingJournal(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('journal_entries').insert({
        plant_id: plant.id,
        author_id: user.id,
        content: journalText.trim(),
      });

      setJournalText('');
      router.refresh();
    } finally {
      setSavingJournal(false);
    }
  };

  const getLastLogForTask = (taskId: string) => {
    return careLogs.find((l) => l.task_id === taskId);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="glass-card rounded-2xl p-6 sm:p-8">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <span className="text-4xl">🪴</span>
            <div>
              <h1 className="text-3xl font-bold text-white">
                {plant.nickname || plant.common_name}
              </h1>
              {plant.scientific_name && (
                <p className="text-lg text-white/40 italic mt-1">
                  {plant.scientific_name}
                </p>
              )}
              {plant.common_name && plant.nickname && (
                <p className="text-sm text-white/30 mt-0.5">{plant.common_name}</p>
              )}
            </div>
          </div>
          {isOwner && (
            <Link
              href={`/plant/${plant.slug}/edit`}
              className="glass-card rounded-xl px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/10 transition-all"
            >
              Edit
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          {plant.location && (
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Location</p>
              <p className="text-sm text-white">📍 {plant.location}</p>
            </div>
          )}
          {plant.light_requirement && (
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Light</p>
              <p className="text-sm text-white">
                ☀️ {LIGHT_REQUIREMENT_LABELS[plant.light_requirement]}
              </p>
            </div>
          )}
          {plant.adopted_at && (
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Adopted</p>
              <p className="text-sm text-white">
                📅 {new Date(plant.adopted_at).toLocaleDateString()}
              </p>
            </div>
          )}
          {plant.min_temp && (
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Temperature</p>
              <p className="text-sm text-white">
                🌡️ {plant.min_temp}°C{plant.max_temp ? ` - ${plant.max_temp}°C` : ''}
              </p>
            </div>
          )}
        </div>

        {plant.notes && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-sm text-white/50">{plant.notes}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Care Schedule */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Care Schedule</h2>
          {careTasks.length === 0 ? (
            <div className="glass-card rounded-2xl p-6 text-center">
              <p className="text-white/30 text-sm mb-4">No care tasks configured yet.</p>
              {isOwner && (
                <Link
                  href={`/plant/${plant.slug}/edit`}
                  className="text-emerald-400 text-sm hover:text-emerald-300 transition-colors"
                >
                  Configure care tasks
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {careTasks.map((task) => {
                const lastLog = getLastLogForTask(task.id);
                const daysSinceLast = lastLog
                  ? Math.floor(
                      (now - new Date(lastLog.logged_at).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
                  : null;
                const isOverdue =
                  task.frequency_days && daysSinceLast !== null
                    ? daysSinceLast >= task.frequency_days
                    : false;

                return (
                  <div
                    key={task.id}
                    className={`glass-card rounded-xl p-4 transition-all hover:bg-white/[0.05] ${
                      isOverdue ? 'border-amber-500/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">
                          {TASK_TYPE_ICONS[task.task_type as TaskType]}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {TASK_TYPE_LABELS[task.task_type as TaskType]}
                          </p>
                          <p className="text-xs text-white/40">
                            {task.frequency_days
                              ? `Every ${task.frequency_days} day${task.frequency_days !== 1 ? 's' : ''}`
                              : 'As needed'}
                            {task.amount && ` · ${task.amount}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {lastLog && (
                          <span className="text-xs text-white/30">
                            {daysSinceLast}d ago
                          </span>
                        )}
                        {isOverdue && (
                          <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                            Due
                          </span>
                        )}
                        <button
                          onClick={() => handleLogCare(task.id, task.task_type as TaskType)}
                          disabled={loggingTask === task.id}
                          className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 transition-all"
                        >
                          {loggingTask === task.id ? '...' : 'Done'}
                        </button>
                      </div>
                    </div>

                    {task.notes && (
                      <p className="text-xs text-white/30 mt-2 ml-9">{task.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Recent care logs for this plant */}
          {careLogs.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-white/50 mb-3">Recent Logs</h3>
              <div className="space-y-1.5">
                {careLogs.slice(0, 10).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-2 text-xs text-white/30"
                  >
                    <span>{TASK_TYPE_ICONS[log.task_type as TaskType]}</span>
                    <span className="text-white/50">
                      {TASK_TYPE_LABELS[log.task_type as TaskType]}
                    </span>
                    <span>·</span>
                    <span>{new Date(log.logged_at).toLocaleDateString()}</span>
                    {log.notes && <span>· &ldquo;{log.notes}&rdquo;</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Journal */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Journal</h2>

          <div className="glass-card rounded-2xl p-4 mb-4">
            <textarea
              value={journalText}
              onChange={(e) => setJournalText(e.target.value)}
              placeholder="Write a journal entry about this plant..."
              rows={3}
              className="w-full bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none resize-none"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleAddJournalEntry}
                disabled={!journalText.trim() || savingJournal}
                className="rounded-lg bg-emerald-500/20 px-4 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 transition-all"
              >
                {savingJournal ? 'Saving...' : 'Add Entry'}
              </button>
            </div>
          </div>

          {journalEntries.length === 0 ? (
            <div className="glass-card rounded-2xl p-6 text-center">
              <p className="text-white/30 text-sm">No journal entries yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {journalEntries.map((entry) => (
                <div key={entry.id} className="glass-card rounded-xl p-4">
                  <p className="text-sm text-white/80">{entry.content}</p>
                  <p className="text-xs text-white/30 mt-2">
                    {new Date(entry.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {entry.profiles?.display_name &&
                      ` · ${entry.profiles.display_name}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
