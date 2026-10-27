# Motor MoneyPrinterTurbo no MKVideos

Motor **adicional** de geração de vídeos faceless (tema/roteiro → MP4),
registado ao lado dos motores existentes. **Não substitui** o
`content2video` nem nenhum outro motor; o default continua
`content2video` (`MKVIDEOS_ENGINE` vazio). A ATHENA é orquestrador externo
futuro e não recebe lógica de produção nesta integração.

## O que o motor faz (e não faz)

Faz: criar tarefas a partir de tema/roteiro, consultar progresso,
cancelar, recriar (restart) e baixar o MP4 final. Não faz: URL → Vídeo
com gate visual, projetos editáveis, editor visual, listagem de tarefas
(o upstream não tem endpoint de listagem) nem retomar renders. Essas
operações devolvem `NOT_IMPLEMENTED` (501) em vez de fingirem existir.

## Como selecionar

```sh
# Via variável (o serviço URL → Vídeo resolve o motor por id):
MKVIDEOS_ENGINE=moneyprinterturbo node dist/cli.js url2video ...

# Via CLI própria (tema → vídeo, sem URL):
node dist/cli.js mpt gerar --subject "Óbidos, a vila medieval de Portugal" \
  --script "$(cat roteiro.txt)" --out ./mpt-output
node dist/cli.js mpt estado <taskId>
node dist/cli.js mpt cancelar <taskId>
node dist/cli.js mpt saude
```

Verificação de registo (sem servidor):

```ts
import './src/engines/index.js';
import { engineIds, getEngine } from './src/engines/index.js';
engineIds(); // [..., 'content2video', 'moneyprinterturbo']
getEngine('moneyprinterturbo'); // MoneyPrinterTurboEngine
```

## Motor isolado (onde corre o MoneyPrinterTurbo)

O motor corre fora do MKVideos: processo próprio (`mpt webui` / API por
`uvicorn app.asgi:app`) ou contentor (`docker/moneyprinterturbo/`).
A API liga-se só a loopback (`127.0.0.1:8080` no compose). Ficheiros
prontos, **imagem NÃO construída nem testada neste VM (sem Docker)** —
construir num anfitrião com Docker, com autorização à parte.

## Variáveis de ambiente (cliente MKVideos)

| Variável | Obrigatória | Omisso | Notas |
| --- | --- | --- | --- |
| `MPT_API_BASE_URL` | sim | — | `http` só em loopback; remoto exige `https`. Sem userinfo/query/hash. |
| `MPT_API_KEY` | sim | — | Enviada em `x-api-key`. O upstream aceita chave vazia; este cliente exige sempre chave. |
| `MPT_TIMEOUT_MS` | não | 60000 | Limitado a 1000–300000. |
| `MPT_MAX_INFLIGHT` | não | 5 | 0 bloqueia todas as criações. Guarda local; a fiscalização real é o 429 do motor. |

Exemplo (placeholders, nunca credenciais reais):

```sh
MPT_API_BASE_URL=http://127.0.0.1:8080
MPT_API_KEY=TROCAR-POR-CHAVE-GERADA-LOCALMENTE
```

O `config.toml` do motor (onde vive a `api_key` do lado do servidor)
está no `.gitignore` e nunca deve ser commitado.

## Narração: local primeiro

O motor usa a voz do seu `config.toml`. **Edge TTS falha neste VM**
(proxy interceta o TLS para `speech.platform.bing.com`, provado em
27/10/2026) — por isso, para testes locais, a via é o CLI com
`--custom-audio-file` e narração local (Piper `pt_BR-cadu-medium`,
offline; o MKVideos também tem Kokoro local em `src/audio/tts.ts`).
Na via API com voz do motor, a rede do motor tem de alcançar o
provedor de TTS. Limitação conhecida da API: áudio próprio só é aceite
se já estiver dentro do diretório da tarefa — um cliente só-API não o
consegue lá pôr antes da etapa de áudio.

## Custos

$0 nesta fase: pacote `mpt` (MIT), Piper, faster-whisper tiny, FFmpeg,
materiais locais. Nenhum provedor pago (OpenAI, ElevenLabs, Seedance,
Pexels) é usado. Qualquer gasto futuro exige autorização explícita.

## Limitações e bloqueios

- Sem Docker neste VM: imagem por construir/testar noutro anfitrião.
- Render completo via API não conseguido neste VM (Edge TTS + áudio
  próprio fora do diretório da tarefa); o vídeo de teste PT-BR foi
  gerado pela via CLI local — ver `research_notes/mkvideos-mpt-engine/`.
- Suite base do repo tinha 43 falhas pré-existentes por falta do
  binário `better-sqlite3` (resolvido no worktree com build local;
  não é código do repo).
- Nada é publicado automaticamente: o MP4 fica para revisão humana.
