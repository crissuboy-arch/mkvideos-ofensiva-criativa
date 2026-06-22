// Fila automática de publicação: a cada minuto, publica os agendados vencidos.
// Usa os publishers (mock) e registra tudo em log. Sem APIs reais ainda.

import { getPublisher } from '../publishers/index.js';
import { nowLocalIso } from './store.js';
import type { SqliteContentStore } from './store.js';
import type { ContentItem } from './types.js';
import type { PublishResult } from '../publishers/index.js';

export interface SchedulerHandle {
  stop(): void;
}

export interface SchedulerOptions {
  intervalMs?: number;          // default 60000 (1 min)
  now?: () => Date;             // injetável para teste
  onPublish?: (item: ContentItem, result: PublishResult) => void;
}

/**
 * Processa uma rodada: pega os agendados vencidos, publica (mock) e atualiza o
 * status + log. Função pura o suficiente para teste (sem timer). Retorna quantos
 * foram publicados.
 */
export async function runDuePublications(
  store: SqliteContentStore,
  now: Date = new Date(),
  hooks: Pick<SchedulerOptions, 'onPublish'> = {},
): Promise<number> {
  const due = store.dueScheduled(nowLocalIso(now));
  let published = 0;
  for (const item of due) {
    const account = item.account_id != null ? store.accountGet(item.account_id) : null;
    try {
      const result = await getPublisher(item.plataforma).publish({ item, account });
      if (result.ok) {
        store.update(item.id, { status: 'publicado', error: null });
        store.logEvent(item.id, 'publicacao', result.url ?? result.externalId ?? 'ok');
        published++;
      } else {
        store.logEvent(item.id, 'erro', `publicação falhou: ${result.error ?? 'desconhecido'}`);
      }
      hooks.onPublish?.(item, result);
    } catch (e) {
      store.logEvent(item.id, 'erro', `publicação exceção: ${(e as Error).message}`);
    }
  }
  return published;
}

/** Inicia o worker periódico (não bloqueia o event loop — unref). */
export function startScheduler(store: SqliteContentStore, opts: SchedulerOptions = {}): SchedulerHandle {
  const intervalMs = opts.intervalMs ?? 60_000;
  const clock = opts.now ?? (() => new Date());
  const tick = (): void => { void runDuePublications(store, clock(), { onPublish: opts.onPublish }); };
  const handle = setInterval(tick, intervalMs);
  if (typeof handle.unref === 'function') handle.unref();
  return { stop: () => clearInterval(handle) };
}
