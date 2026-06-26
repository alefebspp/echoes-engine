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

- **Runtime:** Node.js + TypeScript
- **Framework:** [NestJS](https://nestjs.com/)
- **Persistência:** PostgreSQL com [TypeORM](https://typeorm.io/) (incluindo migrations)
- **Autenticação:** JWT com Passport (estratégias JWT e Local) e hashing de senha com bcrypt
- **Segurança:** rate limiting com `@nestjs/throttler` e validação com `class-validator`
- **Testes:** Jest (unitários e end-to-end)

## Como começar

### Pré-requisitos

- Node.js
- PostgreSQL
- npm

### Instalação

```bash
npm install
```

### Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com as configurações necessárias (conexão com o banco de dados, segredos de JWT, etc.).

### Executando a aplicação

```bash
# desenvolvimento
npm run start

# modo watch (recarrega ao salvar)
npm run start:dev

# produção
npm run start:prod
```

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

# testes end-to-end
npm run test:e2e

# cobertura de testes
npm run test:cov
```
