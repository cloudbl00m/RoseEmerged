import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { fileURLToPath } from 'node:url';
export function openDatabase(demo=false) {
  const dir=resolve(process.env.ROSE_DATA_DIR || fileURLToPath(new URL('./data/',import.meta.url)));
  mkdirSync(dir,{recursive:true,mode:0o700});
  const db=new DatabaseSync(join(dir,demo?'development.sqlite':'garden.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS garden(id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, rows TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS accounts(name TEXT PRIMARY KEY, salt TEXT NOT NULL, hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, name TEXT NOT NULL, expires INTEGER NOT NULL);`);
  return db;
}
