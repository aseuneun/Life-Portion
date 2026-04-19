import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://inntoukptlysbrveewrl.supabase.co'
const supabaseKey = 'sb_publishable_NUwAxk_A1ephSjuL4mvk9w_ZOU2ug9Z'

export const supabase = createClient(supabaseUrl, supabaseKey)
