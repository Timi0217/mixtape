# Railway Environment Variables Setup

Your Railway deployment needs these environment variables set to work properly:

## 🔑 **Required Environment Variables**

Go to your Railway project dashboard and set these variables:

### **JWT Secrets** (Use these strong generated secrets)
```
JWT_SECRET=dfdce629da003f530e35086a17fe3826cea6f5db2988e16bb5d33f8168b1c81e84eab7b169b8f4b51fa912ff6104ce453f4c05214b05f6e5a576cd334a664189
JWT_REFRESH_SECRET=affde4226c54f1d0aadea551cb49ab3ccfb9563ecf3637a004a2b885cf843148a80183c146541beb7b6e52f625ef1f6049cf21ddc58d3253b8482df054ff3235
```

### **Server Configuration**
```
NODE_ENV=production
PORT=8080
```

### **Spotify API** (Your actual keys)
```
SPOTIFY_CLIENT_ID=bec9c9ed6518422c93034a0adf028097
SPOTIFY_CLIENT_SECRET=b09bf29d1ff949d6ba52ebc5c8cbd708
SPOTIFY_REDIRECT_URI=https://amiable-upliftment-production.up.railway.app/api/oauth/spotify/callback
```

### **Frontend URL**
```
FRONTEND_URL=mixtape://
```

### **API Base URL** (Replace with your actual Railway URL)
```
API_BASE_URL=https://amiable-upliftment-production.up.railway.app
```

### **Apple Music API** (Your actual keys)
```
APPLE_MUSIC_KEY_ID=7X7UG77ZA4
APPLE_MUSIC_TEAM_ID=TXQUSHN8GJ
APPLE_MUSIC_PRIVATE_KEY_PATH=./keys/AuthKey_7X7UG77ZA4.p8
```

### **Database** (Railway should set this automatically)
```
DATABASE_URL=(Railway PostgreSQL connection string - should be set automatically)
```

### **Redis** (If you have Redis add-on)
```
REDIS_URL=redis://localhost:6379
```

## 🚀 **How to Set Variables in Railway**

1. **Go to your Railway dashboard**
2. **Click on your backend service**
3. **Go to "Variables" tab**
4. **Add each variable above**
5. **Deploy** (should happen automatically)

## ⚠️ **Important Notes**

- **DATABASE_URL**: Railway should set this automatically when you add PostgreSQL
- **APPLE_MUSIC_PRIVATE_KEY_PATH**: You'll need to upload the `.p8` file to Railway or use a different method
- The JWT secrets above are secure and ready for production use

## 🔧 **Apple Music Private Key**

For the Apple Music private key, you have two options:

1. **Environment Variable**: Convert the `.p8` file content to a single-line string and set `APPLE_MUSIC_PRIVATE_KEY` instead of `APPLE_MUSIC_PRIVATE_KEY_PATH`
2. **File Upload**: Use Railway's file storage or commit a encrypted version

Let me know if you need help with either approach!