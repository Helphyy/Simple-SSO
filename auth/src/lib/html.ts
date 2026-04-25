/**
 * Template helpers pour produire du HTML en toute sécurité (auto-escape).
 * Usage : `html\`<div>${userInput}</div>\`` — userInput est automatiquement
 * échappé. Pour injecter du HTML brut (e.g. sous-templates), utiliser raw().
 */
const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(s: unknown): string {
  const str = s == null ? '' : String(s);
  return str.replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]!);
}

const RAW_MARK = Symbol('raw-html');
export type Raw = { [RAW_MARK]: true; value: string };

export function raw(s: string): Raw {
  return { [RAW_MARK]: true, value: s };
}

function render(value: unknown): string {
  if (value == null || value === false) return '';
  if (value === true) return '';
  if (Array.isArray(value)) return value.map(render).join('');
  if (typeof value === 'object' && (value as Raw)[RAW_MARK]) {
    return (value as Raw).value;
  }
  return escapeHtml(value);
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): Raw {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < values.length) out += render(values[i]);
  }
  return raw(out);
}

/** Convertit un `Raw` en string pour renvoi HTTP. */
export function render$(r: Raw): string {
  return r.value;
}
