// Lógica testável do CLI standalone (sem efeitos colaterais no import).
// O executável (cli.ts) só liga argv → estas funções + IO.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

import { parseVideoCommand, formatQueueList } from './queue.js';
import type { QueueDeps, QueueStore } from './types.js';
import { buildVideo } from './engine/pipeline.js';
import { VIDEO_TYPES } from './specs/types.js';
import type { VideoType } from './specs/types.js';
import { brandIds } from './brands/index.js';

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

/** Valida o tipo de vídeo (cai em explicativo com aviso se for inválido). */
export function resolveTipo(tipo?: string): VideoType {
  if (!tipo) return 'explicativo';
  const t = tipo.toLowerCase().trim();
  if ((VIDEO_TYPES as string[]).includes(t)) return t as VideoType;
  console.warn(`[mkivideos] tipo "${tipo}" inválido — usando explicativo. Tipos: ${VIDEO_TYPES.join(', ')}`);
  return 'explicativo';
}

/** Gera vídeo offline sem API: roteiro → TTS local → HyperFrames → FFmpeg. */
export async function cmdGerar(titulo: string, opts: {
  tipo?: string;
  marca?: string;
  vertical?: boolean;
  horizontal?: boolean;
  pasta?: string;
  cenas?: number;
  tema?: string;
  imagens?: string;
  voz?: string;
}): Promise<string> {
  if (!titulo.trim()) return 'erro: informe o tema/título do vídeo.';
  const tipo = resolveTipo(opts.tipo);
  console.log(`[mkivideos] gerando "${titulo}" (${tipo})...`);
  try {
    const result = await buildVideo({
      titulo: titulo.trim(),
      tipo,
      marca: opts.marca,
      tema: opts.tema,
      n_cenas: opts.cenas,
      vertical: opts.vertical,
      horizontal: opts.horizontal,
      output: opts.pasta,
      imagens_dir: opts.imagens,
      voz: opts.voz,
    });
    return `✅ Vídeo gerado (${result.format}): ${result.mp4} (${result.duration.toFixed(1)}s)`;
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
    'mkivideos — motor universal de vídeos (offline)',
    '',
    'Uso:',
    '  mkivideos gerar "<tema>" [--tipo <tipo>] [--vertical|--horizontal] [--marca <id>]',
    '                          [--cenas <n>] [--tema <eyebrow>] [--pasta <caminho>]',
    '                          [--imagens <pasta>] [--voz <nome>]',
    '  mkivideos add <explicativo|curso|demo> <assunto> [--vertical] [--enviar] [--silencioso] [--pasta <caminho>]',
    '  mkivideos fila',
    '  mkivideos cancelar <id>',
    '  mkivideos run [--port <n>] [--token <t>]    # daemon: processa a fila (1/vez) + dashboard opcional',
    '  mkivideos painel [--port <n>] [--token <t>] # painel de produção (calendário, cadastro, dashboard)',
    '',
    `  tipos:  ${VIDEO_TYPES.join(', ')}`,
    `  marcas: ${brandIds().join(', ')}`,
    '',
    'Env:',
    '  MKIVIDEOS_DB      caminho do banco SQLite (default: ./mkivideos.db)',
    '  MKIVIDEOS_VOZES   pasta-raiz de vozes personalizadas',
    '',
    'Requer: HyperFrames, FFmpeg, Kokoro TTS e Chrome headless instalados localmente.',
  ].join('\n');
}
