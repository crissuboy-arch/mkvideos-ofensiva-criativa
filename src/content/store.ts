// Store SQLite do Centro de Operações (better-sqlite3): conteúdo + contas + logs.
// Tabelas próprias, podem dividir o mesmo .db da fila. Inclui migração leve.

import Database from 'better-sqlite3';

import type {
  ContentItem, ContentInput, ContentPatch, ContentFilters, DashboardCounts,
  Account, AccountInput, LogEntry, LogEvent, Metrics, BatchVariation,
} from './types.js';
import { PENDING_STATUSES, PLATFORMS } from './types.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS content_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    tema         TEXT NOT NULL,
    tipo         TEXT NOT NULL DEFAULT 'explicativo',
    plataforma   TEXT NOT NULL,
    idioma       TEXT NOT NULL DEFAULT 'pt',
    produto      TEXT,
    account_id   INTEGER,
    publish_date TEXT,
    publish_time TEXT,
    timezone     TEXT,
    status       TEXT NOT NULL DEFAULT 'ideia',
    marca        TEXT,
    video_path   TEXT,
    error        TEXT,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_content_status ON content_items(status);
  CREATE INDEX IF NOT EXISTS idx_content_date   ON content_items(publish_date);

  CREATE TABLE IF NOT EXISTS accounts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nome       TEXT NOT NULL,
    plataforma TEXT NOT NULL,
    idioma     TEXT NOT NULL,
    ativo      INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS content_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    content_id INTEGER,
    event      TEXT NOT NULL,
    detail     TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_logs_content ON content_logs(content_id, id);
`;

const now = (): number => Math.floor(Date.now() / 1000);

const UPDATABLE = [
  'tema', 'tipo', 'plataforma', 'idioma', 'produto', 'account_id',
  'publish_date', 'publish_time', 'timezone', 'status', 'marca', 'video_path', 'error',
] as const;

const p2 = (n: number): string => String(n).padStart(2, '0');

/** Data local em YYYY-MM-DD. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** Data+hora local em YYYY-MM-DDTHH:MM (para comparar agendamentos). */
export function nowLocalIso(d = new Date()): string {
  return `${ymd(d)}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** Intervalo da semana (segunda a domingo) que contém `ref`. */
export function weekRange(ref = new Date()): { start: string; end: string } {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const offset = (d.getDay() + 6) % 7;
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
    this.migrate();
  }

  get raw(): Database.Database { return this.db; }
  close(): void { this.db.close(); }

  /** Adiciona colunas novas em bancos criados em versões anteriores. */
  private migrate(): void {
    const cols = new Set(
      (this.db.prepare(`PRAGMA table_info(content_items)`).all() as { name: string }[]).map((c) => c.name),
    );
    const add: [string, string][] = [
      ['account_id', 'INTEGER'], ['timezone', 'TEXT'],
    ];
    for (const [name, decl] of add) {
      if (!cols.has(name)) this.db.exec(`ALTER TABLE content_items ADD COLUMN ${name} ${decl}`);
    }
  }

  // ── conteúdo ────────────────────────────────────────────────────────────────

  create(input: ContentInput): number {
    const t = now();
    const r = this.db.prepare(
      `INSERT INTO content_items
        (tema, tipo, plataforma, idioma, produto, account_id, publish_date, publish_time, timezone, status, marca, created_at, updated_at)
       VALUES (@tema,@tipo,@plataforma,@idioma,@produto,@account_id,@publish_date,@publish_time,@timezone,@status,@marca,@t,@t)`,
    ).run({
      tema: input.tema,
      tipo: input.tipo ?? 'explicativo',
      plataforma: input.plataforma,
      idioma: input.idioma ?? 'pt',
      produto: input.produto ?? null,
      account_id: input.account_id ?? null,
      publish_date: input.publish_date ?? null,
      publish_time: input.publish_time ?? null,
      timezone: input.timezone ?? null,
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
    return this.db.prepare(`UPDATE content_items SET ${sets}, updated_at = @updated_at WHERE id = @id`).run(params).changes > 0;
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
    if (filters.produto) { where.push(`produto LIKE @produto`); params.produto = `%${filters.produto}%`; }
    const sql = `SELECT * FROM content_items${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC, id DESC`;
    return this.db.prepare(sql).all(params) as ContentItem[];
  }

  calendar(): ContentItem[] {
    return this.db.prepare(
      `SELECT * FROM content_items WHERE publish_date IS NOT NULL
       ORDER BY publish_date ASC, publish_time ASC, id ASC`,
    ).all() as ContentItem[];
  }

  /** Itens com data dentro de [start, end] (YYYY-MM-DD). */
  calendarRange(start: string, end: string): ContentItem[] {
    return this.db.prepare(
      `SELECT * FROM content_items WHERE publish_date BETWEEN ? AND ?
       ORDER BY publish_date ASC, publish_time ASC, id ASC`,
    ).all(start, end) as ContentItem[];
  }

  /** Agendados cujo horário de publicação já chegou (data/hora <= nowIso). */
  dueScheduled(nowIso = nowLocalIso()): ContentItem[] {
    return this.db.prepare(
      `SELECT * FROM content_items
       WHERE status = 'agendado' AND publish_date IS NOT NULL
         AND (publish_date || 'T' || COALESCE(NULLIF(publish_time,''),'00:00')) <= ?
       ORDER BY publish_date ASC, publish_time ASC, id ASC`,
    ).all(nowIso) as ContentItem[];
  }

  /** Cria N cópias de um item variando só tema/idioma/data (lote). Retorna os ids. */
  duplicate(baseId: number, variations: BatchVariation[]): number[] {
    const base = this.get(baseId);
    if (!base) return [];
    const ids: number[] = [];
    for (const v of variations) {
      ids.push(this.create({
        tema: v.tema ?? base.tema,
        tipo: base.tipo,
        plataforma: base.plataforma,
        idioma: v.idioma ?? base.idioma,
        produto: base.produto,
        account_id: base.account_id,
        publish_date: v.publish_date ?? base.publish_date,
        publish_time: base.publish_time,
        timezone: base.timezone,
        marca: base.marca,
        status: 'ideia',
      }));
    }
    return ids;
  }

  dashboard(ref = new Date()): DashboardCounts {
    const c = (sql: string, ...p: unknown[]): number =>
      (this.db.prepare(`SELECT COUNT(*) AS n FROM content_items WHERE ${sql}`).get(...p) as { n: number }).n;
    const pendQ = PENDING_STATUSES.map(() => '?').join(',');
    const { start, end } = weekRange(ref);
    return {
      pending: c(`status IN (${pendQ})`, ...PENDING_STATUSES),
      ready: c(`status = ?`, 'pronto'),
      scheduled: c(`status = ?`, 'agendado'),
      published: c(`status = ?`, 'publicado'),
      thisWeek: c(`publish_date IS NOT NULL AND publish_date BETWEEN ? AND ?`, start, end),
    };
  }

  metrics(): Metrics {
    const one = (sql: string, ...p: unknown[]): number =>
      (this.db.prepare(sql).get(...p) as { n: number }).n;
    const byPlatform = Object.fromEntries(PLATFORMS.map((p) => [p, 0])) as Metrics['byPlatform'];
    for (const row of this.db.prepare(
      `SELECT plataforma, COUNT(*) AS n FROM content_items GROUP BY plataforma`,
    ).all() as { plataforma: string; n: number }[]) {
      if (row.plataforma in byPlatform) byPlatform[row.plataforma as keyof Metrics['byPlatform']] = row.n;
    }
    return {
      created: one(`SELECT COUNT(*) AS n FROM content_items`),
      published: one(`SELECT COUNT(*) AS n FROM content_items WHERE status = 'publicado'`),
      scheduled: one(`SELECT COUNT(*) AS n FROM content_items WHERE status = 'agendado'`),
      byPlatform,
    };
  }

  // ── contas ──────────────────────────────────────────────────────────────────

  accountCreate(input: AccountInput): number {
    const r = this.db.prepare(
      `INSERT INTO accounts (nome, plataforma, idioma, ativo, created_at) VALUES (?,?,?,?,?)`,
    ).run(input.nome, input.plataforma, input.idioma, input.ativo === false ? 0 : 1, now());
    return Number(r.lastInsertRowid);
  }

  accountGet(id: number): Account | null {
    return (this.db.prepare(`SELECT * FROM accounts WHERE id = ?`).get(id) as Account | undefined) ?? null;
  }

  accountList(onlyActive = false): Account[] {
    const sql = `SELECT * FROM accounts${onlyActive ? ' WHERE ativo = 1' : ''} ORDER BY plataforma, idioma, nome`;
    return this.db.prepare(sql).all() as Account[];
  }

  accountUpdate(id: number, patch: Partial<Pick<Account, 'nome' | 'plataforma' | 'idioma' | 'ativo'>>): boolean {
    const keys = (['nome', 'plataforma', 'idioma', 'ativo'] as const).filter((k) => k in patch);
    if (!keys.length) return false;
    const sets = keys.map((k) => `${k} = @${k}`).join(', ');
    const params: Record<string, unknown> = { id };
    for (const k of keys) params[k] = patch[k];
    return this.db.prepare(`UPDATE accounts SET ${sets} WHERE id = @id`).run(params).changes > 0;
  }

  accountRemove(id: number): boolean {
    return this.db.prepare(`DELETE FROM accounts WHERE id = ?`).run(id).changes > 0;
  }

  /** Cria as contas-exemplo se a tabela estiver vazia. Retorna quantas criou. */
  seedAccounts(defaults: AccountInput[]): number {
    const n = (this.db.prepare(`SELECT COUNT(*) AS n FROM accounts`).get() as { n: number }).n;
    if (n > 0) return 0;
    let created = 0;
    for (const a of defaults) { this.accountCreate(a); created++; }
    return created;
  }

  // ── logs ─────────────────────────────────────────────────────────────────────

  logEvent(contentId: number | null, event: LogEvent, detail: string | null = null): number {
    const r = this.db.prepare(
      `INSERT INTO content_logs (content_id, event, detail, created_at) VALUES (?,?,?,?)`,
    ).run(contentId, event, detail ? detail.slice(0, 500) : null, now());
    return Number(r.lastInsertRowid);
  }

  logs(contentId?: number, limit = 100): LogEntry[] {
    if (contentId != null) {
      return this.db.prepare(
        `SELECT * FROM content_logs WHERE content_id = ? ORDER BY id DESC LIMIT ?`,
      ).all(contentId, limit) as LogEntry[];
    }
    return this.db.prepare(`SELECT * FROM content_logs ORDER BY id DESC LIMIT ?`).all(limit) as LogEntry[];
  }
}

/** Contas-exemplo padrão (TikTok/Instagram/YouTube em PT e ES). */
export const DEFAULT_ACCOUNTS: AccountInput[] = [
  { nome: 'TikTok PT', plataforma: 'tiktok', idioma: 'pt' },
  { nome: 'TikTok ES', plataforma: 'tiktok', idioma: 'es' },
  { nome: 'Instagram PT', plataforma: 'instagram', idioma: 'pt' },
  { nome: 'Instagram ES', plataforma: 'instagram', idioma: 'es' },
  { nome: 'YouTube Shorts PT', plataforma: 'youtube', idioma: 'pt' },
  { nome: 'YouTube Shorts ES', plataforma: 'youtube', idioma: 'es' },
];
