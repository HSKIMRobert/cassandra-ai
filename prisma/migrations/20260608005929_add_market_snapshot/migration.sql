-- CreateTable
CREATE TABLE "MarketSnapshot" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "stats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketSnapshot_category_createdAt_idx" ON "MarketSnapshot"("category", "createdAt");

-- CreateIndex
CREATE INDEX "MarketSnapshot_createdAt_idx" ON "MarketSnapshot"("createdAt");
