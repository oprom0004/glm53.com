import { handleAnnualCreditsCron } from '@/shared/services/annual-credits-cron';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = (request: Request) => handleAnnualCreditsCron(request);
