import { normalizePolarisSettings, POLARIS_ORIGIN } from './polaris-settings';
import { isProviderModelId, wanApiUrl } from './provider-endpoint';

const MAX_RESPONSE_BYTES = 1024 * 1024;
const safeErrors = new Set([
  'missing_key',
  'invalid_base_url',
  'invalid_api_key',
  'invalid_key',
  'access_denied',
  'rate_limited',
  'unavailable',
  'timeout',
  'invalid_response',
]);

function isTimeout(error: unknown) {
  return (
    error instanceof Error &&
    ['TimeoutError', 'AbortError'].includes(error.name)
  );
}

export async function checkPolarisModels(
  configs: Record<string, string>,
  request: typeof fetch = fetch
): Promise<string[]> {
  const { polaris_api_key: key, polaris_base_url: baseUrl } =
    normalizePolarisSettings({
      polaris_api_key: configs.polaris_api_key || '',
      polaris_base_url: configs.polaris_base_url || POLARIS_ORIGIN,
    });
  if (!key) throw new Error('missing_key');

  let response: Response;
  try {
    response = await request(wanApiUrl(baseUrl, '/v1/models'), {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new Error(isTimeout(error) ? 'timeout' : 'unavailable');
  }
  if (!response.ok) {
    await response.body?.cancel();
    const code = {
      401: 'invalid_key',
      403: 'access_denied',
      429: 'rate_limited',
    }[response.status];
    throw new Error(code || 'unavailable');
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('invalid_response');
  try {
    let bytes = 0;
    let content = '';
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new Error('invalid_response');
      content += decoder.decode(value, { stream: true });
    }
    content += decoder.decode();
    const data = JSON.parse(content)?.data;
    if (!Array.isArray(data) || data.length > 10_000) {
      throw new Error('invalid_response');
    }
    const models = [
      ...new Set<string>(
        data.flatMap((item) => {
          const id = item?.id;
          return typeof id === 'string' &&
            id.length <= 200 &&
            isProviderModelId(id) &&
            /wan/i.test(id) &&
            !id.includes(key)
            ? [id]
            : [];
        })
      ),
    ].sort();
    if (models.length > 200) throw new Error('invalid_response');
    return models;
  } catch (error) {
    throw new Error(isTimeout(error) ? 'timeout' : 'invalid_response');
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

type CheckDependencies = {
  getUser: () => Promise<{ id: string } | null | undefined>;
  canManageSettings: (userId: string) => Promise<boolean>;
  getConfigs: () => Promise<Record<string, string>>;
  request?: typeof fetch;
};

export type PolarisModelCheckResult =
  | { status: 200; models: string[] }
  | { status: number; error: string };

export async function readPolarisModelsForAdmin(
  deps: CheckDependencies
): Promise<PolarisModelCheckResult> {
  try {
    const user = await deps.getUser();
    if (!user) return { status: 401, error: 'unauthenticated' };
    if (!(await deps.canManageSettings(user.id))) {
      return { status: 403, error: 'forbidden' };
    }
    const models = await checkPolarisModels(
      await deps.getConfigs(),
      deps.request
    );
    return { status: 200, models };
  } catch (error) {
    const code =
      error instanceof Error && safeErrors.has(error.message)
        ? error.message
        : 'unavailable';
    return { status: 502, error: code };
  }
}
