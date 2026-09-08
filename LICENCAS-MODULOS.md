# Licenças dos módulos vendorizados

O núcleo do MKVideos (`src/`) é **MIT**. Os módulos em `modules/` são cópias
vendorizadas de repositórios de terceiros (mesma organização, `inematds`), cada
um com sua própria situação de licença. Este arquivo consolida o que foi
verificado, para decidir com segurança antes de qualquer distribuição.

| Módulo | Licença encontrada | Onde | Risco de distribuição |
|---|---|---|---|
| `modules/content2video` | não declarada ("uso interno e educacional INEMA") | `UPSTREAM-README.md` | ⚠️ requer autorização antes de distribuir |
| `modules/musicavideo` | **MIT** | `UPSTREAM-README.md`, seção "Licença" | ✅ nenhum |
| `modules/otimizevideo` | não declarada — sem `LICENSE`, sem seção no README | — | ⚠️ requer autorização antes de distribuir |
| `modules/videosub` | não declarada — sem `LICENSE`, sem seção no README | — | ⚠️ baixo (código não é executado, só referência — ver `modules/videosub/ORIGEM.md`) |
| `modules/musicavideo-pub` | não declarada | — | não se aplica — nenhum código foi vendorizado (ver `modules/musicavideo-pub/ORIGEM.md`) |

## O que "não declarada" significa aqui

Nenhum desses três repositórios tem arquivo `LICENSE` nem uma seção de licença
no README. Não há uma licença OSI explícita (MIT, Apache-2.0, etc.), mas também
não há uma proibição explícita — é uma zona cinzenta típica de projeto interno
de uma organização (`inematds`/INEMA) que ainda não formalizou os termos de
redistribuição pública.

**Isso NÃO bloqueia desenvolvimento e uso local** — é exatamente o caso de uso
do MKVideos hoje (ferramenta pessoal/local do dono do projeto). O aviso é sobre
**distribuição** (publicar o repositório do MKVideos publicamente com esses
módulos embutidos, empacotar e vender, etc.).

## Antes de qualquer distribuição comercial ou pública

1. Confirmar com a INEMA/`inematds` os termos de uso de `content2video`,
   `otimizevideo` e `videosub` (o código vendorizado deste último não é
   executado, mas ainda seria distribuído como arquivo).
2. Alternativa que não depende de autorização: remover os diretórios
   `modules/content2video`, `modules/otimizevideo` e `modules/videosub` do
   pacote distribuído. As funcionalidades correspondentes (URL → Vídeo,
   Otimizar Vídeo, Legendar/transcrição) degradam com erro claro —
   `mkivideos doctor` já sinaliza a ausência do módulo — o resto do MKVideos
   (MIT) não é afetado.
3. `modules/musicavideo` (MIT) pode ser distribuído livremente.
4. `modules/musicavideo-pub` não tem código vendorizado — não há nada a
   remover ou autorizar.

## Créditos

Todos os módulos preservam o `UPSTREAM-README.md` (ou `README.md` original,
quando renomeado) e um `ORIGEM.md` com URL, commit e data da cópia — ver cada
pasta em `modules/*/`. Nenhum aviso de autoria ou licença foi removido.
