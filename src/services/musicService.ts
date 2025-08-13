import axios from 'axios';
import { prisma } from '../config/database';

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  imageUrl?: string;
  previewUrl?: string;
  platform: string;
  platformId: string;
}

export interface NormalizedSong {
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  imageUrl?: string;
  previewUrl?: string;
  platformIds: Record<string, string>;
}

class MusicService {
  async searchAcrossPlatforms(
    query: string,
    platforms: string[] = ['spotify', 'apple-music', 'youtube-music'],
    limit: number = 20
  ): Promise<SearchResult[]> {
    const searchPromises = platforms.map(platform => 
      this.searchOnPlatform(platform, query, limit)
    );

    try {
      const results = await Promise.allSettled(searchPromises);
      const allResults: SearchResult[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allResults.push(...result.value);
        } else {
          console.warn(`Search failed for platform ${platforms[index]}:`, result.reason);
        }
      });

      return this.deduplicateResults(allResults);
    } catch (error) {
      console.error('Music search error:', error);
      throw new Error('Failed to search across platforms');
    }
  }

  private async searchOnPlatform(platform: string, query: string, limit: number): Promise<SearchResult[]> {
    switch (platform) {
      case 'spotify':
        return this.searchSpotify(query, limit);
      case 'apple-music':
        return this.searchAppleMusic(query, limit);
      case 'youtube-music':
        return this.searchYouTubeMusic(query, limit);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private async searchSpotify(query: string, limit: number): Promise<SearchResult[]> {
    try {
      if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
        console.warn('Spotify credentials not configured, skipping Spotify search');
        return [];
      }

      const accessToken = await this.getSpotifyAccessToken();
      
      const response = await axios.get('https://api.spotify.com/v1/search', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        params: {
          q: query,
          type: 'track',
          limit,
        },
      });

      return response.data.tracks.items.map((track: any) => ({
        id: `spotify:${track.id}`,
        title: track.name,
        artist: track.artists.map((a: any) => a.name).join(', '),
        album: track.album.name,
        duration: Math.floor(track.duration_ms / 1000),
        imageUrl: track.album.images[0]?.url,
        previewUrl: track.preview_url,
        platform: 'spotify',
        platformId: track.id,
      }));
    } catch (error) {
      console.error('Spotify search error:', error);
      return [];
    }
  }

  private async searchAppleMusic(query: string, limit: number): Promise<SearchResult[]> {
    try {
      if (!process.env.APPLE_MUSIC_KEY_ID || !process.env.APPLE_MUSIC_TEAM_ID || !process.env.APPLE_MUSIC_PRIVATE_KEY_PATH) {
        console.warn('Apple Music credentials not configured, skipping Apple Music search');
        return [];
      }

      const { appleMusicService } = await import('./appleMusicService');
      const songs = await appleMusicService.searchMusic(query, limit);
      return appleMusicService.formatSearchResults(songs);
    } catch (error) {
      console.error('Apple Music search error:', error);
      return [];
    }
  }

  private async searchYouTubeMusic(query: string, limit: number): Promise<SearchResult[]> {
    try {
      if (!process.env.YOUTUBE_API_KEY) {
        console.warn('YouTube API key not configured, skipping YouTube Music search');
        return [];
      }

      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          q: `${query} music`,
          type: 'video',
          videoCategoryId: '10', // Music category
          maxResults: limit,
          key: process.env.YOUTUBE_API_KEY,
        },
      });

      return response.data.items.map((item: any) => ({
        id: `youtube:${item.id.videoId}`,
        title: this.cleanYouTubeTitle(item.snippet.title),
        artist: item.snippet.channelTitle,
        duration: undefined, // YouTube API doesn't provide duration in search
        imageUrl: item.snippet.thumbnails.medium?.url,
        previewUrl: undefined, // YouTube doesn't provide preview URLs
        platform: 'youtube-music',
        platformId: item.id.videoId,
      }));
    } catch (error) {
      console.error('YouTube Music search error:', error);
      return [];
    }
  }

  // Clean up YouTube video titles to extract song information
  private cleanYouTubeTitle(title: string): string {
    // Remove common YouTube music video suffixes
    return title
      .replace(/\s*\(official\s*(music\s*)?video\)\s*/gi, '')
      .replace(/\s*\(official\s*audio\)\s*/gi, '')
      .replace(/\s*\(lyric\s*video\)\s*/gi, '')
      .replace(/\s*\[official\s*(music\s*)?video\]\s*/gi, '')
      .replace(/\s*\[official\s*audio\]\s*/gi, '')
      .replace(/\s*\[lyric\s*video\]\s*/gi, '')
      .trim();
  }

  private spotifyAccessToken?: string;
  private spotifyTokenExpiry?: Date;

  private async getSpotifyAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.spotifyAccessToken && this.spotifyTokenExpiry && this.spotifyTokenExpiry > new Date()) {
      return this.spotifyAccessToken;
    }

    try {
      const response = await axios.post('https://accounts.spotify.com/api/token', 
        'grant_type=client_credentials',
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(
              `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
            ).toString('base64')}`,
          },
        }
      );

      // Cache the token with 1 hour expiry (Spotify tokens last 1 hour)
      this.spotifyAccessToken = response.data.access_token;
      this.spotifyTokenExpiry = new Date(Date.now() + (response.data.expires_in - 60) * 1000);

      return this.spotifyAccessToken;
    } catch (error) {
      console.error('Spotify token error:', error);
      throw new Error('Failed to get Spotify access token');
    }
  }

  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Map<string, SearchResult>();
    
    results.forEach(result => {
      const key = `${result.title.toLowerCase()}-${result.artist.toLowerCase()}`;
      const existing = seen.get(key);
      
      if (!existing || this.getPlatformPriority(result.platform) > this.getPlatformPriority(existing.platform)) {
        seen.set(key, result);
      }
    });
    
    return Array.from(seen.values());
  }

  private getPlatformPriority(platform: string): number {
    const priorities: Record<string, number> = {
      'spotify': 3,
      'apple-music': 2,
      'youtube-music': 1,
    };
    return priorities[platform] || 0;
  }

  async findOrCreateSong(searchResult: SearchResult): Promise<string> {
    const platformIds: Record<string, string> = {
      [searchResult.platform]: searchResult.platformId,
    };

    let existingSong = await prisma.song.findFirst({
      where: {
        OR: [
          {
            AND: [
              { title: { equals: searchResult.title, mode: 'insensitive' } },
              { artist: { equals: searchResult.artist, mode: 'insensitive' } },
            ],
          },
          {
            platformIds: {
              path: [searchResult.platform],
              equals: searchResult.platformId,
            },
          },
        ],
      },
    });

    if (existingSong) {
      const updatedPlatformIds = {
        ...existingSong.platformIds as Record<string, string>,
        ...platformIds,
      };

      await prisma.song.update({
        where: { id: existingSong.id },
        data: {
          platformIds: updatedPlatformIds,
          imageUrl: existingSong.imageUrl || searchResult.imageUrl,
          previewUrl: existingSong.previewUrl || searchResult.previewUrl,
          duration: existingSong.duration || searchResult.duration,
        },
      });

      return existingSong.id;
    }

    const newSong = await prisma.song.create({
      data: {
        title: searchResult.title,
        artist: searchResult.artist,
        album: searchResult.album,
        duration: searchResult.duration,
        imageUrl: searchResult.imageUrl,
        previewUrl: searchResult.previewUrl,
        platformIds,
      },
    });

    return newSong.id;
  }

  async matchSongAcrossPlatforms(
    songs: { title: string; artist: string; album?: string }[],
    targetPlatform: string
  ): Promise<{ originalSong: any; matches: SearchResult[]; bestMatch?: SearchResult; confidence: number }[]> {
    const results = [];

    for (const song of songs) {
      console.log(`🔍 Matching song: "${song.title}" by ${song.artist} on ${targetPlatform}`);
      
      // Try multiple search strategies
      const searchStrategies = [
        `${song.title} ${song.artist}`, // Basic search
        `"${song.title}" "${song.artist}"`, // Quoted search for exact matches
        `${song.artist} ${song.title}`, // Artist-first search
        song.album ? `${song.title} ${song.artist} ${song.album}` : null, // Include album if available
      ].filter(Boolean);

      let allMatches: SearchResult[] = [];
      
      // Try each search strategy
      for (const query of searchStrategies) {
        try {
          const matches = await this.searchOnPlatform(targetPlatform, query as string, 10);
          allMatches.push(...matches);
        } catch (error) {
          console.warn(`Search strategy failed for "${query}":`, error);
        }
      }

      // Remove duplicates based on platform ID
      const uniqueMatches = this.removeDuplicateMatches(allMatches);
      
      // Score and filter matches
      const scoredMatches = uniqueMatches.map(match => ({
        ...match,
        confidence: this.calculateMatchConfidence(song, match)
      })).filter(match => match.confidence > 0.5) // Only keep matches with >50% confidence
        .sort((a, b) => b.confidence - a.confidence); // Sort by confidence descending

      const bestMatch = scoredMatches.length > 0 ? scoredMatches[0] : undefined;
      const maxConfidence = bestMatch?.confidence || 0;

      console.log(`✅ Found ${scoredMatches.length} matches, best confidence: ${maxConfidence.toFixed(2)}`);

      results.push({
        originalSong: song,
        matches: scoredMatches,
        bestMatch,
        confidence: maxConfidence,
      });
    }

    return results;
  }

  /**
   * Remove duplicate search results based on platform ID
   */
  private removeDuplicateMatches(matches: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return matches.filter(match => {
      if (seen.has(match.platformId)) {
        return false;
      }
      seen.add(match.platformId);
      return true;
    });
  }

  /**
   * Calculate confidence score for a song match (0-1)
   */
  private calculateMatchConfidence(
    original: { title: string; artist: string; album?: string },
    candidate: SearchResult
  ): number {
    const titleSimilarity = this.calculateStringSimilarity(original.title, candidate.title);
    const artistSimilarity = this.calculateStringSimilarity(original.artist, candidate.artist);
    
    // Album similarity (optional, lower weight)
    let albumSimilarity = 0.5; // Neutral score if no album to compare
    if (original.album && candidate.album) {
      albumSimilarity = this.calculateStringSimilarity(original.album, candidate.album);
    }
    
    // Weighted average: title and artist are most important
    const confidence = (titleSimilarity * 0.5) + (artistSimilarity * 0.4) + (albumSimilarity * 0.1);
    
    // Boost confidence for exact matches
    const exactTitleMatch = this.normalizeString(original.title) === this.normalizeString(candidate.title);
    const exactArtistMatch = this.normalizeString(original.artist) === this.normalizeString(candidate.artist);
    
    if (exactTitleMatch && exactArtistMatch) {
      return Math.min(1.0, confidence + 0.2);
    } else if (exactTitleMatch || exactArtistMatch) {
      return Math.min(1.0, confidence + 0.1);
    }
    
    return confidence;
  }

  /**
   * Calculate string similarity using improved algorithm
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const normalized1 = this.normalizeString(str1);
    const normalized2 = this.normalizeString(str2);
    
    // Exact match
    if (normalized1 === normalized2) return 1.0;
    
    // Check if one string contains the other
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      const longer = normalized1.length > normalized2.length ? normalized1 : normalized2;
      const shorter = normalized1.length > normalized2.length ? normalized2 : normalized1;
      return shorter.length / longer.length;
    }
    
    // Use Levenshtein distance for general similarity
    return this.fuzzyMatch(str1, str2);
  }

  /**
   * Bulk match songs across multiple platforms efficiently
   */
  async bulkMatchSongs(
    songs: { id: string; title: string; artist: string; album?: string }[],
    targetPlatforms: string[]
  ): Promise<Record<string, { originalSong: any; platformMatches: Record<string, SearchResult[]> }>> {
    console.log(`🔄 Starting bulk matching for ${songs.length} songs across ${targetPlatforms.length} platforms`);
    
    const results: Record<string, { originalSong: any; platformMatches: Record<string, SearchResult[]> }> = {};
    
    // Process songs in batches to avoid overwhelming APIs
    const batchSize = 5;
    for (let i = 0; i < songs.length; i += batchSize) {
      const batch = songs.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(songs.length / batchSize)}`);
      
      // Process each song in the batch
      const batchPromises = batch.map(async (song) => {
        const platformMatches: Record<string, SearchResult[]> = {};
        
        // Search across all target platforms
        for (const platform of targetPlatforms) {
          try {
            const matchResult = await this.matchSongAcrossPlatforms([song], platform);
            platformMatches[platform] = matchResult[0]?.matches || [];
          } catch (error) {
            console.warn(`Failed to match song ${song.id} on ${platform}:`, error);
            platformMatches[platform] = [];
          }
        }
        
        return {
          songId: song.id,
          originalSong: song,
          platformMatches,
        };
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Store results
      batchResults.forEach(result => {
        results[result.songId] = {
          originalSong: result.originalSong,
          platformMatches: result.platformMatches,
        };
      });
      
      // Small delay between batches to be respectful to APIs
      if (i + batchSize < songs.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✅ Bulk matching completed for ${Object.keys(results).length} songs`);
    return results;
  }

  /**
   * Normalize strings for comparison
   */
  private normalizeString(str: string): string {
    return str.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim()
      .replace(/\b(feat|ft|featuring|with)\b.*$/i, '') // Remove featuring artists
      .replace(/\b(remix|remaster|remastered|radio edit|clean|explicit)\b/gi, '') // Remove version info
      .trim();
  }


  private fuzzyMatch(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1.toLowerCase() : str2.toLowerCase();
    const shorter = str1.length > str2.length ? str2.toLowerCase() : str1.toLowerCase();
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}

export const musicService = new MusicService();