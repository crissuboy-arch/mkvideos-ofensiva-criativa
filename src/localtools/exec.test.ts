// Regressão: um subprocesso que falha SEM escrever em stderr (crash nativo,
// exit code alto) não podia "sumir". Antes runTool devolvia { code, stderr: '' }
// e quem consumia via `x || y` via string vazia como "sem erro". Agora o stderr
// carrega sempre uma mensagem útil.

import { describe, it, expect } from 'vitest';

import { runTool } from './exec.js';

describe('runTool — falha nunca fica silenciosa', () => {
  it('comando que sai com código != 0 e sem stderr → devolve code≠0 + mensagem útil', async () => {
    // `node -e process.exit(3)` não escreve nada em stdout/stderr.
    const r = await runTool(process.execPath, ['-e', 'process.exit(3)'], { cwd: process.cwd(), timeoutMs: 10_000 });
    expect(r.code).not.toBe(0);
    expect((r.stderr || '').length).toBeGreaterThan(0);
  });

  it('comando que escreve em stderr → o stderr real é preservado', async () => {
    const r = await runTool(process.execPath, ['-e', 'console.error("boom-detalhe"); process.exit(1)'], { cwd: process.cwd(), timeoutMs: 10_000 });
    expect(r.code).not.toBe(0);
    expect(r.stderr).toContain('boom-detalhe');
  });

  it('comando bem-sucedido → code 0 e stdout', async () => {
    const r = await runTool(process.execPath, ['-e', 'process.stdout.write("ok")'], { cwd: process.cwd(), timeoutMs: 10_000 });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('ok');
  });
});
