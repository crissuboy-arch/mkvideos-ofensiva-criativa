// Registro de provedores de mídia. Um ativo (hyperframes) + os planejados.

import type { MediaProvider, ProviderId } from './types.js';
import { HYPERFRAMES_PROVIDER } from './hyperframes.js';
import { PLANNED_PROVIDERS } from './planned.js';

const ALL: MediaProvider[] = [HYPERFRAMES_PROVIDER, ...PLANNED_PROVIDERS];
const BY_ID = new Map<ProviderId, MediaProvider>(ALL.map((p) => [p.id, p]));

export function listProviders(): MediaProvider[] {
  return [...ALL];
}

export function getProvider(id: ProviderId): MediaProvider {
  const p = BY_ID.get(id);
  if (!p) throw new Error(`Provedor "${id}" não existe. Conhecidos: ${[...BY_ID.keys()].join(', ')}.`);
  return p;
}

/** Ids implementados (hoje: só 'hyperframes'). */
export function implementedProviderIds(): ProviderId[] {
  return ALL.filter((p) => p.implemented).map((p) => p.id);
}

/** Ids planejados (arquitetura pronta, sem implementação). */
export function plannedProviderIds(): ProviderId[] {
  return ALL.filter((p) => !p.implemented).map((p) => p.id);
}
