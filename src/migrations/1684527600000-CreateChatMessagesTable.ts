import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatMessagesTable1684527600000 implements MigrationInterface {
  name = 'CreateChatMessagesTable1684527600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "chat_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "rideRequestId" uuid NOT NULL, "fromUserId" uuid NOT NULL, "text" text NOT NULL, "sentAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_chat_messages_id" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_messages"`);
  }
}
