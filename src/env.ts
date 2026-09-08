// Carregador de .env sem dependência (mesmo formato do dotenv, subconjunto).
// Nunca sobrescreve variáveis já definidas no ambiente. Secrets NUNCA são versionados
// (.env está no .gitignore). Use .env.example como referência.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export function loadEnv(file = path.resolve(process.cwd(), '.env')): void {
  if (!existsSync(file)) return;
  let content: string;
  try {
    content = readFileSync(file, 'utf-8');
  } catch {
    return;
  }
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
