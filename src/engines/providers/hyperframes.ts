// Provedor ATIVO: composição programável via HyperFrames.
//
// Pacote npm `hyperframes` (heygen-com, Apache-2.0): "Write HTML. Render video."
// Hoje é acionado *dentro* do motor content2video (que monta a timeline, anima,
// valida e renderiza) e pelos wrappers em src/render/hyperframes.ts.
// Este objeto existe para a UI listar o provider ativo e para futuras
// integrações "por cena" usarem o mesmo contrato. A geração direta cena-a-cena
// por aqui ainda não é usada pelo fluxo URL → Vídeo.

import { EngineNotImplementedError } from '../types.js';
import { HYPERFRAMES_PKG, hfVersion } from '../../render/hyperframes.js';
import type { MediaProvider, ProviderHealth, ProviderId, ProviderKind, SceneMediaRequest, SceneMediaResult } from './types.js';

export class HyperframesProvider implements MediaProvider {
  readonly id: ProviderId = 'hyperframes';
  readonly kind: ProviderKind = 'composition';
  readonly label = 'HyperFrames (motion graphics)';
  readonly implemented = true;

  async health(): Promise<ProviderHealth> {
    try {
      const v = await hfVersion(process.cwd());
      return { id: this.id, available: true, message: `HyperFrames OK (${HYPERFRAMES_PKG}; ${v.split('\n')[0]}).` };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { id: this.id, available: false, message: `HyperFrames indisponível: ${msg}` };
    }
  }

  async generate(_req: SceneMediaRequest): Promise<SceneMediaResult> {
    throw new EngineNotImplementedError(
      'Geração cena-a-cena direta pelo provider hyperframes (o fluxo atual compõe o vídeo inteiro no motor content2video)',
    );
  }
}

export const HYPERFRAMES_PROVIDER = new HyperframesProvider();
