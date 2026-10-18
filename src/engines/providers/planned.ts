// Provedores previstos na arquitetura, ainda NÃO implementados.
// Cada um nega com EngineNotImplementedError e uma mensagem específica.
// Não adicione SDKs/chaves aqui até que a integração seja de fato priorizada.

import { PlannedProvider, type ProviderId, type ProviderKind } from './types.js';

class Kling extends PlannedProvider {
  readonly id: ProviderId = 'kling';
  readonly kind: ProviderKind = 'clip';
  readonly label = 'Kling (clipe IA)';
}
class Veo extends PlannedProvider {
  readonly id: ProviderId = 'veo';
  readonly kind: ProviderKind = 'clip';
  readonly label = 'Google Veo (clipe IA)';
}
class Runway extends PlannedProvider {
  readonly id: ProviderId = 'runway';
  readonly kind: ProviderKind = 'clip';
  readonly label = 'Runway (clipe IA)';
}
class Sora extends PlannedProvider {
  readonly id: ProviderId = 'sora';
  readonly kind: ProviderKind = 'clip';
  readonly label = 'Sora (clipe IA)';
}
// NOTA (2026-10-18): o slot `avatar` foi ocupado pelo LongCat-Video-Avatar 1.5
// (MIT, local, sem custo por crédito). A API do HeyGen segue como alternativa
// futura — se for priorizada, entra com id próprio (ex.: 'heygen'), sem colidir.

class ImageGen extends PlannedProvider {
  readonly id: ProviderId = 'image-gen';
  readonly kind: ProviderKind = 'image';
  readonly label = 'Geração + animação de imagem';
}
class LocalMedia extends PlannedProvider {
  readonly id: ProviderId = 'local-media';
  readonly kind: ProviderKind = 'media';
  readonly label = 'Mídia local enviada pelo usuário';
}

export const PLANNED_PROVIDERS = [
  new Kling(),
  new Veo(),
  new Runway(),
  new Sora(),
  new ImageGen(),
  new LocalMedia(),
] as const;
