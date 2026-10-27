import { handleUploadPartsCron } from '@/shared/services/upload-parts-cron';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = (request: Request) => handleUploadPartsCron(request);
