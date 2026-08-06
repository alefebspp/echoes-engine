# Echoes Engine

O **Echoes Engine** é uma plataforma de backend que funciona como um sistema de memória digital, coletando, organizando e compreendendo continuamente as atividades digitais de um usuário ao longo do tempo.

Seu objetivo é transformar eventos brutos vindos de múltiplas fontes — como extensões de navegador, aplicativos móveis e integrações de terceiros — em conhecimento estruturado que possa ser pesquisado, analisado e usado para gerar insights personalizados.

## Visão geral

O sistema segue uma **arquitetura orientada a eventos** (event-driven), na qual cada atividade (por exemplo, visitar um site, ouvir uma música, concluir uma tarefa ou editar um documento) é ingerida, normalizada, enriquecida e armazenada como uma linha do tempo de eventos significativos.

À medida que a plataforma evolui, ela construirá uma compreensão semântica do comportamento do usuário, reconhecendo padrões, conectando eventos relacionados e gerando recomendações. Versões futuras incluirão busca semântica com IA, embeddings, grafos de conhecimento e análise comportamental.

## Propósito do projeto

Além da sua visão de produto, o Echoes Engine é, principalmente, um **projeto de aprendizado** voltado para praticar conceitos de engenharia de backend em nível sênior por meio de desenvolvimento incremental. Ele serve como um ambiente prático para explorar:

- Modelagem de domínio (Domain Modeling)
- Clean Architecture e Domain-Driven Design (DDD)
- Sistemas orientados a eventos e processamento assíncrono
- Observabilidade e sistemas distribuídos
- Caching e engenharia de dados
- Busca vetorial e bancos de dados de grafos

O objetivo é evoluir uma aplicação real, partindo de um MVP simples até uma plataforma pronta para produção.

## Stack tecnológica

- **Runtime:** Node.js + TypeScript (recomendado: Node 20+)
- **Framework:** [NestJS](https://nestjs.com/)
- **Persistência:** PostgreSQL com [TypeORM](https://typeorm.io/) (incluindo migrations)
- **Fila / workers:** Redis + [BullMQ](https://docs.bullmq.io/) (outbox → enrichment)
- **Autenticação:** JWT com Passport (estratégias JWT e Local) e hashing de senha com bcrypt
- **Segurança:** rate limiting com `@nestjs/throttler` e validação com `class-validator`
- **Testes:** Jest (unitários e end-to-end)

## Como começar

### Pré-requisitos

- Node.js 20+ (22 recomendado)
- npm
- Docker (opcional, mas o caminho mais simples para Postgres + Redis)

### 1. Subir Postgres e Redis

```bash
docker compose up -d db redis
```

Isso sobe:

| Serviço | Porta padrão |
|---------|--------------|
| PostgreSQL | `5432` |
| Redis | `6379` |

### 2. Instalação

```bash
npm install
```

### 3. Variáveis de ambiente

```bash
cp .env.example .env
```

Valores mínimos para desenvolvimento local (já cobertos pelo `.env.example`):

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=echoes

JWT_SECRET=change-me-in-production

REDIS_HOST=localhost
REDIS_PORT=6379

OUTBOX_PUBLISHER_ENABLED=true
OUTBOX_BATCH_SIZE=50
ENRICHMENT_JOB_ATTEMPTS=5
```

### 4. Migrations

```bash
npm run migration:run
```

### 5. Executar a API **com** o worker

Na Phase 4, **um único processo Nest** sobe:

1. HTTP API (`POST /api/v1/events`, auth, …)
2. **Outbox publisher** (`OutboxPublisher`) — a cada ~2s lê `outbox_messages` não publicados e enfileira no BullMQ
3. **Enrichment worker** (`EnrichmentProcessor`) — consome a fila `enrichment`, aplica tags de forma idempotente e envia falhas esgotadas para `enrichment-dlq`

```bash
# desenvolvimento (watch)
npm run start:dev

# sem watch
npm run start

# produção (depois de npm run build)
npm run start:prod
```

Não é necessário um segundo terminal para o worker hoje: publisher + consumer sobem junto com `AppModule` → `EnrichmentQueueModule`.

Fluxo esperado após um ingest:

```text
POST /api/v1/events
  → grava events + outbox_messages (mesma TX)
  → 201 accepted

OutboxPublisher
  → BullMQ job na fila "enrichment"

EnrichmentProcessor
  → EnrichEventTagsUseCase → tags no Postgres
```

Nos logs, procure por: `event.create.succeeded`, `outbox.published`, `enrichment.started`, `enrichment.completed` (e `queue.depth` periodicamente).

#### Desligar o publisher (útil em debug)

No `.env`:

```env
OUTBOX_PUBLISHER_ENABLED=false
```

A API continua aceitando eventos (outbox acumula). Sem publisher ativo, as tags **não** são processadas até você religar o publisher ou chamar `OutboxPublisher.publishPending()` (como nos testes e2e).

### Migrations do banco de dados

```bash
# gerar uma nova migration
npm run migration:generate

# aplicar migrations pendentes
npm run migration:run

# reverter a última migration
npm run migration:revert
```

### Testes

```bash
# testes unitários
npm run test

# testes end-to-end (precisam de Postgres + Redis rodando)
npm run test:e2e

# cobertura de testes
npm run test:cov
```

### Documentação relacionada

- [docs/phase-4-concepts.md](./docs/phase-4-concepts.md) — conceitos da Phase 4 com exemplos de código
- [docs/adr/0004-async-tagging-outbox.md](./docs/adr/0004-async-tagging-outbox.md) — decisão de tagging assíncrono + outbox
- [docs/mvp-endpoints.md](./docs/mvp-endpoints.md) — contrato HTTP da extensão
