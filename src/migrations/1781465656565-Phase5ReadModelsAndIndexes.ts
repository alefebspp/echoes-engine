import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase5ReadModelsAndIndexes1781465656565
  implements MigrationInterface
{
  name = 'Phase5ReadModelsAndIndexes1781465656565';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_daily_stats" (
        "user_id" uuid NOT NULL,
        "date" date NOT NULL,
        "event_count" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_user_daily_stats" PRIMARY KEY ("user_id", "date")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_tag_stats" (
        "user_id" uuid NOT NULL,
        "tag" character varying(100) NOT NULL,
        "event_count" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_user_tag_stats" PRIMARY KEY ("user_id", "tag")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_domain_stats" (
        "user_id" uuid NOT NULL,
        "domain" character varying(255) NOT NULL,
        "event_count" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_user_domain_stats" PRIMARY KEY ("user_id", "domain")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_browser_stats" (
        "user_id" uuid NOT NULL,
        "browser" character varying(100) NOT NULL,
        "event_count" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_user_browser_stats" PRIMARY KEY ("user_id", "browser")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_source_stats" (
        "user_id" uuid NOT NULL,
        "source_id" uuid NOT NULL,
        "event_count" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_user_source_stats" PRIMARY KEY ("user_id", "source_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_hourly_stats" (
        "user_id" uuid NOT NULL,
        "hour" smallint NOT NULL,
        "event_count" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_user_hourly_stats" PRIMARY KEY ("user_id", "hour")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_event_summary" (
        "user_id" uuid NOT NULL,
        "total_events" integer NOT NULL DEFAULT 0,
        "untagged_events" integer NOT NULL DEFAULT 0,
        "first_tracked_at" TIMESTAMP WITH TIME ZONE,
        "last_tracked_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_user_event_summary" PRIMARY KEY ("user_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "projection_processed_events" (
        "event_id" uuid NOT NULL,
        "kind" character varying(50) NOT NULL,
        "processed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_projection_processed_events" PRIMARY KEY ("event_id", "kind")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_events_user_occurred_at_id"
      ON "events" ("user_id", "occurred_at" DESC, "id" DESC)
    `);

    await queryRunner.query(`
      CREATE MATERIALIZED VIEW "user_weekly_stats" AS
      SELECT
        e.user_id,
        date_trunc('week', e.occurred_at AT TIME ZONE 'UTC')::date AS week_start,
        COUNT(*)::int AS event_count
      FROM events e
      GROUP BY e.user_id, date_trunc('week', e.occurred_at AT TIME ZONE 'UTC')::date
      WITH NO DATA
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_user_weekly_stats"
      ON "user_weekly_stats" ("user_id", "week_start")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_user_weekly_stats"`);
    await queryRunner.query(`DROP MATERIALIZED VIEW "user_weekly_stats"`);
    await queryRunner.query(`DROP INDEX "IDX_events_user_occurred_at_id"`);
    await queryRunner.query(`DROP TABLE "projection_processed_events"`);
    await queryRunner.query(`DROP TABLE "user_event_summary"`);
    await queryRunner.query(`DROP TABLE "user_hourly_stats"`);
    await queryRunner.query(`DROP TABLE "user_source_stats"`);
    await queryRunner.query(`DROP TABLE "user_browser_stats"`);
    await queryRunner.query(`DROP TABLE "user_domain_stats"`);
    await queryRunner.query(`DROP TABLE "user_tag_stats"`);
    await queryRunner.query(`DROP TABLE "user_daily_stats"`);
  }
}
