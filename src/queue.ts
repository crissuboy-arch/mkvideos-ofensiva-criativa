// Núcleo da fila de vídeos — puro e host-agnóstico.
// parse/prompt/extract são funções puras; processNextJob/initVideoQueue recebem
// um QueueStore (persistência) e QueueDeps (IO) injetados.

import type { ParsedCommand, QueueDeps, QueueStore, VideoJob } from './types.js';

const SKILL_SLUGS: Record<VideoJob['skill'], string> = {
  explicativo: 'video-explicativo',
  curso: 'videos-cursos',
  demo: 'video-demonstrativo',
};

const SKILL_LABEL: Record<VideoJob['skill'], string> = {
  explicativo: 'explicativo',
  curso: 'curso',
  demo: 'demonstrativo',
};

/** Parseia o texto após "/mkivideos" (o caso de enfileirar). */
export function parseVideoCommand(raw: string): ParsedCommand {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { ok: false, error: 'Uso: /mkivideos <explicativo|curso|demo> <assunto/link> [--vertical] [--enviar] [--silencioso] [--pasta <caminho>]' };
  }

  const skillToken = tokens[0].toLowerCase();
  if (skillToken !== 'explicativo' && skillToken !== 'curso' && skillToken !== 'demo') {
    return { ok: false, error: `Skill inválida "${skillToken}". Use: explicativo, curso ou demo.` };
  }
  const skill = skillToken as VideoJob['skill'];

  const rest = tokens.slice(1);
  let vertical = false, send = false, silent = false;
  let dest: string | undefined;
  const inputTokens: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i];
    if (t === '--vertical') vertical = true;
    else if (t === '--enviar') send = true;
    else if (t === '--silencioso') silent = true;
    else if (t === '--pasta') { dest = rest[i + 1]; i++; } // consome o valor
    else if (t.startsWith('--')) { /* flag desconhecida: ignora */ }
    else inputTokens.push(t);
  }
  const input = inputTokens.join(' ').trim();
  if (!input) return { ok: false, error: 'Faltou o assunto/link depois da skill.' };
  return { ok: true, skill, input, vertical, send, silent, dest };
}

/** Prompt autônomo para o agente — roda a skill ponta-a-ponta e emite RESULT:. */
export function buildVideoPrompt(job: { skill: VideoJob['skill']; input: string; vertical: boolean }): string {
  const slug = SKILL_SLUGS[job.skill];
  const formato = job.vertical ? 'Formato 9:16 (vertical, Shorts/Reels).' : 'Use o formato padrão da skill.';
  return [
    `Use a skill \`${slug}\` para criar um vídeo a partir de: "${job.input}".`,
    formato,
    'Rode o fluxo COMPLETO de ponta a ponta de forma AUTÔNOMA, sem pedir confirmação de frames nem qualquer interação — assuma os defaults do usuário (PT-BR, dark premium, marca Ofensiva Criativa).',
    'No RENDER FINAL use a GPU: `npx hyperframes render --quality high --gpu --browser-gpu` com `timeout 900`. Se o .mp4 sair vazio (GPU falhar), faça fallback pro CPU: `npx hyperframes render --quality high` (sem flags de GPU).',
    'Ao terminar com sucesso, sua ÚLTIMA linha deve ser exatamente: `RESULT: <caminho absoluto do .mp4 final>`.',
    'Se falhar, sua ÚLTIMA linha deve ser: `ERRO: <motivo curto>`.',
  ].join('\n');
}

/** Extrai o caminho do .mp4 do output do agente (última linha `RESULT:`). Null se ausente/ERRO. */
export function extractResultPath(text: string | null): string | null {
  if (!text) return null;
  let found: string | null = null;
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*RESULT:\s*(\S+\.mp4)\s*$/i);
    if (m) found = m[1].trim();
  }
  return found;
}

/** Renderiza a fila ativa (running + queued) para `/mkivideos fila`. */
export function formatQueueList(jobs: VideoJob[]): string {
  const running = jobs.filter((j) => j.status === 'running');
  const queued = jobs.filter((j) => j.status === 'queued').sort((a, b) => a.created_at - b.created_at || a.id - b.id);
  const active = [...running, ...queued];
  if (active.length === 0) return '📭 Fila vazia.';
  const line = (jb: VideoJob) => {
    const icon = jb.status === 'running' ? '▶️' : '⏳';
    const inp = jb.input.length > 40 ? jb.input.slice(0, 40) + '…' : jb.input;
    return `${icon} #${jb.id} ${jb.skill} — ${inp}`;
  };
  return ['📋 Fila de vídeos:', ...active.map(line)].join('\n');
}

/** Texto de ajuda do `/mkivideos help` (e quando chamado sem args). HTML simples. */
export function mkiHelpText(): string {
  return [
    '🎬 <b>/mkivideos</b> — fila de vídeos (1 por vez)',
    '',
    '<b>Criar vídeo:</b>',
    '  /mkivideos explicativo &lt;assunto&gt;',
    '  /mkivideos curso &lt;link do curso&gt;',
    '  /mkivideos demo &lt;link do app&gt;',
    '',
    '<b>Flags (no fim):</b>',
    '  --vertical    gera 9:16 (Shorts/Reels) em vez do padrão',
    '  --enviar      anexa o .mp4 no Telegram ao terminar',
    '  --silencioso  não notifica; aparece só no painel',
    '  --pasta &lt;caminho&gt;  move o .mp4 pra essa pasta (ou caminho .mp4 completo)',
    '',
    '<b>Fila:</b>',
    '  /mkivideos fila               mostra a fila',
    '  /mkivideos fila cancelar &lt;id&gt;  cancela um job que ainda espera',
    '  /mkivideos help               esta ajuda',
  ].join('\n');
}

/**
 * Processa no máximo um job. No-op se já houver um job 'running' (concorrência = 1).
 * @param store  persistência da fila
 * @param deps   IO do host (runAgent, mensagens, mover arquivo)
 */
export async function processNextJob(store: QueueStore, deps: QueueDeps): Promise<void> {
  if (store.getRunning()) return;
  const job = store.getNext();
  if (!job) return;

  store.markRunning(job.id);
  const notify = job.notify === 'sempre' && job.chat_id;
  if (notify) await deps.sendMessage(job.chat_id!, `▶️ Iniciando vídeo #${job.id} (${SKILL_LABEL[job.skill]})`);

  try {
    let opts: { vertical?: boolean; dest?: string } = {};
    if (job.opts) {
      try { opts = JSON.parse(job.opts) as { vertical?: boolean; dest?: string }; }
      catch { /* opts inválido — ignora (vertical=false, sem dest) */ }
    }
    const prompt = buildVideoPrompt({ skill: job.skill, input: job.input, vertical: !!opts.vertical });
    const result = await deps.runAgent(prompt);
    const path = extractResultPath(result.text);

    if (!path) {
      const reason = result.text?.split('\n').reverse().find((l) => /ERRO:/i.test(l))?.trim() || 'sem RESULT no output do agente';
      store.markFailed(job.id, reason);
      if (notify) await deps.sendMessage(job.chat_id!, `❌ Vídeo #${job.id} falhou: ${reason}`);
      return;
    }

    let finalPath = path;
    if (opts.dest) {
      try { finalPath = await deps.moveVideo(path, opts.dest); }
      catch (e) {
        finalPath = path;
        if (notify) await deps.sendMessage(job.chat_id!, `⚠ Vídeo #${job.id} renderizou mas não consegui mover pra ${opts.dest}: ${(e as Error).message}. Ficou em ${path}`);
      }
    }

    store.markDone(job.id, finalPath);
    if (notify) {
      await deps.sendMessage(job.chat_id!, `✅ Vídeo #${job.id} pronto — ${SKILL_LABEL[job.skill]}\n${finalPath}`);
    }
    if (job.send_video && job.chat_id) {
      try { await deps.sendDocument(job.chat_id, finalPath); }
      catch (e) { if (notify) await deps.sendMessage(job.chat_id, `(não consegui anexar o arquivo: ${(e as Error).message})`); }
    }
  } catch (e) {
    const msg = (e as Error).message || String(e);
    store.markFailed(job.id, msg);
    if (notify) await deps.sendMessage(job.chat_id!, `❌ Vídeo #${job.id} falhou: ${msg}`);
  }
}

/** Liga o worker num tick periódico. Chame uma vez no boot. Retorna um stop(). */
export function initVideoQueue(store: QueueStore, deps: QueueDeps, intervalMs = 15_000): () => void {
  const timer = setInterval(() => { void processNextJob(store, deps); }, intervalMs);
  return () => clearInterval(timer);
}
