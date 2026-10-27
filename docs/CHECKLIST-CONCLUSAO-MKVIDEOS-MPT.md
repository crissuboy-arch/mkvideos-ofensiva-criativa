# CHECKLIST MESTRE — MKVideos + MoneyPrinterTurbo
Atualizado: 27/10/2026. Branch: `feat/moneyprinterturbo-engine`.
Status: **em desenvolvimento / não pronto para operação pública**.

Este arquivo é a fonte de acompanhamento desta integração. Não confundir código versionado, testes relatados no VM e funcionalidades efetivamente demonstradas no painel / em produção.

## 0. Arquitetura preservada
- [x] MKVideos permanece produto principal e motor original `content2video` permanece default.
- [x] MoneyPrinterTurbo adicionado como **motor opcional**, sem substituir o fluxo atual.
- [x] ATHENA não recebeu lógica de geração audiovisual; sua integração é posterior ao G3.
- [x] Nenhuma alteração em main/produção relatada pelo Muse e nenhuma alteração nesta branch por outras equipes confirmada nesta revisão.
- [ ] Validar em teste de regressão que todas as funções existentes do MKVideos continuam funcionais (inclui URL→Vídeo, painel, biblioteca, música, otimização e legendas).

## 1. Código + testes
- [x] Confirmados no GitHub `src/engines/moneyprinterturbo/engine.ts`, `src/mpt/cli.ts`, `src/engines/index.ts` e documentação do motor.
- [x] Registro `moneyprinterturbo` ao lado de `content2video` confirmado no código.
- [x] Comandos MPT de gerar / estado / cancelar / saúde adicionados ao código.
- [x] Cliente com chave obrigatória, timeout, limites, download com caminho validado, tratamento 429 e cancelamento (conforme código/relatório).
- [x] Muse relatou `252/252` testes passando, com `tsc --noEmit` limpo; **não reproduzido independentemente nesta revisão**.
- [ ] Reexecutar teste e typecheck num checkout limpo/CI (não depender do build manual de `better-sqlite3` no VM).
- [ ] Corrigir/garantir instalação reproduzível de `better-sqlite3` (dependências nativas e Node).
- [ ] Verificar coerência do seletor de motor: `MKVIDEOS_ENGINE` versus `MKIVIDEOS_ENGINE` na documentação e código; padronizar com testes.
- [ ] Verificar testes de integração e persistência de tarefas após reinício do serviço.

## 2. Prova de vídeo
- [x] Muse relatou MP4 local PT-BR de 22,3s, 1080×1920, com narração Piper e legendas, feito via CLI local.
- [ ] Entregar MP4 de teste para revisão visual e auditiva independente; verificar direitos de músicas, áudio, imagens e qualidade das legendas.
- [ ] Confirmar metadados do vídeo com `ffprobe` e rastreabilidade do projeto/arquivo.
- [ ] Revisar sequência das cenas, sincronização, CTA, português, marca e formatos 9:16 e 16:9.
- [ ] Confirmar música de fundo e licença/identidade da faixa, sem afirmar título ainda não comprovado.
- [ ] Renderizar outro vídeo reproduzível a partir de um briefing comercial.

## 3. Motor MPT por API — BLOQUEIO PRINCIPAL
- [x] Muse relatou endpoint de saúde/autenticação, criação, polling e falha normalizada via API local.
- [ ] Solucionar TTS na API: usar narração local dentro do motor/worker ou rede válida para provedor; NÃO depender apenas de Edge TTS.
- [ ] Resolver entrada de áudio próprio por API, se necessário, com contrato seguro e sem caminhos arbitrários/credenciais expostas.
- [ ] Demonstrar **um render COMPLETO via API**: submit → polling → completed → download MP4 → arquivo válido.
- [ ] Demonstrar falha, timeout, cancelamento, fila cheia e restart reais.
- [ ] Verificar política de custos e revisão humana antes de qualquer postagem.

## 4. Implantação
- [x] Dockerfile, compose e template de configuração relatados no repo.
- [ ] Construir e testar imagem Docker num anfitrião aprovado (VM anterior sem Docker).
- [ ] Criar e guardar `MPT_API_KEY` real fora do Git; configurar `config.toml` privado.
- [ ] Configurar rede segura: loopback/HTTPS com autenticação; não expor API sem chave.
- [ ] Configurar volumes persistentes (MP4, tarefas, logs), quotas, reinício, monitorização e backups onde necessários.
- [ ] Executar teste ponta a ponta num ambiente de teste autorizado.
- [ ] Confirmar custo real por produção e limite antes de ativar modelos pagos.

## 5. Experiência de utilizador e lançamento MKVideos
- [ ] Exibir o motor no painel com seleção clara, saúde, disponibilidade e limites honestos.
- [ ] Fluxo por tema: criar → acompanhar progresso → pré-visualizar → baixar MP4.
- [ ] Mensagens em português para falta de API, problema de voz, erro de fila e reenvio seguro.
- [ ] Biblioteca/histórico persistentes e estados de erro comprovados.
- [ ] Revisão/aprovação humana antes de qualquer publicação real.
- [ ] Homologação em dispositivos usados pela equipe, inclusive móvel.
- [ ] Documentação final de uso/administração + checklist de rollback.

## 6. ATHENA e outros sistemas — DEPOIS do MKVideos funcionar
- [ ] Concluir ATHENA G3 (login/sessão, organização, ferramentas, tarefas, T1–T7).
- [ ] Definir contrato MKVideos ↔ ATHENA com organização/RBAC, idempotência, custo e artefatos.
- [ ] Testar tarefa iniciada pelo ATHENA, execução pelo MKVideos e retorno verificável do MP4.
- [ ] NEXORA conserva dados comerciais; Cris OS conserva suas responsabilidades, sem duplicação.
- [ ] Ativar em produção apenas com aprovação explícita e evidências de testes.

## Critério de conclusão
Só marcar **PROJETO CONCLUÍDO** quando: (a) 252+ testes reproduzíveis e regressões passarem; (b) vídeo aprovado em revisão; (c) render completo via API comprovado; (d) Docker/serviço operativo; (e) painel e fluxo completo funcionarem; (f) segurança, custos e publicação aprovados. A integração com ATHENA é marco posterior independente.

**Próximo passo mais crítico:** solucionar a narração na **via API** e demonstrar submit → completed → download. Depois validar em Docker. Evitar criar novas plataformas.
