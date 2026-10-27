import type { ReactNode } from 'react';

import { AccountShell } from '@/shared/blocks/account/account-shell';

export const metadata = { robots: { index: false, follow: false } };

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
