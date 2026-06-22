// Publisher Instagram — MOCK. Estrutura pronta para a Graph API (Reels) futura.

import type { Publisher } from './types.js';

export const instagram: Publisher = {
  platform: 'instagram',
  async publish({ item }) {
    // TODO(real): criar container de mídia (Reels) e publicar via Graph API.
    return {
      ok: true,
      externalId: `ig_${item.id}_${Date.now()}`,
      url: `https://www.instagram.com/reel/mock${item.id}/`,
    };
  },
};
