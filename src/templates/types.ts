// Contrato de um template de tipo de vídeo: dado o tema, devolve o arco de cenas
// de conteúdo (sem hook/CTA — o gerador adiciona essas). Tudo offline.

import type { SceneSpec, VideoType } from '../specs/types.js';
import type { ThemeInfo } from '../specs/theme.js';
import type { Brand } from '../brands/types.js';

export interface BuildCtx {
  theme: ThemeInfo;
  tema: string;       // eyebrow curto (assunto)
  brand: Brand;
  vertical: boolean;
}

export interface HookSpec {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  narration: string;
  caption: string;
}

export interface BuildResult {
  promise: string;        // promessa do vídeo (usada no roteiro)
  hook: HookSpec;         // cena de abertura
  content: SceneSpec[];   // cenas de conteúdo (sem hook/cta)
}

export interface VideoTemplate {
  tipo: VideoType;
  label: string;
  /** Nº de cenas de conteúdo "natural" quando o usuário não fixa --cenas. */
  defaultScenes: number;
  build(ctx: BuildCtx): BuildResult;
}
