#!/usr/bin/env node
// Executável do runner standalone. Liga argv → cli-lib + IO.
// Build → dist/cli.js (bin "mkivideos"). Uso: `mkivideos <add|fila|cancelar|run>`.

import path from 'node:path';

import { initVideoQueue } from './queue.js';
import { SqliteQueueStore } from './sqlite-store.js';
import { createDashboardServer } from './dashboard.js';
import { cmdAdd, cmdFila, cmdCancel, cmdGerar, optVal, makeDefaultDeps, usage } from './cli-lib.js';

const DB = process.env.MKIVIDEOS_DB || path.resolve('mkivideos.db');

function main(): void {
  const [, , cmd, ...rest] = process.argv;
  const store = new SqliteQueueStore(DB);

  switch (cmd) {
    case 'gerar': {
      // mkivideos gerar "título aqui" [--vertical] [--cenas N] [--tema <tema>] [--pasta <dir>]
      const flags = new Set(['--vertical', '-v', '--cenas', '--tema', '--pasta']);
      const valuedFlags = new Set(['--cenas', '--tema', '--pasta']);
      const tituloTokens: string[] = [];
      for (let i = 0; i < rest.length; i++) {
        if (flags.has(rest[i])) { if (valuedFlags.has(rest[i])) i++; continue; }
        tituloTokens.push(rest[i]);
      }
      const titulo = tituloTokens.join(' ').replace(/^["']|["']$/g, '').trim();
      const cenas = optVal(rest, '--cenas');
      void cmdGerar(titulo, {
        vertical: rest.includes('--vertical') || rest.includes('-v'),
        pasta: optVal(rest, '--pasta'),
        cenas: cenas ? parseInt(cenas) : undefined,
        tema: optVal(rest, '--tema'),
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
