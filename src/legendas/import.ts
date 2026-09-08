// Importação de vídeo para a funcionalidade "Legendar" — duas fontes:
//  A) upload de arquivo local (o corpo da requisição é o binário do vídeo; sem
//     multipart, para não depender de parser externo);
//  B) link do YouTube via `yt-dlp` (o mesmo binário que o `doctor` detecta).
//
// Tudo cai numa pasta de trabalho dedicada dentro do diretório de dados dos
// módulos (.mkvideos-data/legendas/_imports), com nome de arquivo saneado —
// sem path traversal, sem expor caminhos de origem do usuário.

import { createWriteStream, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';

import { runTool, LocalToolError, type RunToolOptions, type RunToolResult } from '../localtools/exec.js';
import { legendasRoot } from './store.js';

/** Extensões de vídeo aceitas na aba "Legendar". */
export const ALLOWED_VIDEO_EXT = ['.mp4', '.mov', '.avi', '.mkv', '.webm'] as const;

const DEFAULT_MAX_UPLOAD_MB = 2048;

/** Limite de tamanho do upload (MB → bytes). Ajustável por MKIVIDEOS_LEG_MAX_UPLOAD_MB. */
export function maxUploadBytes(env: NodeJS.ProcessEnv = process.env): number {
  const mb = Number(env.MKIVIDEOS_LEG_MAX_UPLOAD_MB);
  return (Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_MAX_UPLOAD_MB) * 1024 * 1024;
}

/** Pasta de trabalho onde os vídeos importados são guardados. */
export function importsDir(env: NodeJS.ProcessEnv = process.env): string {
  const d = path.join(legendasRoot(env), '_imports');
  mkdirSync(d, { recursive: true });
  return d;
}

function stemSlug(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

/**
 * Gera um nome de arquivo seguro a partir do nome original enviado pelo cliente.
 * - descarta qualquer componente de diretório (path traversal);
 * - valida a extensão contra ALLOWED_VIDEO_EXT;
 * - adiciona um sufixo aleatório para não colidir nem sobrescrever.
 */
export function safeVideoFilename(originalName: string): string {
  const base = path.basename(String(originalName || '').replace(/\\/g, '/').replace(/\0/g, ''));
  const ext = path.extname(base).toLowerCase();
  if (!(ALLOWED_VIDEO_EXT as readonly string[]).includes(ext)) {
    throw new Error(`formato não aceito (${ext || 'sem extensão'}). Use: ${ALLOWED_VIDEO_EXT.join(', ')}.`);
  }
  const stem = stemSlug(base.slice(0, base.length - ext.length)) || 'video';
  const rand = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  return `${stem}-${rand}${ext}`;
}

/** Aceita apenas URLs de vídeo do YouTube. */
export function isYoutubeUrl(raw: string): boolean {
  try {
    const u = new URL(String(raw).trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const h = u.hostname.replace(/^www\./, '').toLowerCase();
    return h === 'youtube.com' || h === 'm.youtube.com' || h === 'youtu.be'
      || h === 'youtube-nocookie.com' || h === 'music.youtube.com';
  } catch {
    return false;
  }
}

function assertInside(target: string, dir: string): void {
  const abs = path.resolve(target);
  if (abs !== path.resolve(dir) && !abs.startsWith(path.resolve(dir) + path.sep)) {
    throw new Error('caminho de destino inválido.');
  }
}

/** Traduz erros comuns do yt-dlp para mensagens amigáveis. */
export function friendlyYtdlpError(stderr: string): string {
  const s = (stderr || '').toLowerCase();
  if (s.includes('private video')) return 'esse vídeo é privado.';
  if (s.includes('video unavailable') || s.includes('this video is not available')) return 'esse vídeo está indisponível.';
  if (s.includes('confirm your age') || s.includes('age-restricted') || s.includes('inappropriate for some users')) {
    return 'esse vídeo tem restrição de idade e não pode ser baixado.';
  }
  if (s.includes("confirm you're not a bot") || s.includes('confirm you are not a bot') || s.includes('sign in to confirm')) {
    return 'o YouTube pediu verificação para baixar este vídeo. Tente novamente mais tarde ou use outro vídeo.';
  }
  if (s.includes('is not a valid url') || s.includes('unsupported url')) return 'link inválido — cole o endereço completo do vídeo no YouTube.';
  if (s.includes('members-only') || s.includes('join this channel')) return 'esse vídeo é exclusivo para membros do canal.';
  if (s.includes('copyright')) return 'esse vídeo foi bloqueado por direitos autorais.';
  if (s.includes('certificate_verify_failed') || s.includes('certificate verify failed')) {
    return 'falha de certificado SSL ao acessar o YouTube neste computador (configuração de rede/Python). Rode "mkivideos doctor".';
  }
  if (s.includes('unable to download') || s.includes('http error 4') || s.includes('http error 5') || s.includes('timed out')) {
    return 'não foi possível baixar o vídeo agora (falha de rede/YouTube). Tente novamente em alguns minutos.';
  }
  const last = (stderr || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop();
  return last ? `falha ao importar: ${last.slice(0, 200)}` : 'falha ao importar o vídeo do YouTube.';
}

type Runner = (cmd: string, args: string[], opts: RunToolOptions) => Promise<RunToolResult>;

export interface ImporterDeps {
  /** Injetável nos testes; por padrão usa o runTool real. */
  run?: Runner;
}

export interface ImportedVideo {
  path: string;
  bytes?: number;
  title?: string;
}

export class VideoImporter {
  private readonly run: Runner;

  constructor(private readonly env: NodeJS.ProcessEnv = process.env, deps: ImporterDeps = {}) {
    this.run = deps.run ?? runTool;
  }

  dir(): string { return importsDir(this.env); }

  /** A) Salva o corpo (stream) da requisição como um arquivo de vídeo seguro. */
  async saveUpload(source: NodeJS.ReadableStream, originalName: string, declaredBytes?: number): Promise<ImportedVideo> {
    const max = maxUploadBytes(this.env);
    if (declaredBytes && declaredBytes > max) {
      throw new Error(`arquivo muito grande (${(declaredBytes / 1048576) | 0} MB). Limite: ${(max / 1048576) | 0} MB.`);
    }
    const safe = safeVideoFilename(originalName);
    const dest = path.join(this.dir(), safe);
    assertInside(dest, this.dir());
    const bytes = await streamToFile(source, dest, max);
    return { path: dest, bytes };
  }

  /** B) Baixa um vídeo do YouTube com yt-dlp para a pasta de trabalho. */
  async fromYoutube(url: string): Promise<ImportedVideo> {
    const clean = String(url || '').trim();
    if (!isYoutubeUrl(clean)) {
      throw new Error('informe um link válido do YouTube (youtube.com ou youtu.be).');
    }
    const dir = this.dir();
    const stem = 'yt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);

    let r: RunToolResult;
    try {
      r = await this.run('yt-dlp', [
        '-f', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b',
        '--no-playlist', '--no-progress', '--no-warnings',
        '--merge-output-format', 'mp4',
        '-o', path.join(dir, stem + '.%(ext)s'),
        clean,
      ], { cwd: dir, timeoutMs: 20 * 60_000 });
    } catch (e) {
      if (e instanceof LocalToolError) {
        throw new Error('yt-dlp não está instalado ou não está no PATH. Rode "mkivideos doctor" para instruções.');
      }
      throw e;
    }
    const combined = `${r.stderr || ''}\n${r.stdout || ''}`;
    if (r.code !== 0 || /^ERROR:/m.test(combined)) throw new Error(friendlyYtdlpError(combined));

    const file = readdirSync(dir).find((f) => f.startsWith(stem + '.'));
    if (!file) throw new Error('a importação terminou, mas o arquivo de vídeo não foi encontrado.');

    return { path: path.join(dir, file), title: await this.tryTitle(clean) };
  }

  private async tryTitle(url: string): Promise<string | undefined> {
    try {
      const r = await this.run('yt-dlp', ['--skip-download', '--no-playlist', '--no-warnings', '--print', '%(title)s', url],
        { cwd: this.dir(), timeoutMs: 60_000 });
      const t = (r.stdout || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0];
      return t || undefined;
    } catch {
      return undefined;
    }
  }
}

function streamToFile(source: NodeJS.ReadableStream, dest: string, maxBytes: number): Promise<number> {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    let failErr: Error | null = null;
    let settled = false;
    const src = source as NodeJS.ReadableStream & { unpipe?: (d: unknown) => void; destroy?: () => void };
    const out = createWriteStream(dest);

    const fail = (err: Error): void => {
      if (failErr || settled) return;
      failErr = err;
      src.unpipe?.(out);
      src.destroy?.();
      out.destroy();
    };

    // Só liquida a promise depois do 'close' do WriteStream: garante que o fd
    // já saiu antes de remover o parcial (inclusive se o `open` demorar).
    out.on('close', () => {
      if (settled) return;
      settled = true;
      if (!failErr && bytes === 0) failErr = new Error('nenhum dado recebido no upload.');
      if (failErr) {
        try { unlinkSync(dest); } catch { /* nada a limpar */ }
        reject(failErr);
      } else {
        resolve(bytes);
      }
    });

    source.on('data', (c: Buffer) => {
      bytes += c.length;
      if (bytes > maxBytes) fail(new Error(`arquivo excede o limite de ${(maxBytes / 1048576) | 0} MB.`));
    });
    source.on('error', fail);
    out.on('error', (e: Error) => { if (!failErr) failErr = e; });

    source.pipe(out);
  });
}
