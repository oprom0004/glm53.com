export type StripeMode = 'test' | 'live';

export function stripeKeyMode(
  secretKey: string | undefined
): StripeMode | undefined {
  return secretKey?.trim().match(/^(?:sk|rk)_(test|live)_/)?.[1] as
    | StripeMode
    | undefined;
}

export function stripeCheckoutMode(
  sessionId: string | null | undefined
): StripeMode | undefined {
  return sessionId?.match(/^cs_(test|live)_[A-Za-z0-9]+$/)?.[1] as
    | StripeMode
    | undefined;
}
