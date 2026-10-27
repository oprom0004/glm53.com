'use client';

import { useRouter } from '@/core/i18n/navigation';
import { useAppContext } from '@/shared/contexts/app';

import { SignUp } from './sign-up';

export function SignUpForm({
  callbackUrl = '/',
  className,
  defaultEmailExpanded = false,
  onSwitchToSignIn,
}: {
  callbackUrl: string;
  className?: string;
  defaultEmailExpanded?: boolean;
  onSwitchToSignIn?: () => void;
}) {
  const router = useRouter();
  const { configs, setIsShowSignModal, fetchUserInfo } = useAppContext();
  return (
    <div className={className}>
      <SignUp
        configs={configs}
        callbackUrl={callbackUrl}
        defaultEmailExpanded={defaultEmailExpanded}
        embedded
        onVerificationRequired={() => setIsShowSignModal(false)}
        onSwitchToSignIn={onSwitchToSignIn}
        onAuthenticated={async () => {
          await fetchUserInfo();
          setIsShowSignModal(false);
          router.refresh();
        }}
      />
    </div>
  );
}
