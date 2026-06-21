// Seed script — inserts sample plants with care tasks
// Usage: node scripts/seed-plants.mjs
// Requires .env.local with SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local manually
const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
}

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Helper to generate a unique slug
function makeSlug(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 25);
  return `${base}-${Date.now().toString(36)}`;
}

// Days ago helper
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

const plantsWithTasks = [
  {
    common_name: 'Monstera Deliciosa',
    scientific_name: 'Monstera deliciosa',
    nickname: 'Manny',
    species: 'Araceae',
    location: 'Living room east window',
    light_requirement: 'bright_indirect',
    min_temp: 18, max_temp: 30,
    humidity_min: 60,
    notes: 'Loves its moss pole. Wipe leaves monthly to keep them shiny.',
    tasks: [
      { task_type: 'watering', frequency_days: 7, amount: '500ml', notes: 'Water when top 2-3" soil is dry' },
      { task_type: 'fertilizing', frequency_days: 30, amount: 'Liquid 20-20-20', notes: 'Dilute to half strength during growing season' },
      { task_type: 'pruning', frequency_days: 90, notes: 'Trim yellowing leaves and aerial roots if needed' },
    ],
    logs: [
      { task_type: 'watering', days_ago: 2, notes: 'Gave extra water, soil was very dry' },
      { task_type: 'watering', days_ago: 9, notes: 'Regular watering' },
      { task_type: 'fertilizing', days_ago: 12, notes: 'Spring feeding' },
    ],
  },
  {
    common_name: 'Snake Plant',
    scientific_name: 'Dracaena trifasciata',
    nickname: 'Slytherin',
    species: 'Asparagaceae',
    location: 'Bedroom corner',
    light_requirement: 'low_light',
    min_temp: 15, max_temp: 30,
    humidity_min: 30,
    notes: 'Almost unkillable. Ignore it and it thrives.',
    tasks: [
      { task_type: 'watering', frequency_days: 21, amount: '200ml', notes: 'Let soil completely dry between waterings' },
      { task_type: 'repotting', frequency_days: 730, notes: 'Only repot when roots push through drainage holes' },
    ],
    logs: [
      { task_type: 'watering', days_ago: 5, notes: 'Watered, soil was bone dry' },
      { task_type: 'watering', days_ago: 26, notes: 'Forgot about this one for a while' },
    ],
  },
  {
    common_name: 'Golden Pothos',
    scientific_name: 'Epipremnum aureum',
    nickname: 'Trailblazer',
    species: 'Araceae',
    location: 'Home office shelf',
    light_requirement: 'bright_indirect',
    min_temp: 18, max_temp: 30,
    humidity_min: 40,
    notes: 'Trailing beautifully. Taking cuttings to propagate soon.',
    tasks: [
      { task_type: 'watering', frequency_days: 7, amount: '300ml', notes: 'Water when top inch of soil is dry' },
      { task_type: 'fertilizing', frequency_days: 30, amount: 'Liquid fertilizer', notes: 'Monthly during growing season' },
      { task_type: 'pruning', frequency_days: 60, notes: 'Trim leggy vines to encourage bushiness' },
      { task_type: 'propagation', frequency_days: 120, notes: 'Take stem cuttings with node, root in water' },
    ],
    logs: [
      { task_type: 'watering', days_ago: 1, notes: 'Watered, soil was slightly moist' },
      { task_type: 'watering', days_ago: 8, notes: 'Regular watering' },
      { task_type: 'pruning', days_ago: 30, notes: 'Trimmed 3 long vines and propagated them' },
    ],
  },
  {
    common_name: 'Fiddle Leaf Fig',
    scientific_name: 'Ficus lyrata',
    nickname: 'Fiona',
    species: 'Moraceae',
    location: 'Dining room near window',
    light_requirement: 'bright_indirect',
    min_temp: 18, max_temp: 28,
    humidity_min: 40,
    notes: 'Dramatic but beautiful. Rotate weekly for even growth.',
    tasks: [
      { task_type: 'watering', frequency_days: 7, amount: '600ml', notes: 'Water when top 1-2" of soil is dry. Does NOT like wet feet.' },
      { task_type: 'fertilizing', frequency_days: 30, amount: 'Fiddle leaf fig fertilizer', notes: 'Use specialized Ficus fertilizer' },
      { task_type: 'pruning', frequency_days: 120, notes: 'Prune in spring to shape. Remove lower leaves for tree form.' },
    ],
    logs: [
      { task_type: 'watering', days_ago: 3, notes: 'Leaves were drooping slightly, perked up after watering' },
      { task_type: 'watering', days_ago: 10, notes: 'Regular watering' },
    ],
  },
  {
    common_name: 'Peace Lily',
    scientific_name: 'Spathiphyllum wallisii',
    nickname: 'Serenity',
    species: 'Araceae',
    location: 'Bathroom shelf',
    light_requirement: 'low_light',
    min_temp: 18, max_temp: 28,
    humidity_min: 50,
    notes: 'Loves the bathroom humidity. Blooms when happy.',
    tasks: [
      { task_type: 'watering', frequency_days: 5, amount: '300ml', notes: 'Water when leaves start to droop slightly' },
      { task_type: 'fertilizing', frequency_days: 45, amount: 'Balanced liquid fertilizer', notes: 'Spring through summer only' },
      { task_type: 'pruning', frequency_days: 60, notes: 'Deadhead spent blooms, trim yellow leaves' },
    ],
    logs: [
      { task_type: 'watering', days_ago: 0, notes: 'Just watered, was drooping' },
      { task_type: 'watering', days_ago: 6, notes: 'Still moist, skipped watering' },
    ],
  },
  {
    common_name: 'ZZ Plant',
    scientific_name: 'Zamioculcas zamiifolia',
    nickname: 'Zorro',
    species: 'Araceae',
    location: 'Dark hallway corner',
    light_requirement: 'low_light',
    min_temp: 18, max_temp: 28,
    humidity_min: 30,
    notes: 'Survives in the darkest corner. Low maintenance champion.',
    tasks: [
      { task_type: 'watering', frequency_days: 28, amount: '250ml', notes: 'Let soil completely dry. When in doubt, skip watering.' },
      { task_type: 'repotting', frequency_days: 1095, notes: 'ZZ plants like being root-bound. Repot every 3 years.' },
    ],
    logs: [
      { task_type: 'watering', days_ago: 10, notes: 'Watered, soil was very dry' },
    ],
  },
  {
    common_name: 'Spider Plant',
    scientific_name: 'Chlorophytum comosum',
    nickname: 'Charlotte',
    species: 'Asparagaceae',
    location: 'Kitchen windowsill',
    light_requirement: 'bright_indirect',
    min_temp: 12, max_temp: 28,
    humidity_min: 40,
    notes: 'Producing lots of babies (spiderettes). Great for propagation!',
    tasks: [
      { task_type: 'watering', frequency_days: 7, amount: '250ml', notes: 'Water when top 25-50% of soil is dry' },
      { task_type: 'fertilizing', frequency_days: 30, amount: 'All-purpose fertilizer', notes: 'Monthly in spring/summer' },
      { task_type: 'propagation', frequency_days: 60, notes: 'Root spiderettes in water or soil' },
    ],
    logs: [
      { task_type: 'watering', days_ago: 4, notes: 'Watered, soil was dry' },
      { task_type: 'propagation', days_ago: 20, notes: 'Potted 3 spiderettes, they rooted in water in 2 weeks!' },
    ],
  },
  {
    common_name: 'Aloe Vera',
    scientific_name: 'Aloe barbadensis',
    nickname: 'Sunny',
    species: 'Asphodelaceae',
    location: 'Back porch (sheltered)',
    light_requirement: 'direct_sun',
    min_temp: 15, max_temp: 35,
    humidity_min: 20,
    notes: 'Outdoors in summer. Use gel for minor burns!',
    tasks: [
      { task_type: 'watering', frequency_days: 14, amount: '200ml', notes: 'Soil must be completely dry. Water deeply but infrequently.' },
      { task_type: 'fertilizing', frequency_days: 60, amount: 'Cactus/succulent fertilizer', notes: 'Half strength, only in growing season' },
      { task_type: 'repotting', frequency_days: 730, notes: 'Aloe pups indicate it is root-bound. Repot and separate pups.' },
    ],
    logs: [
      { task_type: 'watering', days_ago: 7, notes: 'Watered, plumped up nicely' },
    ],
  },
  {
    common_name: 'Calathea Orbifolia',
    scientific_name: 'Goeppertia orbifolia',
    nickname: 'Orbie',
    species: 'Marantaceae',
    location: 'Living room shelf (no direct light)',
    light_requirement: 'bright_indirect',
    min_temp: 18, max_temp: 26,
    humidity_min: 60,
    notes: 'Picky about water — use distilled water only. Leaves fold at night.',
    tasks: [
      { task_type: 'watering', frequency_days: 4, amount: '300ml (distilled)', notes: 'Keep soil lightly moist. Use distilled or filtered water ONLY.' },
      { task_type: 'fertilizing', frequency_days: 30, amount: 'Diluted houseplant fertilizer', notes: 'Half strength during growing season' },
      { task_type: 'pruning', frequency_days: 30, notes: 'Remove crispy leaf edges and yellow leaves' },
    ],
    logs: [
      { task_type: 'watering', days_ago: 1, notes: 'Distilled water. Leaves look happy' },
      { task_type: 'watering', days_ago: 5, notes: 'Soil was slightly dry, watered with distilled' },
    ],
  },
  {
    common_name: 'String of Pearls',
    scientific_name: 'Curio rowleyanus',
    nickname: 'Pearl Jam',
    species: 'Asteraceae',
    location: 'Hanging basket by south window',
    light_requirement: 'bright_indirect',
    min_temp: 18, max_temp: 30,
    humidity_min: 30,
    notes: 'Trailing beautifully. Handle with care — pearls fall off easily.',
    tasks: [
      { task_type: 'watering', frequency_days: 10, amount: '150ml', notes: 'Water when pearls start to dimple/pucker. Bottom water if possible.' },
      { task_type: 'fertilizing', frequency_days: 60, amount: 'Diluted succulent fertilizer', notes: 'Very light feeding during growing season' },
      { task_type: 'propagation', frequency_days: 90, notes: 'Propagate via stem cuttings — lay on soil, keep moist' },
    ],
    logs: [
      { task_type: 'watering', days_ago: 6, notes: 'Watered, pearls are plump' },
      { task_type: 'watering', days_ago: 16, notes: 'Pearls were puckering, watered immediately' },
    ],
  },
];

async function seed() {
  console.log('Fetching existing users...');
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name');

  if (profileError) {
    console.error('Error fetching profiles:', profileError.message);
    process.exit(1);
  }

  if (!profiles || profiles.length === 0) {
    console.log('No users found. Please register an account first, then re-run this script.');
    console.log('Tip: Run `npm run dev` and create an account at http://localhost:3000/auth/signup');
    process.exit(1);
  }

  const user = profiles[0];
  console.log(`Seeding plants for user: ${user.display_name || user.id}`);

  let planted = 0;
  let taskCount = 0;
  let logCount = 0;

  for (const plantData of plantsWithTasks) {
    const { tasks, logs, ...plantFields } = plantData;
    const slug = makeSlug(plantFields.common_name);

    const { data: plant, error: plantError } = await supabase
      .from('plants')
      .insert({
        owner_id: user.id,
        slug,
        common_name: plantFields.common_name,
        scientific_name: plantFields.scientific_name,
        nickname: plantFields.nickname,
        species: plantFields.species,
        location: plantFields.location,
        light_requirement: plantFields.light_requirement,
        min_temp: plantFields.min_temp,
        max_temp: plantFields.max_temp,
        humidity_min: plantFields.humidity_min,
        notes: plantFields.notes,
      })
      .select()
      .single();

    if (plantError) {
      console.error(`  ❌ Failed to insert ${plantFields.common_name}: ${plantError.message}`);
      continue;
    }

    planted++;
    console.log(`  ✅ ${plantFields.common_name} (${plant.nickname || ''})`);

    // Insert care tasks
    for (const task of tasks) {
      const { error: taskError } = await supabase
        .from('care_tasks')
        .insert({
          plant_id: plant.id,
          task_type: task.task_type,
          frequency_days: task.frequency_days,
          amount: task.amount || null,
          notes: task.notes || null,
          is_active: true,
        });
      if (taskError) {
        console.error(`    ⚠️  Failed to insert task ${task.task_type}: ${taskError.message}`);
      } else {
        taskCount++;
      }
    }

    // Insert care logs
    for (const log of logs) {
      // Find the matching task for this log
      const matchedTask = tasks.find(t => t.task_type === log.task_type);
      
      const { data: taskRecord } = await supabase
        .from('care_tasks')
        .select('id')
        .eq('plant_id', plant.id)
        .eq('task_type', log.task_type)
        .single();

      const { error: logError } = await supabase
        .from('care_logs')
        .insert({
          plant_id: plant.id,
          task_id: taskRecord?.id || null,
          task_type: log.task_type,
          logged_by: user.id,
          logged_at: daysAgo(log.days_ago),
          notes: log.notes || null,
        });
      if (logError) {
        console.error(`    ⚠️  Failed to insert log: ${logError.message}`);
      } else {
        logCount++;
      }
    }
  }

  console.log(`\n✅ Done! ${planted} plants, ${taskCount} care tasks, ${logCount} care logs inserted.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
