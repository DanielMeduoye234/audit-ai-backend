import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('CRITICAL: Missing Supabase credentials in backend .env file!');
  console.error('Please add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to backend/.env');
}

// Create Supabase client with service role key (bypasses RLS for admin operations)
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('✅ Supabase client initialized for backend');
