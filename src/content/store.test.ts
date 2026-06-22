import { describe, it, expect, beforeEach } from 'vitest';
import { SqliteContentStore, weekRange, ymd } from './store.js';

describe('SqliteContentStore', () => {
  let store: SqliteContentStore;
  beforeEach(() => { store = new SqliteContentStore(':memory:'); });

  it('cria e lê um item com defaults', () => {
    const id = store.create({ tema: 'Vender mais', plataforma: 'tiktok' });
    const it = store.get(id)!;
    expect(it.tema).toBe('Vender mais');
    expect(it.tipo).toBe('explicativo');
    expect(it.idioma).toBe('pt');
    expect(it.status).toBe('ideia');
    expect(it.plataforma).toBe('tiktok');
  });

  it('atualiza campos e status', () => {
    const id = store.create({ tema: 'X', plataforma: 'youtube' });
    expect(store.update(id, { status: 'pronto', video_path: '/v.mp4' })).toBe(true);
    const it = store.get(id)!;
    expect(it.status).toBe('pronto');
    expect(it.video_path).toBe('/v.mp4');
  });

  it('update vazio ou item inexistente retorna false', () => {
    const id = store.create({ tema: 'X', plataforma: 'youtube' });
    expect(store.update(id, {})).toBe(false);
    expect(store.update(9999, { status: 'pronto' })).toBe(false);
  });

  it('filtra por plataforma, idioma e status', () => {
    store.create({ tema: 'A', plataforma: 'tiktok', idioma: 'pt' });
    store.create({ tema: 'B', plataforma: 'instagram', idioma: 'es' });
    store.create({ tema: 'C', plataforma: 'tiktok', idioma: 'en', status: 'pronto' });
    expect(store.list({ plataforma: 'tiktok' })).toHaveLength(2);
    expect(store.list({ idioma: 'es' })).toHaveLength(1);
    expect(store.list({ status: 'pronto' })).toHaveLength(1);
    expect(store.list()).toHaveLength(3);
  });

  it('remove um item', () => {
    const id = store.create({ tema: 'X', plataforma: 'facebook' });
    expect(store.remove(id)).toBe(true);
    expect(store.get(id)).toBeNull();
  });

  it('dashboard conta pendentes, prontos, publicados e da semana', () => {
    const today = ymd(new Date());
    store.create({ tema: 'p1', plataforma: 'tiktok', status: 'ideia' });
    store.create({ tema: 'p2', plataforma: 'tiktok', status: 'renderizando' });
    store.create({ tema: 'r1', plataforma: 'tiktok', status: 'pronto' });
    store.create({ tema: 'pub', plataforma: 'tiktok', status: 'publicado' });
    store.create({ tema: 'sem', plataforma: 'tiktok', status: 'ideia', publish_date: today });
    const d = store.dashboard();
    expect(d.pending).toBe(3);   // ideia + renderizando + (ideia com data)
    expect(d.ready).toBe(1);
    expect(d.published).toBe(1);
    expect(d.thisWeek).toBe(1);
  });

  it('calendar traz só itens com data, ordenados', () => {
    store.create({ tema: 'sem data', plataforma: 'tiktok' });
    store.create({ tema: 'b', plataforma: 'tiktok', publish_date: '2026-06-25', publish_time: '10:00' });
    store.create({ tema: 'a', plataforma: 'tiktok', publish_date: '2026-06-25', publish_time: '08:00' });
    const cal = store.calendar();
    expect(cal).toHaveLength(2);
    expect(cal[0].tema).toBe('a'); // 08:00 antes de 10:00
  });
});

describe('weekRange', () => {
  it('segunda a domingo contendo a data', () => {
    const { start, end } = weekRange(new Date(2026, 5, 24)); // qua, 24/06/2026
    expect(start).toBe('2026-06-22'); // segunda
    expect(end).toBe('2026-06-28');   // domingo
  });
});
