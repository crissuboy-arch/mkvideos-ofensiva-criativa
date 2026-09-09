// Subcomando `mkivideos otimizevideo …` — fase por fase, com gate de custo.

import { otimizevideo } from './service.js';
import type { ModoOtv } from './types.js';
import { CostAuthorizationRequiredError, CostCeilingExceededError } from '../cost/types.js';

function optVal(a: string[], n: string): string | undefined {
  const i = a.indexOf(n);
  return i >= 0 ? a[i + 1] : undefined;
}

export function otimizevideoUsage(): string {
  return [
    'mkivideos otimizevideo — Otimizar Vídeo (motor: otimizevideo/otv)',
    '',
    '  mkivideos otimizevideo ingest <url-ou-arquivo>',
    '  mkivideos otimizevideo transcrever <id> [--provedor whisper_local|groq] [--autorizo-gasto]   # default: whisper_local (offline)',
    '  mkivideos otimizevideo cenas <id>                    # local, grátis',
    '  mkivideos otimizevideo classificar <id> [--provedor glm|gemini|claude_cli] [--autorizo-gasto]',
    '  mkivideos otimizevideo pontuar <id> [--modo A|B|C|N] [--alvo 120] [--provedor local_heuristic|glm|gemini|ollama|claude_cli]   # default: local_heuristic (offline, heurística)',
    '  mkivideos otimizevideo selecionar <id> [--modo A] [--alvo 120]     # grátis, refaz sempre',
    '  mkivideos otimizevideo render <id> [--rapido]                      # grátis, usa o plan.json atual',
    '  mkivideos otimizevideo narrar <id> [--provedor inemavox|elevenlabs] [--autorizo-gasto]',
    '  mkivideos otimizevideo status <id> | custo <id> | lista',
    '',
    'O LLM nunca escolhe timestamps. selecionar/render/narrar(inemavox) não pagam LLM',
    '— dá para re-cortar e re-renderizar quantas vezes quiser sem gastar de novo.',
    'Pipeline 100% offline (custo US$ 0): ingest → transcrever (whisper_local) → cenas',
    '→ pontuar (local_heuristic) → selecionar → render.',
  ].join('\n');
}

export async function runOtimizevideoCli(args: string[]): Promise<string> {
  const svc = otimizevideo();
  const [sub, ...rest] = args;
  if (!sub) return otimizevideoUsage();
  const id = rest[0];
  const confirmed = rest.includes('--autorizo-gasto');
  const modo = (optVal(rest, '--modo') ?? 'A') as ModoOtv;
  const alvo = optVal(rest, '--alvo') ? Number(optVal(rest, '--alvo')) : undefined;
  const forcar = rest.includes('--forcar');
  // Uma fase que retorna code != 0 (inclui crash nativo do Python, ex.: segfault
  // por falta de memória → runTool devolve code≠0 + stderr) NUNCA pode ser
  // apresentada como concluída. Lança → cli.ts imprime "❌ …" e sai com código 1.
  const out = (r: { code?: number; stdout: string; stderr: string; id?: string }): string => {
    if (r.code !== undefined && r.code !== 0) {
      const detalhe = [r.stderr, r.stdout].map((s) => (s ?? '').trim()).filter(Boolean).join('\n').slice(0, 2000);
      throw new Error(
        `fase "${sub}" falhou (código ${r.code})`
        + (detalhe ? `:\n${detalhe}` : ' — o processo não deixou saída (provável crash; confira a memória disponível).'),
      );
    }
    return (r.id ? `id: ${r.id}\n` : '') + (r.stdout || r.stderr);
  };

  try {
    switch (sub) {
      case 'ingest': {
        if (!id) return 'informe a URL ou o caminho do arquivo.';
        return out(await svc.ingest(id, forcar));
      }
      case 'transcrever':
        if (!id) return 'informe o id.';
        // default offline: whisper local (o modelo é escolhido com segurança por RAM — ver config.ts).
        return out(await svc.transcrever(id, optVal(rest, '--provedor') ?? 'whisper_local', confirmed, forcar));
      case 'cenas':
        if (!id) return 'informe o id.';
        return out(await svc.cenasLocais(id, forcar));
      case 'classificar':
        if (!id) return 'informe o id.';
        return out(await svc.classificarCenas(id, optVal(rest, '--provedor') ?? 'glm', confirmed, forcar));
      case 'pontuar':
        if (!id) return 'informe o id.';
        // default offline: pontuação heurística local (determinística, sem LLM, sem custo).
        return out(await svc.pontuar(id, modo, optVal(rest, '--provedor') ?? 'local_heuristic', confirmed, alvo, forcar));
      case 'selecionar':
        if (!id) return 'informe o id.';
        return out(await svc.selecionar(id, modo, alvo));
      case 'render':
        if (!id) return 'informe o id.';
        return out(await svc.render(id, rest.includes('--rapido')));
      case 'narrar':
        if (!id) return 'informe o id.';
        return out(await svc.narrar(id, optVal(rest, '--provedor') ?? 'inemavox'));
      case 'status': {
        if (!id) return 'informe o id.';
        const s = svc.status(id);
        return JSON.stringify(s, null, 2);
      }
      case 'custo': {
        if (!id) return 'informe o id.';
        return `gasto real acumulado: US$ ${svc.status(id).custoTotalUsd.toFixed(4)}`;
      }
      case 'lista':
        return svc.lista().join('\n') || '(vazio)';
      default:
        return otimizevideoUsage();
    }
  } catch (e) {
    if (e instanceof CostAuthorizationRequiredError || e instanceof CostCeilingExceededError) return `❌ ${e.message}`;
    throw e;
  }
}
