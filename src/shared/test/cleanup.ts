import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, relative, resolve } from 'node:path';

/** libSQL's native transaction connections are finalized by GC on Windows. */
export async function removeTestDatabaseDirectory(directory: string) {
  const target = resolve(directory);
  const insideTemp = relative(resolve(tmpdir()), target);
  if (
    !insideTemp ||
    insideTemp.startsWith('..') ||
    isAbsolute(insideTemp) ||
    !basename(target).startsWith('wan-')
  ) {
    throw new Error(
      'Refusing to remove a directory outside the Wan test sandbox'
    );
  }
  await new Promise<void>((resolve) => setImmediate(resolve));
  globalThis.gc?.();
  await new Promise<void>((resolve) => setImmediate(resolve));
  await rm(target, { recursive: true, maxRetries: 5, retryDelay: 100 });
}
