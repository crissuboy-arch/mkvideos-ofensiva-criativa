// Provedores de mídia por cena.
//
// HOJE: o motor content2video produz cada cena como composição HyperFrames
// (motion graphics/tipografia/diagramas/mídia local). O provider `hyperframes`
// abaixo representa esse caminho, que é o único ativo.
//
// FUTURO (arquitetura pronta, NÃO implementado): cada cena poderá escolher entre
// clipe gerado por IA (Kling, Veo, Runway, Sora), apresentador/avatar (HeyGen),
// geração de imagem animada, ou mídia enviada pelo usuário. Cada solicitação
// deverá registrar provider, modelo, duração, status, custo estimado e créditos
// consumidos, com fallback para HyperFrames/mídia local quando o provedor falhar.

import { EngineNotImplementedError } from '../types.js';

export type ProviderId =
  | 'hyperframes'   // ativo — composição programável (motion graphics)
  | 'local-media'   // planejado — mídia enviada/selecionada pelo usuário
  | 'image-gen'     // planejado — geração + animação de imagem
  | 'avatar'        // planejado — apresentador/avatar (ex.: HeyGen)
  | 'kling'         // planejado — clipe IA
  | 'veo'           // planejado — clipe IA
  | 'runway'        // planejado — clipe IA
  | 'sora';         // planejado — clipe IA

export type ProviderKind = 'composition' | 'clip' | 'avatar' | 'image' | 'media';

export interface SceneMediaRequest {
  /** Descrição/prompt da cena. */
  brief: string;
  aspectRatio: '9:16' | '16:9';
  /** Duração alvo do clipe, em segundos. */
  durationSeconds: number;
  /** Opções específicas do provedor (modelo, seed, referência, …). */
  options?: Record<string, unknown>;
}

export interface SceneMediaResult {
  provider: ProviderId;
  model: string | null;
  kind: ProviderKind;
  /** Caminho local do arquivo gerado (mp4/png/…). */
  filePath: string;
  durationSeconds: number;
  /** Telemetria de custo (quando o provedor informar). */
  cost?: { estimatedCredits?: number; consumedCredits?: number; currency?: string };
  /** Identificador externo da solicitação (para auditoria/retomada). */
  externalId?: string | null;
}

export interface ProviderHealth {
  id: ProviderId;
  available: boolean;
  message: string;
}

export interface MediaProvider {
  readonly id: ProviderId;
  readonly kind: ProviderKind;
  readonly label: string;
  /** `false` enquanto não implementado. */
  readonly implemented: boolean;
  health(): Promise<ProviderHealth>;
  generate(req: SceneMediaRequest): Promise<SceneMediaResult>;
}

/** Base para os provedores ainda não implementados: nega com erro claro. */
export abstract class PlannedProvider implements MediaProvider {
  abstract readonly id: ProviderId;
  abstract readonly kind: ProviderKind;
  abstract readonly label: string;
  readonly implemented = false;

  async health(): Promise<ProviderHealth> {
    return { id: this.id, available: false, message: `${this.label}: planejado, não implementado.` };
  }

  async generate(_req: SceneMediaRequest): Promise<SceneMediaResult> {
    throw new EngineNotImplementedError(`Provedor "${this.id}" (${this.label})`);
  }
}
