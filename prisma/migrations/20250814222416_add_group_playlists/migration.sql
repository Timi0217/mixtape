-- CreateTable
CREATE TABLE "group_playlists" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platform_playlist_id" TEXT NOT NULL,
    "playlist_name" TEXT NOT NULL,
    "playlist_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_playlists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "group_playlists_group_id_platform_key" ON "group_playlists"("group_id", "platform");

-- AddForeignKey
ALTER TABLE "group_playlists" ADD CONSTRAINT "group_playlists_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
