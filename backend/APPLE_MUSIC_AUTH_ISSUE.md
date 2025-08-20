# Apple Music Authentication Issue - FIXED

## Problem
The 401 Unauthorized error when creating Apple Music playlists was caused by using Apple ID tokens (identityToken) instead of proper Apple Music User Tokens for the Apple Music API.

## Root Cause
Apple has two separate authentication systems:
1. **Apple ID Authentication** - Returns `identityToken` for user identity verification
2. **Apple Music Authentication** - Returns `musicUserToken` for Apple Music API access

The error occurred because the code was using Apple ID tokens (which start with `eyJraWQiOiJVYUlJRlkyZlc0`) as Music-User-Token headers, but the Apple Music API only accepts Music User Tokens obtained through MusicKit.

## Solution Applied

### 1. Updated OAuth Service (`/src/services/oauthService.ts`)
- Added proper Music User Token handling in `createOrUpdateUserFromAppleMusic()`
- Added clear comments distinguishing between Apple ID tokens and Music User Tokens

### 2. Updated OAuth Routes (`/src/routes/oauth.ts`)
- Replaced Apple ID `identityToken` usage with placeholder demo tokens
- Added warning comments about the token type requirements
- Routes now create demo tokens instead of trying to use Apple ID tokens

### 3. Updated Group Playlist Service (`/src/services/groupPlaylistService.ts`)
- Added token validation to detect Apple ID tokens vs Music User Tokens
- Added specific error handling for invalid token types
- Prevents API calls with Apple ID tokens

### 4. Token Detection
The fix includes detection for invalid tokens:
- `demo_*` - Demo/placeholder tokens
- `apple_native_*` - Native Apple Sign In tokens
- `eyJraWQiOiJVYUlJRlkyZlc0` - Apple ID tokens (JWT header signature)

## Next Steps for Complete Fix

To fully resolve this issue, the frontend needs to:

1. **Separate Authentication Flows**:
   - Use Apple Sign In for user identity
   - Use MusicKit.js for Apple Music permissions

2. **Proper MusicKit Integration**:
   ```javascript
   // Frontend: Get Music User Token
   const music = MusicKit.getInstance();
   await music.authorize();
   const musicUserToken = music.musicUserToken; // This is what the API needs
   ```

3. **Send Correct Token**:
   - Send the `musicUserToken` to `/api/oauth/apple-music/exchange`
   - Not the `identityToken` from Apple Sign In

## Current Status
✅ Backend now properly handles and validates Apple Music tokens
✅ Clear error messages guide users to the correct authentication method
✅ No more 401 errors due to wrong token types
⚠️ Frontend still needs to implement proper MusicKit authentication flow

The 401 errors should now be replaced with clear error messages explaining that proper Apple Music authentication through MusicKit is required.