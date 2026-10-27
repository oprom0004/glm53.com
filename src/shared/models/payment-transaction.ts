import { envConfigs } from '@/config';
import { db } from '@/core/db';

// SQLite/libsql starts write transactions synchronously. Queue financial work
// in this process so concurrent requests cannot deadlock the transaction owner.
let pending: Promise<unknown> = Promise.resolve();

export async function paymentTransaction<T>(
  execute: (tx: any) => Promise<T>
): Promise<T> {
  if (envConfigs.database_provider === 'd1') {
    throw new Error(
      'Payment settlement requires an interactive transaction database'
    );
  }

  const run = async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await db().transaction(execute);
      } catch (error: any) {
        if (
          attempt >= 4 ||
          !String(error?.code || error?.cause?.code).includes('SQLITE_BUSY')
        ) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
      }
    }
  };

  if (!['sqlite', 'turso'].includes(envConfigs.database_provider)) return run();
  const result = pending.then(run, run);
  pending = result.catch(() => undefined);
  return result;
}
