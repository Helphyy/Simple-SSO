import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.PUBLIC_URL = 'http://localhost:4000';
process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com';
process.env.BOOTSTRAP_ADMIN_PASSWORD = 'bootstrap-pw-xx';
process.env.SESSION_SECRET = 'b'.repeat(64);
process.env.DATA_DIR = '/tmp';

const { csrfFor, csrfValid } = await import('../src/lib/csrf.js');

test('csrf roundtrip', () => {
  const sid = 'session-abc-123';
  const token = csrfFor(sid);
  assert.ok(csrfValid(sid, token));
});

test('csrf tied to session', () => {
  const tokenA = csrfFor('session-a');
  assert.equal(csrfValid('session-b', tokenA), false);
});

test('csrf rejects empty', () => {
  assert.equal(csrfValid('sid', ''), false);
  assert.equal(csrfValid('sid', 'notahex'), false);
});

test('csrf rejects wrong length', () => {
  const token = csrfFor('sid');
  assert.equal(csrfValid('sid', token.slice(0, -2)), false);
});
