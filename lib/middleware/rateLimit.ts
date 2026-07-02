import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RATE_LIMITS = {
  '/api/auth/login': { max: 5, window: 60 },      // 5 requests per minute
  '/api/auth/register': { max: 3, window: 60 },    // 3 requests per minute
  '/api/withdrawal': { max: 3, window: 3600 },     // 3 requests per hour
  '/api/audio/session': { max: 20, window: 60 },   // 20 requests per minute
  '/api/checkin': { max: 2, window: 3600 },        // 2 requests per hour
  '/api/referral': { max: 10, window: 60 },        // 10 requests per minute
  'default': { max: 30, window: 60 },              // Default: 30 per minute
};

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  blocked?: boolean;
}

export async function checkRateLimit(
  ip: string, 
  endpoint: string
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(Date.now() - 60 * 1000); // Last 60 seconds

  // Get limit config
  const config = RATE_LIMITS[endpoint as keyof typeof RATE_LIMITS] || RATE_LIMITS.default;
  const maxRequests = config.max || 30;

  // Check if IP is blocked
  const { data: blocked } = await supabaseAdmin
    .from('rate_limits')
    .select('blocked_until')
    .eq('ip_address', ip)
    .eq('is_blocked', true)
    .single();

  if (blocked && blocked.blocked_until && new Date(blocked.blocked_until) > now) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: new Date(blocked.blocked_until).getTime(),
      blocked: true,
    };
  }

  // Get current minute count
  const { data: existing, error } = await supabaseAdmin
    .from('rate_limits')
    .select('id, request_count, last_request')
    .eq('ip_address', ip)
    .eq('endpoint', endpoint)
    .gte('last_request', windowStart.toISOString())
    .single();

  if (existing) {
    const count = existing.request_count || 0;
    const isExpired = new Date(existing.last_request) < windowStart;

    if (isExpired) {
      // Reset counter
      await supabaseAdmin
        .from('rate_limits')
        .update({ 
          request_count: 1, 
          last_request: now,
          is_blocked: false,
          blocked_until: null,
        })
        .eq('id', existing.id);

      return { allowed: true, remaining: maxRequests - 1, resetTime: Date.now() + 60 * 1000 };
    }

    if (count >= maxRequests) {
      // Block IP for 10 minutes
      const blockUntil = new Date(Date.now() + 10 * 60 * 1000);
      await supabaseAdmin
        .from('rate_limits')
        .update({ 
          is_blocked: true, 
          blocked_until: blockUntil,
          request_count: count + 1,
        })
        .eq('id', existing.id);

      // ✅ Log security event
      await supabaseAdmin
        .from('security_logs')
        .insert({
          type: 'rate_limit_blocked',
          details: { ip, endpoint, count, blocked_until: blockUntil },
        });

      // ✅ Send admin notification
      await supabaseAdmin
        .from('admin_notifications')
        .insert({
          title: '🚫 Rate Limit Exceeded',
          message: `IP ${ip} has been blocked for 10 minutes. Exceeded ${maxRequests} requests on ${endpoint}`,
          type: 'security',
          is_read: false,
        });

      return {
        allowed: false,
        remaining: 0,
        resetTime: blockUntil.getTime(),
        blocked: true,
      };
    }

    // Increment count
    await supabaseAdmin
      .from('rate_limits')
      .update({ 
        request_count: count + 1, 
        last_request: now,
      })
      .eq('id', existing.id);

    // ✅ Send warning notification if nearing limit
    if (count >= maxRequests * 0.8) {
      await supabaseAdmin
        .from('admin_notifications')
        .insert({
          title: '⚠️ Rate Limit Warning',
          message: `IP ${ip} has used ${count+1}/${maxRequests} requests on ${endpoint}`,
          type: 'security',
          is_read: false,
        });
    }

    return {
      allowed: true,
      remaining: maxRequests - (count + 1),
      resetTime: Date.now() + 60 * 1000,
    };

  } else {
    // Create new record
    await supabaseAdmin
      .from('rate_limits')
      .insert({
        ip_address: ip,
        endpoint,
        request_count: 1,
        last_request: now,
      });

    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: Date.now() + 60 * 1000,
    };
  }
}