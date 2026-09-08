// Biblioteca — índice unificado, SÓ LEITURA, do que já foi produzido localmente
// por todos os módulos: `gerar`, content2video (URL → Vídeo), musicavideo,
// otimizevideo e legendas. Varre o disco direto (sem subir processo nenhum).
//
// O formato de item foi inspirado no `manifest.json` do musicavideo-pub
// (um card por produção) — ver modules/musicavideo-pub/ORIGEM.md — mas aqui
// nada depende de Hugging Face/Vercel: é o acervo local.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { dataRoot } from '../localtools/datadir.js';

export type LibrarySource = 'gerar' | 'url2video' | 'musicavideo' | 'otimizevideo' | 'legendas';

export interface LibraryItem {
  source: LibrarySource;
  id: string;
  title: string;
  videoPath: string;
  thumbnailPath?: string;
  sizeBytes: number;
  modifiedAt: string;
  meta?: Record<string, unknown>;
}

function mp4sIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.mp4')).map((f) => path.join(dir, f));
}

function item(source: LibrarySource, id: string, videoPath: string, extra: Partial<LibraryItem> = {}): LibraryItem {
  const st = statSync(videoPath);
  return {
    source, id, title: extra.title ?? id,
    videoPath, thumbnailPath: extra.thumbnailPath,
    sizeBytes: st.size, modifiedAt: st.mtime.toISOString(),
    meta: extra.meta,
  };
}

export interface ScanOptions {
  /** Raiz do MKVideos (para achar `renders/` e `modules/content2video/output`). */
  repoRoot?: string;
  env?: NodeJS.ProcessEnv;
}

export function scanLibrary(opts: ScanOptions = {}): LibraryItem[] {
  const env = opts.env ?? process.env;
  const root = opts.repoRoot ?? process.cwd();
  const data = dataRoot(env);
  const items: LibraryItem[] = [];

  // 1. `gerar` — renders/*.mp4
  for (const v of mp4sIn(path.join(root, 'renders'))) {
    items.push(item('gerar', path.basename(v, '.mp4'), v));
  }

  // 2. content2video — modules/content2video/output/content2video/<slug>/renders/*.mp4
  const c2vBase = path.join(root, 'modules', 'content2video', 'output', 'content2video');
  if (existsSync(c2vBase)) {
    for (const slug of readdirSync(c2vBase)) {
      const rd = path.join(c2vBase, slug, 'renders');
      const thumbs = ['snapshots/contact-sheet.jpg', 'snapshots/visual-gate.png']
        .map((r) => path.join(c2vBase, slug, r)).find(existsSync);
      for (const v of mp4sIn(rd)) items.push(item('url2video', slug, v, { title: slug, thumbnailPath: thumbs }));
    }
  }

  // 3. musicavideo — .mkvideos-data/musicavideo/<slug>/clipe*.mp4  (+ index.jsonl)
  const mvdBase = path.join(data, 'musicavideo');
  const idx = new Map<string, Record<string, unknown>>();
  const idxFile = path.join(mvdBase, 'index.jsonl');
  if (existsSync(idxFile)) {
    for (const l of readFileSync(idxFile, 'utf-8').split('\n').filter((x) => x.trim())) {
      try { const o = JSON.parse(l) as { slug: string }; idx.set(o.slug, o); } catch { /* ignora linha ruim */ }
    }
  }
  if (existsSync(mvdBase)) {
    for (const slug of readdirSync(mvdBase)) {
      const dir = path.join(mvdBase, slug);
      if (!statSync(dir).isDirectory()) continue;
      const capa = path.join(dir, 'capa.png');
      const meta = idx.get(slug);
      for (const v of ['clipe.mp4', 'clipe-1.mp4', 'clipe-2.mp4'].map((f) => path.join(dir, f)).filter(existsSync)) {
        items.push(item('musicavideo', `${slug}/${path.basename(v)}`, v, {
          title: (meta?.titulo as string) ?? slug,
          thumbnailPath: existsSync(capa) ? capa : undefined,
          meta,
        }));
      }
    }
  }

  // 4. otimizevideo — saida/<id>/output.mp4 e trabalho/<id>/output.mp4
  for (const sub of ['saida', 'trabalho']) {
    const base = path.join(data, 'otimizevideo', sub);
    if (!existsSync(base)) continue;
    for (const id of readdirSync(base)) {
      const v = path.join(base, id, 'output.mp4');
      if (existsSync(v)) items.push(item('otimizevideo', id, v, { title: id }));
    }
  }

  // 5. legendas — .mkvideos-data/legendas/<id>/final-legendado.mp4
  const legBase = path.join(data, 'legendas');
  if (existsSync(legBase)) {
    for (const id of readdirSync(legBase)) {
      const dir = path.join(legBase, id);
      const meta = path.join(dir, 'project.json');
      const v = path.join(dir, 'final-legendado.mp4');
      if (!existsSync(v)) continue;
      let title = id;
      try { title = (JSON.parse(readFileSync(meta, 'utf-8')) as { title?: string }).title ?? id; } catch { /* ok */ }
      items.push(item('legendas', id, v, { title }));
    }
  }

  return items.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

/** Dedup de caminho para servir mídia com segurança (só arquivos dentro dos diretórios conhecidos). */
export function isLibraryPathAllowed(target: string, opts: ScanOptions = {}): boolean {
  const env = opts.env ?? process.env;
  const root = opts.repoRoot ?? process.cwd();
  const abs = path.resolve(target);
  const roots = [
    path.join(root, 'renders'),
    path.join(root, 'modules', 'content2video', 'output'),
    dataRoot(env),
  ].map((r) => path.resolve(r) + path.sep);
  return roots.some((r) => abs.startsWith(r)) && !abs.includes('..');
}
