// src/om/agnes.ts — provedor GRATUITO Agnes AI (Sapiens AI).
//
// API: https://apihub.agnes-ai.com/v1 (OpenAI-compatible)
//   imagem: POST /v1/images/generations {model: agnes-image-2.1-flash, prompt, size}
//   vídeo:  POST /v1/videos {model: agnes-video-v2.0, prompt, height, width, num_frames, frame_rate}
//           → async; poll em GET /agnesapi?video_id=<id>
// Auth: Bearer AGNES_API_KEY.
//
// Regras aprendidas (uso real): retry com backoff em 503/429 é OBRIGATÓRIO
// (~1/3 das chamadas free falha); prompts em INGLÊS (PT pode dar 400);
// vídeo limitado a ~5 req/min. Chave via env, nunca no código.

const BASE = process.env.MKV_AGNES_BASE ?? 'https://apihub.agnes-ai.com';

export class AgnesError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'AgnesError';
  }
}

export function agnesApiKey(env: NodeJS.ProcessEnv = process.env): string {
  const k = env.AGNES_API_KEY;
  if (!k) {
    throw new AgnesError(
      'AGNES_API_KEY não definida. Cria em https://platform.agnes-ai.com e exporta AGNES_API_KEY.',
    );
  }
  return k;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** POST com retry em 503/429 (backoff exponencial). Lança AgnesError no resto. */
async function postJson(path: string, body: unknown, key: string, tries = 5): Promise<unknown> {
  let last = 0;
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    last = res.status;
    if (res.status === 503 || res.status === 429) {
      await sleep(1500 * 2 ** i);
      continue;
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new AgnesError(`agnes ${path}: HTTP ${res.status} ${txt.slice(0, 160)}`, res.status);
    }
    return (await res.json()) as unknown;
  }
  throw new AgnesError(`agnes ${path}: falhou ${tries}x (último HTTP ${last})`, last);
}

export interface AgnesImageOpts {
  /** Prompt EM INGLÊS. */
  prompt: string;
  size?: string; // ex: "768x1360" (9:16)
}

/** Gera uma imagem; devolve os bytes (PNG/JPEG). */
export async function agnesImage(opts: AgnesImageOpts, key = agnesApiKey()): Promise<Buffer> {
  const data = (await postJson('/v1/images/generations', {
    model: 'agnes-image-2.1-flash',
    prompt: opts.prompt,
    size: opts.size ?? '768x1360',
  }, key)) as { data?: Array<{ b64_json?: string; url?: string }> };
  const item = data.data?.[0];
  if (!item) throw new AgnesError('agnes imagem: resposta sem data[0]');
  if (item.b64_json) return Buffer.from(item.b64_json, 'base64');
  if (item.url) {
    const res = await fetch(item.url);
    if (!res.ok) throw new AgnesError(`agnes imagem: download HTTP ${res.status}`, res.status);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new AgnesError('agnes imagem: sem b64_json nem url');
}

export interface AgnesVideoOpts {
  /** Prompt EM INGLÊS. */
  prompt: string;
  width?: number;
  height?: number;
  durationSec?: number; // 4–12
  pollIntervalMs?: number;
  timeoutMs?: number;
}

/** Gera um vídeo (async); espera e devolve os bytes do mp4. */
export async function agnesVideo(opts: AgnesVideoOpts, key = agnesApiKey()): Promise<Buffer> {
  const durationSec = Math.min(12, Math.max(4, opts.durationSec ?? 5));
  const fps = 24;
  const created = (await postJson('/v1/videos', {
    model: 'agnes-video-v2.0',
    prompt: opts.prompt,
    width: opts.width ?? 768,
    height: opts.height ?? 1360,
    num_frames: durationSec * fps,
    frame_rate: fps,
  }, key)) as { video_id?: string; id?: string };
  const videoId = created.video_id ?? created.id;
  if (!videoId) throw new AgnesError('agnes vídeo: resposta sem video_id');

  const pollMs = opts.pollIntervalMs ?? 8000;
  const deadline = Date.now() + (opts.timeoutMs ?? 10 * 60_000);
  for (;;) {
    if (Date.now() > deadline) throw new AgnesError('agnes vídeo: timeout a aguardar');
    await sleep(pollMs);
    const res = await fetch(`${BASE}/agnesapi?video_id=${encodeURIComponent(videoId)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 503 || res.status === 429) continue;
    if (!res.ok) throw new AgnesError(`agnes vídeo poll: HTTP ${res.status}`, res.status);
    const st = (await res.json()) as { status?: string; video_url?: string; url?: string };
    const done = (st.status ?? '').toLowerCase();
    if (['succeeded', 'completed', 'done', 'success'].includes(done)) {
      const url = st.video_url ?? st.url;
      if (!url) throw new AgnesError('agnes vídeo: concluído mas sem url');
      const dl = await fetch(url);
      if (!dl.ok) throw new AgnesError(`agnes vídeo: download HTTP ${dl.status}`, dl.status);
      return Buffer.from(await dl.arrayBuffer());
    }
    if (['failed', 'error', 'cancelled'].includes(done)) {
      throw new AgnesError(`agnes vídeo: falhou (status=${st.status})`);
    }
    // senão: ainda a gerar (queued/processing/...)
  }
}
