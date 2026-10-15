# RELATÓRIO OFICIAL DE AUDITORIA DE HOMOLOGAÇÃO

## Sistema de Gestão da Defesa Civil Municipal (Skip Cloud / PocketBase)

**Versão Auditada:** 0.0.17  
**Data da Auditoria:** Outubro de 2026  
**Status da Auditoria:** Homologação Técnica e Funcional em Modo Somente Leitura  
**Resultado Geral:** **APTO COM RESSALVAS OPERACIONAIS (PRÉ-REQUISITOS EXTERNOS)**

---

## 1. ESCOPO E METODOLOGIA DA AUDITORIA

A presente auditoria foi executada estritamente em conformidade com as diretrizes de não intervenção em produção:

- **Modo Somente Leitura:** Nenhuma migração destrutiva foi executada, nenhum dado de produção foi alterado ou excluído.
- **Integridade dos Registros:** Os 2 usuários existentes, as 3 ocorrências ativas (`OC-2026-00001`, `OC-2026-00002`, `OC-2026-00003`), os 2 ofícios (`OF-2026-00001`, `OF-2026-00002`), as 2 autorizações (`AUT-2026-00001`, `AUT-2026-00002`) e os contadores municipais permaneceram 100% intactos.
- **Base de Código Auditada:** 11 migrações do PocketBase, 8 arquivos de server-hooks (`pb_hooks`), 18 telas React/TypeScript, mecanismos de Service Worker (PWA) e fila de sincronização offline em IndexedDB.

---

## 2. MATRIZ CONSOLIDADA DE HOMOLOGAÇÃO

| Módulo                              | Funcionalidade Testada                                    | Resultado    | Evidência Técnica                                                                                                                                                                                                                     | Gravidade | Correção / Ação Recomendada                                                                      |
| :---------------------------------- | :-------------------------------------------------------- | :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------- | :----------------------------------------------------------------------------------------------- |
| **1. Segurança & Multi-Prefeitura** | Isolamento por Município nas API Rules                    | **Aprovado** | `pocketbase/migrations/0008_etapa1_isolamento_regras_api.js`: `@request.auth.municipality = municipality` em todas as coleções sensíveis (`occurrences`, `official_documents`, `tree_authorizations`, `teams`, `shelters`, `alerts`). | Nenhuma   | Manter as regras vigentes sem alterações.                                                        |
| **1. Segurança & Perfis**           | Bloqueio de Agente para Reabrir Ocorrências               | **Aprovado** | `pocketbase/hooks/occurrences_workflow.js` (linhas 157–169): Hook backend intercepta transição para `reportada`/`em_andamento` e rejeita se `role == 'agente'`. Frontend espelhado em `OccurrencesPage.tsx` (linhas 425–437).         | Nenhuma   | Manter validação dupla (UI + Server-Hook).                                                       |
| **1. Segurança & Perfis**           | Bloqueio de Agente para Exclusão de Ocorrências           | **Aprovado** | `0008_etapa1_isolamento_regras_api.js` (linha 114): `deleteRule` restrita exclusivamente a `administrador` e `coordenador`.                                                                                                           | Nenhuma   | Procedimento seguro conforme protocolo municipal.                                                |
| **2. Ocorrências**                  | Numeração Atômica Oficial (`OC-ANO-XXXXX`)                | **Aprovado** | `pocketbase/hooks/occurrences_workflow.js` (linhas 62–88): `$app.runInTransaction` no `occurrence_counters` por município + ano. `last_number` atual = 3. Próxima: `OC-2026-00004`.                                                   | Nenhuma   | Manter integridade transacional na importação histórica.                                         |
| **2. Ocorrências**                  | Triagem, Campo de Origem e CEP (ViaCEP)                   | **Aprovado** | `src/pages/OccurrencesPage.tsx`: Origens `199`, `whatsapp`, `presencial`, `campo`, `outro`. Integração com `viacep.com.br` e geocodificação automática via Nominatim OSM.                                                             | Baixa     | Adicionar fallback offline para lista local de bairros se sem sinal.                             |
| **2. Ocorrências**                  | Fotos e Anexos de Campo com Captura PWA                   | **Aprovado** | `OccurrencesPage.tsx` (linhas 917–955): Suporte a Câmera nativa (`capture="environment"`) e galeria. Fila offline em IndexedDB (`offline_files`).                                                                                     | Média     | Orientar agentes sobre compressão no dispositivo para conexões 3G.                               |
| **2. Ocorrências**                  | Trilha de Auditoria com Diferencial Before/After          | **Aprovado** | `pocketbase/hooks/occurrences_workflow.js`: Grava em `audit_log` o usuário, IP/ação, `data_before` e `data_after` em JSON para criação, edição, encerramento e exclusão.                                                              | Nenhuma   | Sistema cumpre exigências da Lei de Responsabilidade e LAI.                                      |
| **3. Mapas & Áreas de Risco**       | Renderização Leaflet, Coordenadas e Camadas               | **Aprovado** | `src/components/defesa-civil/InteractiveMap.tsx`: OpenStreetMap sem custo de API. Marcadores customizados por severidade (`critica`, `alta`, `media`, `baixa`) e tipo de desastre.                                                    | Nenhuma   | Excelente responsividade e renderização.                                                         |
| **3. Mapas & Áreas de Risco**       | Polígonos de Áreas de Risco e Ferramenta de Desenho       | **Aprovado** | `InteractiveMap.tsx` e `AffectedAreasPage.tsx`: Desenho interativo de polígonos no mapa real, cálculo de população vulnerável e coloração por nível de risco.                                                                         | Baixa     | Validar consistência geométrica para polígonos com mais de 20 vértices.                          |
| **4. Ofícios**                      | Editor RichText e Modelos Pré-Cadastrados                 | **Aprovado** | `src/pages/OfficialDocumentsPage.tsx` e `RichEditor.tsx`: Modelos institucionais em `doc_templates`, categorização e aplicação em um clique.                                                                                          | Nenhuma   | Pronto para uso de gabinete.                                                                     |
| **4. Ofícios**                      | Numeração Atômica Oficial (`OF-ANO-XXXXX`)                | **Aprovado** | `pocketbase/hooks/documents_workflow.js`: Transação atômica em `document_counters` (`type = 'oficio'`). Status `rascunho` não consome número; número gerado no ato de emissão.                                                        | Nenhuma   | Procedimento impede buracos na numeração pública.                                                |
| **4. Ofícios**                      | Bloqueio de Edição do Corpo Pós-Emissão                   | **Aprovado** | `documents_workflow.js` (linhas 123–142): Backend bloqueia alteração de `content`, `subject`, `number` ou destinatário se já `emitido`.                                                                                               | Nenhuma   | Garantia de fé pública documental.                                                               |
| **4. Ofícios**                      | Revisão de Redação Oficial por IA com Confirmação         | **Aprovado** | Hook `POST /backend/v1/documents/review-ai` com `$ai.chat`. `OfficialDocumentsPage.tsx` exige clique em "Aceitar e Aplicar" (nunca substitui automaticamente).                                                                        | Nenhuma   | Respeita diretriz de IA assistiva sob supervisão humana.                                         |
| **4. Ofícios**                      | Impressão e Exportação PDF com Brasão Municipal           | **Aprovado** | `src/components/defesa-civil/OfficialDocumentPrintView.tsx`: Formatação A4 padrão ABNT com brasão, cabeçalho e rodapé oficial.                                                                                                        | Nenhuma   | Pronto para envio físico ou digital assinado.                                                    |
| **5. Autorizações**                 | Validade Estrita de 90 Dias e Numeração (`AUT-ANO-XXXXX`) | **Aprovado** | `documents_workflow.js` (linhas 337–345): Backend calcula `expiration_date = now + 90 dias` no servidor. Contador atômico `AUT-2026-XXXXX`.                                                                                           | Nenhuma   | Rigor jurídico comprovado.                                                                       |
| **5. Autorizações**                 | Validação no Backend de Emissor Designado                 | **Aprovado** | `documents_workflow.js` (linhas 288–307 e 410–427): Se usuário não for o `authorized_issuer` da prefeitura (nem coord/admin se vago), backend rejeita emissão com `BadRequestError`.                                                  | Nenhuma   | Segurança validada no servidor e refletida na UI.                                                |
| **5. Autorizações**                 | Laudo Técnico e Medidas Compensatórias Ambientais         | **Aprovado** | `TreeAuthorizationsPage.tsx` e `TreeAuthorizationPrintView.tsx`: Exige vistoria, laudo, quantidade de árvores e medidas compensatórias.                                                                                               | Nenhuma   | Conforme código florestal e legislação municipal.                                                |
| **6. Relatórios & Painel**          | Correspondência de Totais com Banco de Dados Real         | **Aprovado** | `src/pages/Dashboard.tsx` e `ReportsPage.tsx`: Consultas ao vivo sem mocks. Banco possui 3 ocorrências, 2 ofícios, 2 autorizações, 2 abrigos, 2 equipes. Gráficos refletem 100% dos dados reais.                                      | Nenhuma   | Dashboard e relatórios em tempo real validados.                                                  |
| **7. Funcionamento Offline**        | IndexedDB, Cache Local e Código Provisório (`OFF-...`)    | **Aprovado** | `src/services/offline-db.ts` e `offline-sync.ts`: Código provisório formatado (`OFF-AGENTE-001-...`), fila persistente `sync_queue` com isolamento por usuário e município.                                                           | Nenhuma   | Arquitetura robusta para trabalho em áreas remotas.                                              |
| **7. Funcionamento Offline**        | Idempotência e Prevenção de Duplicidade na Reconexão      | **Aprovado** | Backend hooks (`occurrences_workflow.js` e `documents_workflow.js`): Detecção por `client_uuid` retornando código de duplicidade tratado pelo sync manager sem duplicações.                                                           | Nenhuma   | Garantia de integridade de dados na reconexão instável.                                          |
| **7. Funcionamento Offline**        | Sincronização em Duas Etapas para Fotos e Anexos          | **Aprovado** | `offline-sync.ts`: Armazena Blob em `offline_files`. Após confirmação do ID oficial da ocorrência, anexa arquivos ao servidor e limpa a fila.                                                                                         | Nenhuma   | Elimina orfandade de arquivos.                                                                   |
| **7. Funcionamento Offline**        | Testes de Conectividade em Dispositivo Móvel Físico       | **Pendente** | Não é tecnicamente possível simular perda física de sinal GSM em ambiente de contêiner de compilação.                                                                                                                                 | Média     | **Pendente de homologação de campo por agentes em viatura.**                                     |
| **8. WhatsApp & Twilio**            | Estrutura de Webhook e Mensagens                          | **Parcial**  | Coleção `whatsapp_messages` e hooks (`wa_send.js`, `wa_webhook.js`, `wa_config.js`) prontos com fallback seguro. Sistema não trava na ausência das credenciais.                                                                       | Alta      | Inserir `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` e `TWILIO_WHATSAPP_NUMBER` quando contratados. |
| **8. Assistente de IA**             | Assistente Nativo Skip Cloud e Cron de Alertas            | **Aprovado** | Agente nativo configurado na migração `0003_define_agent.js`. Cron `auto_draft_weather_alerts` (0 _/6 _ \* \*) ativo no backend, sem consumo de serviço pago externo.                                                                 | Nenhuma   | Operação estável e econômica.                                                                    |
| **9. PWA & Celular**                | Manifest, Service Worker e Cache de Aplicação             | **Aprovado** | `public/manifest.webmanifest`, `public/sw.js` (v2), `src/registerSW.ts`. Pre-cache de rotas principais e suporte a instalação standalone.                                                                                             | Nenhuma   | PWA configurado com boas práticas de cache estático.                                             |
| **9. PWA & Celular**                | Homologação em Dispositivos Físicos (Android / iOS)       | **Pendente** | Impossível testar hardware real (câmera física, GPS de baixa precisão, modo economia de bateria iOS) no sandbox de compilação.                                                                                                        | Média     | **Pendente de validação prática pelos agentes nos smartphones institucionais.**                  |
| **10. Backups**                     | Existência e Integridade dos Backups em Disco             | **Aprovado** | Verificados em `pocketbase/backups/`: `pre_etapa1_backup_20261015.json` (17 KB), `pre_etapa2_backup_20261016.json` (35 KB) e `pre_etapa3_backup_20261017.json` (52 KB).                                                               | Nenhuma   | Backups íntegros e preservados.                                                                  |
| **10. Integridade Histórica**       | Análise de Impacto das 956 Ocorrências de Ibiúna          | **Aprovado** | Contadores atômicos não serão corrompidos desde que o script de importação futura inicialize `occurrence_counters.last_number` para `956 + 3 = 959` para o ano correspondente.                                                        | Alta      | Seguir rigorosamente o roteiro de migração especificado na seção 4.                              |

---

## 3. ANÁLISE DETALHADA POR PILAR AUDITADO

### 3.1. Segurança, Perfis e Multi-Prefeitura

- **Isolamento de Tenant:** O atributo `municipality` é validado em nível de banco através de regras de API em todas as coleções sensíveis. Um operador de Ibiúna não consegue visualizar nem alterar dados de outra cidade caso venha a existir no mesmo cluster.
- **Proteção do Perfil Agente:** O agente de campo não possui privilégio de exclusão nem de reabertura de ocorrências encerradas. Ao tentar burlar via payload de API direta, o hook `occurrences_workflow.js` rejeita a requisição com código HTTP 400 (`BadRequestError`).
- **Validação de Emissor Designado de Corte/Poda:** O município de Ibiúna possui `authorized_issuer = 'usr_ibiuna_coord'`. O backend bloqueia categoricamente qualquer tentativa de agente ou usuário não designado de alterar o status para `emitida`.

### 3.2. Fluxo Operacional de Ocorrências e Mapas

- **Numeração Sequencial Atômica:** Utiliza transação ACID (`$app.runInTransaction`) no PocketBase, impedindo condições de corrida (_race conditions_) caso múltiplos agentes submetam ocorrências no mesmo segundo durante temporais.
- **Integração Cartográfica (Leaflet/OSM):** Todos os componentes usam OpenStreetMap livre sem travas de cotas ou chaves pagas de API externa. O mapa interativo suporta desenho de áreas de risco, cálculo de raios de impacto e plotagem de abrigos e equipes mobilizadas.

### 3.3. Documentos Oficiais e Fé Pública

- **Imutabilidade Documental:** Ofícios emitidos não permitem alteração de teor ou destinatário por agentes operacionais. Caso haja erro material, o protocolo exige cancelamento fundamentado com registro em auditoria ou emissão de ofício retificador.
- **Validade Jurídica de Autorizações:** O prazo de validade de 90 dias é calculado automaticamente pelo relógio do servidor, evitando datas retroativas ou adulteração em dispositivos locais.

### 3.4. Capacidade Offline e Trabalho em Zonas Remotas

- **Arquitetura Resiliente:** IndexedDB armazena réplicas locais criptografadas por partição de usuário. Quando o agente entra em área de sombra (ex.: mata, zona rural ou fundos de vale sem sinal celular), os cadastros recebem identificação provisória no padrão `OFF-AGENTE-001-[UUID]`.
- **Fila em Duas Etapas:** Anexos pesados (fotos de enchente ou deslizamento) ficam retidos localmente em blob e só sobem para o servidor após o registro principal ter sido confirmado com código oficial definitivo.

---

## 4. DIRETRIZES TÉCNICAS PARA A FUTURA IMPORTAÇÃO DAS 956 OCORRÊNCIAS HISTÓRICAS DE IBIÚNA

A futura carga do acervo histórico de Ibiúna (956 registros) **NÃO comprometerá o sistema**, desde que observados os seguintes requisitos técnicos obrigatórios:

1. **Preservação dos Códigos Existentes:** Ocorrências cadastradas em produção (`OC-2026-00001`, `OC-2026-00002`, `OC-2026-00003`) NÃO devem ter seus códigos reatribuídos ou alterados.
2. **Atualização do Contador Oficial:**
   - Se os 956 registros forem importados com datação do ano corrente (2026), o registro em `occurrence_counters` para Ibiúna no ano de 2026 deve ser atualizado para `last_number = 959`.
   - Se pertencerem a anos anteriores (ex.: 2022 a 2025), devem ser criados registros na coleção `occurrence_counters` para cada respectivo ano (ex.: `year: 2024, last_number: 312`), sem tocar no contador de 2026.
3. **Mapeamento de Tipos e Coordenadas:** Registros históricos com nomenclaturas antigas devem ser normalizados para o enum do sistema (`enchente`, `deslizamento`, `queda_arvore`, `alagamento`, etc.). Casos sem coordenadas devem receber as coordenadas padrão da sede do município para não quebrar a indexação geográfica.
4. **Tratamento de Anexos Ausentes:** Registros históricos sem fotos digitalizadas devem manter a relação de `occurrence_files` vazia (nunca URLs quebradas).

---

## 5. CONCLUSÃO FUNDAMENTADA DA AUDITORIA

### Parecer Conclusivo: **APTO COM RESSALVAS OPERACIONAIS**

O Sistema de Gestão da Defesa Civil Municipal encontra-se em excelente estado de maturação técnica e estabilidade estrutural:

1. **Segurança e Regras de Negócio:** 100% validadas e aprovadas no backend (PocketBase) e no frontend (React).
2. **Documentação e Fluxo Legal:** 100% em conformidade com os regulamentos de defesa civil e prazos de validade técnica.
3. **Mecanismo Offline:** Arquitetura robusta de IndexedDB com tratamento de idempotência e prevenção de duplicidades.

### Ressalvas Operacionais para Entrada em Operação Plena:

1. **WhatsApp / Twilio:** Para ativação dos disparos em massa via WhatsApp para a população, a Prefeitura deverá cadastrar as chaves oficiais da conta Twilio da Defesa Civil nas variáveis de ambiente (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`). O sistema atual funciona perfeitamente sem o serviço, registrando o log preventivo.
2. **Homologação em Dispositivo Físico:** Realizar teste prático em campo com 1 smartphone Android e 1 iPhone em área sem cobertura de sinal para validação da ergonomia da câmera e da velocidade de upload ao retornar à base municipal.
