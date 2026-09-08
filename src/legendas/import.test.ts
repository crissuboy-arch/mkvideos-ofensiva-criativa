import { mkdtempSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  safeVideoFilename, isYoutubeUrl, friendlyYtdlpError, maxUploadBytes, importsDir,
  VideoImporter, ALLOWED_VIDEO_EXT,
} from './import.js';
import type { RunToolResult } from '../localtools/exec.js';

describe('safeVideoFilename', () => {
  it('mantém a extensão e gera nome único e seguro', () => {
    const n = safeVideoFilename('Meu Vídeo Final.MP4');
    expect(n).toMatch(/^meu-video-final-[a-z0-9-]+\.mp4$/);
  });

  it('descarta componentes de diretório (sem path traversal)', () => {
    for (const evil of ['../../etc/passwd.mp4', '..\\..\\win.mp4', '/abs/path/x.mkv', 'C:\\Windows\\a.mov']) {
      const n = safeVideoFilename(evil);
      expect(n.includes('/')).toBe(false);
      expect(n.includes('\\')).toBe(false);
      expect(n.includes('..')).toBe(false);
    }
  });

  it('rejeita extensões fora da lista', () => {
    expect(() => safeVideoFilename('a.exe')).toThrow(/formato não aceito/);
    expect(() => safeVideoFilename('semext')).toThrow(/formato não aceito/);
  });

  it('aceita todas as extensões suportadas', () => {
    for (const ext of ALLOWED_VIDEO_EXT) expect(safeVideoFilename(`v${ext}`)).toMatch(new RegExp(`\\${ext}$`));
  });
});

describe('isYoutubeUrl', () => {
  it('aceita domínios do YouTube', () => {
    for (const u of [
      'https://www.youtube.com/watch?v=abc123',
      'https://youtu.be/abc123',
      'http://m.youtube.com/watch?v=x',
      'https://music.youtube.com/watch?v=x',
    ]) expect(isYoutubeUrl(u)).toBe(true);
  });

  it('rejeita o resto', () => {
    for (const u of ['https://vimeo.com/1', 'not a url', 'ftp://youtube.com/x', 'https://youtube.com.evil.com/x', '']) {
      expect(isYoutubeUrl(u)).toBe(false);
    }
  });
});

describe('friendlyYtdlpError', () => {
  it('traduz erros comuns', () => {
    expect(friendlyYtdlpError('ERROR: Private video. Sign in')).toMatch(/privado/);
    expect(friendlyYtdlpError('ERROR: Video unavailable')).toMatch(/indisponível/);
    expect(friendlyYtdlpError('ERROR: "x" is not a valid URL')).toMatch(/link inválido/);
    expect(friendlyYtdlpError('boom qualquer coisa')).toMatch(/boom qualquer coisa/);
  });
});

describe('VideoImporter', () => {
  let dataDir: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'leg-imp-'));
    env = { MKIVIDEOS_DATA_DIR: dataDir };
  });
  afterEach(() => rmSync(dataDir, { recursive: true, force: true }));

  it('maxUploadBytes respeita a env', () => {
    expect(maxUploadBytes({})).toBe(2048 * 1024 * 1024);
    expect(maxUploadBytes({ MKIVIDEOS_LEG_MAX_UPLOAD_MB: '10' })).toBe(10 * 1024 * 1024);
  });

  it('saveUpload grava o stream num arquivo seguro dentro da pasta de trabalho', async () => {
    const imp = new VideoImporter(env);
    const payload = Buffer.from('conteudo-de-video-falso');
    const r = await imp.saveUpload(Readable.from(payload), 'clipe da aula.mp4');
    expect(r.path.startsWith(importsDir(env) + path.sep)).toBe(true);
    expect(path.basename(r.path)).toMatch(/^clipe-da-aula-.*\.mp4$/);
    expect(statSync(r.path).size).toBe(payload.length);
    expect(r.bytes).toBe(payload.length);
  });

  it('saveUpload rejeita extensão inválida sem deixar arquivo', async () => {
    const imp = new VideoImporter(env);
    await expect(imp.saveUpload(Readable.from(Buffer.from('x')), 'malware.exe')).rejects.toThrow(/formato não aceito/);
    expect(readdirSync(importsDir(env))).toHaveLength(0);
  });

  it('saveUpload aborta e limpa quando estoura o limite de tamanho', async () => {
    const imp = new VideoImporter({ ...env, MKIVIDEOS_LEG_MAX_UPLOAD_MB: '0.000001' }); // ~1 byte
    await expect(imp.saveUpload(Readable.from(Buffer.alloc(5000)), 'grande.mp4')).rejects.toThrow(/limite/);
    expect(readdirSync(importsDir(env))).toHaveLength(0);
  });

  it('saveUpload recusa antes de ler quando o Content-Length já excede', async () => {
    const imp = new VideoImporter({ ...env, MKIVIDEOS_LEG_MAX_UPLOAD_MB: '1' });
    await expect(imp.saveUpload(Readable.from(Buffer.from('x')), 'v.mp4', 5 * 1024 * 1024)).rejects.toThrow(/muito grande/);
  });

  it('fromYoutube usa yt-dlp (injetado), acha o arquivo e o título', async () => {
    const calls: string[][] = [];
    const run = async (cmd: string, args: string[]): Promise<RunToolResult> => {
      calls.push([cmd, ...args]);
      const oi = args.indexOf('-o');
      if (oi >= 0) {
        const outPath = args[oi + 1].replace('%(ext)s', 'mp4');
        writeFileSync(outPath, 'video');
        return { code: 0, stdout: `[download] ${outPath}`, stderr: '' };
      }
      if (args.includes('--print')) return { code: 0, stdout: 'Título Real do Vídeo\n', stderr: '' };
      return { code: 0, stdout: '', stderr: '' };
    };
    const imp = new VideoImporter(env, { run });
    const r = await imp.fromYoutube('https://www.youtube.com/watch?v=abc');
    expect(r.path.endsWith('.mp4')).toBe(true);
    expect(statSync(r.path).isFile()).toBe(true);
    expect(r.title).toBe('Título Real do Vídeo');
    expect(calls[0][0]).toBe('yt-dlp');
  });

  it('fromYoutube rejeita URL não-YouTube sem chamar yt-dlp', async () => {
    let called = false;
    const imp = new VideoImporter(env, { run: async () => { called = true; return { code: 0, stdout: '', stderr: '' }; } });
    await expect(imp.fromYoutube('https://vimeo.com/1')).rejects.toThrow(/YouTube/);
    expect(called).toBe(false);
  });

  it('fromYoutube converte falha do yt-dlp em mensagem amigável', async () => {
    const run = async (_c: string, args: string[]): Promise<RunToolResult> =>
      args.includes('-o') ? { code: 1, stdout: '', stderr: 'ERROR: Private video.' } : { code: 0, stdout: '', stderr: '' };
    const imp = new VideoImporter(env, { run });
    await expect(imp.fromYoutube('https://youtu.be/x')).rejects.toThrow(/privado/);
  });
});
