import { db } from '../db/index.js';
import { newId } from '../lib/ids.js';

export interface Group {
  id: string;
  name: string;
  description: string;
  created_at: number;
}

export const Groups = {
  findById(id: string): Group | undefined {
    return db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as Group | undefined;
  },

  findByName(name: string): Group | undefined {
    return db.prepare('SELECT * FROM groups WHERE name = ?').get(name) as Group | undefined;
  },

  listAll(): Group[] {
    return db.prepare('SELECT * FROM groups ORDER BY name ASC').all() as Group[];
  },

  create(input: { name: string; description: string }): Group {
    const id = newId();
    db.prepare(`
      INSERT INTO groups (id, name, description, created_at) VALUES (?, ?, ?, ?)
    `).run(id, input.name, input.description, Date.now());
    return Groups.findById(id)!;
  },

  update(id: string, patch: { description?: string }): void {
    if (patch.description !== undefined) {
      db.prepare('UPDATE groups SET description = ? WHERE id = ?')
        .run(patch.description, id);
    }
  },

  delete(id: string): void {
    db.prepare('DELETE FROM groups WHERE id = ?').run(id);
  },

  // ── Membership ──
  membersOf(groupId: string): { id: string; username: string; email: string }[] {
    return db.prepare(`
      SELECT u.id, u.username, u.email
        FROM users u
        JOIN user_groups ug ON ug.user_id = u.id
       WHERE ug.group_id = ?
       ORDER BY u.username
    `).all(groupId) as any[];
  },

  groupsOf(userId: string): Group[] {
    return db.prepare(`
      SELECT g.*
        FROM groups g
        JOIN user_groups ug ON ug.group_id = g.id
       WHERE ug.user_id = ?
       ORDER BY g.name
    `).all(userId) as Group[];
  },

  groupNamesOf(userId: string): string[] {
    return (db.prepare(`
      SELECT g.name FROM groups g
        JOIN user_groups ug ON ug.group_id = g.id
       WHERE ug.user_id = ?
       ORDER BY g.name
    `).all(userId) as any[]).map((r) => r.name);
  },

  addUser(userId: string, groupId: string): void {
    db.prepare(`
      INSERT OR IGNORE INTO user_groups (user_id, group_id) VALUES (?, ?)
    `).run(userId, groupId);
  },

  removeUser(userId: string, groupId: string): void {
    db.prepare('DELETE FROM user_groups WHERE user_id = ? AND group_id = ?')
      .run(userId, groupId);
  },

  setUserGroups(userId: string, groupIds: string[]): void {
    db.transaction(() => {
      db.prepare('DELETE FROM user_groups WHERE user_id = ?').run(userId);
      const ins = db.prepare('INSERT INTO user_groups (user_id, group_id) VALUES (?, ?)');
      for (const gid of groupIds) ins.run(userId, gid);
    })();
  },
};
