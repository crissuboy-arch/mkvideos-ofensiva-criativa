// Provedor ATIVO: composição programável via HyperFrames.
//
// Hoje o HyperFrames é acionado *dentro* do motor content2video (que monta a
// timeline, anima, valida e renderiza). Este objeto existe para a UI listar o
// provider ativo e para futuras integrações "por cena" usarem o mesmo contrato.
// A geração direta cena-a-cena por aqui ainda não é usada pelo fluxo URL → Vídeo.

import { EngineNotImplementedError } from '../types.js';
import type { MediaProvider, ProviderHealth, ProviderId, ProviderKind, SceneMediaRequest, SceneMediaResult } from './types.js';

export class HyperframesProvider implements MediaProvider {
  readonly id: ProviderId = 'hyperframes';
  readonly kind: ProviderKind = 'composition';
  readonly label = 'HyperFrames (motion graphics)';
  readonly implemented = true;

  async health(): Promise<ProviderHealth> {
    return { id: this.id, available: true, message: 'Acionado pelo motor content2video (via npx hyperframes).' };
  }

  async generate(_req: SceneMediaRequest): Promise<SceneMediaResult> {
    throw new EngineNotImplementedError(
      'Geração cena-a-cena direta pelo provider hyperframes (o fluxo atual compõe o vídeo inteiro no motor content2video)',
    );
  }
}

export const HYPERFRAMES_PROVIDER = new HyperframesProvider();
