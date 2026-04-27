/**
 * Image upload helper.
 * Validation par magic bytes (anti MIME spoofing) + taille + type déclaré.
 * Retourne un data URL prêt à stocker, ou null si invalide.
 */

const MAGIC: Array<{ bytes: number[]; mime: string; offset?: number }> = [
  { bytes: [0x89, 0x50, 0x4E, 0x47], mime: 'image/png' },
  { bytes: [0xFF, 0xD8, 0xFF],       mime: 'image/jpeg' },
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp' }, // RIFF...
  // SVG : pas de magic universel, on vérifie plus bas (XML + <svg)
];

function detectMimeFromBytes(buf: Buffer): string | null {
  for (const sig of MAGIC) {
    const off = sig.offset ?? 0;
    if (buf.length < off + sig.bytes.length) continue;
    let ok = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buf[off + i] !== sig.bytes[i]) { ok = false; break; }
    }
    if (ok) {
      // WebP : RIFF + 4 bytes size + 'WEBP'
      if (sig.mime === 'image/webp') {
        if (buf.length < 12) return null;
        if (String.fromCharCode(buf[8], buf[9], buf[10], buf[11]) !== 'WEBP') return null;
      }
      return sig.mime;
    }
  }
  // SVG : XML déclaré + <svg
  const head = buf.slice(0, 1024).toString('utf8').trim().toLowerCase();
  if (head.startsWith('<?xml') || head.startsWith('<svg')) {
    if (head.includes('<svg')) return 'image/svg+xml';
  }
  return null;
}

export interface ParseImageUploadOpts {
  maxBytes?: number;
  allowedMimes: readonly string[];
}

export type ImageUploadResult =
  | { status: 'empty' }                               // pas de fichier soumis (champ vide)
  | { status: 'ok'; dataUrl: string }                 // fichier valide
  | { status: 'too_large'; max: number; size: number }
  | { status: 'mime_not_allowed'; declared: string }
  | { status: 'magic_mismatch'; declared: string };   // contenu ≠ type déclaré

/**
 * Parse un upload de fichier image en provenance d'un body Hono parsé.
 * Retourne un statut détaillé (utilisé par l'appelant pour afficher une erreur lisible).
 * - 'empty' : champ vide → l'appelant ignore (pas d'erreur)
 * - 'ok' : data URL prêt à stocker
 * - autres : erreur de validation (à afficher)
 */
export async function parseImageUpload(
  file: unknown,
  opts: ParseImageUploadOpts,
): Promise<ImageUploadResult> {
  if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) return { status: 'empty' };
  const f = file as File;
  if (f.size === 0) return { status: 'empty' };
  const max = opts.maxBytes ?? 10 * 1024 * 1024;
  if (f.size > max) return { status: 'too_large', max, size: f.size };
  if (!opts.allowedMimes.includes(f.type)) return { status: 'mime_not_allowed', declared: f.type };
  const buf = Buffer.from(await f.arrayBuffer());
  const realMime = detectMimeFromBytes(buf);
  if (!realMime || realMime !== f.type) return { status: 'magic_mismatch', declared: f.type };
  return { status: 'ok', dataUrl: `data:${realMime};base64,${buf.toString('base64')}` };
}

export function uploadErrorMessage(result: ImageUploadResult, fieldLabel = 'Image'): string | null {
  switch (result.status) {
    case 'empty':
    case 'ok':
      return null;
    case 'too_large':
      return `${fieldLabel} : fichier trop volumineux (${(result.size / 1024 / 1024).toFixed(1)} Mo, max ${(result.max / 1024 / 1024).toFixed(0)} Mo).`;
    case 'mime_not_allowed':
      return `${fieldLabel} : type "${result.declared}" non autorisé.`;
    case 'magic_mismatch':
      return `${fieldLabel} : le contenu du fichier ne correspond pas au type déclaré (${result.declared}). Possible corruption ou tentative d'usurpation.`;
  }
}
