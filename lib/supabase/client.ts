import { createBrowserClient } from '@supabase/ssr'

export const createClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error('Supabase credentials missing:', { url: !!url, key: !!key })
    throw new Error('Supabase credentials missing')
  }

  return createBrowserClient(url, key)
}