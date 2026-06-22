// Publisher YouTube (Shorts) — MOCK. Estrutura pronta para a Data API v3 futura.

import type { Publisher } from './types.js';

export const youtube: Publisher = {
  platform: 'youtube',
  async publish({ item }) {
    // TODO(real): videos.insert (resumable upload) + status (público/agendado).
    return {
      ok: true,
      externalId: `yt_${item.id}_${Date.now()}`,
      url: `https://youtube.com/shorts/mock${item.id}`,
    };
  },
};
