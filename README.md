# Mixtape - Cross-Platform Music Playlist Manager

A modern application that allows users to search for music across multiple streaming platforms (Spotify and Apple Music) and create unified playlists that sync across both connected platforms.

## Features

### ✅ Implemented
- **Unified Music Search Interface**: Search across Spotify and Apple Music simultaneously
- **Cross-Platform Playlist Creation**: Create playlists that sync to multiple streaming services
- **Song Matching**: Intelligent matching of songs across different platforms
- **React Native Frontend**: Clean, modern mobile interface
- **TypeScript Backend**: Robust Express.js API with Prisma ORM
- **Database Schema**: PostgreSQL with support for users, groups, songs, and playlists

### Backend API Endpoints
- `GET /api/music/search` - Search music across platforms
- `GET /api/music/song/:id` - Get song details
- `POST /api/music/songs/match` - Match songs across platforms  
- `GET /api/music/platforms` - Get available platforms
- `POST /api/playlists/create` - Create cross-platform playlist
- `GET /api/playlists/:id` - Get playlist details
- `GET /api/playlists` - Get user playlists

### Frontend Features
- **Search Screen**: Multi-platform music search with filtering
- **Playlist Management**: View and manage created playlists
- **Profile Screen**: Account management and platform connections
- **Cross-Platform Support**: Works on iOS, Android, and Web via Expo

## Architecture

```
mixtape/
├── backend/                 # Express.js + TypeScript API
│   ├── src/
│   │   ├── config/         # Database and environment config
│   │   ├── middleware/     # Auth and validation middleware
│   │   ├── models/         # Database models (Prisma)
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic (music, playlist services)
│   │   └── utils/          # Utility functions
│   ├── prisma/             # Database schema and migrations
│   └── package.json
├── frontend/               # React Native + Expo app
│   ├── navigation/         # Navigation setup
│   ├── screens/           # App screens
│   ├── services/          # API client
│   └── package.json
└── README.md
```

## Tech Stack

### Backend
- **Node.js + Express.js** - REST API server
- **TypeScript** - Type safety
- **Prisma ORM** - Database ORM with PostgreSQL
- **JWT Authentication** - Secure user authentication
- **Axios** - HTTP client for external APIs
- **Express Rate Limiting** - API protection

### Frontend
- **React Native + Expo** - Cross-platform mobile development
- **TypeScript** - Type safety
- **React Navigation** - Navigation system
- **Axios** - API communication
- **Expo Linear Gradient** - UI styling

### External APIs
- **Spotify Web API** - Music search and playlist creation
- **Apple Music API** - Music search and playlist management  

## Database Schema

The application uses PostgreSQL with the following main entities:

- **Users**: User accounts with display names and timezone
- **Groups**: User groups for collaborative playlists
- **Songs**: Normalized song data with cross-platform IDs
- **Playlists**: Generated playlists with platform-specific IDs
- **UserMusicAccounts**: OAuth tokens for streaming services

## Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Expo CLI (`npm install -g @expo/cli`)
- API keys for Spotify and Apple Music

### Backend Setup

1. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Environment setup**:
   ```bash
   cp .env.example .env
   # Edit .env with your database URL and API keys
   ```

3. **Database setup**:
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

The backend will be available at `http://localhost:3000`

### Frontend Setup

1. **Install dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Update API configuration**:
   Edit `services/api.ts` and set the correct `API_BASE_URL` for your backend.

3. **Start the app**:
   ```bash
   npm start
   ```

   Then follow the Expo CLI instructions to run on iOS simulator, Android emulator, or physical device.

## API Keys Setup

### Spotify
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/)
2. Create a new app
3. Add client ID and secret to your `.env` file

### Apple Music  
1. Sign up for [Apple Developer Program](https://developer.apple.com/programs/)
2. Create a MusicKit identifier and generate a token
3. Add the token to your `.env` file


## Development Scripts

### Backend
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production  
- `npm run start` - Start production server
- `npm run test` - Run tests
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript checks

### Frontend  
- `npm start` - Start Expo development server
- `npm run android` - Start on Android
- `npm run ios` - Start on iOS
- `npm run web` - Start web version

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`) 
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Roadmap

- [ ] Real-time collaboration features
- [ ] Advanced playlist customization
- [ ] Music recommendation engine
- [ ] Social sharing features
- [ ] Offline playlist caching
- [ ] Desktop application
- [ ] Additional streaming platform support