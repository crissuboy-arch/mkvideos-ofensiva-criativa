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

## 5. Configurar Kokoro TTS

O TTS roda via HyperFrames — sem instalação extra necessária.
Testar:

```bash
npx hyperframes@0.6.80 tts "Teste de voz" --voice pf_dora --output teste.wav
```

Se quiser o módulo Python direto:
```bash
pip install kokoro-onnx soundfile
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

Criar `.env` na raiz do projeto (não commitar):

```env
# caminho do banco de dados da fila (padrão: ./mkivideos.db)
MKIVIDEOS_DB=C:\Users\<voce>\meus-videos-ia\mkivideos\mkivideos.db
```

---

## 10. Verificação de saúde

```bash
npx hyperframes@0.6.80 doctor
```

Deve mostrar: Node, FFmpeg, Chrome — todos ✅.

---

## Problemas comuns

| Problema | Causa | Solução |
|----------|-------|---------|
| `ffmpeg not found` | FFmpeg não está no PATH | Reiniciar terminal após `winget install` |
| `better-sqlite3` falha no install | Falta build tools | `winget install Microsoft.VisualStudio.2022.BuildTools` |
| `Chrome not found` | HyperFrames sem browser | `npx hyperframes@0.6.80 browser ensure` |
| `pf_dora` não encontrado | Modelo Kokoro não baixado | Rodar o TTS uma vez — baixa automaticamente |
| Render sai vazio | FFmpeg path errado no Git Bash | Usar `ffmpeg -nostdin` ou PowerShell |
