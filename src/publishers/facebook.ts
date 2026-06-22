// Publisher Facebook — MOCK. Estrutura pronta para a Graph API (Reels) futura.

import type { Publisher } from './types.js';

export const facebook: Publisher = {
  platform: 'facebook',
  async publish({ item }) {
    // TODO(real): video_reels endpoint (start → upload → finish) via Graph API.
    return {
      ok: true,
      externalId: `fb_${item.id}_${Date.now()}`,
      url: `https://www.facebook.com/reel/mock${item.id}`,
    };
  },
};
