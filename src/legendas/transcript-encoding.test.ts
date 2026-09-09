// Regressão: o Whisper local transcrevia certo, mas `transcript.json` (e os
// vizinhos `metadata.json`/`custos.json` do fluxo Legendar) eram gravados pelo
// otimizevideo com a codificação padrão do SO. No Windows (cp1252) o lado JS
// (`src/legendas/service.ts`, `readFileSync(..., 'utf-8')`) lia isso como UTF-8 e
// trocava cada acento português por `�` (U+FFFD): `Vídeo`→`V�deo`,
// `atenção`→`aten��o`. A correção fixa `encoding="utf-8"` na escrita/leitura.
//
// Este teste prova o contrato escrita→leitura: os caracteres têm de sobreviver
// exatamente, com ZERO ocorrências de U+FFFD.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

import { moduleRoot } from '../otimizevideo/config.js';
import { wordsToCues, cuesToSrt } from './srt.js';

const ACENTOS = ['Vídeo', 'atenção', 'não', 'você', 'rápido', 'mão', 'diferença', 'ação', 'informação'];
const REPLACEMENT = '�';

/** Arquivos Python do fluxo OtimizeVideo→Legendar que gravam/leem JSON de texto. */
const ARQUIVOS_FLUXO = [
  'otv/fases/transcrever.py',
  'otv/fases/ingest.py',
  'otv/util/custos.py',
];

describe('transcript.json — codificação UTF-8 (regressão dos acentos)', () => {
  it('toda chamada .read_text/.write_text no fluxo Legendar fixa encoding= explícito', () => {
    const root = moduleRoot();
    for (const rel of ARQUIVOS_FLUXO) {
      const src = readFileSync(path.join(root, rel), 'utf-8');
      // Toda linha que chama .read_text( / .write_text( deve fixar encoding= (as
      // chamadas do fluxo são de linha única, então a checagem por linha basta).
      const lines = src.split('\n').filter((l) => /\.(?:read|write)_text\(/.test(l));
      expect(lines.length, `${rel}: nenhuma chamada read_text/write_text encontrada`).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line, `${rel}: chamada sem encoding= → depende do locale do SO: ${line.trim()}`).toContain('encoding=');
      }
    }
  });

  it('a rota pura JS (palavras → cues → SRT) preserva acentos e não gera U+FFFD', () => {
    const palavras = ACENTOS.map((t, i) => ({ t, ini: i * 0.5, fim: i * 0.5 + 0.4 }));
    const srt = cuesToSrt(wordsToCues(palavras, { maxChars: 200 }));
    expect(srt).not.toContain(REPLACEMENT);
    for (const w of ACENTOS) expect(srt).toContain(w);
  });

  it('otv/fases/transcrever.py grava transcript.json em UTF-8 e o lado JS o lê intacto', () => {
    const root = moduleRoot();
    let python: string;
    try {
      python = process.platform === 'win32' ? 'python' : 'python3';
      execFileSync(python, ['--version'], { stdio: 'ignore' });
    } catch {
      // sem Python no PATH — o teste estático acima já trava a regressão.
      return;
    }

    const work = mkdtempSync(path.join(os.tmpdir(), 'transc-enc-'));
    try {
      // palavras acentuadas repetidas até passar o guard interno (>50 palavras).
      const driver = `
import sys, pathlib
sys.path.insert(0, sys.argv[1])
try:
    from otv.fases import transcrever as T
except Exception as e:
    print("SKIP:" + repr(e)); sys.exit(0)

WORDS = ${JSON.stringify(ACENTOS)}
palavras, tcur = [], 0.0
for _ in range(7):
    for w in WORDS:
        palavras.append({"t": w, "ini": round(tcur, 3), "fim": round(tcur + 0.3, 3)})
        tcur += 0.35

T.PROVEDORES = {"__test__": lambda audio, cfg: {
    "idioma": "pt", "provedor": "__test__",
    "palavras": palavras, "fins_segmento": [1.0, 2.0, 3.0],
}}

d = pathlib.Path(sys.argv[2])
(d / "audio.opus").write_bytes(b"stub")
out = T.transcrever(d, {"transcricao": "__test__", "modelos": {}}, "__test__")
print("OK:" + str(out))
`;
      const driverPath = path.join(work, 'driver.py');
      writeFileSync(driverPath, driver);
      const stdout = execFileSync(python, [driverPath, root, work], { encoding: 'utf-8' });
      if (stdout.includes('SKIP:')) return; // módulo não importável neste ambiente

      const transcriptPath = path.join(work, 'transcript.json');

      // 1) bytes reais são UTF-8 (não cp1252): "atenção" aparece nos bytes UTF-8.
      const bytes = readFileSync(transcriptPath);
      expect(bytes.includes(Buffer.from('atenção', 'utf-8'))).toBe(true);
      expect(bytes.includes(Buffer.from('informação', 'utf-8'))).toBe(true);

      // 2) lido como o service.ts faz (readFileSync utf-8) → sem U+FFFD, acentos exatos.
      const raw = readFileSync(transcriptPath, 'utf-8');
      expect(raw.includes(REPLACEMENT)).toBe(false);
      const parsed = JSON.parse(raw) as { palavras: { t: string }[] };
      const joined = parsed.palavras.map((p) => p.t).join(' ');
      for (const w of ACENTOS) expect(joined).toContain(w);

      // 3) custos.json (gravado por util/custos.py no mesmo fluxo) também é UTF-8 legível.
      const custos = readFileSync(path.join(work, 'custos.json'), 'utf-8');
      expect(custos.includes(REPLACEMENT)).toBe(false);
      expect(JSON.parse(custos)).toHaveProperty('transcrever');
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }, 30_000);
});
