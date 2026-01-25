import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixUserTokensUserId20260126224500 implements MigrationInterface {
  name = 'FixUserTokensUserId20260126224500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'user_id'
        ) THEN
          ALTER TABLE "user_tokens" ADD COLUMN "user_id" integer;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'userId'
        ) THEN
          EXECUTE 'UPDATE "user_tokens" SET "user_id" = "userId" WHERE "user_id" IS NULL';
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'user_id'
        ) THEN
          ALTER TABLE "user_tokens" ALTER COLUMN "user_id" SET NOT NULL;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'userId'
        ) THEN
          ALTER TABLE "user_tokens" DROP COLUMN "userId";
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'userId'
        ) THEN
          ALTER TABLE "user_tokens" ADD COLUMN "userId" integer;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'user_id'
        ) THEN
          EXECUTE 'UPDATE "user_tokens" SET "userId" = "user_id" WHERE "userId" IS NULL';
        END IF;
      END $$;
    `);
  }
}
