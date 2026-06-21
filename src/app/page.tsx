import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { DashboardContent } from '@/components/dashboard-content';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: plants } = await supabase
    .from('plants')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  const { data: careLogs } = await supabase
    .from('care_logs')
    .select('*')
    .in(
      'plant_id',
      plants?.map((p) => p.id) ?? []
    )
    .order('logged_at', { ascending: false })
    .limit(20);

  const { data: careTasks } = await supabase
    .from('care_tasks')
    .select('*')
    .in(
      'plant_id',
      plants?.map((p) => p.id) ?? []
    )
    .eq('is_active', true);

  return (
    <DashboardContent
      plants={plants ?? []}
      careLogs={careLogs ?? []}
      careTasks={careTasks ?? []}
      userEmail={user.email ?? ''}
    />
  );
}
