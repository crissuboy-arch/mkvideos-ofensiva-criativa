// Registro de provedores de mídia. Ativos: hyperframes (composição),
// avatar (LongCat-Video-Avatar 1.5, lip-sync local), longcat (clipe IA local,
// ponte de clip pendente de PoC) + os planejados.

import type { MediaProvider, ProviderId } from './types.js';
import { HYPERFRAMES_PROVIDER } from './hyperframes.js';
import { LONGCAT_AVATAR_PROVIDER, LONGCAT_CLIP_PROVIDER } from './longcat.js';
import { PLANNED_PROVIDERS } from './planned.js';

const ALL: MediaProvider[] = [
  HYPERFRAMES_PROVIDER,
  LONGCAT_AVATAR_PROVIDER,
  LONGCAT_CLIP_PROVIDER,
  ...PLANNED_PROVIDERS,
];
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
