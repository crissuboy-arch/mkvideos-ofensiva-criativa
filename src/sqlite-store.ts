// Store SQLite default — implementa QueueStore com better-sqlite3.
// Usado no modo standalone (rodar a fila sem bot) ou por hosts que não tenham
// um DB próprio. Hosts com SQLite próprio (ex.: openpcbot) podem implementar
// QueueStore sobre o banco deles em vez de usar este.

import Database from 'better-sqlite3';

import type { EnqueueInput, QueueStore, VideoJob } from './types.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS video_jobs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    skill        TEXT NOT NULL,
    input        TEXT NOT NULL,
    opts         TEXT,
    status       TEXT NOT NULL DEFAULT 'queued',
    result_path  TEXT,
    error        TEXT,
    notify       TEXT NOT NULL DEFAULT 'sempre',
    send_video   INTEGER NOT NULL DEFAULT 0,
    chat_id      TEXT,
    created_at   INTEGER NOT NULL,
    started_at   INTEGER,
    finished_at  INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status, created_at, id);
`;

const now = (): number => Math.floor(Date.now() / 1000);

export class SqliteQueueStore implements QueueStore {
  private db: Database.Database;

  /** @param path caminho do arquivo .db, ou ':memory:' para in-memory. */
  constructor(path = ':memory:') {
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SCHEMA);
  }

  /** Acesso ao Database cru (migrações/integração). */
  get raw(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }

  enqueue(job: EnqueueInput): number {
    const result = this.db.prepare(
      `INSERT INTO video_jobs (skill, input, opts, status, notify, send_video, chat_id, created_at)
       VALUES (?, ?, ?, 'queued', ?, ?, ?, ?)`,
    ).run(job.skill, job.input, job.opts, job.notify, job.sendVideo ? 1 : 0, job.chatId, now());
    return Number(result.lastInsertRowid);
  }

  getNext(): VideoJob | null {
    return (this.db
      .prepare(`SELECT * FROM video_jobs WHERE status = 'queued' ORDER BY created_at, id LIMIT 1`)
      .get() as VideoJob | undefined) ?? null;
  }

  getRunning(): VideoJob | null {
    return (this.db
      .prepare(`SELECT * FROM video_jobs WHERE status = 'running' ORDER BY started_at LIMIT 1`)
      .get() as VideoJob | undefined) ?? null;
  }

  markRunning(id: number): void {
    this.db.prepare(`UPDATE video_jobs SET status = 'running', started_at = ? WHERE id = ?`).run(now(), id);
  }

  markDone(id: number, resultPath: string): void {
    this.db.prepare(`UPDATE video_jobs SET status = 'done', result_path = ?, finished_at = ? WHERE id = ?`)
      .run(resultPath, now(), id);
  }

  markFailed(id: number, error: string): void {
    this.db.prepare(`UPDATE video_jobs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?`)
      .run(error.slice(0, 500), now(), id);
  }

  cancel(id: number): boolean {
    const result = this.db.prepare(`UPDATE video_jobs SET status = 'canceled' WHERE id = ? AND status = 'queued'`).run(id);
    return result.changes > 0;
  }

  list(limit = 50): VideoJob[] {
    return this.db
      .prepare(`SELECT * FROM video_jobs ORDER BY created_at DESC, id DESC LIMIT ?`)
      .all(limit) as VideoJob[];
  }

  failStaleRunning(): number {
    const result = this.db.prepare(
      `UPDATE video_jobs SET status = 'failed', error = 'interrompido por reinício do serviço', finished_at = ? WHERE status = 'running'`,
    ).run(now());
    return result.changes;
  }
}
