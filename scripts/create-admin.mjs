// Creates an admin superuser — username: admin, password: admin, email: iullahS@gmail.com
// Usage: node scripts/create-admin.mjs
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

async function createAdmin() {
  console.log('Creating admin superuser...\n');

  // Check if user already exists
  const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing users:', listError.message);
    process.exit(1);
  }

  const existing = existingUsers.users.find(u => u.email === 'iullahS@gmail.com');
  if (existing) {
    console.log(`✅ Admin user already exists: ${existing.email} (ID: ${existing.id})`);
    console.log('   Skipping creation.');
    process.exit(0);
  }

  // Create the admin user with a simple password and auto-confirmed email
  const { data: user, error: createError } = await supabase.auth.admin.createUser({
    email: 'iullahS@gmail.com',
    password: 'admin',
    email_confirm: true,
    user_metadata: {
      display_name: 'admin',
    },
  });

  if (createError) {
    console.error('❌ Failed to create admin user:', createError.message);
    process.exit(1);
  }

  console.log(`✅ Admin user created successfully!`);
  console.log(`   Email:      iullahS@gmail.com`);
  console.log(`   Password:   admin`);
  console.log(`   User ID:    ${user.user.id}`);
  console.log(`   Confirmed:  Yes\n`);

  // Verify the profile was auto-created by the trigger
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.user.id)
    .single();

  if (profileError) {
    console.log('⚠️  Profile not yet created (trigger may need a moment).');
  } else {
    console.log(`✅ Profile created: display_name = ${profile.display_name}`);
  }

  process.exit(0);
}

createAdmin().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
