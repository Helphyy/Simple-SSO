import { db } from '../db/index.js';

export type AuditAction =
  | 'user.login.success'
  | 'user.login.failure'
  | 'user.logout'
  | 'user.password.changed'
  | 'admin.user.create'
  | 'admin.user.update'
  | 'admin.user.delete'
  | 'admin.user.password_reset'
  | 'admin.user.enable'
  | 'admin.user.disable'
  | 'admin.group.create'
  | 'admin.group.update'
  | 'admin.group.delete'
  | 'admin.group.member_add'
  | 'admin.group.member_remove'
  | 'admin.client.create'
  | 'admin.client.delete'
  | 'admin.client.access_update'
  | 'admin.branding.update'
  | 'admin.settings.update'
  | 'admin.user.unlock'
  | 'user.profile.updated';

export interface AuditEntry {
  id: number;
  actor_user_id: string | null;
  action: AuditAction;
  target: string | null;
  metadata: string | null;
  ip: string | null;
  created_at: number;
}

export const Audit = {
  log(input: {
    actorUserId: string | null;
    action: AuditAction;
    target?: string | null;
    metadata?: Record<string, unknown>;
    ip?: string | null;
  }): void {
    db.prepare(`
      INSERT INTO audit_log (actor_user_id, action, target, metadata, ip, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      input.actorUserId,
      input.action,
      input.target ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.ip ?? null,
      Date.now()
    );
  },

  list(limit = 100): AuditEntry[] {
    return db.prepare(`
      SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?
    `).all(limit) as AuditEntry[];
  },
};
