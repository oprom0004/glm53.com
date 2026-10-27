import { handleWanApi } from '@/shared/services/wan-video-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = (request: Request) => handleWanApi('capabilities', request);
