import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function updateSourceLastFetched(sourceName: string) {
  const supabase = getSupabaseClient()
  await supabase
    .from('sources')
    .update({ last_fetched_at: new Date().toISOString() })
    .eq('name', sourceName)
}
