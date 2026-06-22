#!/usr/bin/env node
// Executável do runner standalone. Liga argv → cli-lib + IO.
// Build → dist/cli.js (bin "mkivideos"). Uso: `mkivideos <add|fila|cancelar|run>`.

import path from 'node:path';

import { initVideoQueue } from './queue.js';
import { SqliteQueueStore } from './sqlite-store.js';
import { createDashboardServer } from './dashboard.js';
import { cmdAdd, cmdFila, cmdCancel, cmdGerar, optVal, makeDefaultDeps, usage } from './cli-lib.js';
import { SqliteContentStore, DEFAULT_ACCOUNTS } from './content/store.js';
import { createPanelServer } from './content/panel.js';
import { startScheduler } from './content/scheduler.js';
import { platformFormat } from './content/types.js';
import { buildVideo } from './engine/pipeline.js';

const DB = process.env.MKIVIDEOS_DB || path.resolve('mkivideos.db');

function main(): void {
  const [, , cmd, ...rest] = process.argv;
  const store = new SqliteQueueStore(DB);

  switch (cmd) {
    case 'gerar': {
      // mkivideos gerar "tema" [--tipo X] [--vertical|--horizontal] [--marca id]
      //                        [--cenas N] [--tema <eyebrow>] [--pasta <dir>] [--imagens <p>] [--voz <n>]
      const boolFlags = new Set(['--vertical', '-v', '--horizontal', '-h']);
      const valuedFlags = new Set(['--tipo', '--marca', '--cenas', '--tema', '--pasta', '--imagens', '--voz']);
      const tituloTokens: string[] = [];
      for (let i = 0; i < rest.length; i++) {
        if (boolFlags.has(rest[i])) continue;
        if (valuedFlags.has(rest[i])) { i++; continue; }
        tituloTokens.push(rest[i]);
      }
      const titulo = tituloTokens.join(' ').replace(/^["']|["']$/g, '').trim();
      const cenas = optVal(rest, '--cenas');
      void cmdGerar(titulo, {
        tipo: optVal(rest, '--tipo'),
        marca: optVal(rest, '--marca'),
        vertical: rest.includes('--vertical') || rest.includes('-v'),
        horizontal: rest.includes('--horizontal') || rest.includes('-h'),
        pasta: optVal(rest, '--pasta'),
        cenas: cenas ? parseInt(cenas) : undefined,
        tema: optVal(rest, '--tema'),
        imagens: optVal(rest, '--imagens'),
        voz: optVal(rest, '--voz'),
      }).then(msg => { console.log(msg); store.close(); });
      return; // async — não fecha store aqui
    }

    case 'add':
      console.log(cmdAdd(store, rest.join(' ')));
      break;

    case 'fila':
      console.log(cmdFila(store));
      break;

    case 'cancelar':
    case 'cancel':
      console.log(cmdCancel(store, Number(rest[0])));
      break;

    case 'painel': {
      store.close(); // a fila não é usada no painel
      const port = Number(optVal(rest, '--port') || 3142);
      const token = optVal(rest, '--token');
      const content = new SqliteContentStore(DB);
      const seeded = content.seedAccounts(DEFAULT_ACCOUNTS);
      if (seeded) console.log(`(criei ${seeded} contas-exemplo)`);
      createPanelServer(content, {
        port, token,
        generate: async (item, { onPhase }) => {
          const fmt = platformFormat(item.plataforma);
          const r = await buildVideo({
            titulo: item.tema,
            tipo: item.tipo,
            marca: item.marca ?? undefined,
            vertical: fmt === 'vertical',
            horizontal: fmt === 'horizontal',
          }, { onProgress: (ph) => onPhase(ph === 'render' || ph === 'movendo' ? 'renderizando' : 'gerando') });
          return r.mp4;
        },
      });
      const sched = startScheduler(content, { intervalMs: 60_000 });
      void sched; // worker publica os agendados vencidos (mock) a cada minuto
      console.log(`painel: http://localhost:${port}/painel${token ? `?token=${token}` : ''} (DB: ${DB})`);
      console.log('worker de publicação: ativo (1/min, mocks)');
      return; // o server + worker seguram o processo vivo
    }

    case 'run': {
      const swept = store.failStaleRunning();
      if (swept > 0) console.log(`(limpei ${swept} job(s) órfão(s) de um restart)`);
      initVideoQueue(store, makeDefaultDeps());

      const port = optVal(rest, '--port');
      const token = optVal(rest, '--token');
      if (port) {
        createDashboardServer(store, { port: Number(port), token });
        console.log(`dashboard: http://localhost:${port}/videos${token ? `?token=${token}` : ''}`);
      }
      console.log(`mkivideos rodando (DB: ${DB}) — Ctrl+C pra sair`);
      // setInterval (worker) + server seguram o processo vivo.
      return;
    }

    default:
      console.log(usage());
  }

  // Comandos one-shot fecham o banco e saem.
  store.close();
}

main();
