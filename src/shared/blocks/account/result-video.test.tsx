import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createRoot } from 'react-dom/client';

import { ResultVideo } from './result-video';

test('completed playback resets to a decoded frame and can replay; failed media offers retry', async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://wan.example/my-videos',
  });
  for (const name of [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'Node',
    'Element',
  ]) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: dom.window[name as keyof Window],
    });
  }
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const host = dom.window.document.getElementById('root')!;
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(<ResultVideo src="https://cdn.example/video.mp4" />)
    );
    const video = host.querySelector('video')!;
    assert.equal(video.playsInline, true);
    await act(async () =>
      video.dispatchEvent(new dom.window.Event('loadeddata'))
    );
    assert.equal(host.querySelector('[role="status"]'), null);
    video.currentTime = 2.02;
    await act(async () => video.dispatchEvent(new dom.window.Event('ended')));
    assert.equal(video.currentTime, 0);
    assert.equal(host.querySelector('button')?.textContent, 'Replay video');
    let played = 0;
    video.play = async () => {
      played++;
      video.dispatchEvent(new dom.window.Event('playing'));
    };
    await act(async () => host.querySelector('button')!.click());
    assert.equal(played, 1);
    assert.equal(host.querySelector('button')?.textContent, 'Reload video');
    await act(async () => video.dispatchEvent(new dom.window.Event('error')));
    assert.match(
      host.querySelector('[role="alert"]')!.textContent!,
      /could not load/
    );
    Object.defineProperty(video, 'error', {
      configurable: true,
      value: { code: 2 },
    });
    let loaded = 0;
    video.load = () => {
      loaded++;
    };
    await act(async () => host.querySelector('button')!.click());
    assert.equal(loaded, 1);
    assert.equal(played, 2);
    assert.equal(host.querySelector('[role="alert"]'), null);
    // A blank rendering surface may not emit a media error. Reload must replace
    // the element itself, so it can recover independently of error detection.
    await act(async () => host.querySelector('button')!.click());
    assert.notEqual(host.querySelector('video'), video);
    assert.equal(
      host.querySelector('video')?.getAttribute('src'),
      'https://cdn.example/video.mp4'
    );
    assert.ok(host.querySelector('[role="status"]'));
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
