import { createClient } from '@/lib/supabase-server';
import { createDataClient } from '@/lib/data-client';
import { redirect, notFound } from 'next/navigation';
import { PlantDetailContent } from '@/components/plant-detail-content';
import { getAuthedUser } from '@/lib/get-user';

export default async function PlantDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) redirect('/auth/login');

  const db = await createDataClient();

  const { data: plant } = await db
    .from('plants')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!plant) notFound();

  const { data: careTasks } = await db
    .from('care_tasks')
    .select('*')
    .eq('plant_id', plant.id)
    .order('task_type');

  const { data: careLogs } = await db
    .from('care_logs')
    .select('*')
    .eq('plant_id', plant.id)
    .order('logged_at', { ascending: false })
    .limit(50);

  const { data: journalEntries } = await db
    .from('journal_entries')
    .select('*, profiles(display_name, avatar_url)')
    .eq('plant_id', plant.id)
    .order('created_at', { ascending: false })
    .limit(20);

  // Fetch photos for this plant
  const { data: photos } = await db
    .from('plant_photos')
    .select('*')
    .eq('plant_id', plant.id)
    .order('uploaded_at', { ascending: false });

  const isOwner = plant.owner_id === user.id;

  return (
    <PlantDetailContent
      plant={plant}
      careTasks={careTasks ?? []}
      careLogs={careLogs ?? []}
      journalEntries={journalEntries ?? []}
      photos={photos ?? []}
      isOwner={isOwner}
    />
  );
}
