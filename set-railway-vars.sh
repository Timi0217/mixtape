#!/bin/bash

# Set Railway environment variables
# Run this in your Railway project directory with: railway variables set

echo "Setting Railway environment variables..."

railway variables --set "NODE_ENV=production" \
  --set "JWT_SECRET=dfdce629da003f530e35086a17fe3826cea6f5db2988e16bb5d33f8168b1c81e84eab7b169b8f4b51fa912ff6104ce453f4c05214b05f6e5a576cd334a664189" \
  --set "JWT_REFRESH_SECRET=affde4226c54f1d0aadea551cb49ab3ccfb9563ecf3637a004a2b885cf843148a80183c146541beb7b6e52f625ef1f6049cf21ddc58d3253b8482df054ff3235" \
  --set "SPOTIFY_CLIENT_ID=bec9c9ed6518422c93034a0adf028097" \
  --set "SPOTIFY_CLIENT_SECRET=b09bf29d1ff949d6ba52ebc5c8cbd708" \
  --set "SPOTIFY_REDIRECT_URI=https://amiable-upliftment-production.up.railway.app/api/oauth/spotify/callback" \
  --set "APPLE_MUSIC_KEY_ID=7X7UG77ZA4" \
  --set "APPLE_MUSIC_TEAM_ID=TXQUSHN8GJ" \
  --set "FRONTEND_URL=mixtape://" \
  --set "API_BASE_URL=https://amiable-upliftment-production.up.railway.app"

echo "Done! Railway should redeploy automatically with the new variables."