// Verificação de saúde do ambiente (`mkivideos doctor`).
// Cobre o motor offline (gerar) e a funcionalidade URL → Vídeo (content2video).

import { exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { moduleRoot } from '../engines/content2video/config.js';

export interface Check {
  name: string;
  ok: boolean;
  required: boolean;
  detail: string;
  /** Grupo para agrupar na saída. */
  group: 'node' | 'mídia' | 'IA' | 'motor' | 'módulos' | 'ambiente';
}

export interface DoctorReport {
  ok: boolean;
  checks: Check[];
}

// `cmd`/`args` são literais fixos deste arquivo (nunca entrada do usuário).
function tryExec(cmd: string, args: string[], timeoutMs = 5000): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    try {
      exec(`${cmd} ${args.join(' ')}`.trim(), { timeout: timeoutMs, windowsHide: true }, (err, stdout, stderr) => {
        resolve({ ok: !err, out: `${stdout || ''}${stderr || ''}`.trim() });
      });
    } catch (e) {
      resolve({ ok: false, out: (e as Error).message });
    }
  });
}

/** Primeira linha não vazia da saída. */
function firstLine(s: string): string {
  return s.split(/\r?\n/).find((l) => l.trim()) ?? '';
}

export function parseNodeMajor(version: string): number {
  const m = version.match(/v?(\d+)/);
  return m ? Number(m[1]) : 0;
}

export async function runDoctor(env: NodeJS.ProcessEnv = process.env): Promise<DoctorReport> {
  const checks: Check[] = [];
  const add = (c: Check): void => { checks.push(c); };

  // ── Node ──────────────────────────────────────────────────────────────────
  const nodeMajor = parseNodeMajor(process.version);
  add({
    name: 'Node.js',
    group: 'node',
    required: true,
    ok: nodeMajor >= 20,
    detail: `${process.version} — MKVideos requer ≥ 20; URL → Vídeo (content2video) requer ≥ 22${nodeMajor < 22 ? ' ⚠' : ''}`,
  });

  const npx = await tryExec(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--version']);
  add({
    name: 'npx',
    group: 'node',
    required: true,
    ok: npx.ok,
    detail: npx.ok ? `v${firstLine(npx.out)} (HyperFrames roda via npx)` : 'não encontrado no PATH',
  });

  // ── mídia ─────────────────────────────────────────────────────────────────
  for (const bin of ['ffmpeg', 'ffprobe'] as const) {
    const r = await tryExec(bin, ['-version']);
    add({
      name: bin,
      group: 'mídia',
      required: true,
      ok: r.ok,
      detail: r.ok ? firstLine(r.out) : `não encontrado no PATH (winget install Gyan.FFmpeg)`,
    });
  }

  // ── IA (só para URL → Vídeo) ──────────────────────────────────────────────
  const provider = (env.AI_PROVIDER || 'codex').toLowerCase();
  if (provider === 'openai') {
    add({
      name: 'OpenAI API key',
      group: 'IA',
      required: false,
      ok: Boolean(env.OPENAI_API_KEY),
      detail: env.OPENAI_API_KEY ? 'OPENAI_API_KEY definida' : 'defina OPENAI_API_KEY no .env (AI_PROVIDER=openai)',
    });
  } else {
    const codex = await tryExec('codex', ['--version']);
    let ready = false;
    let detail = 'não encontrado — `npm i -g @openai/codex` e `codex login` (só URL → Vídeo)';
    if (codex.ok) {
      const status = await tryExec('codex', ['login', 'status'], 6000);
      ready = status.ok && /logged in/i.test(status.out);
      detail = ready ? `${firstLine(codex.out)} — sessão OAuth conectada` : `${firstLine(codex.out)} — rode \`codex login\``;
    }
    add({ name: 'Codex CLI', group: 'IA', required: false, ok: ready, detail });
  }

  // ── motor content2video ──────────────────────────────────────────────────
  const root = moduleRoot();
  const hasServer = existsSync(path.join(root, 'app', 'server.mjs'));
  add({
    name: 'modules/content2video',
    group: 'motor',
    required: false,
    ok: hasServer,
    detail: hasServer ? `vendorizado em ${path.relative(process.cwd(), root) || '.'}` : 'ausente — URL → Vídeo indisponível (ver modules/content2video/ORIGEM.md)',
  });
  if (env.MKIVIDEOS_C2V_URL) {
    add({
      name: 'motor externo',
      group: 'motor',
      required: false,
      ok: true,
      detail: `MKIVIDEOS_C2V_URL=${env.MKIVIDEOS_C2V_URL} (o MKVideos não sobe processo)`,
    });
  }

  // ── módulos novos (Música/Otimizar/Legendar) ─────────────────────────────
  const repoRoot = process.cwd();
  const modChecks: [string, string][] = [
    ['musicavideo', 'src/main.py'],
    ['otimizevideo', 'otv.py'],
    ['videosub', 'ORIGEM.md'],
    ['musicavideo-pub', 'ORIGEM.md'],
  ];
  for (const [name, marker] of modChecks) {
    const present = existsSync(path.join(repoRoot, 'modules', name, marker));
    add({
      name: `modules/${name}`, group: 'módulos', required: false, ok: present,
      detail: present ? 'vendorizado' : `ausente — funcionalidade correspondente indisponível`,
    });
  }

  const py = await tryExec(process.platform === 'win32' ? 'python' : 'python3', ['--version']);
  const py2 = py.ok ? py : await tryExec(process.platform === 'win32' ? 'python3' : 'python', ['--version']);
  add({
    name: 'Python 3', group: 'módulos', required: false, ok: py2.ok,
    detail: py2.ok ? `${firstLine(py2.out)} (Música + Videoclipe e Otimizar Vídeo são Python)` : 'não encontrado — instale Python 3.10+',
  });
  if (py2.ok) {
    const pyyaml = await tryExec(process.platform === 'win32' ? 'python' : 'python3', ['-c', '"import yaml, requests"']);
    add({
      name: 'deps pip do otimizevideo', group: 'módulos', required: false, ok: pyyaml.ok,
      detail: pyyaml.ok ? 'pyyaml + requests OK' : 'rode: pip install -r modules/otimizevideo/requirements.txt',
    });
  }
  const ytdlp = await tryExec('yt-dlp', ['--version']);
  add({
    name: 'yt-dlp', group: 'módulos', required: false, ok: ytdlp.ok,
    detail: ytdlp.ok ? `v${firstLine(ytdlp.out)}` : 'opcional — só para "Otimizar Vídeo" a partir de URL de vídeo',
  });

  // chaves de provider (lidas do .env centralizado)
  const keyChecks: [string, string][] = [
    ['KIE_API_KEY', 'música paga (Suno via kie.ai) — Música + Videoclipe'],
    ['AGNES_API_KEY', 'capa/clipe de custo zero — Música + Videoclipe (opcional, default)'],
    ['GROQ_API_KEY', 'transcrição (Otimizar Vídeo / Legendar)'],
    ['OPENROUTER_API_KEY', 'pontuação/classificação (Otimizar Vídeo)'],
    ['ELEVENLABS_API_KEY', 'narração paga (opcional; default local inemavox)'],
    ['FAL_KEY', 'clipe/imagem pagos (opcional)'],
  ];
  for (const [k, para] of keyChecks) {
    add({
      name: k, group: 'IA', required: false, ok: Boolean(env[k]),
      detail: env[k] ? `definida — ${para}` : `ausente — ${para}`,
    });
  }

  // daemons locais opcionais
  for (const [nome, url] of [['Ollama', 'http://localhost:11434'], ['inemavox (TTS)', 'http://localhost:8010']] as const) {
    let up = false;
    try { up = (await fetch(url, { signal: AbortSignal.timeout(800) })).status < 500; } catch { up = false; }
    add({ name: nome, group: 'IA', required: false, ok: up, detail: up ? `no ar em ${url}` : `offline (${url}) — opcional` });
  }

  // ── ambiente ──────────────────────────────────────────────────────────────
  const envFile = path.resolve(process.cwd(), '.env');
  add({
    name: '.env',
    group: 'ambiente',
    required: false,
    ok: existsSync(envFile),
    detail: existsSync(envFile) ? envFile : 'ausente — copie de .env.example (opcional; há defaults)',
  });

  const ok = checks.filter((c) => c.required).every((c) => c.ok);
  return { ok, checks };
}

export function formatDoctor(report: DoctorReport): string {
  const groups: Check['group'][] = ['node', 'mídia', 'IA', 'motor', 'módulos', 'ambiente'];
  const lines: string[] = ['mkivideos doctor — verificação de ambiente', ''];
  for (const g of groups) {
    const items = report.checks.filter((c) => c.group === g);
    if (!items.length) continue;
    lines.push(`  ${g.toUpperCase()}`);
    for (const c of items) {
      const mark = c.ok ? '✅' : c.required ? '❌' : '⚠️ ';
      lines.push(`   ${mark} ${c.name}: ${c.detail}`);
    }
    lines.push('');
  }
  lines.push(report.ok
    ? '→ Requisitos obrigatórios OK. (avisos ⚠️ afetam só a URL → Vídeo)'
    : '→ Há requisitos obrigatórios faltando (❌). Veja RESTAURAR.md.');
  return lines.join('\n');
}
