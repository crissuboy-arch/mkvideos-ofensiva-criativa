// Parser de tema (offline, determinístico): extrai assunto, nº de cenas e "tipo de
// listagem" do título que o usuário digitou. Nada de IA — só heurística de PT-BR.

export interface ThemeInfo {
  titulo: string;   // título original
  subject: string;  // assunto núcleo (sem "5 formas de…")
  n: number;        // nº de cenas de conteúdo
  kind?: string;    // singular: "forma"/"passo"/"dica"/"erro"/"razão"/"segredo"…
}

const KINDS = 'formas?|passos?|dicas?|erros?|razões|razão|segredos?|motivos?|jeitos?|maneiras?|etapas?|pilares?|n[íi]veis?|fases?';
const LEAD_PREP = /^(de|do|da|dos|das|para|pra|pro|que|sobre|em|no|na)\s+/i;

function singular(kind: string): string {
  const k = kind.toLowerCase();
  if (k === 'razões') return 'razão';
  if (k === 'níveis' || k === 'niveis') return 'nível';
  return k.replace(/s$/, '');
}

/** Capitaliza a primeira letra (sem mexer no resto). */
export function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * `parseTheme("5 formas de ganhar dinheiro com IA")`
 *   → { subject: "ganhar dinheiro com IA", n: 5, kind: "forma" }
 * `parseTheme("Como funciona o ChatGPT")`
 *   → { subject: "o ChatGPT", n: <default> }
 */
export function parseTheme(titulo: string, nOverride?: number, fallbackN = 4): ThemeInfo {
  const t = titulo.trim();
  const re = new RegExp(`^(\\d+)\\s+(${KINDS})\\b\\s*`, 'i');
  const m = t.match(re);

  if (m) {
    const num = Math.min(Math.max(parseInt(m[1], 10), 2), 8);
    let subject = t.slice(m[0].length).replace(LEAD_PREP, '').trim();
    if (!subject) subject = t;
    return { titulo: t, subject, n: nOverride ?? num, kind: singular(m[2]) };
  }

  // Sem listagem numerada: o assunto é o próprio título (lê melhor nos templates).
  return { titulo: t, subject: t, n: nOverride ?? fallbackN };
}

/** "@ofensivacriativa" → "arroba ofensivacriativa" (legível pelo TTS). */
export function spokenHandle(instagram: string): string {
  return 'arroba ' + instagram.replace(/^@/, '');
}

/** "links.ofensivacriativa.com" → "links ponto ofensivacriativa ponto com". */
export function spokenUrl(site: string): string {
  return site
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .replace(/\./g, ' ponto ')
    .replace(/\//g, ' barra ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
