import { MigrationInterface, QueryRunner } from 'typeorm';

export class OutboxAndAsyncEnrichment1781465656564
  implements MigrationInterface
{
  name = 'OutboxAndAsyncEnrichment1781465656564';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "outbox_messages" (
        "id" uuid NOT NULL,
        "type" character varying(100) NOT NULL,
        "payload" jsonb NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "published_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_outbox_messages" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_outbox_messages_unpublished"
      ON "outbox_messages" ("created_at")
      WHERE "published_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN "tags_assigned" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      UPDATE "events" e
      SET "tags_assigned" = true
      WHERE EXISTS (
        SELECT 1 FROM "event_tags" t WHERE t."event_id" = e."id"
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_event_tags_event_id_tag"
      ON "event_tags" ("event_id", "tag")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_event_tags_event_id_tag"`);
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "tags_assigned"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_outbox_messages_unpublished"`);
    await queryRunner.query(`DROP TABLE "outbox_messages"`);
  }
}
