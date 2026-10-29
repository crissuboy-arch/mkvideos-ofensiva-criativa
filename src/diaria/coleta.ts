// Coletor da diária: adaptador → Top 10 → pasta da edição (snapshot).
// Não publica nada, não corre git, não toca em nenhum módulo existente.
// O retrato (snapshot) é o que torna o ranking reprodutível.

import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

import type { FonteAdapter, HttpGet, Top10, TopItem } from './types.js';

/** Nome da pasta de uma edição, padrão do repo (edicoes/…). */
export function nomePastaEdicao(data: string): string {
  return `edicoes/${data}-top10-dia`;
}

/** Modo teste estilo SEM_* do gitbombando: sem efeitos externos.
 * Forçado por SEM_GIT=1, SEM_PUBLICAR=1 ou pela flag --teste.
 * Em modo teste a edição vai para um diretório temporário, nunca para
 * o repo — e a Fase 1 nunca corre git nem publica em nenhum modo. */
export function modoTeste(args: string[] = []): boolean {
  return (
    process.env.SEM_GIT === '1' ||
    process.env.SEM_PUBLICAR === '1' ||
    args.includes('--teste')
  );
}

/** Atribui posições de ranking (#1 = primeiro) e exige 10 itens. */
export function montarTop10(
  fonte: string,
  data: string,
  brutos: { titulo: string; resumo: string; url: string; pontos: number; comentarios: number; fonteId: string }[],
  coletadoEm: string = new Date().toISOString(),
): Top10 {
  if (brutos.length !== 10) {
    throw new Error(
      `coleta devolveu ${brutos.length} itens; uma edição precisa de 10 (fonte: ${fonte})`,
    );
  }
  const itens: TopItem[] = brutos.map((b, i) => ({ ...b, posicao: i + 1 }));
  return { fonte, data, coletadoEm, itens };
}

/** Corre um adaptador e monta o Top 10 do dia. */
export async function coletarTop10(
  adapter: FonteAdapter,
  data: string,
  httpGet: HttpGet,
): Promise<Top10> {
  const brutos = await adapter.coletar(data, httpGet);
  return montarTop10(adapter.id, data, brutos);
}

/** Escreve a pasta da edição: top10.json (ranking), snapshot.json
 * (retrato: quando, fonte, ids) e rodada.log. Devolve o caminho. */
export function escreverEdicao(baseDir: string, top10: Top10): string {
  const dir = path.join(baseDir, nomePastaEdicao(top10.data));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'top10.json'), `${JSON.stringify(top10, null, 2)}\n`);
  writeFileSync(
    path.join(dir, 'snapshot.json'),
    `${JSON.stringify(
      {
        fonte: top10.fonte,
        data: top10.data,
        coletadoEm: top10.coletadoEm,
        fonteIds: top10.itens.map((i) => i.fonteId),
        totalItens: top10.itens.length,
      },
      null,
      2,
    )}\n`,
  );
  appendFileSync(
    path.join(dir, 'rodada.log'),
    `${top10.coletadoEm} coleta fonte=${top10.fonte} itens=${top10.itens.length}\n`,
  );
  return dir;
}

/** Coleta completa: adaptador → Top 10 → pasta da edição.
/// Em modo teste, `baseDir` é ignorado e a edição vai para o tmpdir. */
export async function coletarEEditar(
  adapter: FonteAdapter,
  data: string,
  httpGet: HttpGet,
  opts: { baseDir?: string; teste?: boolean } = {},
): Promise<{ dir: string; top10: Top10 }> {
  const top10 = await coletarTop10(adapter, data, httpGet);
  const base = opts.teste
    ? path.join(tmpdir(), 'mkivideos-diaria-teste')
    : (opts.baseDir ?? process.cwd());
  const dir = escreverEdicao(base, top10);
  return { dir, top10 };
}
