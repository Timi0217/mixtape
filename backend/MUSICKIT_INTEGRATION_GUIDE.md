# MusicKit Integration Guide for Frontend

## Overview
This guide explains how to implement full MusicKit integration on the frontend to enable real Apple Music playlist creation.

## Backend API Endpoints

### 1. Get MusicKit Configuration
```
GET /api/oauth/apple-music/login
```

**Response:**
```json
{
  "state": "uuid-string",
  "musicKitConfig": {
    "developerToken": "eyJhbGciOiJFUzI1NiIs...",
    "app": {
      "name": "Mixtape",
      "build": "1.0.0"
    }
  },
  "instructions": "Use MusicKit.js with the provided configuration to authorize and get musicUserToken"
}
```

### 2. Exchange Music User Token
```
POST /api/oauth/apple-music/exchange
```

**Request Body:**
```json
{
  "musicUserToken": "string", // Music User Token from MusicKit.js
  "userInfo": {              // Optional user info
    "id": "string",
    "name": "string",
    "email": "string"
  }
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt-token-for-mixtape-app",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "displayName": "User Name"
  },
  "platform": "apple-music"
}
```

## Frontend Implementation (React Native)

### 1. Install MusicKit (if needed)
For React Native, you'll need to use the native iOS MusicKit APIs or a bridge.

### 2. Implement Apple Music Authentication Flow

```javascript
import { MusicKit } from '@react-native-community/music-kit'; // or similar

class AppleMusicAuth {
  async authenticateWithAppleMusic() {
    try {
      // Step 1: Get MusicKit configuration from backend
      const configResponse = await fetch('/api/oauth/apple-music/login');
      const { state, musicKitConfig } = await configResponse.json();
      
      // Step 2: Configure MusicKit
      await MusicKit.configure({
        developerToken: musicKitConfig.developerToken,
        app: musicKitConfig.app
      });
      
      // Step 3: Request authorization
      const music = await MusicKit.getInstance();
      const musicUserToken = await music.authorize();
      
      if (!musicUserToken) {
        throw new Error('Failed to get Music User Token');
      }
      
      // Step 4: Exchange token with backend
      const exchangeResponse = await fetch('/api/oauth/apple-music/exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          musicUserToken,
          userInfo: {
            // Add any user info if available
            name: 'User Name' // optional
          }
        }),
      });
      
      const result = await exchangeResponse.json();
      
      if (result.success) {
        // Store the JWT token for app authentication
        await AsyncStorage.setItem('authToken', result.token);
        return result;
      } else {
        throw new Error(result.message || 'Authentication failed');
      }
      
    } catch (error) {
      console.error('Apple Music authentication failed:', error);
      throw error;
    }
  }
}
```

### 3. Native iOS Implementation (if using native bridge)

```swift
import MusicKit

class AppleMusicManager {
    func authenticateAppleMusic() async throws -> String {
        // Request authorization
        let status = await MusicAuthorization.request()
        
        guard status == .authorized else {
            throw AppleMusicError.authorizationDenied
        }
        
        // Get music user token
        guard let musicUserToken = await MusicAuthorization.shared.userToken else {
            throw AppleMusicError.noUserToken
        }
        
        return musicUserToken
    }
}
```

## Key Differences from Previous Implementation

### ✅ What Changed
1. **Real MusicKit Integration**: Uses actual Music User Tokens instead of Apple ID tokens
2. **No Demo Tokens**: Removed all placeholder/demo token logic
3. **Proper Token Validation**: Backend validates Music User Tokens before playlist creation
4. **Clear Error Messages**: Specific errors guide users to correct authentication

### ✅ What Works Now
1. **Real Playlist Creation**: Creates actual playlists in user's Apple Music library
2. **Token Validation**: Proper validation of Music User Tokens
3. **Error Handling**: Clear errors when wrong token types are used
4. **MusicKit Configuration**: Backend provides developer token for frontend

### ⚠️ Important Notes
1. **Music User Token Required**: Only accepts real Music User Tokens from MusicKit
2. **Apple ID Tokens Rejected**: Will not work with Apple Sign In tokens
3. **Permissions Required**: User must grant playlist creation permissions in MusicKit
4. **Developer Token**: Backend automatically provides the required developer token

## Testing the Integration

### 1. Test Authentication
```bash
# Get MusicKit config
curl -X GET http://localhost:3000/api/oauth/apple-music/login

# Test token exchange (use real Music User Token)
curl -X POST http://localhost:3000/api/oauth/apple-music/exchange \
  -H "Content-Type: application/json" \
  -d '{"musicUserToken": "REAL_MUSIC_USER_TOKEN_FROM_MUSICKIT"}'
```

### 2. Test Playlist Creation
After successful authentication, the user can create playlists through the normal group playlist creation flow, and real Apple Music playlists will be created.

## Deprecated Endpoints
These endpoints are now deprecated and will return 410 errors:
- `/api/oauth/apple/music-auth`
- `/api/oauth/apple/complete-music-auth`
- Any routes using Apple ID tokens for music access

## Next Steps
1. Implement MusicKit.js or native MusicKit integration in your React Native app
2. Update authentication flow to use the new endpoints
3. Test with real Apple Music accounts
4. Remove any old Apple ID token logic from frontend

## Support
The backend now fully supports real Apple Music playlist creation. All demo/placeholder functionality has been removed in favor of proper MusicKit integration.