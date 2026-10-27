import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  referenceVideoDuration,
  signReferenceVideo,
} from './wan-reference-video';
import { wanUploadSigningKey } from './wan-upload-signing';

test('dedicated upload key works with a legacy login secret and rejects forged receipts', () => {
  const previous = {
    auth: process.env.AUTH_SECRET,
    upload: process.env.WAN_UPLOAD_SIGNING_SECRET,
  };
  try {
    process.env.AUTH_SECRET = 'legacy-short-login-secret';
    delete process.env.WAN_UPLOAD_SIGNING_SECRET;
    assert.throws(wanUploadSigningKey, /not_configured/);
    process.env.WAN_UPLOAD_SIGNING_SECRET =
      'dedicated-test-upload-key-at-least-32-characters';
    const url = 'https://media.example.com/reference.mp4';
    const token = signReferenceVideo('owner', url, 2020);
    assert.equal(referenceVideoDuration([{ url, token }], 'owner'), 2.02);
    assert.throws(() => referenceVideoDuration([{ url, token }], 'other'));
    assert.throws(() =>
      referenceVideoDuration([{ url: url + '?changed', token }], 'owner')
    );
    process.env.WAN_UPLOAD_SIGNING_SECRET = 'short';
    process.env.AUTH_SECRET =
      'valid-legacy-fallback-key-at-least-32-characters';
    assert.throws(wanUploadSigningKey, /not_configured/);
    delete process.env.WAN_UPLOAD_SIGNING_SECRET;
    assert.equal(wanUploadSigningKey(), process.env.AUTH_SECRET);
  } finally {
    for (const [key, value] of [
      ['AUTH_SECRET', previous.auth],
      ['WAN_UPLOAD_SIGNING_SECRET', previous.upload],
    ]) {
      if (value === undefined) delete process.env[key!];
      else process.env[key!] = value;
    }
  }
});
