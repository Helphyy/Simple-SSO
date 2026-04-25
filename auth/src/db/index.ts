import Database from 'better-sqlite3';
import path from 'node:path';
import { config } from '../config.js';
import { runMigrations } from './migrations.js';

const dbPath = path.join(config.DATA_DIR, 'auth.db');
export const db = new Database(dbPath);

// Pragma recommendations : WAL, foreign_keys, synchronous=NORMAL
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');

runMigrations(db);

console.log(`[db] opened ${dbPath}`);
