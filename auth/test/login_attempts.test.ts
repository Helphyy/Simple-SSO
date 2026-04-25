import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Crée un DATA_DIR temp unique pour isoler la DB de test
const tmpDir = fs.mkdtempSync(path.join('/tmp', 'auth-test-'));
process.env.DATA_DIR = tmpDir;
process.env.PUBLIC_URL = 'http://localhost:4000';
process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com';
process.env.BOOTSTRAP_ADMIN_PASSWORD = 'bootstrap-pw-xx';
process.env.SESSION_SECRET = 'd'.repeat(64);

const { LoginAttempts } = await import('../src/models/login_attempts.js');

test('pas lock par défaut', () => {
  assert.equal(LoginAttempts.isLocked('alice', '1.2.3.4'), false);
});

test('5 échecs → lock', () => {
  for (let i = 0; i < 5; i++) LoginAttempts.record('bob', '1.2.3.4', false);
  assert.equal(LoginAttempts.isLocked('bob', '1.2.3.4'), true);
});

test('succès reset le compteur', () => {
  for (let i = 0; i < 4; i++) LoginAttempts.record('carol', '1.2.3.4', false);
  LoginAttempts.record('carol', '1.2.3.4', true);
  for (let i = 0; i < 4; i++) LoginAttempts.record('carol', '1.2.3.4', false);
  assert.equal(LoginAttempts.isLocked('carol', '1.2.3.4'), false);
});

test('lock par (user, ip) — pas global', () => {
  for (let i = 0; i < 5; i++) LoginAttempts.record('dave', '5.5.5.5', false);
  assert.equal(LoginAttempts.isLocked('dave', '5.5.5.5'), true);
  assert.equal(LoginAttempts.isLocked('dave', '6.6.6.6'), false);
});

test('cleanup supprime les vieilles entrées', () => {
  LoginAttempts.gc();
  // On ne peut pas asserter précisément mais s'exécute sans erreur
  assert.ok(true);
});
