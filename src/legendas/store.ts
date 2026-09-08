// Store de projetos de legenda — arquivo, sem SQLite (evita a dependência nativa
// e segue o padrão do url2video/musicavideo: JSON + pastas por projeto).

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { moduleDataDir } from '../localtools/datadir.js';
import type { SubtitleStyle } from '../video/ffmpeg.js';
import type { Cue } from './srt.js';
import { cuesToSrt, parseSrt } from './srt.js';

export interface LegendaProject {
  id: string;
  title: string;
  sourceVideo: string;
  createdAt: string;
  updatedAt: string;
  idioma?: string;
  /** id da pasta de trabalho do otimizevideo usada para transcrever. */
  otvId?: string;
  transcriptProvider?: string;
  cueCount: number;
  style: SubtitleStyle;
  burnedVideoPath?: string;
  softSubVideoPath?: string;
}

export function legendasRoot(env: NodeJS.ProcessEnv = process.env): string {
  return moduleDataDir('legendas', env);
}

function projDir(id: string, env: NodeJS.ProcessEnv): string {
  const d = path.join(legendasRoot(env), id);
  mkdirSync(d, { recursive: true });
  return d;
}
function metaFile(id: string, env: NodeJS.ProcessEnv): string { return path.join(projDir(id, env), 'project.json'); }
function srtFile(id: string, env: NodeJS.ProcessEnv): string { return path.join(projDir(id, env), 'legenda.srt'); }

export function slugify(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || `legenda-${Date.now().toString(36)}`;
}

export class LegendaStore {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  create(sourceVideo: string, title?: string): LegendaProject {
    const base = slugify(title || path.basename(sourceVideo).replace(/\.[^.]+$/, ''));
    let id = base;
    for (let i = 2; existsSync(path.join(legendasRoot(this.env), id)); i++) id = `${base}-${i}`;
    const now = new Date().toISOString();
    const project: LegendaProject = {
      id, title: title || base, sourceVideo: path.resolve(sourceVideo),
      createdAt: now, updatedAt: now, cueCount: 0, style: {},
    };
    writeFileSync(metaFile(id, this.env), JSON.stringify(project, null, 2));
    return project;
  }

  get(id: string): LegendaProject | null {
    const f = metaFile(id, this.env);
    return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf-8')) as LegendaProject) : null;
  }

  list(): LegendaProject[] {
    const root = legendasRoot(this.env);
    if (!existsSync(root)) return [];
    return readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(metaFile(e.name, this.env)))
      .map((e) => this.get(e.name)!)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  update(id: string, patch: Partial<LegendaProject>): LegendaProject {
    const current = this.get(id);
    if (!current) throw new Error(`projeto de legenda "${id}" não existe.`);
    const next = { ...current, ...patch, id, updatedAt: new Date().toISOString() };
    writeFileSync(metaFile(id, this.env), JSON.stringify(next, null, 2));
    return next;
  }

  saveCues(id: string, cues: Cue[]): void {
    writeFileSync(srtFile(id, this.env), cuesToSrt(cues));
    this.update(id, { cueCount: cues.length });
  }

  readCues(id: string): Cue[] {
    const f = srtFile(id, this.env);
    return existsSync(f) ? parseSrt(readFileSync(f, 'utf-8')) : [];
  }

  srtPath(id: string): string { return srtFile(id, this.env); }
  dir(id: string): string { return projDir(id, this.env); }

  touched(id: string): number {
    const f = metaFile(id, this.env);
    return existsSync(f) ? statSync(f).mtimeMs : 0;
  }
}
