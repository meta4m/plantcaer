import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PlantCard } from '@/components/plant-card';
import { Plus } from 'lucide-react';

export default async function PlantsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: plants } = await supabase
    .from('plants')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Plants</h1>
          <p className="mt-1 text-white/50">
            {plants?.length ?? 0} plant{plants?.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/plants/new"
          className="glass-card rounded-xl px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-all active:scale-[0.98] flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Plant
        </Link>
      </div>

      {!plants || plants.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <span className="text-5xl mb-4 block">🪴</span>
          <h3 className="text-xl font-semibold text-white mb-2">No plants yet</h3>
          <p className="text-white/40 text-sm mb-6">
            Add your first plant to get started.
          </p>
          <Link
            href="/plants/new"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 transition-all"
          >
            <Plus className="h-4 w-4" />
            Add your first plant
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plants.map((plant) => (
            <PlantCard key={plant.id} plant={plant} />
          ))}
        </div>
      )}
    </div>
  );
}
