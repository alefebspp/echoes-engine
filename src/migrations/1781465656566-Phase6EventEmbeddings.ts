import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase6EventEmbeddings1781465656566 implements MigrationInterface {
  name = 'Phase6EventEmbeddings1781465656566';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    await queryRunner.query(`
      CREATE TABLE "event_embeddings" (
        "event_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "embedding" vector(1536) NOT NULL,
        "model" character varying(100) NOT NULL,
        "dimensions" integer NOT NULL,
        "content_hash" character varying(64) NOT NULL,
        "embedded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_embeddings" PRIMARY KEY ("event_id"),
        CONSTRAINT "FK_event_embeddings_event"
          FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_embeddings_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_event_embeddings_user"
      ON "event_embeddings" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_event_embeddings_hnsw"
      ON "event_embeddings"
      USING hnsw ("embedding" vector_cosine_ops)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_event_embeddings_hnsw"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_event_embeddings_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "event_embeddings"`);
  }
}
