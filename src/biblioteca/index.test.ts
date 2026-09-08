import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { scanLibrary, isLibraryPathAllowed } from './index.js';

function touch(file: string, content = 'x'): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

describe('biblioteca/scanLibrary', () => {
  let repo: string;
  let data: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    repo = mkdtempSync(path.join(os.tmpdir(), 'bib-repo-'));
    data = path.join(repo, '.mkvideos-data');
    env = { MKIVIDEOS_DATA_DIR: data };
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it('agrega mp4 de todas as fontes locais', () => {
    touch(path.join(repo, 'renders', 'meu-tema-9x16.mp4'));
    touch(path.join(repo, 'modules', 'content2video', 'output', 'content2video', 'artigo-x', 'renders', 'artigo-x.mp4'));
    touch(path.join(data, 'musicavideo', 'minha-musica', 'clipe-1.mp4'));
    touch(path.join(data, 'musicavideo', 'index.jsonl'), JSON.stringify({ slug: 'minha-musica', titulo: 'Segunda Chance' }) + '\n');
    touch(path.join(data, 'otimizevideo', 'saida', 'abc123', 'output.mp4'));
    touch(path.join(data, 'legendas', 'aula-01', 'final-legendado.mp4'));
    touch(path.join(data, 'legendas', 'aula-01', 'project.json'), JSON.stringify({ title: 'Aula 01' }));

    const items = scanLibrary({ repoRoot: repo, env });
    const bySource = Object.fromEntries(items.map((i) => [i.source, i]));
    expect(Object.keys(bySource).sort()).toEqual(['gerar', 'legendas', 'musicavideo', 'otimizevideo', 'url2video']);
    expect(bySource.musicavideo.title).toBe('Segunda Chance');
    expect(bySource.legendas.title).toBe('Aula 01');
  });

  it('ignora diretórios inexistentes sem quebrar', () => {
    expect(scanLibrary({ repoRoot: repo, env })).toEqual([]);
  });

  it('isLibraryPathAllowed barra caminhos fora das raízes conhecidas', () => {
    expect(isLibraryPathAllowed(path.join(repo, 'renders', 'a.mp4'), { repoRoot: repo, env })).toBe(true);
    expect(isLibraryPathAllowed(path.join(data, 'legendas', 'x', 'final-legendado.mp4'), { repoRoot: repo, env })).toBe(true);
    expect(isLibraryPathAllowed('C:/Windows/System32/x.mp4', { repoRoot: repo, env })).toBe(false);
  });
});
