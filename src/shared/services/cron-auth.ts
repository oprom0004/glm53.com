import { timingSafeEqual } from 'node:crypto';

export function hasCronAuthorization(request: Request, secret?: string) {
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get('authorization') || '');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
