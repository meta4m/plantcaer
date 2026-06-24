import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getHouseholdUserId } from '@/lib/pin-auth';
import { createAdminClient } from '@/lib/supabase-admin';

/** Helper: verify PIN from request — tries Authorization header first, then cookies */
async function getAuthedUserId(request?: Request): Promise<string | null> {
  let token: string | null = null;

  // 1. Try Authorization header (client passes PIN token from document.cookie)
  if (request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  // 2. Fall back to cookie-based auth
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get('plantcaer_pin')?.value ?? null;
    } catch {
      // cookies() may fail in route handlers on some deployments
    }
  }

  if (token && (await verifyToken(token))) {
    return getHouseholdUserId();
  }

  return null;
}

/**
 * GET /api/plant/[slug] — returns plant data + care tasks.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const userId = await getAuthedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: plant } = await admin
      .from('plants')
      .select('*')
      .eq('slug', slug)
      .eq('owner_id', userId)
      .single();

    if (!plant) {
      return NextResponse.json({ error: 'Plant not found' }, { status: 404 });
    }

    const { data: careTasks } = await admin
      .from('care_tasks')
      .select('*')
      .eq('plant_id', plant.id)
      .order('task_type');

    return NextResponse.json({ plant, careTasks: careTasks ?? [] });
  } catch (err) {
    console.error('GET /api/plant/[slug] error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * PUT /api/plant/[slug] — updates plant data + care tasks.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const userId = await getAuthedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const admin = createAdminClient();

    const { data: plant } = await admin
      .from('plants')
      .select('id, owner_id')
      .eq('slug', slug)
      .single();

    if (!plant) {
      return NextResponse.json({ error: 'Plant not found' }, { status: 404 });
    }

    if (plant.owner_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update plant fields
    const updateData: Record<string, unknown> = {};
    const fields = ['common_name', 'scientific_name', 'nickname', 'species', 'location',
      'adopted_at', 'light_requirement', 'min_temp', 'max_temp', 'humidity_min', 'notes'];
    for (const field of fields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field] || null;
      }
    }
    updateData.updated_at = new Date().toISOString();

    const { error: updateError } = await admin
      .from('plants')
      .update(updateData)
      .eq('id', plant.id);

    if (updateError) throw updateError;

    // Upsert care tasks
    if (body.careTasks && Array.isArray(body.careTasks)) {
      for (const task of body.careTasks) {
        if (task.frequency_days) {
          const { error: taskError } = await admin.from('care_tasks').upsert(
            {
              plant_id: plant.id,
              task_type: task.task_type,
              frequency_days: parseInt(task.frequency_days) || null,
              amount: task.amount || null,
              notes: task.notes || null,
              is_active: true,
            },
            { onConflict: 'plant_id,task_type' }
          );
          if (taskError) throw taskError;
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PUT /api/plant/[slug] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update plant' },
      { status: 500 }
    );
  }
}
