/**
 * GET /api/calendar/export
 *
 * Generates an iCal (.ics) file with all active care tasks as recurring events,
 * allowing users to import their plant care schedule into Google Calendar,
 * Apple Calendar, Outlook, or any other calendar app.
 *
 * Each care task becomes a VEVENT with:
 *   - All-day event on its next due date
 *   - RRULE for the recurrence frequency (e.g. every 7 days)
 *   - Plant name + task type in the summary
 *   - Care notes in the description
 *
 * Past care logs are also included as completed events for the last 3 months.
 *
 * Query params:
 *   ?plant=slug  — Filter to a single plant's care tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createDataClient } from '@/lib/data-client';
import { getAuthedUser } from '@/lib/get-user';
import { estimateNextDue } from '@/lib/types';
import { TASK_TYPE_LABELS } from '@/lib/types';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const db = await createDataClient();

  const { data: allPlants } = await db
    .from('plants')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  if (!allPlants || allPlants.length === 0) {
    return new NextResponse('No plants found', { status: 404 });
  }

  // Support ?plant=slug for per-plant filtering
  const plantSlug = request.nextUrl.searchParams.get('plant');
  const plants = plantSlug
    ? allPlants.filter((p) => p.slug === plantSlug)
    : allPlants;

  if (plants.length === 0) {
    return new NextResponse('Plant not found', { status: 404 });
  }

  const plantIds = plants.map((p) => p.id);

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

  // Build latest log per task
  const latestLogByTask = new Map<string, (typeof logs)[0]>();
  for (const log of logs) {
    if (log.task_id && !latestLogByTask.has(log.task_id)) {
      latestLogByTask.set(log.task_id, log);
    }
  }

  const now = new Date();
  const icsLines: string[] = [];

  // Header
  icsLines.push('BEGIN:VCALENDAR');
  icsLines.push('VERSION:2.0');
  icsLines.push('PRODID:-//Plantcaer//Plant Care Calendar//EN');
  icsLines.push('CALSCALE:GREGORIAN');
  icsLines.push('METHOD:PUBLISH');
  icsLines.push('X-WR-CALNAME:Plant Care Schedule');
  icsLines.push('X-WR-CALDESC:Care schedule for your plants');

  // Format a date to ICS format (YYYYMMDD)
  const toIcsDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  };

  // Format a timestamp to ICS format (YYYYMMDDTHHMMSSZ)
  const toIcsTimestamp = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}${m}${d}T${h}${min}${s}Z`;
  };

  const nowStamp = toIcsTimestamp(now);

  // Helper to build an RRULE string from frequency_days
  const buildRrule = (frequencyDays: number | null): string | null => {
    if (!frequencyDays || frequencyDays <= 0) return null;
    return `RRULE:FREQ=DAILY;INTERVAL=${frequencyDays}`;
  };

  // Escape text for ICS (escape semicolons, commas, backslashes, newlines)
  const escapeIcsText = (text: string): string => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };

  // 1. Generate events for each active care task
  for (const task of tasks) {
    const plant = plants.find((p) => p.id === task.plant_id);
    if (!plant) continue;

    const lastLog = latestLogByTask.get(task.id);
    const nextDue = estimateNextDue(
      lastLog?.logged_at ?? null,
      task.frequency_days,
      task.seasonal_adjustment as Record<string, number> | undefined,
    );

    if (!nextDue) continue;

    const plantName = plant.nickname || plant.common_name;
    const taskLabel = TASK_TYPE_LABELS[task.task_type as keyof typeof TASK_TYPE_LABELS] || task.task_type;
    const summary = `${plantName} - ${taskLabel}`;
    const description = task.notes
      ? `Care notes: ${task.notes}`
      : `Care task for ${plantName}`;

    const uid = `plantcaer-task-${task.id}@plantcaer.app`;
    const rrule = buildRrule(task.frequency_days);

    icsLines.push('BEGIN:VEVENT');
    icsLines.push(`UID:${uid}`);
    icsLines.push(`DTSTAMP:${nowStamp}`);
    icsLines.push(`DTSTART;VALUE=DATE:${toIcsDate(nextDue)}`);
    icsLines.push(`SUMMARY:${escapeIcsText(summary)}`);
    icsLines.push(`DESCRIPTION:${escapeIcsText(description)}`);
    if (rrule) {
      icsLines.push(rrule);
    }
    icsLines.push('END:VEVENT');
  }

  // 2. Include care logs from the last 3 months as completed events
  for (const log of logs) {
    const plant = plants.find((p) => p.id === log.plant_id);
    if (!plant) continue;

    const logDate = new Date(log.logged_at);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    if (logDate < threeMonthsAgo) continue;

    const plantName = plant.nickname || plant.common_name;
    const taskLabel = TASK_TYPE_LABELS[log.task_type as keyof typeof TASK_TYPE_LABELS] || log.task_type;
    const summary = `✓ Done: ${plantName} - ${taskLabel}`;
    const description = log.notes
      ? `Completed on ${logDate.toLocaleDateString()}. Notes: ${log.notes}`
      : `Completed on ${logDate.toLocaleDateString()}`;

    const uid = `plantcaer-log-${log.id}@plantcaer.app`;

    icsLines.push('BEGIN:VEVENT');
    icsLines.push(`UID:${uid}`);
    icsLines.push(`DTSTAMP:${nowStamp}`);
    icsLines.push(`DTSTART;VALUE=DATE:${toIcsDate(logDate)}`);
    icsLines.push(`SUMMARY:${escapeIcsText(summary)}`);
    icsLines.push(`DESCRIPTION:${escapeIcsText(description)}`);
    icsLines.push('END:VEVENT');
  }

  // Footer
  icsLines.push('END:VCALENDAR');

  const icsContent = icsLines.join('\r\n');

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="plantcaer-care-calendar.ics"',
      'Cache-Control': 'no-cache',
    },
  });
}
