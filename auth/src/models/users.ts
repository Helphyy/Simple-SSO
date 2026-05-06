import { db } from '../db/index.js';
import { newId } from '../lib/ids.js';

export type Role = 'admin' | 'member';

export interface User {
  id: string;
  username: string;
  email: string | null;
  first_name: string;
  last_name: string;
  password_hash: string;
  role: Role;
  enabled: number;             // 0/1
  must_change_password: number; // 0/1
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
}

export const Users = {
  findById(id: string): User | undefined {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  },

  findByUsername(username: string): User | undefined {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
  },

  findByEmail(email: string): User | undefined {
    if (!email) return undefined;
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
  },

  listAll(): User[] {
    return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as User[];
  },

  create(input: {
    username: string;
    email: string | null;
    first_name: string;
    last_name: string;
    password_hash: string;
    role: Role;
    must_change_password: boolean;
  }): User {
    const id = newId();
    const now = Date.now();
    db.prepare(`
      INSERT INTO users (id, username, email, first_name, last_name,
        password_hash, role, enabled, must_change_password, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      id,
      input.username,
      input.email || null,
      input.first_name,
      input.last_name,
      input.password_hash,
      input.role,
      input.must_change_password ? 1 : 0,
      now,
      now
    );
    return Users.findById(id)!;
  },

  update(id: string, patch: Partial<{
    username: string;
    email: string | null;
    first_name: string;
    last_name: string;
    role: Role;
    enabled: boolean;
  }>): void {
    const fields: string[] = [];
    const values: any[] = [];
    if (patch.username !== undefined) { fields.push('username = ?'); values.push(patch.username); }
    if (patch.email !== undefined) { fields.push('email = ?'); values.push(patch.email || null); }
    if (patch.first_name !== undefined) { fields.push('first_name = ?'); values.push(patch.first_name); }
    if (patch.last_name !== undefined) { fields.push('last_name = ?'); values.push(patch.last_name); }
    if (patch.role !== undefined) { fields.push('role = ?'); values.push(patch.role); }
    if (patch.enabled !== undefined) { fields.push('enabled = ?'); values.push(patch.enabled ? 1 : 0); }
    if (!fields.length) return;
    fields.push('updated_at = ?'); values.push(Date.now());
    values.push(id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  },

  setPassword(id: string, hash: string, mustChange: boolean): void {
    db.prepare(`
      UPDATE users
         SET password_hash = ?, must_change_password = ?, updated_at = ?
       WHERE id = ?
    `).run(hash, mustChange ? 1 : 0, Date.now(), id);
  },

  markLogin(id: string): void {
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(Date.now(), id);
  },

  delete(id: string): void {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  },

  count(): number {
    return (db.prepare('SELECT COUNT(*) AS c FROM users').get() as any).c;
  },

  countActiveAdmins(): number {
    return (db.prepare(
      `SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND enabled = 1`
    ).get() as any).c;
  },
};

