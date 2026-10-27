import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';

import { TaskHistory } from './task-history';

test('task history renders processing, failure and success states without trial balance UI', () => {
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider
      value={{
        push() {},
        replace() {},
        refresh() {},
        back() {},
        forward() {},
        prefetch: async () => {},
      }}
    >
      <PathnameContext.Provider value="/my-videos">
        <NextIntlClientProvider locale="en" messages={{}}>
          <TaskHistory
            page={1}
            limit={12}
            total={3}
            tasks={[
              {
                id: '1',
                prompt: 'A',
                model: 'm',
                status: 'processing',
                costCredits: 5,
                createdAt: new Date(),
                version: '2.5',
                resolution: '720P',
                duration: 5,
              },
              {
                id: '2',
                prompt: 'B',
                model: 'm',
                status: 'failed',
                costCredits: 10,
                createdAt: new Date(),
                version: '2.7',
                resolution: '1080P',
                duration: 6,
                errorCode: 'generation_rejected',
              },
              {
                id: '3',
                prompt: 'C',
                model: 'm',
                status: 'success',
                costCredits: 7,
                createdAt: new Date(),
                version: '3.0',
                resolution: '720P',
                duration: 4,
                videoUrl: 'https://cdn.example/video.mp4',
              },
            ]}
          />
        </NextIntlClientProvider>
      </PathnameContext.Provider>
    </AppRouterContext.Provider>
  );
  assert.ok(html.includes('Generating'));
  assert.ok(html.includes('Failed'));
  assert.ok(html.includes('Open video'));
  assert.equal(/trial|赠送|50 credits/i.test(html), false);
});
