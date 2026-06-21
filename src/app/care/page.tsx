import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { CareContent } from '@/components/care-content';

export default async function CarePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: plants } = await supabase
    .from('plants')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  const { data: careTasks } = await supabase
    .from('care_tasks')
    .select('*')
    .in(
      'plant_id',
      plants?.map((p) => p.id) ?? []
    )
    .eq('is_active', true);

  const { data: careLogs } = await supabase
    .from('care_logs')
    .select('*')
    .in(
      'plant_id',
      plants?.map((p) => p.id) ?? []
    )
    .order('logged_at', { ascending: false });

  return (
    <CareContent
      plants={plants ?? []}
      careTasks={careTasks ?? []}
      careLogs={careLogs ?? []}
    />
  );
}
