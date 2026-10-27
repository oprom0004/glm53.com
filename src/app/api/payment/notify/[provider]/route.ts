import { getPaymentService } from '@/shared/services/payment';
import { handlePaymentEvent } from '@/shared/services/payment-events';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    const manager = await getPaymentService();
    const paymentProvider = manager.getProvider(provider);
    if (!paymentProvider || paymentProvider.name !== provider) {
      return Response.json(
        { message: 'Payment provider unavailable' },
        { status: 404 }
      );
    }
    const event = await paymentProvider.getPaymentEvent({ req });
    await handlePaymentEvent({ provider, event });
    console.info('Payment webhook handled', {
      provider,
      eventId: event.eventResult?.id,
      eventType: event.eventResult?.eventType || event.eventType,
    });
    return Response.json({ message: 'success' });
  } catch (cause: any) {
    const invalid = /^Invalid webhook (signature|request|payload)/.test(
      cause?.message || ''
    );
    console.error('Payment webhook rejected', {
      reason: invalid ? 'invalid_request' : 'settlement_failed',
    });
    return Response.json(
      {
        message: invalid
          ? 'Invalid webhook request'
          : 'Payment notification could not be processed; retry required',
      },
      { status: invalid ? 400 : 500 }
    );
  }
}
