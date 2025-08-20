# Test Apple Music Playlist Creation (Backend Only) 🧪

Since the frontend authentication doesn't work with Expo, let's test the Apple Music backend directly to verify it's working correctly.

## 🎯 Test 1: Developer Token Validation

First, verify the Apple Music developer token is working:

```bash
curl -X GET "https://mixtape-production.up.railway.app/test/apple-music-token"
```

**Expected Result:**
```json
{
  "success": true,
  "message": "Apple Music developer token generated successfully",
  "tokenLength": 1234,
  "tokenPreview": "eyJhbGciOiJFUzI1NiIsImtpZCI6IjdYN1VHNzdaQTQi..."
}
```

## 🎯 Test 2: Apple Music Search (Basic API Test)

Test basic Apple Music API connectivity:

```bash
curl -X POST "https://mixtape-production.up.railway.app/test/apple-music-search" \
  -H "Content-Type: application/json" \
  -d '{"query": "The Beatles", "limit": 3}'
```

**Expected Result:**
```json
{
  "success": true,
  "message": "Apple Music API working correctly",
  "query": "The Beatles",
  "count": 3,
  "results": [...]
}
```

## 🎯 Test 3: Playlist Creation (Mock Token)

Test playlist creation with mock token (will likely fail but shows the flow):

```bash
curl -X POST "https://mixtape-production.up.railway.app/test/apple-music-playlist" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mixtape Test Playlist",
    "description": "Testing Apple Music playlist creation from backend"
  }'
```

**Expected Result (Mock Token):**
```json
{
  "success": false,
  "error": "401 Unauthorized",
  "analysis": {
    "likely_cause": "invalid_music_user_token",
    "action_needed": "Need a real Music User Token from Apple Music authorization"
  }
}
```

## 🎯 Test 4: Playlist Creation (Real Token)

If you can get a real Music User Token from a web browser, test with it:

```bash
curl -X POST "https://mixtape-production.up.railway.app/test/apple-music-playlist" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Real Mixtape Test",
    "description": "Testing with real Music User Token",
    "musicUserToken": "YOUR_REAL_MUSIC_USER_TOKEN_HERE"
  }'
```

**Expected Result (Real Token):**
```json
{
  "success": true,
  "playlist": {
    "id": "p.abc123",
    "name": "Real Mixtape Test",
    "url": "https://music.apple.com/us/playlist/...",
    "playParams": {...}
  },
  "message": "SUCCESS! Apple Music playlist creation works perfectly.",
  "note": "Backend integration is fully functional."
}
```

## 🔍 How to Get a Real Music User Token

Since the Expo app can't get one, you can test with a web browser:

1. **Open Developer Console** in Chrome/Safari
2. **Go to:** https://music.apple.com
3. **Run in Console:**
```javascript
// This would be the MusicKit.js flow
// (Requires MusicKit setup on a real website)
console.log('Would need MusicKit.js implementation');
```

## 📊 Test Results Analysis

### ✅ **If Tests 1-2 Pass:**
- Developer token works
- Apple Music API connectivity is good
- MusicKit is enabled correctly

### ⚠️ **If Test 3 Fails with 401:**
- Expected! Mock tokens don't work
- Need real Music User Token for playlist creation
- Backend logic is correct

### 🎉 **If Test 4 Passes:**
- **Apple Music integration is 100% working!**
- Only limitation is Expo frontend authentication
- Backend can create real playlists perfectly

## 🎯 Conclusion

This testing will prove that your Apple Music backend integration is fully functional. The challenge is purely getting Music User Tokens through Expo/React Native, not the playlist creation itself.