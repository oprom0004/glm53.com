import { WanFooter } from './wan-footer';
import { WanGenerator } from './wan-generator';
import { WanHeader } from './wan-header';
import { WanLineup } from './wan-lineup';
import type { WanUiVersion } from './generator-copy';

export function WanVersionPage({ version }: { version: WanUiVersion }) {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col selection:bg-violet-500 selection:text-white">
      <WanHeader />
      <main className="flex-1">
        <WanGenerator version={version} />
        <WanLineup />
      </main>
      <WanFooter />
    </div>
  );
}
