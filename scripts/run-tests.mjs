import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { run } from 'node:test';
import { tap } from 'node:test/reporters';

const TEST_PATTERN = /\.test\.(?:ts|tsx|mts|cjs)$/;
function collect(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? collect(path)
      : TEST_PATTERN.test(entry.name)
        ? [resolve(path)]
        : [];
  });
}

// Pass exact files through the API: CLI glob expansion treats Next.js [param]
// directory names as character classes and can silently omit their tests.
const files = collect('src').sort();
if (!files.length) throw new Error('No test files found');
const stream = run({ files, execArgv: ['--import', 'tsx', '--expose-gc'] });
stream.on('test:fail', () => {
  process.exitCode = 1;
});
stream.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
stream.compose(tap).pipe(process.stdout);
