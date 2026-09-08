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
    '  mkivideos otimizevideo transcrever <id> [--provedor groq|whisper_local] [--autorizo-gasto]',
    '  mkivideos otimizevideo cenas <id>                    # local, grátis',
    '  mkivideos otimizevideo classificar <id> [--provedor glm|gemini|claude_cli] [--autorizo-gasto]',
    '  mkivideos otimizevideo pontuar <id> [--modo A|B|C|N] [--alvo 120] [--provedor glm|ollama|claude_cli] [--autorizo-gasto]',
    '  mkivideos otimizevideo selecionar <id> [--modo A] [--alvo 120]     # grátis, refaz sempre',
    '  mkivideos otimizevideo render <id> [--rapido]                      # grátis, usa o plan.json atual',
    '  mkivideos otimizevideo narrar <id> [--provedor inemavox|elevenlabs] [--autorizo-gasto]',
    '  mkivideos otimizevideo status <id> | custo <id> | lista',
    '',
    'O LLM nunca escolhe timestamps. selecionar/render/narrar(inemavox) não pagam LLM',
    '— dá para re-cortar e re-renderizar quantas vezes quiser sem gastar de novo.',
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
  const out = (r: { stdout: string; stderr: string; id?: string }): string =>
    (r.id ? `id: ${r.id}\n` : '') + (r.stdout || r.stderr);

  try {
    switch (sub) {
      case 'ingest': {
        if (!id) return 'informe a URL ou o caminho do arquivo.';
        return out(await svc.ingest(id, forcar));
      }
      case 'transcrever':
        if (!id) return 'informe o id.';
        return out(await svc.transcrever(id, optVal(rest, '--provedor') ?? 'groq', confirmed, forcar));
      case 'cenas':
        if (!id) return 'informe o id.';
        return out(await svc.cenasLocais(id, forcar));
      case 'classificar':
        if (!id) return 'informe o id.';
        return out(await svc.classificarCenas(id, optVal(rest, '--provedor') ?? 'glm', confirmed, forcar));
      case 'pontuar':
        if (!id) return 'informe o id.';
        return out(await svc.pontuar(id, modo, optVal(rest, '--provedor') ?? 'glm', confirmed, alvo, forcar));
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
