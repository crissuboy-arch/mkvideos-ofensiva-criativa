// Adapter do CLI otimizevideo (`otv.py`, Python). Fase por fase, reaproveitando
// artefatos em disco. Filosofia preservada: o LLM NUNCA escolhe timestamps — a
// seleção sai da transcrição real; este adapter só orquestra as fases.
//
// Gate de custo do MKVideos nas fases que chamam provider pago (transcrever/groq,
// cenas --classificar/glm, pontuar/glm|gemini, substituir/fal). Fases locais
// (ingest, cenas, unidades, selecionar, render, narrar/inemavox) NÃO passam pelo
// gate — e são exatamente as que dá para re-rodar sem pagar de novo.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { runTool, resolvePython, LocalToolError } from '../localtools/exec.js';
import { requireAuthorization, ceilingFromEnv, recordAuthorized } from '../cost/gate.js';
import type { CostEstimate } from '../cost/types.js';
import {
  moduleRoot, trabalhoDir, saidaDir, ensureConfigYaml, OTV_ENV_KEYS, faseProviderEhPago,
} from './config.js';
import type { ModoOtv, PlanoOtv, StatusOtv } from './types.js';

const ARTEFATOS = [
  'video.mp4', 'audio.opus', 'metadata.json', 'transcript.json', 'scenes.json',
  'unidades.json', 'notas.json', 'plan.json', 'abertura.mp4', 'output.mp4',
];

/** Estimativas estáticas (README §10) — usadas só para o gate/apresentação. */
const EST_USD: Record<string, { usd: number; note: string }> = {
  transcrever: { usd: 0.03, note: 'Groq — ~US$0,04/hora de áudio' },
  classificar: { usd: 0.004, note: 'classificação visual por modelo (modo B/C)' },
  pontuar: { usd: 0.002, note: '1 chamada de LLM' },
  substituir: { usd: 0.04, note: 'geração de imagem por segmento (fal)' },
};

function envSubset(source: NodeJS.ProcessEnv, keys: readonly string[]): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const k of keys) if (source[k]) out[k] = source[k];
  return out;
}

export interface FaseResult { code: number; stdout: string; stderr: string; id?: string }

export class OtimizevideoService {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  private async run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    const py = await resolvePython(this.env);
    const root = moduleRoot();
    if (!existsSync(path.join(root, 'otv.py'))) {
      throw new LocalToolError(`módulo otimizevideo ausente em ${root} — ver modules/otimizevideo/ORIGEM.md.`, {});
    }
    const cfg = ensureConfigYaml(this.env);
    // `--config` é opção de nível raiz no otv.py (declarada antes dos subcomandos),
    // então precisa vir ANTES do subcomando: `otv --config X ingest <fonte>`.
    return runTool(py, [path.join(root, 'otv.py'), '--config', cfg, ...args], {
      cwd: root,
      // PYTHONUTF8=1: o otv.py imprime marcas Unicode (✔/✗) no status e lê/escreve
      // JSON com acento — no Windows o locale é cp1252 e isso quebrava tanto o
      // `print()` quanto o I/O de arquivo. Força UTF-8 no processo filho inteiro.
      env: { PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', ...this.env, ...envSubset(this.env, OTV_ENV_KEYS) },
      timeoutMs: 40 * 60_000,
    });
  }

  dirDo(id: string): string { return path.join(trabalhoDir(this.env), id); }

  estimarFase(fase: keyof typeof EST_USD, billable: boolean): CostEstimate {
    const e = EST_USD[fase];
    return {
      module: 'otimizevideo', phase: fase, providerId: fase,
      estimatedUsd: billable ? e.usd : 0, billable, note: e.note,
    };
  }

  // ── fases gratuitas ────────────────────────────────────────────────────────

  /** Baixa/copia o vídeo e extrai áudio. Não processa nada, não gasta. */
  async ingest(fonte: string, forcar = false): Promise<FaseResult> {
    const r = await this.run(forcar ? ['ingest', fonte, '--forcar'] : ['ingest', fonte]);
    const id = this.detectarIdNovo(r.stdout);
    return { ...r, id };
  }

  cenasLocais(id: string, forcar = false): Promise<FaseResult> {
    return this.run(forcar ? ['cenas', id, '--forcar'] : ['cenas', id]);
  }

  /** Refaz sempre, sem custo de LLM — é a base do "re-cortar sem repagar". */
  selecionar(id: string, modo: ModoOtv, alvo?: number): Promise<FaseResult> {
    const args = ['selecionar', id, '--modo', modo];
    if (alvo) args.push('--alvo', String(alvo));
    return this.run(args);
  }

  /** Re-renderiza a partir do plan.json atual (editável à mão). Sem custo de LLM. */
  render(id: string, rapido = false): Promise<FaseResult> {
    return this.run(rapido ? ['render', id, '--rapido'] : ['render', id]);
  }

  narrar(id: string, provedor = 'inemavox'): Promise<FaseResult> {
    return this.gatePagoESpawn('narrar', provedor === 'elevenlabs', ['narrar', id, '--provedor', provedor], { confirmed: false }, id, false);
  }

  // ── fases que podem gastar ─────────────────────────────────────────────────

  transcrever(id: string, provedor: string, confirmed: boolean, forcar = false): Promise<FaseResult> {
    const billable = faseProviderEhPago('transcricao', provedor);
    const args = ['transcrever', id, '--provedor', provedor];
    if (forcar) args.push('--forcar');
    return this.gatePagoESpawn('transcrever', billable, args, { confirmed }, id);
  }

  classificarCenas(id: string, provedor: string, confirmed: boolean, forcar = false): Promise<FaseResult> {
    const billable = faseProviderEhPago('visual', provedor);
    const args = ['cenas', id, '--classificar', '--provedor', provedor];
    if (forcar) args.push('--forcar');
    return this.gatePagoESpawn('classificar', billable, args, { confirmed }, id);
  }

  pontuar(id: string, modo: ModoOtv, provedor: string, confirmed: boolean, alvo?: number, forcar = false): Promise<FaseResult> {
    const billable = faseProviderEhPago('pontuacao', provedor);
    const args = ['pontuar', id, '--modo', modo, '--provedor', provedor];
    if (alvo) args.push('--alvo', String(alvo));
    if (forcar) args.push('--forcar');
    return this.gatePagoESpawn('pontuar', billable, args, { confirmed }, id);
  }

  substituir(id: string, provedor: string, confirmed: boolean, forcar = false): Promise<FaseResult> {
    const args = ['substituir', id, '--provedor', provedor];
    if (forcar) args.push('--forcar');
    return this.gatePagoESpawn('substituir', true, args, { confirmed }, id);
  }

  private async gatePagoESpawn(
    fase: string, billable: boolean, args: string[], opts: { confirmed: boolean }, id: string, applyGate = true,
  ): Promise<FaseResult> {
    if (applyGate && billable) {
      const est = this.estimarFase(fase as keyof typeof EST_USD, true);
      requireAuthorization(est, { confirmed: opts.confirmed, ceilingUsd: ceilingFromEnv(this.env) });
      recordAuthorized(est, id);
    }
    return this.run(args);
  }

  // ── leitura de estado (sem spawn) ──────────────────────────────────────────

  status(id: string): StatusOtv {
    const dir = this.dirDo(id);
    const artefatos = Object.fromEntries(ARTEFATOS.map((f) => [f, existsSync(path.join(dir, f))]));
    let plano: StatusOtv['plano'] = null;
    const planFile = path.join(dir, 'plan.json');
    if (existsSync(planFile)) {
      const p = JSON.parse(readFileSync(planFile, 'utf-8')) as PlanoOtv;
      plano = { modo: p.modo, total_s: p.total_s, segmentos: p.segmentos?.length ?? 0, alvo_s: p.alvo_s };
    }
    const custos: StatusOtv['custos'] = existsSync(path.join(dir, 'custos.json'))
      ? JSON.parse(readFileSync(path.join(dir, 'custos.json'), 'utf-8'))
      : {};
    let custoTotalUsd = 0;
    for (const v of Object.values(custos)) {
      if (v && typeof v === 'object') custoTotalUsd += Number(v.uso?.cost ?? 0) || 0;
    }
    const outLocal = path.join(dir, 'output.mp4');
    const outSaida = path.join(saidaDir(this.env), id, 'output.mp4');
    return {
      id, dir, artefatos, plano, custos,
      custoTotalUsd: Math.round(custoTotalUsd * 10000) / 10000,
      outputMp4: existsSync(outLocal) ? outLocal : existsSync(outSaida) ? outSaida : null,
    };
  }

  /** plan.json bruto — texto editável à mão (README §9). */
  planoJson(id: string): PlanoOtv | null {
    const f = path.join(this.dirDo(id), 'plan.json');
    return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf-8')) as PlanoOtv) : null;
  }

  lista(): string[] {
    const base = trabalhoDir(this.env);
    if (!existsSync(base)) return [];
    return readdirSync(base, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .sort((a, b) => statSync(path.join(base, b.name)).mtimeMs - statSync(path.join(base, a.name)).mtimeMs)
      .map((e) => e.name);
  }

  private detectarIdNovo(stdout: string): string | undefined {
    const linha = stdout.split('\n').map((l) => l.trim()).filter(Boolean).pop();
    if (linha) {
      const base = path.basename(linha.replace(/^\[ingest\]\s*/, ''));
      if (base && /^[\w.-]+$/.test(base)) return base;
    }
    return this.lista()[0];
  }
}

let singleton: OtimizevideoService | null = null;
export function otimizevideo(): OtimizevideoService {
  singleton ??= new OtimizevideoService();
  return singleton;
}
