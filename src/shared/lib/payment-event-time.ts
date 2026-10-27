export function getSubscriptionEventTime(result: unknown): number {
  try {
    const snapshot = typeof result === 'string' ? JSON.parse(result) : result;
    if (!snapshot || typeof snapshot !== 'object') return Number.NaN;
    const value =
      (snapshot as Record<string, unknown>)._state_observed_at ??
      (snapshot as Record<string, unknown>)._event_created_at ??
      (snapshot as Record<string, unknown>).updated_at;
    return typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Date.parse(value)
        : Number.NaN;
  } catch {
    return Number.NaN;
  }
}
