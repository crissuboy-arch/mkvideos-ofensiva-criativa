import { describe, it, expect, beforeEach } from 'vitest';
import { SqliteContentStore, weekRange, ymd, nowLocalIso, DEFAULT_ACCOUNTS } from './store.js';

describe('SqliteContentStore — conteúdo', () => {
  let store: SqliteContentStore;
  beforeEach(() => { store = new SqliteContentStore(':memory:'); });

  it('cria e lê um item com defaults', () => {
    const id = store.create({ tema: 'Vender mais', plataforma: 'tiktok' });
    const it = store.get(id)!;
    expect(it.tema).toBe('Vender mais');
    expect(it.tipo).toBe('explicativo');
    expect(it.status).toBe('ideia');
    expect(it.account_id).toBeNull();
    expect(it.timezone).toBeNull();
  });

  it('atualiza campos novos (account_id, timezone) e status', () => {
    const id = store.create({ tema: 'X', plataforma: 'youtube' });
    expect(store.update(id, { status: 'agendado', account_id: 5, timezone: 'America/Sao_Paulo' })).toBe(true);
    const it = store.get(id)!;
    expect(it.status).toBe('agendado');
    expect(it.account_id).toBe(5);
    expect(it.timezone).toBe('America/Sao_Paulo');
  });

  it('filtra por produto (substring), plataforma e status', () => {
    store.create({ tema: 'A', plataforma: 'tiktok', produto: 'Curso SEO' });
    store.create({ tema: 'B', plataforma: 'instagram', produto: 'Ebook' });
    expect(store.list({ produto: 'seo' })).toHaveLength(1); // LIKE case-insensitive (ASCII)
    expect(store.list({ produto: 'SEO' })).toHaveLength(1);
    expect(store.list({ plataforma: 'tiktok' })).toHaveLength(1);
  });

  it('dashboard inclui scheduled', () => {
    store.create({ tema: 'p', plataforma: 'tiktok', status: 'ideia' });
    store.create({ tema: 'r', plataforma: 'tiktok', status: 'pronto' });
    store.create({ tema: 'a', plataforma: 'tiktok', status: 'agendado' });
    store.create({ tema: 'pub', plataforma: 'tiktok', status: 'publicado' });
    const d = store.dashboard();
    expect(d).toMatchObject({ pending: 1, ready: 1, scheduled: 1, published: 1 });
  });

  it('métricas: criados/publicados/agendados + por plataforma', () => {
    store.create({ tema: 'a', plataforma: 'tiktok', status: 'publicado' });
    store.create({ tema: 'b', plataforma: 'tiktok', status: 'agendado' });
    store.create({ tema: 'c', plataforma: 'youtube' });
    const m = store.metrics();
    expect(m.created).toBe(3);
    expect(m.published).toBe(1);
    expect(m.scheduled).toBe(1);
    expect(m.byPlatform.tiktok).toBe(2);
    expect(m.byPlatform.youtube).toBe(1);
    expect(m.byPlatform.facebook).toBe(0);
  });
});

describe('SqliteContentStore — agendamento (dueScheduled)', () => {
  let store: SqliteContentStore;
  beforeEach(() => { store = new SqliteContentStore(':memory:'); });

  it('retorna só agendados com data/hora já vencida', () => {
    const past = store.create({ tema: 'venceu', plataforma: 'tiktok', status: 'agendado', publish_date: '2020-01-01', publish_time: '08:00' });
    store.create({ tema: 'futuro', plataforma: 'tiktok', status: 'agendado', publish_date: '2999-01-01', publish_time: '08:00' });
    store.create({ tema: 'pronto-vencido', plataforma: 'tiktok', status: 'pronto', publish_date: '2020-01-01' });
    const due = store.dueScheduled(nowLocalIso());
    expect(due.map((d) => d.id)).toEqual([past]);
  });
});

describe('SqliteContentStore — lotes (duplicate)', () => {
  let store: SqliteContentStore;
  beforeEach(() => { store = new SqliteContentStore(':memory:'); });

  it('duplica variando tema/idioma/data, resetando status e vídeo', () => {
    const base = store.create({ tema: 'Base', plataforma: 'tiktok', idioma: 'pt', produto: 'X', status: 'pronto' });
    store.update(base, { video_path: '/v.mp4' });
    const ids = store.duplicate(base, [
      { tema: 'PT v1', idioma: 'pt', publish_date: '2026-07-01' },
      { tema: 'ES v1', idioma: 'es', publish_date: '2026-07-02' },
    ]);
    expect(ids).toHaveLength(2);
    const a = store.get(ids[0])!;
    expect(a.tema).toBe('PT v1');
    expect(a.produto).toBe('X');         // herdado
    expect(a.status).toBe('ideia');      // resetado
    expect(a.video_path).toBeNull();     // resetado
    expect(store.get(ids[1])!.idioma).toBe('es');
  });

  it('base inexistente → []', () => {
    expect(store.duplicate(999, [{ tema: 'x' }])).toEqual([]);
  });
});

describe('SqliteContentStore — contas', () => {
  let store: SqliteContentStore;
  beforeEach(() => { store = new SqliteContentStore(':memory:'); });

  it('CRUD + ativo + seed idempotente', () => {
    const id = store.accountCreate({ nome: 'TikTok PT', plataforma: 'tiktok', idioma: 'pt' });
    expect(store.accountGet(id)!.ativo).toBe(1);
    store.accountUpdate(id, { ativo: 0 });
    expect(store.accountList(true)).toHaveLength(0); // só ativas
    expect(store.accountList()).toHaveLength(1);
    expect(store.accountRemove(id)).toBe(true);

    expect(store.seedAccounts(DEFAULT_ACCOUNTS)).toBe(DEFAULT_ACCOUNTS.length);
    expect(store.seedAccounts(DEFAULT_ACCOUNTS)).toBe(0); // idempotente
  });
});

describe('SqliteContentStore — logs', () => {
  let store: SqliteContentStore;
  beforeEach(() => { store = new SqliteContentStore(':memory:'); });

  it('registra eventos e lista por conteúdo', () => {
    const id = store.create({ tema: 'X', plataforma: 'tiktok' });
    store.logEvent(id, 'geracao', 'iniciada');
    store.logEvent(id, 'publicacao', 'ok');
    store.logEvent(99, 'erro', 'outro');
    expect(store.logs(id)).toHaveLength(2);
    expect(store.logs()).toHaveLength(3);
    expect(store.logs(id)[0].event).toBe('publicacao'); // mais recente primeiro
  });
});

describe('helpers de data', () => {
  it('weekRange = segunda a domingo', () => {
    const { start, end } = weekRange(new Date(2026, 5, 24));
    expect(start).toBe('2026-06-22');
    expect(end).toBe('2026-06-28');
  });
  it('nowLocalIso formata YYYY-MM-DDTHH:MM', () => {
    expect(nowLocalIso(new Date(2026, 5, 24, 9, 5))).toBe('2026-06-24T09:05');
  });
  it('ymd zero-pad', () => {
    expect(ymd(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
});
