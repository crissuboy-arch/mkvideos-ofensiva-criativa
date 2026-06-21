// Lógica testável do CLI standalone (sem efeitos colaterais no import).
// O executável (cli.ts) só liga argv → estas funções + IO.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

import { parseVideoCommand, formatQueueList } from './queue.js';
import type { QueueDeps, QueueStore } from './types.js';
import { buildVideo } from './offline-builder.js';

const run = promisify(execFile);

/** `mkivideos add <skill> <input...> [--flags]` → enfileira. Retorna a mensagem. */
export function cmdAdd(store: QueueStore, raw: string): string {
  const parsed = parseVideoCommand(raw);
  if (!parsed.ok) return `erro: ${parsed.error}`;
  const o: { vertical?: boolean; dest?: string } = {};
  if (parsed.vertical) o.vertical = true;
  if (parsed.dest) o.dest = parsed.dest;
  const opts = Object.keys(o).length ? JSON.stringify(o) : null;
  const id = store.enqueue({
    skill: parsed.skill, input: parsed.input, opts,
    notify: parsed.silent ? 'silencioso' : 'sempre',
    sendVideo: parsed.send, chatId: 'cli',
  });
  return `enfileirado #${id} (${parsed.skill})${parsed.dest ? ` → ${parsed.dest}` : ''}`;
}

/** `mkivideos fila` → lista a fila ativa. */
export function cmdFila(store: QueueStore): string {
  return formatQueueList(store.list());
}

/** `mkivideos cancelar <id>` → cancela um job que ainda espera. */
export function cmdCancel(store: QueueStore, id: number): string {
  if (!Number.isInteger(id)) return 'erro: id inválido';
  return store.cancel(id) ? `cancelado #${id}` : `não cancelei #${id} (já rodando ou não existe)`;
}

/** Pega o valor de uma flag `--nome valor` num array de tokens. */
export function optVal(tokens: string[], name: string): string | undefined {
  const i = tokens.indexOf(name);
  return i >= 0 ? tokens[i + 1] : undefined;
}

/** Gera vídeo offline sem API: TTS local → HyperFrames → FFmpeg. */
export async function cmdGerar(titulo: string, opts: {
  vertical?: boolean;
  pasta?: string;
  cenas?: number;
  tema?: string;
  imagens?: string;
  voz?: string;
}): Promise<string> {
  if (!titulo.trim()) return 'erro: informe o título do vídeo.';
  console.log(`[mkivideos] gerando "${titulo}"...`);
  try {
    const result = await buildVideo({
      titulo: titulo.trim(),
      tema: opts.tema,
      n_cenas: opts.cenas,
      vertical: opts.vertical ?? true,
      output: opts.pasta,
      imagens_dir: opts.imagens,
      voz: opts.voz,
    });
    return `✅ Vídeo gerado: ${result.mp4} (${result.duration.toFixed(1)}s)`;
  } catch (e) {
    return `❌ Falhou: ${(e as Error).message}`;
  }
}

/** Deps default pro modo standalone: runAgent via `claude -p` (legado — fila). */
export function makeDefaultDeps(): QueueDeps {
  return {
    runAgent: async (prompt) => {
      const { stdout } = await run('claude', ['-p', prompt], { maxBuffer: 100 * 1024 * 1024 });
      return { text: stdout };
    },
    sendMessage: async (_chatId, text) => { console.log(text); },
    sendDocument: async (_chatId, p) => { console.log('📎', p); },
    moveVideo: async (src, dest) => {
      const isFile = dest.toLowerCase().endsWith('.mp4');
      const targetDir = isFile ? path.dirname(dest) : dest;
      fs.mkdirSync(targetDir, { recursive: true });
      const target = isFile ? dest : path.join(dest, path.basename(src));
      try { fs.renameSync(src, target); }
      catch { fs.copyFileSync(src, target); fs.unlinkSync(src); }
      return target;
    },
  };
}

export function usage(): string {
  return [
    'mkivideos — gerador de vídeos (offline)',
    '',
    'Uso:',
    '  mkivideos gerar "<título>" [--vertical] [--cenas <n>] [--tema <tema>] [--pasta <caminho>] [--imagens <pasta>] [--voz <nome>]',
    '  mkivideos add <explicativo|curso|demo> <assunto> [--vertical] [--enviar] [--silencioso] [--pasta <caminho>]',
    '  mkivideos fila',
    '  mkivideos cancelar <id>',
    '  mkivideos run [--port <n>] [--token <t>]    # daemon: processa a fila (1/vez) + dashboard opcional',
    '',
    'Env:',
    '  MKIVIDEOS_DB   caminho do banco SQLite (default: ./mkivideos.db)',
    '',
    'Requer: HyperFrames, FFmpeg, Kokoro TTS e Chrome headless instalados localmente.',
  ].join('\n');
}
