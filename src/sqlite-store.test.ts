import { describe, it, expect, beforeEach } from 'vitest';

import { SqliteQueueStore } from './sqlite-store.js';

describe('SqliteQueueStore', () => {
  let store: SqliteQueueStore;
  beforeEach(() => { store = new SqliteQueueStore(':memory:'); });

  it('enqueue creates a queued job and returns its id', () => {
    const id = store.enqueue({ skill: 'explicativo', input: 'Bayes', opts: null, notify: 'sempre', sendVideo: false, chatId: '123' });
    expect(id).toBeGreaterThan(0);
    const job = store.getNext();
    expect(job?.id).toBe(id);
    expect(job?.status).toBe('queued');
    expect(job?.skill).toBe('explicativo');
  });

  it('send_video round-trips as 1', () => {
    store.enqueue({ skill: 'explicativo', input: 'X', opts: null, notify: 'sempre', sendVideo: true, chatId: '1' });
    expect(store.getNext()?.send_video).toBe(1);
  });

  it('getNext is FIFO by created_at then id', () => {
    const a = store.enqueue({ skill: 'explicativo', input: 'A', opts: null, notify: 'sempre', sendVideo: false, chatId: '1' });
    const b = store.enqueue({ skill: 'explicativo', input: 'B', opts: null, notify: 'sempre', sendVideo: false, chatId: '1' });
    expect(store.getNext()?.id).toBe(a);
    store.markRunning(a);
    store.markDone(a, '/tmp/a.mp4');
    expect(store.getNext()?.id).toBe(b);
  });

  it('getRunning returns the running job or null', () => {
    expect(store.getRunning()).toBeNull();
    const id = store.enqueue({ skill: 'demo', input: 'http://x', opts: null, notify: 'sempre', sendVideo: false, chatId: '1' });
    store.markRunning(id);
    expect(store.getRunning()?.id).toBe(id);
  });

  it('markDone sets status, result_path and finished_at', () => {
    const id = store.enqueue({ skill: 'explicativo', input: 'X', opts: null, notify: 'sempre', sendVideo: false, chatId: '1' });
    store.markRunning(id);
    store.markDone(id, '/out/x.mp4');
    const done = store.list().find((x) => x.id === id)!;
    expect(done.status).toBe('done');
    expect(done.result_path).toBe('/out/x.mp4');
    expect(done.finished_at).toBeGreaterThan(0);
  });

  it('markFailed records the error (truncated) and frees the queue', () => {
    const id = store.enqueue({ skill: 'explicativo', input: 'X', opts: null, notify: 'sempre', sendVideo: false, chatId: '1' });
    store.markRunning(id);
    store.markFailed(id, 'render quebrou');
    const failed = store.list().find((x) => x.id === id)!;
    expect(failed.status).toBe('failed');
    expect(failed.error).toBe('render quebrou');
    expect(store.getRunning()).toBeNull();
  });

  it('cancel only cancels queued jobs', () => {
    const id = store.enqueue({ skill: 'explicativo', input: 'X', opts: null, notify: 'sempre', sendVideo: false, chatId: '1' });
    expect(store.cancel(id)).toBe(true);
    expect(store.list().find((x) => x.id === id)!.status).toBe('canceled');
    const running = store.enqueue({ skill: 'explicativo', input: 'Y', opts: null, notify: 'sempre', sendVideo: false, chatId: '1' });
    store.markRunning(running);
    expect(store.cancel(running)).toBe(false);
  });

  it('failStaleRunning marks orphaned running jobs as failed', () => {
    const a = store.enqueue({ skill: 'explicativo', input: 'A', opts: null, notify: 'sempre', sendVideo: false, chatId: '1' });
    const b = store.enqueue({ skill: 'explicativo', input: 'B', opts: null, notify: 'sempre', sendVideo: false, chatId: '1' });
    store.markRunning(a);
    expect(store.failStaleRunning()).toBe(1);
    expect(store.list().find((x) => x.id === a)!.status).toBe('failed');
    expect(store.list().find((x) => x.id === a)!.error).toContain('reinício');
    expect(store.list().find((x) => x.id === b)!.status).toBe('queued');
  });
});
