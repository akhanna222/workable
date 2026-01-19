import { createBrowserClient } from '@supabase/ssr';

// Provide fallback values for build time (will be replaced at runtime)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
