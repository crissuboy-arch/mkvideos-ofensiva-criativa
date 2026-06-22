// Camada de publicação — contrato comum dos adapters por plataforma.
// Hoje todos são MOCK (sem API real); a arquitetura já está pronta para integração.

import type { ContentItem, Account, Platform } from '../content/types.js';

export interface PublishContext {
  item: ContentItem;
  account: Account | null;
}

export interface PublishResult {
  ok: boolean;
  externalId?: string;  // id do post na plataforma
  url?: string;         // URL pública do post
  error?: string;
}

export interface Publisher {
  platform: Platform;
  /** Publica o conteúdo. Implementação real conecta a API; aqui é mock. */
  publish(ctx: PublishContext): Promise<PublishResult>;
}
