// Tipos da funcionalidade URL → Vídeo (camada de produto do MKVideos).

import type {
  AspectRatio, ConversationStyle, SpeechPace, EngineId,
} from '../engines/types.js';

export interface Url2VideoDefaults {
  engine: EngineId;
  aspectRatio: AspectRatio;
  conversationStyle: ConversationStyle;
  speechPace: SpeechPace;
  includeCta: boolean;
  visualPresetId?: string;
}

/** Payload cru vindo da UI/CLI (tudo string/opcional). */
export interface Url2VideoRequestRaw {
  url?: unknown;
  objetivo?: unknown;
  objective?: unknown;
  formato?: unknown;      // '9:16' | '16:9' | 'vertical' | 'horizontal'
  aspectRatio?: unknown;
  estilo?: unknown;       // popular | natural | technical  (aceita PT: simples/tecnico)
  conversationStyle?: unknown;
  ritmo?: unknown;        // calm | natural | fast  (aceita PT: calma/rapida)
  speechPace?: unknown;
  preset?: unknown;
  visualPresetId?: unknown;
  cta?: unknown;
  includeCta?: unknown;
}

/** Requisição validada e normalizada. */
export interface Url2VideoRequest {
  url: string;
  objective?: string;
  aspectRatio: AspectRatio;
  conversationStyle: ConversationStyle;
  speechPace: SpeechPace;
  visualPresetId?: string;
  includeCta: boolean;
}

export class Url2VideoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Url2VideoValidationError';
  }
}
