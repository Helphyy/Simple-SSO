import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.PUBLIC_URL = 'http://localhost:4000';
process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com';
process.env.BOOTSTRAP_ADMIN_PASSWORD = 'bootstrap-pw-xx';
process.env.SESSION_SECRET = 'c'.repeat(64);
process.env.DATA_DIR = '/tmp';

const { hashPassword, verifyPassword, validatePassword } = await import('../src/lib/password.js');

test('hash and verify roundtrip', async () => {
  const hash = await hashPassword('LongCorrectHorseBatteryStaple42!');
  assert.ok(hash.startsWith('$argon2id$'));
  assert.ok(await verifyPassword(hash, 'LongCorrectHorseBatteryStaple42!'));
  assert.equal(await verifyPassword(hash, 'wrong'), false);
});

test('policy rejects too short', () => {
  const r = validatePassword('short');
  assert.equal(r?.code, 'too_short');
});

test('policy rejects weak 12 chars', () => {
  const r = validatePassword('password1234');
  assert.equal(r?.code, 'too_weak');
});

test('policy accepts strong', () => {
  assert.equal(validatePassword('correct horse battery staple donkey'), null);
});

test('policy uses user inputs as blocklist', () => {
  // Un mdp = username répété doit être rejeté
  const r = validatePassword('alicealicealice', ['alice', 'alice@corp.com']);
  assert.ok(r, 'doit être rejeté car dérivé du username');
});

test('verify resistant to garbled hash', async () => {
  assert.equal(await verifyPassword('not-a-real-hash', 'whatever'), false);
});
