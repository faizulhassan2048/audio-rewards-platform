import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ success: false, error: 'No token' }, { status: 400 });
    }

    // ✅ Development mein captcha bypass karo
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({ success: true });
    }

    const secret = process.env.HCAPTCHA_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ success: false, error: 'Secret key missing' }, { status: 500 });
    }

    const response = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secret,
        response: token,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      return NextResponse.json(
        { success: false, error: 'Captcha verification failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Captcha error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}