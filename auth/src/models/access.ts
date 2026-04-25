import { db } from '../db/index.js';
import { Groups } from './groups.js';

export type Principal = { type: 'user' | 'group'; id: string };

export const Access = {
  /**
   * Liste des principals autorisés sur un client.
   * Si vide, tous les utilisateurs authentifiés peuvent accéder (open).
   */
  list(clientId: string): Principal[] {
    return (db.prepare(`
      SELECT principal_type AS type, principal_id AS id
        FROM client_access WHERE client_id = ?
       ORDER BY principal_type, principal_id
    `).all(clientId) as any[]).map((r) => ({ type: r.type, id: r.id }));
  },

  /**
   * Vérifie si un user a accès à un client.
   * Open par défaut si aucune entrée n'existe pour le client.
   */
  canAccess(userId: string, clientId: string): boolean {
    const entries = Access.list(clientId);
    if (entries.length === 0) return true;
    if (entries.some((p) => p.type === 'user' && p.id === userId)) return true;
    const userGroupIds = new Set(Groups.groupsOf(userId).map((g) => g.id));
    return entries.some((p) => p.type === 'group' && userGroupIds.has(p.id));
  },

  /**
   * Liste des clients accessibles par un user (pour le hub).
   */
  clientsForUser(userId: string): string[] {
    const all = (db.prepare(`SELECT id FROM oidc_clients`).all() as any[]).map((r) => r.id as string);
    return all.filter((id) => Access.canAccess(userId, id));
  },

  set(clientId: string, principals: Principal[]): void {
    db.transaction(() => {
      db.prepare('DELETE FROM client_access WHERE client_id = ?').run(clientId);
      const ins = db.prepare(`
        INSERT INTO client_access (client_id, principal_type, principal_id)
        VALUES (?, ?, ?)
      `);
      for (const p of principals) ins.run(clientId, p.type, p.id);
    })();
  },
};
