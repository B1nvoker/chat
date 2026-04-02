// lib/supabase.js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://YOUR_PROJECT.supabase.co',
  'PUBLIC_ANON_KEY'
)
