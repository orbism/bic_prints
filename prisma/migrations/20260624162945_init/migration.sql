-- CreateTable
CREATE TABLE "Holder" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "fdpCount" INTEGER NOT NULL DEFAULT 0,
    "adpCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapshotMeta" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastFetched" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SnapshotMeta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Holder_address_key" ON "Holder"("address");
