import dotenv from 'dotenv';

// Server-side read-only check. Never print the key or upstream response body.
dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ path: '.env', quiet: true });
const key = process.env.KIE_API_KEY?.trim();
if (!key || !/^[\x21-\x7e]+$/.test(key) || /^Bearer\b/i.test(key)) {
  console.log('KIE_API_KEY is missing or invalid. Fill it in .env.local.');
  process.exitCode = 1;
} else {
  try {
    const response = await fetch('https://api.kie.ai/api/v1/chat/credit', {
      headers: { Authorization: `Bearer ${key}` },
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json();
    if (
      response.ok &&
      result.code === 200 &&
      typeof result.data === 'number' &&
      Number.isFinite(result.data)
    ) {
      console.log(
        JSON.stringify({
          authenticated: true,
          providerCredits: result.data,
          generationTested: false,
        })
      );
    } else {
      console.log(
        JSON.stringify({
          authenticated: false,
          httpStatus: response.status,
          providerCode: typeof result.code === 'number' ? result.code : null,
        })
      );
      process.exitCode = 1;
    }
  } catch {
    console.log(
      'Kie authentication check failed: network timeout or invalid response.'
    );
    process.exitCode = 1;
  }
}
