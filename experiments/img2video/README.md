# Img2Video Experimental

Protótipo local para transformar imagens em vídeos verticais com movimentos
cinematográficos, narração offline e legendas automáticas. Roda 100% na máquina,
só com **ffmpeg** + **SAPI** (vozes do Windows). Sem APIs pagas.

---

## Modo 1 — Imagens avulsas

```bash
node img2vid.mjs --img foto1.png
```

> A entrada de imagem usa a flag `--img` (não há subcomando `img`). Os subcomandos
> existentes são `dir`, `selftest` e `clean`.

* **Uma imagem** — basta uma `--img`; para várias, repita a flag
  (`--img 1.png --img 2.png ...`).
* **Efeito Ken Burns** — sem `--motion`, a cena recebe o preset padrão `kenburns`
  (zoom lento + deriva diagonal suave). Outros presets: `zoomin`, `zoomout`,
  `panL`, `panR`, `panU`, `panD`, `parallax`, `slow`.
* **Narração opcional** — `--narr "seu texto"` gera locução PT-BR via SAPI
  (Microsoft Maria) e essa locução define a duração total do vídeo.
* **Legenda opcional** — `--cap "sua legenda"` queima a legenda na cena
  (caixa escura + texto branco, quebrado automaticamente).
* **Saída MP4** — por padrão `out/saida.mp4` (mude com `--out nome.mp4`);
  vertical `1080x1920` por padrão (use `--size 720x1280` em PC fraco).

Exemplo com tudo:

```bash
node img2vid.mjs --img foto1.png --motion kenburns \
  --narr "Uma foto, um movimento suave e uma legenda." \
  --cap "Memórias de verão" --out memoria.mp4
```

---

## Modo 2 — Storytelling por pasta

Estrutura mínima de uma pasta:

```
novela01/
├── 001.png
├── 002.png
├── 003.png
├── 004.png
├── 005.png
├── movimento.txt
└── narracao.txt        (legendas.txt é opcional)
```

```bash
node img2vid.mjs dir ./novela01
```

* **Leitura automática das imagens numeradas** — pega todos os
  `.png/.jpg/.webp/.bmp` da pasta e ordena por número (`001`, `002`, …),
  então cada imagem vira uma cena na ordem certa.
* **Interpretação do `movimento.txt`** — o conteúdo é um único *prompt* em
  linguagem natural que define o "clima" do vídeo (ritmo, ênfase e transições).
  Pode ser substituído pela flag `--style "..."`.
* **Geração automática dos movimentos por cena** — a partir do clima, cada cena
  recebe um movimento **diferente** e coerente (sem repetir o anterior).
* **Narração SAPI** — lida de `narracao.txt` (ou `--narr "..."`) e sintetizada
  offline pela voz Maria; define a duração total.
* **Legendas automáticas** — sem `--cap` nem `legendas.txt`, a narração é
  **fatiada em blocos por cena** e queimada como legenda sincronizada.
  Ordem de prioridade: `--cap` → `legendas.txt` (1 linha por cena) → fatiamento
  automático da narração.
* **Vídeo final vertical 9:16** — sai em `out/<nome-da-pasta>.mp4`
  (ex.: `out/novela01.mp4`), `1080x1920` por padrão.

---

## Prompt de movimento

O texto de `movimento.txt` (ou `--style`) é livre. Exemplos:

* `câmera lenta cinematográfica`
* `estilo novela coreana`
* `suspense dramático`
* `movimento energético para TikTok`
* `zoom suave e emocional`

O interpretador reconhece *pistas* no texto e ajusta o resultado:

| Pista no prompt | Efeito |
|---|---|
| lenta, suave, delicado, novela, coreana, cinematográfico, emotivo | ritmo lento, transições longas, movimentos contidos |
| rápido, energético, dinâmico, impacto, intenso | ritmo acelerado, transição deslizante, movimentos amplos |
| zoom | favorece `zoomin`/`zoomout` |
| pan, lateral, horizontal | favorece `panL`/`panR`/`panU`/`panD` |
| parallax, profundidade, 3d | inclui `parallax` |
| fade preto, dissolve, wipe, sem transição | troca o tipo de transição |

Sem nenhuma pista reconhecida, usa um padrão cinematográfico neutro.

---

## Saídas

Estas pastas são geradas pela ferramenta e **não entram no git**
(estão no `.gitignore`):

* **`out/`** — vídeos MP4 finais (o resultado que você usa).
* **`.tmp/`** — intermediários: segmentos por cena, o `.wav` da narração SAPI,
  o script `.ps1` da síntese e os arquivos `.cap.txt` das legendas.
* **`_assets/`** — fonte copiada (`font.ttf`, a partir da Segoe UI do Windows) e
  as imagens sintéticas usadas pelo `selftest`.

Pastas de teste real (entrada do modo `dir`, ex.: `novela01/`) também ficam
ignoradas.

---

## Exemplo completo

Crie a pasta `novela01/` com 5 imagens numeradas e dois arquivos de texto:

`novela01/movimento.txt`

```
câmera lenta cinematográfica, zoom suave, movimentos delicados, estilo novela coreana
```

`novela01/narracao.txt`

```
Era uma vez um olhar que dizia tudo sem dizer nada. Entre silêncios e suspiros,
dois destinos se encontram numa tarde de outono. O tempo desacelera, o coração
acelera, e cada gesto delicado guarda uma promessa que o vento não leva embora.
```

Rode:

```bash
node img2vid.mjs dir ./novela01
```

Saída (resumo real):

```
▶ pasta: ./novela01
  imagens: 5 (001.png … 005.png)
  estilo:  "câmera lenta cinematográfica, zoom suave, movimentos delicados, estilo novela coreana"
  mood:    intensity=0.35 · transição=fade · xfade=0.9s
  motions: zoomin → zoomout → slow → kenburns → parallax
✓ out/novela01.mp4  (≈21s, 1080x1920, h264 + narração AAC, legendas por cena)
```

> Quer ver tudo funcionando sem preparar nada? `node img2vid.mjs selftest`
> gera imagens sintéticas e roda as provas (incluindo o modo pasta).

---

## Observações

* **Totalmente offline** — nada sai da máquina.
* **ffmpeg + SAPI** — render e voz são locais (voz PT-BR Microsoft Maria).
* **Sem APIs pagas.**
* **Não faz parte do núcleo do mkvideos** — fica isolado em `experiments/img2video`;
  não toca painel, banco, publishers nem o pipeline de render.
* **Experimental** — é um protótipo/prova de conceito; a interface (imagem +
  movimento + narração + legenda) foi pensada para depois receber, atrás dela,
  um motor de movimento mais sofisticado.
