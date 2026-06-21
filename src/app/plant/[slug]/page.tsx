import { createClient } from '@/lib/supabase-server';
import { redirect, notFound } from 'next/navigation';
import { PlantDetailContent } from '@/components/plant-detail-content';

export default async function PlantDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: plant } = await supabase
    .from('plants')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!plant) notFound();

  const { data: careTasks } = await supabase
    .from('care_tasks')
    .select('*')
    .eq('plant_id', plant.id)
    .order('task_type');

  const { data: careLogs } = await supabase
    .from('care_logs')
    .select('*')
    .eq('plant_id', plant.id)
    .order('logged_at', { ascending: false })
    .limit(50);

  const { data: journalEntries } = await supabase
    .from('journal_entries')
    .select('*, profiles(display_name, avatar_url)')
    .eq('plant_id', plant.id)
    .order('created_at', { ascending: false })
    .limit(20);

  const isOwner = plant.owner_id === user.id;

  return (
    <PlantDetailContent
      plant={plant}
      careTasks={careTasks ?? []}
      careLogs={careLogs ?? []}
      journalEntries={journalEntries ?? []}
      isOwner={isOwner}
    />
  );
}
