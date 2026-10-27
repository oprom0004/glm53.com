import Image from 'next/image';
import { getLocale } from 'next-intl/server';

import { Link } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { Button as AppButton } from '@/shared/components/ui/button';

export default async function NotFoundPage() {
  const locale = await getLocale();
  const isChinese = locale === 'zh';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Image
        src={envConfigs.app_logo}
        alt={envConfigs.app_name}
        width={80}
        height={80}
      />
      <h1 className="text-2xl font-normal">
        {isChinese ? '页面不存在' : 'Page not found'}
      </h1>
      <AppButton asChild type="button">
        <Link href="/" className="mt-4">
          <SmartIcon name="ArrowLeft" />
          <span>{isChinese ? '返回首页' : 'Back to Home'}</span>
        </Link>
      </AppButton>
    </div>
  );
}
