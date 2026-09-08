/** 현재 `site_settings` 단일 행 값을 그대로 찍는다(폴백 판정 근거). */
import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (match !== null && process.env[match[1]] === undefined) {
    process.env[match[1]] = match[2]
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle()

console.log(JSON.stringify({ data, error }, null, 2))
