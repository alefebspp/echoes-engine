import { MigrationInterface, QueryRunner } from 'typeorm';

export class EventsUserExternalEventIdUniqueIndex1781465656563
  implements MigrationInterface
{
  name = 'EventsUserExternalEventIdUniqueIndex1781465656563';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_events_user_id_external_event_id" ON "events" ("user_id", "external_event_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_events_user_id_external_event_id"`,
    );
  }
}
