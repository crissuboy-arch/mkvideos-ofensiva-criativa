# Providers LongCat-Video + bridges Concat/Layouts + HyperFrames (2026-10-18)

## O que foi integrado

| Componente | Origem | Licença | Forma de integração |
|---|---|---|---|
| LongCat-Video-Avatar 1.5 (foto+áudio → lip-sync) | meituan-longcat via espelho inematds/LongCat-Video | **MIT** (código e pesos) | Bridge por processo externo (`src/engines/providers/longcat.ts`, provider `avatar`) |
| LongCat-Video clip (texto/imagem → vídeo) | idem | **MIT** | Provider `longcat` — ponte pendente de PoC em GPU |
| Concat (editor, alt. ao CapCut) | jub0t/Concat via espelho inematds/concat | **AGPL-3.0 + Plugin Exception** | Bridge **exclusiva** via binário `concat` (`src/engines/concat/concat.ts`) — nenhum código copiado |
| formatos-layout (20 layouts apresentador+conteúdo) | inematds/formatos-layout | **MIT** | Bridge via `compor.sh` (`src/engines/layouts/layouts.ts`) — estágio final de composição |
| HyperFrames (composição HTML→MP4) | heygen-com/hyperframes (npm) | **Apache-2.0** | Já era o motor ativo; agora com versão configurável + health real |

**NÃO integrado (bloqueio de licença):** inemavox (suite de voz local) —
sem ficheiro LICENSE no repo (menção "MIT" só num README antigo, sem texto
da licença) → vale a regra dela: sem LICENSE = todos os direitos reservados =
só ideias, nunca código. Além disso, a voz do MKVideos já está resolvida
(Qwen3-TTS, decisão dela: não mudar).

**Regra de licenças (dura):** código AGPL **nunca** entra neste repo (núcleo MIT).
A Plugin Exception do Concat cobre explicitamente módulos independentes que
falam via CLI/API/IPC — é exatamente o que a bridge faz. O padrão é o mesmo
da bridge OpenMontage (AGPLv3, processo externo).

## Como funciona

### Avatar (`avatar`) — o que ataca o FAIL do lip-sync
1. O pipeline chama `getProvider('avatar').generate({ brief, aspectRatio,
   durationSeconds, options: { photoPath, audioPath } })`.
2. A bridge monta um `input.json` (`prompt`, `cond_image`, `cond_audio.person1`)
   e invoca `python run_demo_avatar_single_audio_to_video.py --input_json …
   --checkpoint_dir … --output_dir … --use_int8`.
3. Devolve o MP4 gerado como `SceneMediaResult.filePath`.

Sem `LONGCAT_DIR`/pesos, `health()` = `available:false` e `generate()` nega
com `EngineNotImplementedError` + instruções — nunca finge que gerou.

### Clip (`longcat`)
Registado e com `health()` honesto, mas `generate()` nega até ao PoC: os
scripts demo de text/image-to-video do upstream têm o prompt hardcoded
(sem `--input_json`), por isso a integração real exige um wrapper Python
próprio testado em GPU.

### Concat (`src/engines/concat/concat.ts`)
`concatHealth()` / `concatProbe(path)` / `concatRender(projeto, saída)` /
`concatCheck(projeto)` — tudo via `CONCAT_BIN` (default: `concat` no PATH).
Não é um provider de cena (é um renderizador de projetos); por isso vive em
módulo próprio, não no registro de providers.

### HyperFrames
- Versão agora configurável: `HYPERFRAMES_VERSION` (default `0.6.80`, a versão
  provada neste pipeline; npm latest em 2026-10-18: `0.8.172`).
- `health()` do provider passou a executar `hyperframes --version` de verdade
  em vez de responder `available:true` incondicionalmente.
- **NÃO** subir o default sem um render de validação (mudança 0.6→0.8 pode
  quebrar flags do CLI).

## Configuração (.env)

```bash
# LongCat-Video (pesos: 80-160GB em disco + GPU NVIDIA; ex.: RunPod)
LONGCAT_DIR=/caminho/para/LongCat-Video
LONGCAT_PYTHON=python3            # default
LONGCAT_AVATAR_CHECKPOINT=weights/LongCat-Video-Avatar  # default relativo a LONGCAT_DIR
LONGCAT_USE_INT8=1                # default: 1 (menos VRAM)
LONGCAT_TIMEOUT_MS=1800000        # default: 30min

# Concat
CONCAT_BIN=concat                # default (no PATH)

# formatos-layout (compor.sh; só ffmpeg + python3, sem GPU)
LAYOUTS_DIR=/caminho/para/formatos-layout
LAYOUTS_TIMEOUT_MS=1200000       # default: 20min

# HyperFrames
HYPERFRAMES_VERSION=0.6.80       # default; subir só após render de validação
```

## Estado de verificação (honesto)

| Item | Estado |
|---|---|
| Testes unitários (vitest) | PASS (a correr nos gates) |
| Typecheck / lint | a correr nos gates |
| Interface `--input_json` do avatar | verificada no código-fonte do upstream |
| Render real LongCat (foto+áudio → MP4) | **NÃO VERIFICADO** — exige GPU + pesos (PoC RunPod pendente de autorização de gasto) |
| Binário `concat` | **NÃO VERIFICADO** — bridge pronta, sem binário neste ambiente |
| HyperFrames 0.8.x | **NÃO VERIFICADO** — default segue 0.6.80 |

## Próximo passo proposto

PoC LongCat-Avatar em RunPod: foto dela + áudio curto → clipe de 5s.
Só avança com autorização explícita de gasto da GPU.
