import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { LIMITS } from '@/lib/limits';

// IP はハッシュ化して保存（生IPを残さない）
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? 'default-salt';
  return createHash('sha256').update(ip + salt).digest('hex').slice(0, 32);
}

// リクエスト元IPを取得（Vercelはx-forwarded-forに入る）
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export type LimitResult = { ok: true } | { ok: false; reason: string };

export async function checkRateLimit(ipHash: string): Promise<LimitResult> {
  // 1. 全体の日次上限（コストの最終防波堤）
  const { data: todayTotal } = await supabaseAdmin.rpc('count_today_requests');
  if ((todayTotal ?? 0) >= LIMITS.GLOBAL_PER_DAY) {
    return { ok: false, reason: '本日の利用上限に達しました。時間をおいて再度お試しください。' };
  }

  // 2. IP別・1分あたり
  const { data: perMin } = await supabaseAdmin.rpc('count_recent_requests', {
    p_ip_hash: ipHash, p_window_minutes: 1,
  });
  if ((perMin ?? 0) >= LIMITS.PER_IP_PER_MINUTE) {
    return { ok: false, reason: 'リクエストが多すぎます。少し時間をおいてください。' };
  }

  // 3. IP別・1日あたり
  const { data: perDay } = await supabaseAdmin.rpc('count_recent_requests', {
    p_ip_hash: ipHash, p_window_minutes: 60 * 24,
  });
  if ((perDay ?? 0) >= LIMITS.PER_IP_PER_DAY) {
    return { ok: false, reason: '本日の利用回数の上限に達しました。' };
  }

  return { ok: true };
}

// リクエストを記録（カウント対象に加える）
export async function recordRequest(ipHash: string): Promise<void> {
  await supabaseAdmin.from('ask_requests').insert({ ip_hash: ipHash });
}