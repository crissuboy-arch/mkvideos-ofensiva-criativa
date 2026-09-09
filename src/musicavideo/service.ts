// Adapter do CLI musicavideo (Python, stdlib only). Cada comando é um processo
// curto — sem servidor HTTP. Este serviço spawna `python src/main.py <args>` e
// lê o estado direto dos JSONs em disco (mais robusto que parsear stdout).
//
// REGRA CRÍTICA preservada: `faz` (a única ação que gasta) só roda depois de
// (1) a parte já estar `aprovado` no estado.json — gate embutido no próprio
// musicavideo (comando `ok`) — e (2) `confirmado: true` explícito aqui — gate
// do MKVideos, camada extra. Nunca passamos `--aprovar` (que pularia o gate
// `ok`) nem `--sim`/`--autorizo-pago` sem pedido explícito do chamador.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

import { runTool, resolvePython, LocalToolError } from '../localtools/exec.js';
import { requireAuthorization, ceilingFromEnv, recordAuthorized } from '../cost/gate.js';
import type { CostEstimate } from '../cost/types.js';
import { moduleRoot, outDir, MUSICAVIDEO_ENV_KEYS, motorEhPago } from './config.js';
import type {
  EstadoMusicavideo, FazInput, IndiceLinha, ParteMusicavideo, PlanoInput, PlanoMusicavideo,
} from './types.js';

function envSubset(source: NodeJS.ProcessEnv, keys: readonly string[]): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const k of keys) if (source[k]) out[k] = source[k];
  return out;
}

export class MusicavideoService {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  private async python(): Promise<string> { return resolvePython(this.env); }

  private slugDir(slug: string): string { return path.join(outDir(this.env), slug); }

  private async run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    const py = await this.python();
    const root = moduleRoot();
    if (!existsSync(path.join(root, 'src', 'main.py'))) {
      throw new LocalToolError(`módulo musicavideo ausente em ${root} — ver modules/musicavideo/ORIGEM.md.`, {});
    }
    return runTool(py, [path.join(root, 'src', 'main.py'), ...args], {
      cwd: root,
      // PYTHONUTF8=1: erros/mensagens do CLI têm acento; no Windows o console é
      // cp1252 e o texto sai ilegível (ou o `print` chega a quebrar). Força UTF-8.
      env: {
        PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8',
        ...this.env, ...envSubset(this.env, MUSICAVIDEO_ENV_KEYS), MUSICAVIDEO_OUT: outDir(this.env),
      },
      timeoutMs: 20 * 60_000,
    });
  }

  // ── leitura direta de disco (sem spawn) ────────────────────────────────────

  estado(slug: string): EstadoMusicavideo | null {
    const f = path.join(this.slugDir(slug), 'estado.json');
    return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf-8')) as EstadoMusicavideo) : null;
  }

  plano(slug: string): PlanoMusicavideo | null {
    const f = path.join(this.slugDir(slug), 'plano.json');
    return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf-8')) as PlanoMusicavideo) : null;
  }

  planoMd(slug: string): string | null {
    const f = path.join(this.slugDir(slug), 'PLANO.md');
    return existsSync(f) ? readFileSync(f, 'utf-8') : null;
  }

  pacoteMd(slug: string): string | null {
    const f = path.join(this.slugDir(slug), 'PACOTE.md');
    return existsSync(f) ? readFileSync(f, 'utf-8') : null;
  }

  indice(limite = 10): IndiceLinha[] {
    const f = path.join(outDir(this.env), 'index.jsonl');
    if (!existsSync(f)) return [];
    const linhas = readFileSync(f, 'utf-8').split('\n').filter((l) => l.trim())
      .map((l) => JSON.parse(l) as IndiceLinha);
    return linhas.reverse().slice(0, limite);
  }

  busca(termo: string): IndiceLinha[] {
    const t = termo.toLowerCase();
    return this.indice(10_000).filter((l) =>
      l.titulo?.toLowerCase().includes(t) || l.solicitacao?.toLowerCase().includes(t) ||
      l.genero?.toLowerCase().includes(t) || (l.tags ?? []).some((tag) => tag.toLowerCase().includes(t)));
  }

  /** Estimativa de custo das partes pendentes de `faz`, lida do estado.json (fonte de verdade). */
  estimarCusto(slug: string, partes?: ParteMusicavideo[]): CostEstimate {
    const estado = this.estado(slug);
    const plano = this.plano(slug);
    if (!estado || !plano) throw new Error(`produção "${slug}" não encontrada — rode "plano" primeiro.`);
    const alvo = partes ?? (['musica', 'capa', 'clipe'] as ParteMusicavideo[])
      .filter((p) => ['aprovado', 'erro'].includes(estado.partes[p].estado));
    let total = 0;
    const motores: string[] = [];
    for (const p of alvo) {
      total += estado.partes[p].custo_estimado_usd;
      motores.push(`${p}=${plano[p].motor}`);
    }
    return {
      module: 'musicavideo',
      phase: alvo.join('+') || '(nada pendente)',
      providerId: motores.join(', ') || '—',
      estimatedUsd: Math.round(total * 10000) / 10000,
      billable: total > 0,
      note: alvo.some((p) => motorEhPago(plano[p].motor)) ? 'inclui provider pago' : undefined,
    };
  }

  // ── ações (spawnam o CLI) ───────────────────────────────────────────────────

  async criarPlano(input: PlanoInput): Promise<{ code: number; stdout: string; stderr: string }> {
    const args = ['plano', input.solicitacao];
    if (input.slug) args.push(input.slug);
    if (input.pesquisa) args.push('--pesquisa');
    if (input.estilo) args.push('--estilo', input.estilo);
    if (input.idioma) args.push('--idioma', input.idioma);
    if (input.letraArquivo) { args.push('--letra', input.letraArquivo); if (input.letraFinal) args.push('--letra-final'); }
    if (input.faixaProntaArquivo) args.push('--faixa-pronta', input.faixaProntaArquivo);
    if (input.ritmo) args.push('--ritmo', input.ritmo);
    if (input.forca) args.push('--forca');
    for (const [parte, motor] of Object.entries(input.motor ?? {})) args.push('--motor', `${parte}=${motor}`);
    return this.run(args);
  }

  ajusta(slug: string, parte: ParteMusicavideo, instrucao: string, refaz = false): Promise<{ code: number; stdout: string; stderr: string }> {
    const args = ['ajusta', slug, parte, instrucao];
    if (refaz) args.push('--refaz');
    return this.run(args);
  }

  /** Portão do PLANO — precisa rodar antes de `faz` conseguir gastar nessa parte. */
  ok(slug: string, parte: ParteMusicavideo): Promise<{ code: number; stdout: string; stderr: string }> {
    return this.run(['ok', slug, parte]);
  }

  /** A ÚNICA ação que gasta dinheiro. Gate de custo obrigatório antes do spawn. */
  async faz(input: FazInput): Promise<{ code: number; stdout: string; stderr: string }> {
    const estimate = this.estimarCusto(input.slug, input.partes);
    requireAuthorization(estimate, { confirmed: input.confirmado, ceilingUsd: ceilingFromEnv(this.env) });

    const args = ['faz', input.slug];
    if (input.partes?.length === 1) args.push(input.partes[0]);
    if (input.semRevisao) args.push('--sem-revisao');
    let usaMotorPago = false;
    for (const [parte, motor] of Object.entries(input.motorOverride ?? {})) {
      args.push('--motor', `${parte}=${motor}`);
      if (motorEhPago(motor)) usaMotorPago = true;
    }
    // O próprio musicavideo recusa `--motor` pago sem esta flag (ver README §Motores) —
    // só a incluímos quando o chamador de fato pediu um motor pago, nunca por padrão.
    if (usaMotorPago) args.push('--autorizo-pago');

    if (estimate.billable) recordAuthorized(estimate, input.slug);
    return this.run(args);
  }

  revisa(slug: string, parte?: ParteMusicavideo): Promise<{ code: number; stdout: string; stderr: string }> {
    return this.run(parte ? ['revisa', slug, parte] : ['revisa', slug]);
  }

  aprova(slug: string, parte: ParteMusicavideo, faixa?: 1 | 2): Promise<{ code: number; stdout: string; stderr: string }> {
    const args = ['aprova', slug, parte];
    if (faixa) args.push('--faixa', String(faixa));
    return this.run(args);
  }

  reprova(slug: string, parte: ParteMusicavideo, shots?: string): Promise<{ code: number; stdout: string; stderr: string }> {
    const args = ['reprova', slug, parte];
    if (shots) args.push(shots);
    return this.run(args);
  }

  pacote(slug: string): Promise<{ code: number; stdout: string; stderr: string }> {
    return this.run(['pacote', slug]);
  }

  /** Caminhos de artefato conhecidos que já existem em disco (para download/preview). */
  artefatos(slug: string): Record<string, string> {
    const dir = this.slugDir(slug);
    const candidatos = [
      'faixa-1.mp3', 'faixa-2.mp3', 'capa.png', 'clipe.mp4', 'clipe-1.mp4', 'clipe-2.mp4',
      'revisao/contato-clipe.jpg', 'PACOTE.md', 'PLANO.md',
    ];
    const found: Record<string, string> = {};
    for (const rel of candidatos) {
      const abs = path.join(dir, rel);
      if (existsSync(abs)) found[rel] = abs;
    }
    return found;
  }
}

let singleton: MusicavideoService | null = null;
export function musicavideo(): MusicavideoService {
  singleton ??= new MusicavideoService();
  return singleton;
}
