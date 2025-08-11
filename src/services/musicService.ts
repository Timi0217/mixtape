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
      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          q: `${query} music`,
          type: 'video',
          videoCategoryId: '10',
          maxResults: limit,
          key: process.env.YOUTUBE_API_KEY,
        },
      });

      return response.data.items.map((item: any) => ({
        id: `youtube:${item.id.videoId}`,
        title: item.snippet.title,
        artist: item.snippet.channelTitle,
        duration: undefined,
        imageUrl: item.snippet.thumbnails.medium?.url,
        previewUrl: undefined,
        platform: 'youtube-music',
        platformId: item.id.videoId,
      }));
    } catch (error) {
      console.error('YouTube Music search error:', error);
      return [];
    }
  }

  private async getSpotifyAccessToken(): Promise<string> {
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

      return response.data.access_token;
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
  ): Promise<{ originalSong: any; matches: SearchResult[] }[]> {
    const results = [];

    for (const song of songs) {
      const query = `${song.title} ${song.artist}`;
      const matches = await this.searchOnPlatform(targetPlatform, query, 5);
      
      const filteredMatches = matches.filter(match => 
        this.isSongMatch(song, match)
      );

      results.push({
        originalSong: song,
        matches: filteredMatches,
      });
    }

    return results;
  }

  private isSongMatch(
    original: { title: string; artist: string; album?: string },
    candidate: SearchResult
  ): boolean {
    const titleMatch = this.fuzzyMatch(original.title, candidate.title);
    const artistMatch = this.fuzzyMatch(original.artist, candidate.artist);
    
    return titleMatch > 0.7 && artistMatch > 0.6;
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