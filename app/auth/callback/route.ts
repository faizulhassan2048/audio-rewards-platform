import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

// ✅ ADD THIS — Static generation disable karo
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const type = searchParams.get('type')

    console.log('🔑 Callback - Code:', code ? '✅ Present' : '❌ Missing')
    console.log('📋 Callback - Type:', type)

    if (!code) {
      console.error('❌ No code found in callback')
      return NextResponse.redirect(`${origin}/auth/login?error=verification_failed`)
    }

    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Server component se call hone par ignore karo
            }
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('❌ Callback error:', error.message)
      return NextResponse.redirect(`${origin}/auth/login?error=verification_failed&message=${encodeURIComponent(error.message)}`)
    }

    console.log('✅ User verified:', data.user?.id)

    // ✅ Check if user was referred
    if (data.user) {
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('referral_code')
          .eq('id', data.user.id)
          .single()

        console.log('📊 User referral code:', userData?.referral_code)
      } catch (err) {
        console.log('⚠️ Could not fetch user data:', err)
      }
    }

    // Password reset → reset password page
    if (type === 'recovery') {
      return NextResponse.redirect(`${origin}/auth/reset-password`)
    }

    // Email verified → dashboard
    return NextResponse.redirect(`${origin}/dashboard`)

  } catch (error: any) {
    console.error('❌ Callback crash:', error.message)
    // ✅ Fix: origin defined nahi hai error state mein
    const { origin } = new URL(request.url)
    return NextResponse.redirect(`${origin}/auth/login?error=callback_failed`)
  }
}
