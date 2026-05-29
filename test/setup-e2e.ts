import { webcrypto } from 'node:crypto';

Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  writable: true,
  configurable: true,
});

process.env.DB_HOST = process.env.DB_HOST ?? 'localhost';
process.env.DB_PORT = process.env.DB_PORT ?? '5432';
process.env.DB_USERNAME = process.env.DB_USERNAME ?? 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? 'postgres';
process.env.DB_DATABASE = process.env.DB_DATABASE ?? 'echoes';
process.env.NODE_ENV = 'test';
