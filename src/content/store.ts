// Store SQLite do painel de conteúdo (better-sqlite3). Tabela própria, pode
// dividir o mesmo arquivo .db da fila. CRUD + filtros + contadores do dashboard.

import Database from 'better-sqlite3';

import type {
  ContentItem, ContentInput, ContentPatch, ContentFilters, DashboardCounts,
} from './types.js';
import { PENDING_STATUSES } from './types.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS content_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    tema         TEXT NOT NULL,
    tipo         TEXT NOT NULL DEFAULT 'explicativo',
    plataforma   TEXT NOT NULL,
    idioma       TEXT NOT NULL DEFAULT 'pt',
    produto      TEXT,
    publish_date TEXT,
    publish_time TEXT,
    status       TEXT NOT NULL DEFAULT 'ideia',
    marca        TEXT,
    video_path   TEXT,
    error        TEXT,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_content_status ON content_items(status);
  CREATE INDEX IF NOT EXISTS idx_content_date   ON content_items(publish_date);
`;

const now = (): number => Math.floor(Date.now() / 1000);

const UPDATABLE = [
  'tema', 'tipo', 'plataforma', 'idioma', 'produto',
  'publish_date', 'publish_time', 'status', 'marca', 'video_path', 'error',
] as const;

/** Data local em YYYY-MM-DD. */
export function ymd(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Intervalo da semana (segunda a domingo) que contém `ref`. */
export function weekRange(ref = new Date()): { start: string; end: string } {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const offset = (d.getDay() + 6) % 7; // 0 = segunda
  const start = new Date(d); start.setDate(d.getDate() - offset);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  return { start: ymd(start), end: ymd(end) };
}

export class SqliteContentStore {
  private db: Database.Database;

  constructor(path = ':memory:') {
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SCHEMA);
  }

  get raw(): Database.Database { return this.db; }
  close(): void { this.db.close(); }

  create(input: ContentInput): number {
    const t = now();
    const r = this.db.prepare(
      `INSERT INTO content_items
        (tema, tipo, plataforma, idioma, produto, publish_date, publish_time, status, marca, created_at, updated_at)
       VALUES (@tema, @tipo, @plataforma, @idioma, @produto, @publish_date, @publish_time, @status, @marca, @t, @t)`,
    ).run({
      tema: input.tema,
      tipo: input.tipo ?? 'explicativo',
      plataforma: input.plataforma,
      idioma: input.idioma ?? 'pt',
      produto: input.produto ?? null,
      publish_date: input.publish_date ?? null,
      publish_time: input.publish_time ?? null,
      status: input.status ?? 'ideia',
      marca: input.marca ?? null,
      t,
    });
    return Number(r.lastInsertRowid);
  }

  get(id: number): ContentItem | null {
    return (this.db.prepare(`SELECT * FROM content_items WHERE id = ?`).get(id) as ContentItem | undefined) ?? null;
  }

  update(id: number, patch: ContentPatch): boolean {
    const keys = UPDATABLE.filter((k) => k in patch);
    if (keys.length === 0) return false;
    const sets = keys.map((k) => `${k} = @${k}`).join(', ');
    const params: Record<string, unknown> = { id, updated_at: now() };
    for (const k of keys) params[k] = (patch as Record<string, unknown>)[k] ?? null;
    const r = this.db.prepare(`UPDATE content_items SET ${sets}, updated_at = @updated_at WHERE id = @id`).run(params);
    return r.changes > 0;
  }

  remove(id: number): boolean {
    return this.db.prepare(`DELETE FROM content_items WHERE id = ?`).run(id).changes > 0;
  }

  list(filters: ContentFilters = {}): ContentItem[] {
    const where: string[] = [];
    const params: Record<string, unknown> = {};
    for (const k of ['plataforma', 'idioma', 'status', 'tipo'] as const) {
      if (filters[k]) { where.push(`${k} = @${k}`); params[k] = filters[k]; }
    }
    const sql = `SELECT * FROM content_items${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC, id DESC`;
    return this.db.prepare(sql).all(params) as ContentItem[];
  }

  /** Itens com data marcada, ordenados para a visão de calendário. */
  calendar(): ContentItem[] {
    return this.db.prepare(
      `SELECT * FROM content_items WHERE publish_date IS NOT NULL
       ORDER BY publish_date ASC, publish_time ASC, id ASC`,
    ).all() as ContentItem[];
  }

  dashboard(ref = new Date()): DashboardCounts {
    const c = (sql: string, ...p: unknown[]): number =>
      (this.db.prepare(`SELECT COUNT(*) AS n FROM content_items WHERE ${sql}`).get(...p) as { n: number }).n;
    const pendQ = PENDING_STATUSES.map(() => '?').join(',');
    const { start, end } = weekRange(ref);
    return {
      pending: c(`status IN (${pendQ})`, ...PENDING_STATUSES),
      ready: c(`status = ?`, 'pronto'),
      published: c(`status = ?`, 'publicado'),
      thisWeek: c(`publish_date IS NOT NULL AND publish_date BETWEEN ? AND ?`, start, end),
    };
  }
}
