import { WanCatalogValidationError } from '@/shared/lib/wan-product-catalog';

import {
  getWanCatalog,
  saveWanCatalog,
  type WanCatalogAuth,
} from './wan-catalog';

function reply(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function getWanCatalogResponse() {
  try {
    return reply({ code: 0, data: await getWanCatalog() });
  } catch {
    return reply({ code: -1, message: 'pricing_unavailable' }, 503);
  }
}

export function createSaveWanCatalogHandler(auth?: WanCatalogAuth) {
  return async (req: Request) => {
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin)
      return reply({ code: -1, message: 'pricing_forbidden' }, 403);
    try {
      const text = await req.text();
      if (text.length > 16000)
        return reply({ code: -1, message: 'pricing_invalid' }, 400);
      const input = JSON.parse(text);
      return reply({ code: 0, data: await saveWanCatalog(input, auth) });
    } catch (error) {
      if (error instanceof WanCatalogValidationError)
        return reply(
          {
            code: -1,
            message: 'pricing_invalid',
            fieldErrors: error.fieldErrors,
          },
          400
        );
      const message =
        error instanceof SyntaxError
          ? 'pricing_invalid'
          : error instanceof Error
            ? error.message
            : '';
      const statuses: Record<string, number> = {
        pricing_unauthorized: 401,
        pricing_forbidden: 403,
        pricing_conflict: 409,
        pricing_invalid: 400,
      };
      return statuses[message]
        ? reply({ code: -1, message }, statuses[message])
        : reply({ code: -1, message: 'pricing_unavailable' }, 503);
    }
  };
}
