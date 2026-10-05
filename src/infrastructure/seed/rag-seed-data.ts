export const RAG_SEED_USER = {
  id: '11111111-1111-4111-8111-111111111000',
  name: 'Rag',
  surname: 'Demo',
  email: 'rag@echoes.local',
  password: 'ragdemo1234',
} as const;

export const RAG_SEED_EXTERNAL_ID_PREFIX = 'rag-seed-';

export type RagSeedEventType = 'WEB_VISIT' | 'APP_VISIT';
export type RagSeedSourceCode = 'browser_extension' | 'mobile_sdk';

export type RagSeedEvent = {
  id: string;
  externalEventId: string;
  type: RagSeedEventType;
  source: RagSeedSourceCode;
  occurredAt: string;
  metadata: Record<string, unknown>;
};

/**
 * Curated browsing history for local RAG tests.
 * Titles share topic words with the sample questions so the fake
 * embedding adapter (no OpenAI key) still retrieves the right cluster.
 */
export const RAG_SEED_EVENTS: RagSeedEvent[] = [
  {
    id: '11111111-1111-4111-8111-111111111001',
    externalEventId: `${RAG_SEED_EXTERNAL_ID_PREFIX}kafka`,
    type: 'WEB_VISIT',
    source: 'browser_extension',
    occurredAt: '2026-06-12T15:30:00.000Z',
    metadata: {
      url: 'https://kafka.apache.org/documentation/',
      title: 'Apache Kafka documentation — distributed message queues',
      browser: 'chrome',
    },
  },
  {
    id: '11111111-1111-4111-8111-111111111002',
    externalEventId: `${RAG_SEED_EXTERNAL_ID_PREFIX}rabbitmq`,
    type: 'WEB_VISIT',
    source: 'browser_extension',
    occurredAt: '2026-06-13T10:00:00.000Z',
    metadata: {
      url: 'https://github.com/rabbitmq/rabbitmq-server',
      title: 'RabbitMQ tutorial — message queues and AMQP',
      browser: 'chrome',
    },
  },
  {
    id: '11111111-1111-4111-8111-111111111003',
    externalEventId: `${RAG_SEED_EXTERNAL_ID_PREFIX}sqs`,
    type: 'WEB_VISIT',
    source: 'browser_extension',
    occurredAt: '2026-06-14T09:15:00.000Z',
    metadata: {
      url: 'https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html',
      title: 'Amazon SQS developer guide — managed message queues',
      browser: 'firefox',
    },
  },
  {
    id: '11111111-1111-4111-8111-111111111004',
    externalEventId: `${RAG_SEED_EXTERNAL_ID_PREFIX}ddd-fowler`,
    type: 'WEB_VISIT',
    source: 'browser_extension',
    occurredAt: '2026-06-18T14:00:00.000Z',
    metadata: {
      url: 'https://martinfowler.com/bliki/DomainDrivenDesign.html',
      title:
        'Domain-Driven Design by Martin Fowler — aggregates and bounded contexts',
      browser: 'chrome',
    },
  },
  {
    id: '11111111-1111-4111-8111-111111111005',
    externalEventId: `${RAG_SEED_EXTERNAL_ID_PREFIX}ddd-wikipedia`,
    type: 'WEB_VISIT',
    source: 'browser_extension',
    occurredAt: '2026-06-18T16:45:00.000Z',
    metadata: {
      url: 'https://en.wikipedia.org/wiki/Domain-driven_design',
      title: 'Domain-Driven Design — Wikipedia',
      browser: 'chrome',
    },
  },
  {
    id: '11111111-1111-4111-8111-111111111006',
    externalEventId: `${RAG_SEED_EXTERNAL_ID_PREFIX}ddd-vernon`,
    type: 'WEB_VISIT',
    source: 'browser_extension',
    occurredAt: '2026-06-19T11:20:00.000Z',
    metadata: {
      url: 'https://www.domainlanguage.com/ddd/pattern-summaries/',
      title:
        'Implementing Domain-Driven Design — Vaughn Vernon pattern summaries',
      browser: 'chrome',
    },
  },
  {
    id: '11111111-1111-4111-8111-111111111007',
    externalEventId: `${RAG_SEED_EXTERNAL_ID_PREFIX}openai-embeddings`,
    type: 'WEB_VISIT',
    source: 'browser_extension',
    occurredAt: '2026-06-22T13:00:00.000Z',
    metadata: {
      url: 'https://platform.openai.com/docs/guides/embeddings',
      title: 'OpenAI embeddings guide — semantic vectors for RAG',
      browser: 'chrome',
    },
  },
  {
    id: '11111111-1111-4111-8111-111111111008',
    externalEventId: `${RAG_SEED_EXTERNAL_ID_PREFIX}pgvector`,
    type: 'WEB_VISIT',
    source: 'browser_extension',
    occurredAt: '2026-06-22T17:30:00.000Z',
    metadata: {
      url: 'https://github.com/pgvector/pgvector',
      title: 'pgvector — vector similarity search in PostgreSQL for RAG',
      browser: 'chrome',
    },
  },
  {
    id: '11111111-1111-4111-8111-111111111009',
    externalEventId: `${RAG_SEED_EXTERNAL_ID_PREFIX}langchain-rag`,
    type: 'WEB_VISIT',
    source: 'browser_extension',
    occurredAt: '2026-06-23T08:50:00.000Z',
    metadata: {
      url: 'https://python.langchain.com/docs/tutorials/rag/',
      title: 'Retrieval-Augmented Generation (RAG) tutorial — LangChain',
      browser: 'chrome',
    },
  },
  {
    id: '11111111-1111-4111-8111-111111111010',
    externalEventId: `${RAG_SEED_EXTERNAL_ID_PREFIX}netflix`,
    type: 'WEB_VISIT',
    source: 'browser_extension',
    occurredAt: '2026-06-08T21:10:00.000Z',
    metadata: {
      url: 'https://www.netflix.com/title/81446677',
      title: 'Netflix — The Bear season review',
      browser: 'chrome',
    },
  },
  {
    id: '11111111-1111-4111-8111-111111111011',
    externalEventId: `${RAG_SEED_EXTERNAL_ID_PREFIX}spotify`,
    type: 'WEB_VISIT',
    source: 'browser_extension',
    occurredAt: '2026-06-09T19:05:00.000Z',
    metadata: {
      url: 'https://open.spotify.com/playlist/37i9dQZEVXc',
      title: 'Spotify — Discover Weekly playlist',
      browser: 'chrome',
    },
  },
  {
    id: '11111111-1111-4111-8111-111111111012',
    externalEventId: `${RAG_SEED_EXTERNAL_ID_PREFIX}nytimes`,
    type: 'WEB_VISIT',
    source: 'browser_extension',
    occurredAt: '2026-06-10T07:40:00.000Z',
    metadata: {
      url: 'https://www.nytimes.com/2026/06/10/climate/heat-wave.html',
      title: 'The New York Times — climate news heat wave coverage',
      browser: 'safari',
    },
  },
  {
    id: '11111111-1111-4111-8111-111111111013',
    externalEventId: `${RAG_SEED_EXTERNAL_ID_PREFIX}amazon`,
    type: 'WEB_VISIT',
    source: 'browser_extension',
    occurredAt: '2026-06-11T12:25:00.000Z',
    metadata: {
      url: 'https://www.amazon.com/dp/B0COOKWARE',
      title: 'Amazon — carbon steel kitchen knife set',
      browser: 'chrome',
    },
  },
  {
    id: '11111111-1111-4111-8111-111111111014',
    externalEventId: `${RAG_SEED_EXTERNAL_ID_PREFIX}notion`,
    type: 'WEB_VISIT',
    source: 'browser_extension',
    occurredAt: '2026-06-16T09:00:00.000Z',
    metadata: {
      url: 'https://www.notion.so/templates/weekly-planner',
      title: 'Notion — weekly planning template',
      browser: 'chrome',
    },
  },
  {
    id: '11111111-1111-4111-8111-111111111015',
    externalEventId: `${RAG_SEED_EXTERNAL_ID_PREFIX}instagram-app`,
    type: 'APP_VISIT',
    source: 'mobile_sdk',
    occurredAt: '2026-06-20T22:15:00.000Z',
    metadata: {
      appName: 'Instagram',
      packageName: 'com.instagram.android',
      title: 'Instagram — photos from the weekend',
    },
  },
];
