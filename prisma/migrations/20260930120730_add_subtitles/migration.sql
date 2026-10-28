-- CreateTable
CREATE TABLE "Subtitle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mediaId" INTEGER NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'und',
    "label" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    CONSTRAINT "Subtitle_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Subtitle_filePath_key" ON "Subtitle"("filePath");

-- CreateIndex
CREATE INDEX "Subtitle_mediaId_idx" ON "Subtitle"("mediaId");
