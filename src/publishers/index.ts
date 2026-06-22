// Registro de publishers por plataforma.

import { tiktok } from './tiktok.js';
import { instagram } from './instagram.js';
import { youtube } from './youtube.js';
import { facebook } from './facebook.js';
import type { Publisher } from './types.js';
import type { Platform } from '../content/types.js';

export type { Publisher, PublishContext, PublishResult } from './types.js';

export const PUBLISHERS: Record<Platform, Publisher> = { tiktok, instagram, youtube, facebook };

export function getPublisher(p: Platform): Publisher {
  return PUBLISHERS[p];
}
