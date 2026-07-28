'use client';

import type { Plant, CareTask, CareLog, JournalEntry, PlantPhoto, GrowthRecord, TaskType } from '@/lib/types';
import {
  TASK_TYPE_LABELS,
  LIGHT_REQUIREMENT_LABELS,
} from '@/lib/types';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PhotoGallery } from './photo-gallery';
import { getPhotoUrl } from '@/lib/storage';
import { QRCode } from './qr-code';
import { CopyAsPrompt } from './copy-as-prompt';
import { GrowthTracking } from './growth-tracking';
import { TaskIcon } from '@/components/ui/task-icon';
import { UI_ICONS } from '@/lib/icons';
import type { LucideIcon } from 'lucide-react';

interface PlantDetailContentProps {
  plant: Plant;
  careTasks: CareTask[];
  careLogs: CareLog[];
  journalEntries: (JournalEntry & { profiles?: { display_name: string | null; avatar_url: string | null } })[];
  photos: PlantPhoto[];
  growthRecords: GrowthRecord[];
  isOwner: boolean;
}

type TabId = 'care' | 'journal' | 'photos' | 'growth';

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'care', label: 'Care', icon: UI_ICONS.care },
  { id: 'journal', label: 'Journal', icon: UI_ICONS.book },
  { id: 'photos', label: 'Photos', icon: UI_ICONS.image },
  { id: 'growth', label: 'Growth', icon: UI_ICONS.growth },
];

export function PlantDetailContent({
  plant,
  careTasks,
  careLogs,
  journalEntries,
  photos,
  growthRecords,
  isOwner,
}: PlantDetailContentProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loggingTask, setLoggingTask] = useState<string | null>(null);
  const [journalText, setJournalText] = useState('');
  const [savingJournal, setSavingJournal] = useState(false);
  const [now] = useState(Date.now);
  const [photosKey, setPhotosKey] = useState(0);
  const [activeTab, setActiveTab] = useState<TabId>('care');

  const primaryPhoto = photos.find((p) => p.is_primary);

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
    <div className="space-y-6">
      {/* Hero photo header */}
      <div className="relative overflow-hidden rounded-2xl glass-card">
        <div className="relative h-44 sm:h-56">
          {primaryPhoto ? (
            <img
              src={getPhotoUrl(primaryPhoto.url)}
              alt={plant.nickname || plant.common_name}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-forest)]/8 text-[var(--color-forest)]/40">
              <UI_ICONS.plants size={64} aria-hidden="true" />
            </div>
          )}

          {/* Actions, top-right over the photo */}
          <div className="absolute right-3 top-3 flex items-center gap-1.5">
            <div className="sm:hidden">
              <CopyAsPrompt plant={plant} careTasks={careTasks} compact />
            </div>
            <div className="hidden sm:block">
              <CopyAsPrompt plant={plant} careTasks={careTasks} />
            </div>
            {isOwner && (
              <>
                <Link
                  href={`/plant/${plant.slug}/edit`}
                  className="hidden sm:inline-flex rounded-xl bg-black/40 px-4 py-2 text-sm text-white backdrop-blur-sm hover:bg-black/55 transition-all"
                >
                  Edit
                </Link>
                <Link
                  href={`/plant/${plant.slug}/edit`}
                  className="sm:hidden rounded-xl bg-black/40 p-2 text-white backdrop-blur-sm hover:bg-black/55 transition-all"
                  title="Edit plant"
                >
                  <UI_ICONS.edit size={16} aria-hidden="true" />
                </Link>
              </>
            )}
          </div>

          {/* Name overlay with gradient fade */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-5 pb-4 pt-14">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {plant.nickname || plant.common_name}
            </h1>
            {plant.nickname && plant.common_name && (
              <p className="text-sm text-white/75 mt-0.5">{plant.common_name}</p>
            )}
            {plant.scientific_name && (
              <p className="text-sm text-white/60 italic mt-0.5">
                {plant.scientific_name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Sticky tab bar — scrolls horizontally with snap on mobile */}
      <div className="sticky top-0 z-20 -mx-4 px-4 bg-[var(--color-bg-base)]/95 py-2">
        <div
          role="tablist"
          aria-label="Plant sections"
          className="glass-card flex gap-1 overflow-x-auto rounded-2xl p-1 snap-x snap-mandatory"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-[48px] flex-1 snap-start items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? 'bg-[var(--color-forest)] text-white shadow-sm'
                    : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100/50'
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Care tab */}
      {activeTab === 'care' && (
        <div role="tabpanel" className="space-y-6">
          {/* Info grid */}
          {(plant.location || plant.light_requirement || plant.adopted_at || plant.min_temp) && (
            <div className="glass-card rounded-2xl p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {plant.location && (
                  <div>
                    <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Location</p>
                    <p className="flex items-center gap-1.5 text-sm text-stone-700">
                      <UI_ICONS.location size={14} className="text-stone-400 flex-shrink-0" aria-hidden="true" />
                      {plant.location}
                    </p>
                  </div>
                )}
                {plant.light_requirement && (
                  <div>
                    <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Light</p>
                    <p className="flex items-center gap-1.5 text-sm text-stone-700">
                      <UI_ICONS.sun size={14} className="text-[var(--color-sun)] flex-shrink-0" aria-hidden="true" />
                      {LIGHT_REQUIREMENT_LABELS[plant.light_requirement]}
                    </p>
                  </div>
                )}
                {plant.adopted_at && (
                  <div>
                    <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Adopted</p>
                    <p className="flex items-center gap-1.5 text-sm text-stone-700">
                      <UI_ICONS.care size={14} className="text-stone-400 flex-shrink-0" aria-hidden="true" />
                      {new Date(plant.adopted_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {plant.min_temp && (
                  <div>
                    <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Temperature</p>
                    <p className="flex items-center gap-1.5 text-sm text-stone-700">
                      <UI_ICONS.thermometer size={14} className="text-[var(--color-terracotta)] flex-shrink-0" aria-hidden="true" />
                      {plant.min_temp}°C{plant.max_temp ? ` - ${plant.max_temp}°C` : ''}
                    </p>
                  </div>
                )}
              </div>
              {plant.notes && (
                <p className="text-sm text-stone-500 mt-4 pt-4 border-t border-[rgba(80,60,40,0.08)]">
                  {plant.notes}
                </p>
              )}
            </div>
          )}

          {/* Care Schedule */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-stone-800">Care Schedule</h2>
              {careTasks.length > 0 && (
                <Link
                  href={`/care/calendar?plant=${plant.slug}`}
                  className="glass-card rounded-xl px-3 py-1.5 text-xs font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-100/80 transition-all flex items-center gap-1.5"
                >
                  <UI_ICONS.care size={12} aria-hidden="true" />
                  Calendar
                </Link>
              )}
            </div>
            {careTasks.length === 0 ? (
              <div className="glass-card rounded-2xl p-6 text-center">
                <p className="text-stone-400 text-sm mb-4">No care tasks configured yet.</p>
                {isOwner && (
                  <Link
                    href={`/plant/${plant.slug}/edit`}
                    className="text-[var(--color-forest)] text-sm hover:text-[var(--color-forest-hover)] transition-colors"
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
                      className={`glass-card rounded-xl p-4 ${
                        isOverdue ? 'border-amber-500/20' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <TaskIcon type={task.task_type as TaskType} size={20} className="flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-stone-800">
                              {TASK_TYPE_LABELS[task.task_type as TaskType]}
                            </p>
                            <p className="text-xs text-stone-400">
                              {task.frequency_days
                                ? `Every ${task.frequency_days} day${task.frequency_days !== 1 ? 's' : ''}`
                                : 'As needed'}
                              {task.amount && ` · ${task.amount}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {lastLog && (
                            <span className="text-xs text-stone-400">
                              {daysSinceLast}d ago
                            </span>
                          )}
                          {isOverdue && (
                            <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                              Due
                            </span>
                          )}
                          <button
                            onClick={() => handleLogCare(task.id, task.task_type as TaskType)}
                            disabled={loggingTask === task.id}
                            aria-label={`Mark ${TASK_TYPE_LABELS[task.task_type as TaskType]} done`}
                            className="flex h-12 w-12 items-center justify-center rounded-full text-[var(--color-forest)] hover:bg-[var(--color-forest)]/10 active:bg-[var(--color-forest)]/20 disabled:opacity-40 transition-colors"
                          >
                            <UI_ICONS.check size={20} aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      {task.notes && (
                        <p className="text-xs text-stone-400 mt-2 ml-9">{task.notes}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Recent care logs for this plant */}
            {careLogs.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-stone-500 mb-3">Recent Logs</h3>
                <div className="space-y-1.5">
                  {careLogs.slice(0, 10).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-2 text-xs text-stone-400"
                    >
                      <TaskIcon type={log.task_type as TaskType} size={14} className="flex-shrink-0" />
                      <span className="text-stone-500">
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
        </div>
      )}

      {/* Journal tab */}
      {activeTab === 'journal' && (
        <div role="tabpanel" id="journal" className="space-y-4">
          <div className="glass-card rounded-2xl p-4">
            <textarea
              value={journalText}
              onChange={(e) => setJournalText(e.target.value)}
              placeholder="Write a journal entry about this plant..."
              rows={3}
              className="w-full bg-transparent text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none resize-none"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleAddJournalEntry}
                disabled={!journalText.trim() || savingJournal}
                className="rounded-xl bg-[var(--color-forest)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--color-forest-hover)] disabled:opacity-50 transition-all"
              >
                {savingJournal ? 'Saving...' : 'Add Entry'}
              </button>
            </div>
          </div>

          {journalEntries.length === 0 ? (
            <div className="glass-card rounded-2xl p-6 text-center">
              <p className="text-stone-400 text-sm">No journal entries yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {journalEntries.map((entry) => (
                <div key={entry.id} className="glass-card rounded-xl p-4">
                  <p className="text-sm text-stone-700">{entry.content}</p>
                  <p className="text-xs text-stone-400 mt-2">
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
      )}

      {/* Photos tab */}
      {activeTab === 'photos' && (
        <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PhotoGallery
              key={photosKey}
              plantId={plant.id}
              photos={photos}
              onPhotosChanged={() => {
                setPhotosKey((k) => k + 1);
                router.refresh();
              }}
            />
          </div>
          <div>
            <div className="glass-card rounded-2xl p-4">
              <h3 className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">
                Pot Sticker QR
              </h3>
              <QRCode slug={plant.slug} plantName={plant.nickname || plant.common_name} compact={false} />
            </div>
          </div>
        </div>
      )}

      {/* Growth tab */}
      {activeTab === 'growth' && (
        <div role="tabpanel">
          <GrowthTracking plantId={plant.id} records={growthRecords} />
        </div>
      )}
    </div>
  );
}
