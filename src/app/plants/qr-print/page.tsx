import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { QRPrintContent } from '@/components/qr-print-content';
import { getAuthedUser } from '@/lib/get-user';

export default async function QRPrintPage() {
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  if (!user) redirect('/auth/login');

  const { data: plants } = await supabase
    .from('plants')
    .select('slug, common_name, nickname')
    .eq('owner_id', user.id)
    .order('common_name');

  if (!plants || plants.length === 0) {
    redirect('/plants');
  }

  return <QRPrintContent plants={plants} />;
}
