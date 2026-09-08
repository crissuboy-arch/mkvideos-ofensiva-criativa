# Como restaurar o mkivideos em outro computador

Guia de reinstalação do zero — Windows 10/11, PowerShell.

---

## 1. Pré-requisitos do sistema

### Node.js 20+
```powershell
winget install OpenJS.NodeJS.LTS
# reiniciar terminal após instalar
node -v    # deve mostrar v20+
npm -v
```

### FFmpeg
```powershell
winget install Gyan.FFmpeg
# reiniciar terminal após instalar
ffmpeg -version
ffprobe -version
```

### Git
```powershell
winget install Git.Git
```

### Chrome headless (HyperFrames)
O HyperFrames baixa o Chrome automaticamente na primeira execução:
```bash
npx hyperframes@0.6.80 browser ensure
```

---

## 2. Clonar o repositório

```bash
git clone git@github.com:<seu-usuario>/mkivideos.git
cd mkivideos
```

Ou via HTTPS:
```bash
git clone https://github.com/<seu-usuario>/mkivideos.git
cd mkivideos
```

---

## 3. Instalar dependências

```bash
npm install
npm run build
```

O `npm install` compila o `better-sqlite3` (binário nativo).
Se falhar, instale as ferramentas de build:

```powershell
npm install --global windows-build-tools
# ou
winget install Microsoft.VisualStudio.2022.BuildTools
```

---

## 4. Configurar CLI do Claude (só para modo fila)

O comando `mkivideos gerar` **não precisa** do Claude.
O comando `mkivideos run` (modo fila) precisa do CLI logado:

```bash
# instalar CLI do Claude
npm install -g @anthropic-ai/claude-code

# fazer login
claude login
```

---

## 5. Configurar Kokoro TTS (voz offline) — OBRIGATÓRIO para `mkivideos gerar`

O TTS roda via HyperFrames, mas o HyperFrames **chama o `python` do sistema** e
**exige** os pacotes `kokoro-onnx` e `soundfile` instalados nele. **Eles NÃO são
baixados automaticamente.** Sem eles, `mkivideos gerar` falha na fase de narração
com *"The kokoro-onnx package is not installed"*.

```bash
python -m pip install kokoro-onnx soundfile
python -c "import kokoro_onnx, soundfile; print('Kokoro OK')"
```

Use o **mesmo** `python` que está no PATH (o que `mkivideos doctor` reporta).
Testar a síntese (baixa o modelo de voz ~27 MB na primeira vez):

```bash
npx hyperframes@0.6.80 tts "Teste de voz" --voice pf_dora --output teste.wav
```

---

## 6. Instalar o CLI globalmente (opcional)

Para usar `mkivideos` de qualquer pasta:

```bash
npm install -g .
mkivideos --help
```

---

## 7. Testar

```bash
# verificar que tudo está no PATH
node -v && npm -v && ffmpeg -version && ffprobe -version

# gerar vídeo de teste
mkivideos gerar "Teste de restauração"
# → renders/teste-de-restauracao-9x16.mp4
```

---

## 8. Estrutura de pastas recomendada

```
C:\Users\<voce>\
  meus-videos-ia\
    mkivideos\          ← este repositório
    bonequinhas-3d\     ← projetos gerados (temporários)
    ofensiva-ia-final\  ← projetos gerados (temporários)
  Videos\
    Renderizados\       ← vídeos finais
    Testes\             ← testes de render
```

---

## 9. Variáveis de ambiente (opcional)

Copie `.env.example` para `.env` na raiz do projeto (nunca commitar `.env`):

```bash
cp .env.example .env
```

Tudo tem default seguro. Cobre a fila/painel (`MKIVIDEOS_DB`, `MKIVIDEOS_VOZES`,
render) e a funcionalidade **URL → Vídeo** (`AI_PROVIDER`, `OPENAI_API_KEY`,
`MKIVIDEOS_URL2VIDEO_*`, `MKIVIDEOS_C2V_*`) — ver
[`docs/url-para-video.md`](docs/url-para-video.md) para o detalhe de cada uma.

---

## 10. Verificação de saúde

```bash
npx hyperframes@0.6.80 doctor   # Node, FFmpeg, Chrome (render offline)
mkivideos doctor                # idem + Codex/OpenAI + motor content2video (URL → Vídeo)
```

Deve mostrar tudo ✅ nos itens obrigatórios; os itens ⚠️ só afetam a URL → Vídeo.

## 11. URL → Vídeo (opcional — só se for usar essa funcionalidade)

```bash
npm install -g @openai/codex   # ou configure OPENAI_API_KEY no .env (AI_PROVIDER=openai)
codex login
mkivideos doctor                # confirma tudo antes de usar
mkivideos url2video status
```

Detalhes completos: [`docs/url-para-video.md`](docs/url-para-video.md).

## 12. Música + Videoclipe / Otimizar Vídeo / Legendar (opcional)

```powershell
winget install Python.Python.3.12      # Música e Otimizar Vídeo são Python
# reiniciar o terminal
pip install -r modules/otimizevideo/requirements.txt   # só para Otimizar Vídeo
winget install yt-dlp.yt-dlp           # opcional — Otimizar Vídeo a partir de URL
```

No `.env` (copiado de `.env.example`), preencha só o que for usar:
`KIE_API_KEY` (música paga), `AGNES_API_KEY` (capa/clipe grátis),
`GROQ_API_KEY` (transcrição), `OPENROUTER_API_KEY` (pontuação). Rode
`mkivideos doctor` para conferir. Detalhes: [`docs/modulos-video.md`](docs/modulos-video.md).

---

## Problemas comuns

| Problema | Causa | Solução |
|----------|-------|---------|
| `ffmpeg not found` | FFmpeg não está no PATH | Reiniciar terminal após `winget install` |
| `better-sqlite3` falha no install | Falta build tools, **ou** não há prebuild para a versão do Node em uso (visto com Node 24) | `winget install Microsoft.VisualStudio.2022.BuildTools`; ou use um Node LTS com prebuild disponível (`nvm install 22` / `20`). Enquanto isso, `npm install --ignore-scripts` instala o resto (typecheck/build/testes fora de `content/store` e `sqlite-store` funcionam) |
| `Chrome not found` | HyperFrames sem browser | `npx hyperframes@0.6.80 browser ensure` |
| `pf_dora` não encontrado | Modelo Kokoro não baixado | Rodar o TTS uma vez — baixa automaticamente |
| Render sai vazio | FFmpeg path errado no Git Bash | Usar `ffmpeg -nostdin` ou PowerShell |
