# MKVideos ↔ ATHENA — integração (adapter)

Branch: `feat/athena-mkvideos-adapter`. Pipeline alvo:
TELEGRAM → ATHENA → MKVideos → ATHENA → Telegram → aprovação humana → agendamento/publicação.

## O que foi construído (lado MKVideos)

`src/athena/adapter.ts` — traduz missões ATHENA (ContratoPonteV1) para jobs da
fila do MKVideos, sem tocar no motor de execução nem na ATHENA.

| Missão ATHENA | Adapter | MKVideos |
|---|---|---|
| `mission_type: CRIAR_VIDEO` | ✅ suportado | skill `explicativo`/`curso`/`demo` |
| `mission_id` | idempotência: reenvio devolve o mesmo job | guardado em `opts.athena_mission_id` |
| `objective` | vira o `input` do job | assunto do vídeo |
| `context.video_skill` | `explicativo` (default), `curso`, `demo` | skill da fila |
| `context.vertical: true` | `--vertical` | formato 9:16 |
| `requires_human_approval: true` | `notify: 'sempre'` + `send_video: 1` | vídeo vai ao Telegram p/ aprovação |
| `requested_outputs` | exige incluir `"video"` | — |
| `handoff_id` | guardado em `opts.athena_handoff_id` (correlação) | — |

Validação: `mission_type` ≠ CRIAR_VIDEO, `mission_id` em formato inválido,
`objective` vazio ou `requested_outputs` sem `"video"` → `EngineError`
`ATHENA_MISSION_INVALID` (422). Missão desconhecida no status → 404.

## CLI

```bash
# 1. ATHENA entrega a missão (envelope JSON, stdin ou ficheiro)
mkivideos athena-receive < missao.json
# → {"ok":true,"job_id":7,"deduped":false}

# 2. A fila processa (worker existente; nada muda aqui)
mkivideos run

# 3. ATHENA faz poll do resultado
mkivideos athena-status --mission <mission_id>
# → {"mission_id":"...","status":"queued|running|done|failed",
#    "outputs":{"video":"/caminho/out.mp4"}|null,"error":null|"..."}
```

## O que falta (lado ATHENA — NÃO mexido aqui)

O **Executor Real** da Fase 7 precisa de um executor `mkvideos` que:
1. monte o envelope ContratoPonteV1 (`mission_type: CRIAR_VIDEO`, `objective`,
   `requested_outputs: ["video"]`, `requires_human_approval: true` quando o
   pipeline exigir aprovação);
2. chame `mkivideos athena-receive` (ou `receiveMission()` em-processo);
3. faça poll via `athena-status` (callback `poll`) ou leia o resultado do
   outbox;
4. devolva o vídeo à ATHENA para o passo Telegram → aprovação humana.

**Nada na ATHENA foi alterado nesta branch.** O executor é trabalho separado,
na Fase 7 (branch `feat/fase-7-integracao`, DRAFT PR #4) — sem merge/deploy
sem autorização explícita.

## Gates

- `vitest run src/athena/adapter.test.ts` → 11/11 PASS
- `tsc --noEmit` → 0 erros
- Smoke do ciclo receive → reenvio (dedup) → status queued → done → 404 → OK
  (store em memória; o binário nativo do better-sqlite3 não compila neste
  ambiente — limitação pré-existente, fora do escopo do adapter)
