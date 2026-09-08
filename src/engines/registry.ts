// Registro de motores de vídeo. Novos motores se registram aqui; a UI/CLI
// escolhem por id (env MKIVIDEOS_ENGINE, default 'content2video').

import type { EngineId, VideoEngine } from './types.js';
import { EngineError } from './types.js';

const REGISTRY = new Map<EngineId, () => VideoEngine>();
const CACHE = new Map<EngineId, VideoEngine>();

/** Registra uma factory preguiçosa para um motor. */
export function registerEngine(id: EngineId, factory: () => VideoEngine): void {
  REGISTRY.set(id, factory);
}

/** Ids registrados. */
export function engineIds(): EngineId[] {
  return [...REGISTRY.keys()];
}

/** Instância (memoizada) de um motor. */
export function getEngine(id: EngineId): VideoEngine {
  const cached = CACHE.get(id);
  if (cached) return cached;
  const factory = REGISTRY.get(id);
  if (!factory) {
    throw new EngineError(
      `Motor "${id}" não registrado. Registrados: ${engineIds().join(', ') || '(nenhum)'}.`,
      'ENGINE_UNKNOWN',
      404,
    );
  }
  const engine = factory();
  CACHE.set(id, engine);
  return engine;
}

/** Só para testes: limpa o registro/cache. */
export function _resetEngines(): void {
  REGISTRY.clear();
  CACHE.clear();
}
