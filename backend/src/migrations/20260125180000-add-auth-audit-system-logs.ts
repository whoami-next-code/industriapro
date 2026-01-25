import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthAuditSystemLogs20260125180000
  implements MigrationInterface
{
  name = 'AddAuthAuditSystemLogs20260125180000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" varchar DEFAULT 'PENDING'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "token_version" integer DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verified" boolean DEFAULT false`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_tokens" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer NOT NULL,
        "type" varchar NOT NULL,
        "tokenHash" varchar NOT NULL,
        "expiresAt" timestamp NOT NULL,
        "usedAt" timestamp NULL,
        "ip" varchar NULL,
        "userAgent" varchar NULL,
        "meta" json NULL,
        "createdAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'userId'
        ) THEN
          ALTER TABLE "user_tokens" ADD COLUMN "userId" integer;
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'user_tokens' AND column_name = 'user_id'
          ) THEN
            EXECUTE 'UPDATE "user_tokens" SET "userId" = "user_id" WHERE "userId" IS NULL';
          END IF;
          ALTER TABLE "user_tokens" ALTER COLUMN "userId" SET NOT NULL;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_tokens_user'
        ) THEN
          ALTER TABLE "user_tokens"
          ADD CONSTRAINT "fk_user_tokens_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'tokenHash'
        ) THEN
          ALTER TABLE "user_tokens" ADD COLUMN "tokenHash" varchar;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'type'
        ) THEN
          ALTER TABLE "user_tokens" ADD COLUMN "type" varchar;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'expiresAt'
        ) THEN
          ALTER TABLE "user_tokens" ADD COLUMN "expiresAt" timestamp;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'usedAt'
        ) THEN
          ALTER TABLE "user_tokens" ADD COLUMN "usedAt" timestamp NULL;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'ip'
        ) THEN
          ALTER TABLE "user_tokens" ADD COLUMN "ip" varchar NULL;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'userAgent'
        ) THEN
          ALTER TABLE "user_tokens" ADD COLUMN "userAgent" varchar NULL;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'meta'
        ) THEN
          ALTER TABLE "user_tokens" ADD COLUMN "meta" json NULL;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'createdAt'
        ) THEN
          ALTER TABLE "user_tokens" ADD COLUMN "createdAt" timestamp NOT NULL DEFAULT now();
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_user_tokens_hash_type" ON "user_tokens" ("tokenHash", "type")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" SERIAL PRIMARY KEY,
        "action" varchar NOT NULL,
        "userId" integer NULL,
        "meta" json NULL,
        "createdAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "system_logs" (
        "id" SERIAL PRIMARY KEY,
        "level" varchar NOT NULL,
        "message" varchar NOT NULL,
        "context" json NULL,
        "createdAt" timestamp NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "system_logs"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "audit_logs"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "user_tokens"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "token_version"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "status"`,
    );
  }
}
