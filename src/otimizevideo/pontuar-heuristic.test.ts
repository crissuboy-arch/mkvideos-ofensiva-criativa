// Testa o provedor `local_heuristic` do otv/fases/pontuar.py: pontuação 100%
// offline, determinística, sem LLM. Roda o Python real do módulo vendorizado
// sobre um unidades.json sintético e verifica o contrato:
//  - notas.json produzido e válido (schema de validar_notas);
//  - resultado IDÊNTICO entre duas execuções (determinístico);
//  - CTA/saudação recebem nota baixa; trecho-tese recebe nota alta;
//  - gancho aponta para o começo, fecho para o fim, sem CTA;
//  - acentos preservados (UTF-8), zero U+FFFD.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

import { moduleRoot } from './config.js';

const UNIDADES = [
  { id: 0, ini: 0.0, fim: 4.0, dur: 4.0, texto: 'Se você sempre errou nisso, presta atenção porque a diferença é enorme.', visual: 'outro' },
  { id: 1, ini: 4.0, fim: 5.2, dur: 1.2, texto: 'Curte e se inscreve no canal, ativa o sino.', visual: 'outro' },
  { id: 2, ini: 5.2, fim: 12.0, dur: 6.8, texto: 'O primeiro passo é medir o resultado real, com número, antes de mudar qualquer coisa.', visual: 'demo_tela' },
  { id: 3, ini: 12.0, fim: 19.0, dur: 7.0, texto: 'A conclusão é simples: aplica um passo de cada vez e mede de novo. Isso muda tudo.', visual: 'outro' },
  { id: 4, ini: 19.0, fim: 21.0, dur: 2.0, texto: 'Valeu, até a próxima, um abraço.', visual: 'outro' },
];
const META = { id: 'x', titulo: 'Como medir resultado de verdade', duracao_s: 21.0 };

function haPython(): string | null {
  for (const c of process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python']) {
    try { execFileSync(c, ['--version'], { stdio: 'ignore' }); return c; } catch { /* tenta o próximo */ }
  }
  return null;
}

function rodarPontuar(dir: string, py: string, root: string): Record<string, unknown> {
  const driver = `
import sys, json, pathlib
sys.path.insert(0, sys.argv[1])
from otv.fases.pontuar import pontuar
d = pathlib.Path(sys.argv[2])
cfg = {"pontuacao": "local_heuristic", "selecao": {"alvo_s": 120}}
out = pontuar(d, cfg, "A", None, "local_heuristic", forcar=True)
sys.stdout.buffer.write(pathlib.Path(out).read_bytes())
`;
  const driverPath = path.join(dir, '_driver.py');
  writeFileSync(driverPath, driver);
  const raw = execFileSync(py, [driverPath, root, dir], { encoding: 'buffer' });
  const text = raw.toString('utf-8');
  expect(text.includes('�')).toBe(false); // acentos preservados
  return JSON.parse(text);
}

describe('otv pontuar --provedor local_heuristic (offline, determinístico)', () => {
  const py = haPython();
  const root = moduleRoot();

  it.runIf(py)('pontua deterministicamente, sem LLM, com o schema esperado', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'otv-heur-'));
    try {
      writeFileSync(path.join(dir, 'unidades.json'), JSON.stringify({ unidades: UNIDADES }));
      writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify(META));

      const a = rodarPontuar(dir, py!, root);
      const b = rodarPontuar(dir, py!, root);

      // determinístico
      expect(a).toEqual(b);

      // schema
      expect(a.provedor).toBe('local_heuristic');
      expect((a.uso as Record<string, number>).cost).toBe(0);
      const notas = a.notas as { id: number; nota: number; motivo: string }[];
      expect(notas).toHaveLength(UNIDADES.length);
      for (const n of notas) {
        expect(n.nota).toBeGreaterThanOrEqual(0);
        expect(n.nota).toBeLessThanOrEqual(10);
      }

      // conteúdo: CTA/saudação baixos, tese alta
      const nota = Object.fromEntries(notas.map((n) => [n.id, n.nota]));
      expect(nota[1]).toBeLessThanOrEqual(2); // "curte e se inscreve…"
      expect(nota[4]).toBeLessThanOrEqual(2); // "valeu, até a próxima…"
      expect(nota[0]).toBeGreaterThanOrEqual(7); // hook forte
      expect(nota[2]).toBeGreaterThanOrEqual(7); // "primeiro passo… resultado… número"

      // gancho começa cedo e não é CTA; fecho termina e não é CTA
      const gancho = a.gancho as number[];
      const fecho = a.fecho as number[];
      expect(gancho.length).toBeGreaterThanOrEqual(1);
      expect(gancho).not.toContain(1);
      expect(gancho).not.toContain(4);
      expect(fecho).not.toContain(1);
      expect(fecho).not.toContain(4);
      expect(fecho).toContain(3); // a conclusão
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 20_000);
});
