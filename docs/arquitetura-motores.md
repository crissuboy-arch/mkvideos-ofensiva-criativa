# Arquitetura de motores e provedores

O MKVideos passa a ter duas famílias de "coisas que produzem vídeo":

1. **`gerar`** (`src/engine/pipeline.ts`) — motor offline/determinístico original:
   tema → roteiro (specs) → TTS local (Kokoro/XTTS) → composição → HyperFrames →
   MP4. Não mudou nada aqui.
2. **Motores plugáveis** (`src/engines/`) — para funcionalidades que dependem de
   um serviço externo/local mais complexo (hoje: URL → Vídeo, via
   `content2video`). Pensado desde já para caber outros motores no futuro
   (Remotion, fontefilm, …) sem acoplar o resto do MKVideos a nenhum deles.

```
src/engines/
  types.ts            VideoEngine, EngineJob, EngineProject, AspectRatio, …
  registry.ts          registerEngine() / getEngine(id) — memoizado
  content2video/        único motor implementado hoje
  providers/            provedores de MÍDIA POR CENA (ver abaixo)
```

## `VideoEngine` — contrato de um motor

```ts
interface VideoEngine {
  id: EngineId; label: string; capabilities: EngineCapabilities;
  health(): Promise<EngineHealth>;
  config(): Promise<EngineConfigInfo>;
  createDirection(input: UrlToVideoInput): Promise<EngineJob>;   // gate: roteiro + cena-piloto
  approveDirection(jobId): Promise<EngineJob>;                   // produção completa
  regenerateDirection(jobId): Promise<EngineJob>;
  listJobs() / cancelJob() / retryRender();
  listProjects() / editProject() / duplicateProject() / renderProject();
  openEditor(slug): Promise<{ url }>;
  fetchMedia(relPath): Promise<{ status, contentType, body }>;
}
```

Um novo motor implementa essa interface e se registra em
`registerEngine(id, () => new MeuMotor())`. `src/url2video/service.ts` (a camada
de produto usada pelo painel e pela CLI) escolhe o motor por
`MKIVIDEOS_ENGINE` (hoje só `content2video`) e não conhece nenhum detalhe de
implementação de motor específico.

### Motor `content2video`

`src/engines/content2video/` é um **cliente HTTP fino** sobre o processo
vendorizado em `modules/content2video/app/server.mjs`:

- `config.ts` resolve onde o módulo está e lê env (`MKIVIDEOS_C2V_*`).
- `process.ts` sobe o processo em loopback sob demanda (ou usa
  `MKIVIDEOS_C2V_URL` para um motor já rodando), espera `/healthz` e encerra no
  shutdown.
- `engine.ts` chama a API JSON do motor (`/api/jobs`, `/api/projects`, …) e
  normaliza os payloads para os tipos estáveis de `types.ts` — a camada de
  produto nunca vê o formato específico do upstream.

Por que HTTP e não reescrever a orquestração em TypeScript? O motor upstream já
resolve, de forma testada, um problema com bastante superfície (gate de
aprovação, checkpoints de render, retomada, cancelamento em grupo de processos,
CTA, presets visuais). Reescrever isso é caro e arriscado; um cliente fino por
cima preserva 100% do comportamento e facilita atualizar a partir do upstream
(ver `modules/content2video/ORIGEM.md`).

## Provedores de mídia por cena (`src/engines/providers/`)

Separado do motor: dentro de uma produção, cada **cena** poderá futuramente
escolher entre diferentes formas de virar mídia. Hoje só existe uma:

| Provider (`ProviderId`) | O que faz | Status |
|---|---|---|
| `hyperframes` | composição programável (motion graphics/tipografia/diagramas/mídia local) | ✅ ativo — é como o `content2video` produz cenas hoje |
| `local-media` | mídia enviada/selecionada pelo usuário | 🧭 planejado |
| `image-gen` | geração + animação de imagem | 🧭 planejado |
| `avatar` | apresentador/avatar (ex.: HeyGen) | 🧭 planejado |
| `kling` | clipe por IA (Kling) | 🧭 planejado |
| `veo` | clipe por IA (Google Veo) | 🧭 planejado |
| `runway` | clipe por IA (Runway) | 🧭 planejado |
| `sora` | clipe por IA (Sora) | 🧭 planejado |

Contrato (`src/engines/providers/types.ts`):

```ts
interface MediaProvider {
  id: ProviderId; kind: 'composition'|'clip'|'avatar'|'image'|'media';
  implemented: boolean;
  health(): Promise<ProviderHealth>;
  generate(req: SceneMediaRequest): Promise<SceneMediaResult>;
}
```

`SceneMediaResult` já reserva os campos que a evolução prevista no
`ROADMAP.md`/`UPSTREAM-README.md` do content2video pede: `provider`, `model`,
`durationSeconds`, `cost.{estimatedCredits,consumedCredits}` e `externalId` —
para quando um provedor de clipe/avatar for de fato ligado, dá para registrar
por cena o que foi pedido, quanto custou e permitir fallback para
`hyperframes`/`local-media` sem mudar o contrato.

**Os provedores planejados (`src/engines/providers/planned.ts`) existem só como
esqueleto**: `generate()` lança `EngineNotImplementedError` com o nome do
provedor. Nenhuma chave de API, SDK ou custo é usado por eles — isso foi
proposital, por instrução explícita de não implementar esses provedores agora.
Ativar um deles no futuro é: escrever a classe (chamando a API do provedor real),
trocar `implemented = false` para `true`, e o resto da UI/roteamento já reconhece
via `implementedProviderIds()`.

## Por que essa divisão (e não "engines" = "providers")

- **Motor** = quem produz o vídeo ponta a ponta (roteiro → cenas → render →
  MP4). Trocar de motor é uma decisão de produto grande (ex.: usar Remotion em
  vez de HyperFrames).
- **Provider** = como uma cena vira mídia dentro de um motor. Trocar de
  provider é uma decisão por cena, dentro da mesma produção.

Hoje o `content2video` só usa o provider `hyperframes` internamente (não expõe
escolha por cena). Quando isso mudar, o motor passa a chamar
`getProvider(id).generate(...)` por cena em vez de sempre montar HTML/CSS/JS —
sem precisar tocar em `src/url2video/` nem no painel.
