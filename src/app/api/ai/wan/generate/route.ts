import { handleWanApi } from '@/shared/services/wan-video-api';

export const runtime = 'nodejs';

export const POST = (request: Request) => handleWanApi('generate', request);
