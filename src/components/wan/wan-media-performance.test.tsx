import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';

import enHome from '@/config/locale/messages/en/wan-home.json';

import { WanFeatures } from './wan-features';
import { WanHero } from './wan-hero';

Object.assign(globalThis, { React });

const messages = {
  'wan-home': enHome,
  common: { media: { play: 'Play demo', pause: 'Pause demo' } },
};
const page = () => (
  <NextIntlClientProvider locale="en" timeZone="UTC" messages={messages}>
    <WanFeatures />
  </NextIntlClientProvider>
);

let dom: JSDOM | undefined;
let root: Root | undefined;
let observers: VisibilityObserver[];
let playing: Set<HTMLMediaElement>;
let hidden = false;
let reduced = false;
let saveData = false;
let rejectPlay = false;
let motionListeners: Set<() => void>;

class VisibilityObserver {
  target?: Element;
  disconnected = false;
  constructor(private callback: IntersectionObserverCallback) {
    observers.push(this);
  }
  observe(target: Element) {
    this.target = target;
  }
  disconnect() {
    this.disconnected = true;
  }
  emit(visible: boolean) {
    this.emitBatch(visible);
  }
  emitBatch(...visibility: boolean[]) {
    this.callback(
      visibility.map(
        (visible) =>
          ({
            target: this.target!,
            isIntersecting: visible,
            intersectionRatio: visible ? 1 : 0,
          }) as IntersectionObserverEntry
      ),
      this as unknown as IntersectionObserver
    );
  }
}

async function mount(
  options: {
    reduced?: boolean;
    saveData?: boolean;
    noObserver?: boolean;
    rejectPlay?: boolean;
  } = {}
) {
  dom = new JSDOM('<div id="root"></div>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });
  hidden = false;
  reduced = options.reduced ?? false;
  saveData = options.saveData ?? false;
  rejectPlay = options.rejectPlay ?? false;
  observers = [];
  playing = new Set();
  motionListeners = new Set();
  for (const name of [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'HTMLMediaElement',
    'Element',
    'Node',
  ]) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: (dom.window as any)[name],
    });
  }
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  });
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    value: { saveData },
  });
  window.matchMedia = (() => ({
    get matches() {
      return reduced;
    },
    addEventListener(_event: string, callback: () => void) {
      motionListeners.add(callback);
    },
    removeEventListener(_event: string, callback: () => void) {
      motionListeners.delete(callback);
    },
  })) as any;
  Object.assign(globalThis, {
    IntersectionObserver: options.noObserver ? undefined : VisibilityObserver,
  });
  Object.assign(window, {
    IntersectionObserver: options.noObserver ? undefined : VisibilityObserver,
  });
  dom.window.HTMLMediaElement.prototype.play = function () {
    if (rejectPlay) return Promise.reject(new Error('autoplay blocked'));
    playing.add(this as unknown as HTMLMediaElement);
    this.dispatchEvent(new dom!.window.Event('playing'));
    return Promise.resolve();
  };
  dom.window.HTMLMediaElement.prototype.pause = function () {
    playing.delete(this as unknown as HTMLMediaElement);
    this.dispatchEvent(new dom!.window.Event('pause'));
  };
  dom.window.HTMLMediaElement.prototype.load = function () {};
  root = createRoot(document.getElementById('root')!);
  await act(async () => {
    root!.render(page());
  });
  return Array.from(document.querySelectorAll('video'));
}

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  dom?.window.close();
  dom = undefined;
});

test('below-fold homepage demos do not advertise eager video requests in server HTML', () => {
  const document = new JSDOM(renderToStaticMarkup(page())).window.document;
  const videos = Array.from(document.querySelectorAll('video'));
  assert.equal(videos.length, 6);
  assert.equal(
    document.querySelectorAll('video[src], video source[src]').length,
    0
  );
  assert.ok(
    videos.every((video) => !video.autoplay && video.preload === 'none')
  );
});

test('hero preview also waits for visibility instead of unconditional autoplay', () => {
  const markup = renderToStaticMarkup(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={messages}>
      <WanHero />
    </NextIntlClientProvider>
  );
  const document = new JSDOM(markup).window.document;
  const video = document.querySelector('video');
  assert.ok(video);
  assert.equal(
    document.querySelectorAll('video[src], video source[src]').length,
    0
  );
  assert.equal(video.autoplay, false);
  assert.equal(video.preload, 'none');
  assert.ok(video.poster);
  assert.ok(document.querySelector('button[aria-label="Play demo"]'));
});

test('only a visible demo loads and plays; leaving viewport pauses decoding', async () => {
  const videos = await mount();
  assert.equal(
    document.querySelectorAll('video[src], video source[src]').length,
    0
  );
  assert.equal(observers.length, 6);
  await act(async () => observers[0].emit(true));
  assert.match(videos[0].src, /expected-4k-video-output\.mp4$/);
  assert.equal(playing.size, 1);
  assert.equal(videos[1].getAttribute('src'), null);
  await act(async () => observers[0].emit(false));
  assert.equal(playing.size, 0);
  await act(async () => observers[0].emit(true));
  assert.equal(playing.size, 1);
});

test('batched visibility records use the latest state so fast scrolling cannot leave a video running', async () => {
  const videos = await mount();
  await act(async () => observers[0].emitBatch(true, false));
  assert.equal(playing.size, 0);
  assert.equal(videos[0].getAttribute('src'), null);
  await act(async () => observers[0].emitBatch(false, true));
  assert.equal(playing.size, 1);
});

test('a delayed play promise cannot keep an offscreen or unmounted video running', async () => {
  await mount();
  let finishPlay: (() => void) | undefined;
  dom!.window.HTMLMediaElement.prototype.play = function () {
    return new Promise<void>((resolve) => {
      finishPlay = () => {
        playing.add(this as unknown as HTMLMediaElement);
        this.dispatchEvent(new window.Event('playing'));
        resolve();
      };
    });
  };
  await act(async () => observers[0].emit(true));
  await act(async () => observers[0].emit(false));
  await act(async () => finishPlay!());
  assert.equal(playing.size, 0);
  assert.equal(
    document
      .querySelector('video')
      ?.parentElement?.querySelector('button')
      ?.getAttribute('aria-label'),
    'Play demo'
  );
  await act(async () => observers[0].emit(true));
  await act(async () => root!.unmount());
  root = undefined;
  await act(async () => finishPlay!());
  assert.equal(playing.size, 0);
});

test('background tabs pause all demos and only visible demos resume', async () => {
  await mount();
  await act(async () => {
    observers[0].emit(true);
    observers[1].emit(true);
  });
  assert.equal(playing.size, 2);
  await act(async () => {
    hidden = true;
    document.dispatchEvent(new window.Event('visibilitychange'));
  });
  assert.equal(playing.size, 0);
  await act(async () => {
    observers[1].emit(false);
    hidden = false;
    document.dispatchEvent(new window.Event('visibilitychange'));
  });
  assert.equal(playing.size, 1);
  await act(async () => root!.unmount());
  root = undefined;
  assert.equal(playing.size, 0);
  assert.ok(observers.every((observer) => observer.disconnected));
});

for (const policy of ['reduced', 'saveData'] as const) {
  test(`${policy} does not auto-download media but explicit play still works`, async () => {
    const videos = await mount({ [policy]: true });
    await act(async () => observers[0].emit(true));
    assert.equal(videos[0].getAttribute('src'), null);
    assert.equal(playing.size, 0);
    const button = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Play demo"]'
    );
    assert.ok(button);
    await act(async () => button.click());
    assert.equal(playing.size, 1);
  });
}

test('blocked autoplay presents a manual play control and recovers without a reload', async () => {
  await mount({ rejectPlay: true });
  await act(async () => observers[0].emit(true));
  assert.equal(playing.size, 0);
  const button = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Play demo"]'
  );
  assert.ok(button);
  rejectPlay = false;
  await act(async () => button.click());
  assert.equal(playing.size, 1);
});

test('without IntersectionObserver demos remain manual instead of playing every video', async () => {
  await mount({ noObserver: true });
  assert.equal(
    document.querySelectorAll('video[src], video source[src]').length,
    0
  );
  assert.equal(playing.size, 0);
  const button = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Play demo"]'
  );
  assert.ok(button);
  await act(async () => button.click());
  assert.equal(playing.size, 1);
});

test('manual pause survives viewport and tab changes until explicitly resumed', async () => {
  await mount();
  await act(async () => observers[0].emit(true));
  const button = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Pause demo"]'
  );
  assert.ok(button);
  await act(async () => button.click());
  assert.equal(playing.size, 0);
  await act(async () => {
    observers[0].emit(false);
    observers[0].emit(true);
  });
  await act(async () => {
    hidden = true;
    document.dispatchEvent(new window.Event('visibilitychange'));
    hidden = false;
    document.dispatchEvent(new window.Event('visibilitychange'));
  });
  assert.equal(playing.size, 0);
  await act(async () => button.click());
  assert.equal(playing.size, 1);
});

test('enabling reduced motion stops automatic playback immediately', async () => {
  await mount();
  await act(async () => {
    observers[0].emit(true);
    observers[1].emit(true);
  });
  assert.equal(playing.size, 2);
  await act(async () => {
    reduced = true;
    motionListeners.forEach((listener) => listener());
  });
  assert.equal(playing.size, 0);
});
