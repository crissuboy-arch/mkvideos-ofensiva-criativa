// Bridge para formatos-layout (inematds, licença MIT).
// https://github.com/inematds/formatos-layout
//
// Catálogo de 20 layouts nomeados (apresentador + conteúdo) + script
// `compor.sh` que monta o vídeo final a partir de dois ficheiros — o vídeo
// do conteúdo e o vídeo do apresentador — só com ffmpeg e Python, sem GPU.
//
// Encaixe no MKVideos: estágio FINAL de composição. O avatar (LongCat-Avatar
// ou outro provider) gera o vídeo do apresentador, o pipeline gera o conteúdo
// (B-roll/cenas), e esta bridge compõe os dois no layout escolhido — é o
// equivalente programático do padrão "PIP do talking-head" dos vídeos semanais.
//
// Integração por processo externo (bridge): nenhum código copiado para cá.
// MIT permite adaptar; optámos pela bridge para manter o upstream atualizável.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { EngineNotImplementedError } from '../types.js';

const run = promisify(execFile);

export const LAYOUTS_SETUP_MSG =
  'formatos-layout não configurado. Passos: git clone https://github.com/inematds/formatos-layout.git ' +
  '(MIT) e definir LAYOUTS_DIR no .env apontando para o clone (deve conter compor.sh).';

/** Layouts 16:9 (lidos do case do compor.sh; ver FORMATOS.md no upstream). */
export const FORMATS_16X9 = [
  'largo',        // conteúdo à esquerda, apresentador em coluna à direita
  'canto',        // conteúdo em tela cheia, rosto num quadro no canto
  'bolha',        // conteúdo em tela cheia, rosto num círculo
  'telejornal',   // apresentador em tela cheia nos trechos escolhidos
  'dividido',     // metade conteúdo, metade apresentador
  'apresentador', // apresentador domina, conteúdo num cartão
  'documentario', // só voz sobre o conteúdo, rosto no fim
  'aula',         // conteúdo em tela cheia, rosto pequeno no canto de cima
] as const;

/** Layouts 9:16. */
export const FORMATS_9X16 = [
  'faixa',        // conteúdo em cima, apresentador numa faixa embaixo
  'canto',        // conteúdo em tela cheia, rosto num quadro embaixo
  'bolha',        // conteúdo em tela cheia, rosto num círculo
  'telejornal',   // apresentador em tela cheia nos trechos escolhidos
  'apresentador', // apresentador grande, conteúdo num cartão em cima
  'viral',        // cortes secos a cada 2s, fecha no apresentador
  'documentario', // só voz sobre o conteúdo, rosto no fim
  'metade',       // avatar grande na metade de baixo
  'invertido',    // avatar em cima, conteúdo embaixo
  'pergunta',     // faixa no gancho → canto → avatar grande na pergunta
  'empilhado',    // conteúdo / avatar / conteúdo em 3 faixas
  'personagem',   // o personagem ocupa o vídeo inteiro
] as const;

export type Aspecto = '16x9' | '9x16';

export function listLayouts(aspecto: Aspecto): readonly string[] {
  return aspecto === '16x9' ? FORMATS_16X9 : FORMATS_9X16;
}

function layoutsDir(): string {
  return process.env.LAYOUTS_DIR || '';
}

function comporScript(): string | null {
  const dir = layoutsDir();
  if (!dir) return null;
  const p = path.join(dir, 'compor.sh');
  return existsSync(p) ? p : null;
}

export interface LayoutsHealth {
  available: boolean;
  message: string;
}

/** Verifica se o compor.sh existe (não executa composição). */
export async function layoutsHealth(): Promise<LayoutsHealth> {
  const script = comporScript();
  if (!script) {
    return { available: false, message: `compor.sh não encontrado. ${LAYOUTS_SETUP_MSG}` };
  }
  return { available: true, message: `compor.sh pronto em ${script}.` };
}

export interface ComposeOptions {
  formato: string;
  aspecto: Aspecto;
  /** Vídeo do conteúdo (cena/B-roll), já no aspecto. */
  cena: string;
  /** Vídeo do apresentador (avatar). */
  avatar: string;
  /** MP4 de saída. */
  saida: string;
  /** Opções extra repassadas ao compor.sh (ss, t, trechos, fim, gancho, nome). */
  extra?: Record<string, string | number>;
}

/**
 * Compõe CENA + AVATAR no layout nomeado via compor.sh.
 * Ex.: composeLayout({ formato:'bolha', aspecto:'9x16', cena, avatar, saida }).
 */
export async function composeLayout(opts: ComposeOptions): Promise<string> {
  const validos = listLayouts(opts.aspecto);
  if (!validos.includes(opts.formato)) {
    throw new EngineNotImplementedError(
      `Layouts: formato '${opts.formato}' não existe em ${opts.aspecto}. Válidos: ${validos.join(', ')}.`,
    );
  }
  const script = comporScript();
  if (!script) throw new EngineNotImplementedError(`Layouts: ${LAYOUTS_SETUP_MSG}`);
  for (const [k, f] of [['cena', opts.cena], ['avatar', opts.avatar]] as const) {
    if (!existsSync(f)) throw new EngineNotImplementedError(`Layouts: ficheiro ${k} não existe: ${f}`);
  }

  const args = [
    '--formato', opts.formato,
    '--aspecto', opts.aspecto,
    '--cena', path.resolve(opts.cena),
    '--avatar', path.resolve(opts.avatar),
    '--saida', path.resolve(opts.saida),
  ];
  for (const [k, v] of Object.entries(opts.extra ?? {})) args.push(`--${k}`, String(v));

  const timeoutMs = Number(process.env.LAYOUTS_TIMEOUT_MS || '') || 20 * 60 * 1000;
  try {
    const { stdout, stderr } = await run('bash', [script, ...args], {
      timeout: timeoutMs,
      maxBuffer: 32 * 1024 * 1024,
    });
    return stdout + stderr;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new EngineNotImplementedError(`Layouts: compor.sh falhou: ${msg}`);
  }
}
