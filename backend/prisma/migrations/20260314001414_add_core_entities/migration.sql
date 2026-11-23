-- CreateEnum
CREATE TYPE "ArgumentStatus" AS ENUM ('IN', 'OUT', 'UNDECIDED');

-- CreateEnum
CREATE TYPE "ParentType" AS ENUM ('SUBTOPIC', 'ARGUMENT');

-- CreateTable
CREATE TABLE "Topic" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subtopic" (
    "id" SERIAL NOT NULL,
    "topicId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subtopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "conclusion" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriticalQuestion" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "validResponseSchemeIds" TEXT[],

    CONSTRAINT "CriticalQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Argument" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "selectedCqId" TEXT,
    "isInitial" BOOLEAN NOT NULL,
    "parentId" TEXT,
    "parentType" "ParentType" NOT NULL,
    "subtopicId" INTEGER NOT NULL,
    "status" "ArgumentStatus" NOT NULL DEFAULT 'UNDECIDED',
    "childIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "descendantCount" INTEGER NOT NULL DEFAULT 0,
    "authorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Argument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArgumentVariable" (
    "id" SERIAL NOT NULL,
    "argumentId" TEXT NOT NULL,
    "variableId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ArgumentVariable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArgumentVariable_argumentId_variableId_key" ON "ArgumentVariable"("argumentId", "variableId");

-- AddForeignKey
ALTER TABLE "Subtopic" ADD CONSTRAINT "Subtopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriticalQuestion" ADD CONSTRAINT "CriticalQuestion_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Argument" ADD CONSTRAINT "Argument_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Argument" ADD CONSTRAINT "Argument_selectedCqId_fkey" FOREIGN KEY ("selectedCqId") REFERENCES "CriticalQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Argument" ADD CONSTRAINT "Argument_subtopicId_fkey" FOREIGN KEY ("subtopicId") REFERENCES "Subtopic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Argument" ADD CONSTRAINT "Argument_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArgumentVariable" ADD CONSTRAINT "ArgumentVariable_argumentId_fkey" FOREIGN KEY ("argumentId") REFERENCES "Argument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
