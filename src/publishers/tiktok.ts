// Publisher TikTok — MOCK. Estrutura pronta para a Content Posting API futura.

import type { Publisher } from './types.js';

export const tiktok: Publisher = {
  platform: 'tiktok',
  async publish({ item }) {
    // TODO(real): autenticar conta, upload do item.video_path, agendar/publicar.
    return {
      ok: true,
      externalId: `tk_${item.id}_${Date.now()}`,
      url: `https://www.tiktok.com/@mock/video/${item.id}`,
    };
  },
};
