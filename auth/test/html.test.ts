import { test } from 'node:test';
import assert from 'node:assert/strict';

const { html, escapeHtml, raw, render$ } = await import('../src/lib/html.js');

test('escapeHtml échappe les caractères HTML', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(escapeHtml(`"'&`), '&quot;&#39;&amp;');
});

test('html auto-escape injection', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const out = html`<div>${evil}</div>`;
  assert.equal(render$(out), '<div>&lt;img src=x onerror=alert(1)&gt;</div>');
});

test('raw() bypasse l\'escape', () => {
  const safe = raw('<b>bold</b>');
  const out = html`<p>${safe}</p>`;
  assert.equal(render$(out), '<p><b>bold</b></p>');
});

test('arrays concatenated and escaped', () => {
  const items = ['<a>', '<b>'];
  const out = html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`;
  assert.equal(render$(out), '<ul><li>&lt;a&gt;</li><li>&lt;b&gt;</li></ul>');
});

test('null/undefined/false rendered as empty', () => {
  const out = html`<p>${null}${undefined}${false}${true}</p>`;
  assert.equal(render$(out), '<p></p>');
});
