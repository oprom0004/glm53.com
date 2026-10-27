'use client';

import { useRouter } from '@/core/i18n/navigation';
import { useAppContext } from '@/shared/contexts/app';

import { SignIn } from './sign-in';

export function SignInForm({
  callbackUrl = '/',
  className,
  defaultEmailExpanded = false,
  onSwitchToSignUp,
}: {
  callbackUrl: string;
  className?: string;
  defaultEmailExpanded?: boolean;
  onSwitchToSignUp?: () => void;
}) {
  const router = useRouter();
  const { configs, setIsShowSignModal, fetchUserInfo } = useAppContext();
  return (
    <div className={className}>
      <SignIn
        configs={configs}
        callbackUrl={callbackUrl}
        defaultEmailExpanded={defaultEmailExpanded}
        embedded
        onVerificationRequired={() => setIsShowSignModal(false)}
        onSwitchToSignUp={onSwitchToSignUp}
        onAuthenticated={async () => {
          await fetchUserInfo();
          setIsShowSignModal(false);
          router.refresh();
        }}
      />
    </div>
  );
}
