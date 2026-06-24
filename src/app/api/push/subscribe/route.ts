/**
 * Push Notification API routes.
 *
 * POST /api/push/subscribe  — Save a push subscription
 * DELETE /api/push/subscribe — Remove a push subscription
 * GET  /api/push/check      — Check for due/overdue tasks and send notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { getAuthedUser } from '@/lib/get-user';
import { estimateNextDue } from '@/lib/types';
import { TASK_TYPE_LABELS } from '@/lib/types';

// ─── POST: Subscribe ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getAuthedUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { endpoint, p256dhKey, authKey, userAgent } = body;

    if (!endpoint || !p256dhKey || !authKey) {
      return NextResponse.json(
        { error: 'endpoint, p256dhKey, and authKey are required' },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // Upsert subscription
    const { error } = await admin.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh_key: p256dhKey,
        auth_key: authKey,
        user_agent: userAgent || null,
      },
      { onConflict: 'endpoint' },
    );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[push/subscribe]', err);
    return NextResponse.json(
      { error: 'Failed to save subscription' },
      { status: 500 },
    );
  }
}

// ─── DELETE: Unsubscribe ─────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getAuthedUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint query param required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[push/unsubscribe]', err);
    return NextResponse.json(
      { error: 'Failed to remove subscription' },
      { status: 500 },
    );
  }
}

// ─── GET: Check for due tasks & send notifications ──────────

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getAuthedUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const admin = createAdminClient();

    // 1. Get user's subscriptions
    const { data: subscriptions } = await admin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user.id);

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ due: 0, overdue: 0, notified: false });
    }

    // 2. Get user's plants and care tasks
    const { data: plants } = await admin
      .from('plants')
      .select('*')
      .eq('owner_id', user.id);

    if (!plants || plants.length === 0) {
      return NextResponse.json({ due: 0, overdue: 0, notified: false });
    }

    const plantIds = plants.map((p) => p.id);

    const { data: careTasks } = await admin
      .from('care_tasks')
      .select('*')
      .in('plant_id', plantIds)
      .eq('is_active', true);

    const { data: careLogs } = await admin
      .from('care_logs')
      .select('*')
      .in('plant_id', plantIds)
      .order('logged_at', { ascending: false });

    const tasks = careTasks ?? [];
    const logs = careLogs ?? [];

    // 3. Build latest log per task
    const latestLogByTask = new Map<string, (typeof logs)[0]>();
    for (const log of logs) {
      if (log.task_id && !latestLogByTask.has(log.task_id)) {
        latestLogByTask.set(log.task_id, log);
      }
    }

    // 4. Find due and overdue tasks
    const now = new Date();
    const dueTasks: { plantName: string; taskLabel: string; slug: string }[] = [];
    const overdueTasks: { plantName: string; taskLabel: string; slug: string }[] = [];

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

      if (nextDue < now) {
        overdueTasks.push({ plantName, taskLabel, slug: plant.slug });
      } else if (isToday(nextDue)) {
        dueTasks.push({ plantName, taskLabel, slug: plant.slug });
      }
    }

    // 5. If there are due/overdue tasks, send push notifications
    if ((dueTasks.length > 0 || overdueTasks.length > 0) && subscriptions.length > 0) {
      const notifications: string[] = [];

      if (overdueTasks.length > 0) {
        const names = overdueTasks.slice(0, 3).map((t) => `${t.plantName} (${t.taskLabel})`);
        const suffix = overdueTasks.length > 3 ? ` and ${overdueTasks.length - 3} more` : '';
        notifications.push(`⚠️ Overdue: ${names.join(', ')}${suffix}`);
      }

      if (dueTasks.length > 0) {
        const names = dueTasks.slice(0, 3).map((t) => `${t.plantName} (${t.taskLabel})`);
        const suffix = dueTasks.length > 3 ? ` and ${dueTasks.length - 3} more` : '';
        notifications.push(`📅 Due today: ${names.join(', ')}${suffix}`);
      }

      const message = notifications.join('\n');

      // Send to all subscriptions
      for (const sub of subscriptions) {
        try {
          const webpush = await import('web-push');
          webpush.setVapidDetails(
            'mailto:plantcaer@app.com',
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
            process.env.VAPID_PRIVATE_KEY!,
          );

          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh_key,
                auth: sub.auth_key,
              },
            },
            JSON.stringify({
              title: 'Plantcaer Care Reminder',
              body: message,
              icon: '/icon-192.svg',
              badge: '/icon-192.svg',
              data: {
                url: '/care/calendar',
              },
              tag: 'plantcaer-care',
            }),
          );
        } catch (pushErr: unknown) {
          // If subscription is expired/invalid, remove it
          if (pushErr instanceof Error && 
            (pushErr.message.includes('410') || pushErr.message.includes('404') || pushErr.message.includes('expired'))) {
            await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
          console.error('[push/check] Failed to send:', pushErr instanceof Error ? pushErr.message : String(pushErr));
        }
      }
    }

    return NextResponse.json({
      due: dueTasks.length,
      overdue: overdueTasks.length,
      notified: dueTasks.length > 0 || overdueTasks.length > 0,
    });
  } catch (err) {
    console.error('[push/check]', err);
    return NextResponse.json(
      { error: 'Failed to check notifications' },
      { status: 500 },
    );
  }
}

/** Check if a date is today */
function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
