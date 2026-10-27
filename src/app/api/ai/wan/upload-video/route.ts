import { handleWanApi } from '@/shared/services/wan-video-api';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const POST = (request: Request) => handleWanApi('upload-video', request);
