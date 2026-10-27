'use server';

import { headers } from 'next/headers';

export async function getClientIp() {
  const h = await headers();

  const ip =
    h.get('cf-connecting-ip') || // Cloudflare IP
    h.get('x-real-ip') || // Vercel or other reverse proxies
    (h.get('x-forwarded-for') || '0.0.0.0').split(',')[0]; // Standard header

  return ip;
}
