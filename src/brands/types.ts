// Contrato de marca: paleta + fontes + identidade da CTA.

export interface Palette {
  bg: string;       // fundo dominante (idêntico em todas as cenas)
  bg2: string;      // painéis/cartões
  bg3: string;      // bordas/divisores
  fg: string;       // texto principal
  muted: string;    // texto secundário
  accent: string;   // destaque ÚNICO dominante
  accent2: string;  // variação quente do accent (gradientes)
  code: string;     // valores/código/segunda cor pontual
}

export interface Fonts {
  title: string;    // títulos (Sora)
  body: string;     // corpo (Inter)
  mono: string;     // código/URLs (JetBrains Mono)
}

export interface Brand {
  id: string;
  name: string;       // exibido na CTA — 1–2 palavras (vira b1 / b2)
  tagline: string;    // eyebrow da CTA (ex: "Marketing Sem Filtro")
  slogan: string;     // linha de apoio
  instagram: string;  // @handle
  site: string;       // URL exibida (mono)
  palette: Palette;
  fonts: Fonts;
  light?: boolean;    // tema claro (inverte sombras/overlays)
}
