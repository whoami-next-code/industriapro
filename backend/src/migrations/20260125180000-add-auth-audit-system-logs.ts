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
        "user_id" integer NOT NULL,
        "type" varchar NOT NULL,
        "token_hash" varchar NOT NULL,
        "expires_at" timestamp NOT NULL,
        "used_at" timestamp NULL,
        "ip" varchar NULL,
        "user_agent" varchar NULL,
        "meta" json NULL,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'user_id'
        ) THEN
          ALTER TABLE "user_tokens" ADD COLUMN "user_id" integer;
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'user_tokens' AND column_name = 'userId'
          ) THEN
            EXECUTE 'UPDATE "user_tokens" SET "user_id" = "userId" WHERE "user_id" IS NULL';
          END IF;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'user_id'
            AND is_nullable = 'NO'
        ) THEN
          ALTER TABLE "user_tokens" ALTER COLUMN "user_id" SET NOT NULL;
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
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'token_hash'
        ) THEN
          ALTER TABLE "user_tokens" ADD COLUMN "token_hash" varchar;
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'user_tokens' AND column_name = 'tokenHash'
          ) THEN
            EXECUTE 'UPDATE "user_tokens" SET "token_hash" = "tokenHash" WHERE "token_hash" IS NULL';
          END IF;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'type'
        ) THEN
          ALTER TABLE "user_tokens" ADD COLUMN "type" varchar;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'expires_at'
        ) THEN
          ALTER TABLE "user_tokens" ADD COLUMN "expires_at" timestamp;
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'user_tokens' AND column_name = 'expiresAt'
          ) THEN
            EXECUTE 'UPDATE "user_tokens" SET "expires_at" = "expiresAt" WHERE "expires_at" IS NULL';
          END IF;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'used_at'
        ) THEN
          ALTER TABLE "user_tokens" ADD COLUMN "used_at" timestamp NULL;
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'user_tokens' AND column_name = 'usedAt'
          ) THEN
            EXECUTE 'UPDATE "user_tokens" SET "used_at" = "usedAt" WHERE "used_at" IS NULL';
          END IF;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'ip'
        ) THEN
          ALTER TABLE "user_tokens" ADD COLUMN "ip" varchar NULL;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'user_agent'
        ) THEN
          ALTER TABLE "user_tokens" ADD COLUMN "user_agent" varchar NULL;
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'user_tokens' AND column_name = 'userAgent'
          ) THEN
            EXECUTE 'UPDATE "user_tokens" SET "user_agent" = "userAgent" WHERE "user_agent" IS NULL';
          END IF;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'meta'
        ) THEN
          ALTER TABLE "user_tokens" ADD COLUMN "meta" json NULL;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_tokens' AND column_name = 'created_at'
        ) THEN
          ALTER TABLE "user_tokens" ADD COLUMN "created_at" timestamp NOT NULL DEFAULT now();
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'user_tokens' AND column_name = 'createdAt'
          ) THEN
            EXECUTE 'UPDATE "user_tokens" SET "created_at" = "createdAt" WHERE "created_at" IS NULL';
          END IF;
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_user_tokens_hash_type" ON "user_tokens" ("token_hash", "type")`,
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
