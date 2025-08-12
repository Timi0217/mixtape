-- CreateTable
CREATE TABLE "user_notification_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "user_notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_music_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "preferred_platform" TEXT NOT NULL DEFAULT 'spotify',
    "auto_match_songs" BOOLEAN NOT NULL DEFAULT true,
    "high_quality_only" BOOLEAN NOT NULL DEFAULT false,
    "explicit_content_filter" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_music_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_notification_settings_user_id_key" ON "user_notification_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_music_preferences_user_id_key" ON "user_music_preferences"("user_id");

-- AddForeignKey
ALTER TABLE "user_notification_settings" ADD CONSTRAINT "user_notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_music_preferences" ADD CONSTRAINT "user_music_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
