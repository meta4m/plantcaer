import { createClient } from '@/lib/supabase-server';
import { createDataClient } from '@/lib/data-client';
import { redirect } from 'next/navigation';
import { DashboardContent } from '@/components/dashboard-content';
import { getAuthedUser } from '@/lib/get-user';

export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);

  if (!user) {
    redirect('/auth/login');
  }

  const db = await createDataClient();

  const { data: plants } = await db
    .from('plants')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  const plantIds = plants?.map((p) => p.id) ?? [];

  const { data: careLogs } = await db
    .from('care_logs')
    .select('*')
    .in('plant_id', plantIds)
    .order('logged_at', { ascending: false })
    .limit(20);

  const { data: careTasks } = await db
    .from('care_tasks')
    .select('*')
    .in('plant_id', plantIds)
    .eq('is_active', true);

  // Fetch primary photos for all plants
  const { data: allPhotos } = plantIds.length > 0
    ? await db
        .from('plant_photos')
        .select('plant_id, url')
        .in('plant_id', plantIds)
        .eq('is_primary', true)
    : { data: [] };

  // Build a map of plant_id -> primary photo URL
  const primaryPhotoMap: Record<string, string> = {};
  for (const photo of allPhotos ?? []) {
    primaryPhotoMap[photo.plant_id] = photo.url;
  }

  return (
    <DashboardContent
      plants={plants ?? []}
      careLogs={careLogs ?? []}
      careTasks={careTasks ?? []}
      userEmail={user.email ?? ''}
      primaryPhotoMap={primaryPhotoMap}
    />
  );
}
