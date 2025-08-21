import ExpoMusickitModule from './ExpoMusickitModule';

export interface MusicKitAuthStatus {
  status: 'notDetermined' | 'denied' | 'restricted' | 'authorized' | 'unknown';
  authorized: boolean;
}

export interface MusicKitSong {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  artwork: string;
  isrc: string;
  url: string;
}

export interface MusicKitSearchResult {
  songs: MusicKitSong[];
}

export interface MusicKitPlaylist {
  id: string;
  name: string;
  description: string;
  songCount: number;
  success: boolean;
}

export interface MusicKitUser {
  hasSubscription: boolean;
  subscriptionType: string;
}

export interface MusicKitUserToken {
  userToken: string;
}

/**
 * Request authorization to access Apple Music
 */
export async function requestAuthorization(): Promise<MusicKitAuthStatus> {
  return await ExpoMusickitModule.requestAuthorization();
}

/**
 * Get current authorization status
 */
export async function getAuthorizationStatus(): Promise<MusicKitAuthStatus> {
  return await ExpoMusickitModule.getAuthorizationStatus();
}

/**
 * Get user token for API requests
 */
export async function getUserToken(): Promise<MusicKitUserToken> {
  return await ExpoMusickitModule.getUserToken();
}

/**
 * Search for music in Apple Music catalog
 */
export async function searchMusic(query: string, limit: number = 25): Promise<MusicKitSearchResult> {
  return await ExpoMusickitModule.searchMusic(query, limit);
}

/**
 * Create a new playlist in user's Apple Music library
 */
export async function createPlaylist(
  name: string, 
  description: string = '', 
  songIds: string[] = []
): Promise<MusicKitPlaylist> {
  return await ExpoMusickitModule.createPlaylist(name, description, songIds);
}

/**
 * Get current user information
 */
export async function getCurrentUser(): Promise<MusicKitUser> {
  return await ExpoMusickitModule.getCurrentUser();
}

/**
 * Check if user is authorized and has active subscription
 */
export async function isReady(): Promise<boolean> {
  try {
    const auth = await getAuthorizationStatus();
    if (!auth.authorized) {
      return false;
    }
    
    const user = await getCurrentUser();
    return user.hasSubscription;
  } catch {
    return false;
  }
}

export default {
  requestAuthorization,
  getAuthorizationStatus,
  getUserToken,
  searchMusic,
  createPlaylist,
  getCurrentUser,
  isReady,
};