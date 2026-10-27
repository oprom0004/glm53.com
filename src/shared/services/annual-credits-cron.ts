import { sweepAnnualCredits } from './annual-credits';
import { hasCronAuthorization } from './cron-auth';

export async function handleAnnualCreditsCron(
  request: Request,
  secret = process.env.CRON_SECRET,
  sweep = sweepAnnualCredits
) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!hasCronAuthorization(request, secret))
    return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  try {
    const result = await sweep();
    return Response.json(
      { ok: result.failed === 0, ...result },
      {
        status: result.failed ? 503 : 200,
        headers,
      }
    );
  } catch {
    return Response.json(
      { error: 'annual_credit_settlement_unavailable' },
      {
        status: 503,
        headers,
      }
    );
  }
}
