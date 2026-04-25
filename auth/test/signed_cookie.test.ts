import { test } from 'node:test';
import assert from 'node:assert/strict';

// Force config via env avant l'import
process.env.PUBLIC_URL = 'http://localhost:4000';
process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com';
process.env.BOOTSTRAP_ADMIN_PASSWORD = 'bootstrap-pw-xx';
process.env.SESSION_SECRET = 'a'.repeat(64);
process.env.DATA_DIR = '/tmp';

const { sign, unsign } = await import('../src/lib/signed_cookie.js');

test('signed cookie roundtrip', () => {
  const value = 'session-id-12345';
  const signed = sign(value);
  assert.notEqual(signed, value);
  assert.ok(signed.includes('.'));
  assert.equal(unsign(signed), value);
});

test('tampered cookie rejected', () => {
  const signed = sign('foo');
  // Modifier la valeur sans regénérer le mac
  const tampered = 'bar' + signed.slice(3);
  assert.equal(unsign(tampered), null);
});

test('truncated signature rejected', () => {
  const signed = sign('hello');
  const shortened = signed.slice(0, -5);
  assert.equal(unsign(shortened), null);
});

test('missing signature rejected', () => {
  assert.equal(unsign('just-a-value'), null);
  assert.equal(unsign(''), null);
  assert.equal(unsign('.'), null);
});
