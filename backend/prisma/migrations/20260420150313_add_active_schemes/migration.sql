-- AlterTable
ALTER TABLE "Argument" ALTER COLUMN "argumentText" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ActiveScheme" (
    "schemeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiveScheme_pkey" PRIMARY KEY ("schemeId")
);

-- Seed existing schemes as active on first run
INSERT INTO "ActiveScheme" ("schemeId")
SELECT "id"
FROM "Scheme"
ON CONFLICT ("schemeId") DO NOTHING;

-- AddForeignKey
ALTER TABLE "ActiveScheme" ADD CONSTRAINT "ActiveScheme_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
