import { describe, it, expect, beforeEach } from 'vitest';
import { SqliteContentStore } from './store.js';
import { runDuePublications } from './scheduler.js';

describe('runDuePublications', () => {
  let store: SqliteContentStore;
  beforeEach(() => { store = new SqliteContentStore(':memory:'); });

  it('publica agendados vencidos e registra log; ignora futuros', async () => {
    const acc = store.accountCreate({ nome: 'TikTok PT', plataforma: 'tiktok', idioma: 'pt' });
    const due = store.create({ tema: 'venceu', plataforma: 'tiktok', status: 'agendado', account_id: acc, publish_date: '2020-01-01', publish_time: '08:00' });
    const future = store.create({ tema: 'futuro', plataforma: 'tiktok', status: 'agendado', publish_date: '2999-01-01', publish_time: '08:00' });

    const published: number[] = [];
    const n = await runDuePublications(store, new Date(), { onPublish: (it) => published.push(it.id) });

    expect(n).toBe(1);
    expect(store.get(due)!.status).toBe('publicado');
    expect(store.get(future)!.status).toBe('agendado');
    expect(published).toEqual([due]);

    const logs = store.logs(due);
    expect(logs.some((l) => l.event === 'publicacao')).toBe(true);
  });

  it('nada vencido → 0 publicações', async () => {
    store.create({ tema: 'x', plataforma: 'youtube', status: 'pronto', publish_date: '2020-01-01' }); // pronto, não agendado
    expect(await runDuePublications(store, new Date())).toBe(0);
  });
});
