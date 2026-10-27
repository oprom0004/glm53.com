import { createVideoPricingHandler } from '@/shared/services/wan-video-pricing-settings';

export const dynamic = 'force-dynamic';
export const GET = createVideoPricingHandler('GET');
export const POST = createVideoPricingHandler('POST');
