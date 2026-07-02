import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, username, fullName } = body;

    console.log('📝 Register attempt:', { email, username, fullName });

    // Validation
    if (!email || !password || !username || !fullName) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const usernameRegex = /^[a-z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        { error: 'Username: 3-20 characters, letters, numbers, underscore only' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if username already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('username')
      .eq('username', username)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already taken. Please choose another.' },
        { status: 409 }
      );
    }

    // Check if email already registered
    const { data: existingEmail } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (existingEmail) {
      return NextResponse.json(
        { error: 'Email already registered. Please login instead.' },
        { status: 409 }
      );
    }

    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          full_name: fullName,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });

    if (error) {
      console.error('❌ Signup error:', error);

      // Handle specific Supabase errors
      if (error.message.includes('already registered')) {
        return NextResponse.json(
          { error: 'Email already registered. Please login instead.' },
          { status: 409 }
        );
      }

      if (error.message.includes('Password')) {
        return NextResponse.json(
          { error: 'Password is too weak. Use at least 6 characters.' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.log('✅ User created:', data.user?.id);

    // Check if user was created successfully
    if (!data.user) {
      return NextResponse.json(
        { error: 'Failed to create account. Please try again.' },
        { status: 500 }
      );
    }

    // If email confirmation is required
    if (!data.session) {
      return NextResponse.json({
        success: true,
        message: 'Account created! Please check your email to verify.',
        user: data.user,
        requiresVerification: true,
      }, { status: 201 });
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully!',
      user: data.user,
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Server error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}