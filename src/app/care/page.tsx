import { createClient } from '@/lib/supabase-server';
import { createDataClient } from '@/lib/data-client';
import { redirect } from 'next/navigation';
import { CareContent } from '@/components/care-content';
import { getAuthedUser } from '@/lib/get-user';

export default async function CarePage() {
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) redirect('/auth/login');

  const db = await createDataClient();

  const { data: plants } = await db
    .from('plants')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  const { data: careTasks } = await db
    .from('care_tasks')
    .select('*')
    .in(
      'plant_id',
      plants?.map((p) => p.id) ?? []
    )
    .eq('is_active', true);

  const { data: careLogs } = await db
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
