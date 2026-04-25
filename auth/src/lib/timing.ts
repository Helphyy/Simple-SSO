/**
 * Garantit que l'op async prend AU MOINS `minMs`. Utilisé sur le POST /login
 * pour lisser le temps de réponse et neutraliser les timing attacks
 * d'énumération de users.
 */
export async function constantTime<T>(op: Promise<T>, minMs: number): Promise<T> {
  const start = Date.now();
  const result = await op;
  const elapsed = Date.now() - start;
  if (elapsed < minMs) {
    await new Promise((r) => setTimeout(r, minMs - elapsed));
  }
  return result;
}
