// Setup do projeto HyperFrames: estrutura de pastas, GSAP local, fontes, imagens.

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, copyFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { hfInit } from './hyperframes.js';

const shell = promisify(exec);
const __dir = path.dirname(fileURLToPath(import.meta.url));

/** Procura um gsap.min.js local (no próprio pacote ou no cwd). */
export function findLocalGsap(): string | null {
  const candidates = [
    path.resolve(__dir, '..', '..', 'node_modules', 'gsap', 'dist', 'gsap.min.js'),
    path.resolve(process.cwd(), 'node_modules', 'gsap', 'dist', 'gsap.min.js'),
  ];
  return candidates.find(existsSync) ?? null;
}

/** Caminhos candidatos das fontes (.woff2 + fonts.css) da skill video-explicativo. */
function skillFontsDir(): string | null {
  const candidates = [
    path.join(os.homedir(), '.claude', 'skills', 'video-explicativo', 'scripts', 'assets', 'fonts'),
    path.join(os.homedir(), 'meus-videos-ia', 'skill-video-explicativo', 'skill', 'video-explicativo', 'scripts', 'assets', 'fonts'),
  ];
  return candidates.find(existsSync) ?? null;
}

function fetchFontsScript(): string | null {
  const candidates = [
    path.join(os.homedir(), '.claude', 'skills', 'video-explicativo', 'scripts', 'fetch-fonts.mjs'),
    path.join(os.homedir(), 'meus-videos-ia', 'skill-video-explicativo', 'skill', 'video-explicativo', 'scripts', 'fetch-fonts.mjs'),
  ];
  return candidates.find(existsSync) ?? null;
}

/** Cria o projeto HyperFrames e prepara assets (audio/fonts/img, gsap, fontes). */
export async function initProject(dir: string): Promise<void> {
  mkdirSync(dir, { recursive: true });
  await hfInit(dir);

  mkdirSync(path.join(dir, 'assets', 'audio'), { recursive: true });
  mkdirSync(path.join(dir, 'assets', 'fonts'), { recursive: true });
  mkdirSync(path.join(dir, 'assets', 'img'), { recursive: true });
  mkdirSync(path.join(dir, 'renders'), { recursive: true });

  // GSAP local (evita CDN, que some no render headless).
  const gsap = findLocalGsap();
  if (gsap) {
    copyFileSync(gsap, path.join(dir, 'assets', 'gsap.min.js'));
  } else {
    await shell('npm install gsap --prefix .', { cwd: dir });
    const installed = path.join(dir, 'node_modules', 'gsap', 'dist', 'gsap.min.js');
    if (existsSync(installed)) copyFileSync(installed, path.join(dir, 'assets', 'gsap.min.js'));
  }

  // Fontes: copia da skill se houver; senão tenta fetch-fonts.mjs.
  const fontsDir = skillFontsDir();
  if (fontsDir) {
    for (const f of readdirSync(fontsDir)) {
      copyFileSync(path.join(fontsDir, f), path.join(dir, 'assets', 'fonts', f));
    }
  } else {
    const fetch = fetchFontsScript();
    if (fetch) await shell(`node "${fetch}"`, { cwd: dir });
  }
}

/** Lê o fonts.css do projeto e reescreve os caminhos para assets/fonts/. */
export function readFontCss(projectDir: string): string {
  const f = path.join(projectDir, 'assets', 'fonts', 'fonts.css');
  if (!existsSync(f)) return '';
  return readFileSync(f, 'utf-8').replace(/\.\/fonts\//g, 'assets/fonts/');
}

/**
 * Copia imagens cena{i}.{png,jpg,jpeg,webp} de `imagensDir` para o projeto.
 * Retorna o caminho relativo por índice (vazio quando não há imagem).
 */
export function copySceneImages(imagensDir: string, projectDir: string, count: number): string[] {
  const exts = ['png', 'jpg', 'jpeg', 'webp'];
  const result: string[] = [];
  for (let i = 1; i <= count; i++) {
    const found = exts.map((e) => path.join(imagensDir, `cena${i}.${e}`)).find(existsSync);
    if (found) {
      const ext = path.extname(found);
      const dest = path.join(projectDir, 'assets', 'img', `cena${i}${ext}`);
      copyFileSync(found, dest);
      result.push(`assets/img/cena${i}${ext}`);
      console.log(`  [img] cena${i}: ${dest}`);
    } else {
      result.push('');
    }
  }
  return result;
}
