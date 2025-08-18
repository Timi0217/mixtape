import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import api from '../services/api';

const PlaylistsScreen = () => {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const response = await api.get('/playlists');
      setPlaylists(response.data.playlists || []);
    } catch (error) {
      console.error('Failed to load playlists:', error);
      
      let errorMessage = 'Failed to load playlists.';
      
      if (error.response?.status === 401) {
        errorMessage = 'Please log in again to view your playlists.';
      } else if (error.response?.status === 403) {
        errorMessage = 'You do not have permission to view playlists.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message?.includes('network') || error.message?.includes('connection')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPlaylists();
    setRefreshing(false);
  };

  const handleCreatePlaylist = () => {
    Alert.alert(
      'Group Playlists', 
      'Group playlists are created automatically by group admins. Check your group settings to manage playlists.',
      [{ text: 'OK' }]
    );
  };

  const openPlaylist = (playlist) => {
    if (playlist.playlistUrl) {
      Alert.alert(
        'Open Playlist',
        `Open ${playlist.playlistName} in ${getPlatformName(playlist.platform)}?\n\nThis playlist is updated daily at 8:30am with fresh submissions from your group.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open', 
            onPress: () => {
              // Note: In a real app, you'd use Linking.openURL(playlist.playlistUrl)
              // For now, show URL for testing
              Alert.alert(
                'Opening Playlist',
                `This would open your ${getPlatformName(playlist.platform)} app with the playlist.\n\nURL: ${playlist.playlistUrl}`,
                [
                  { 
                    text: 'Copy URL', 
                    onPress: () => {
                      // In a real app: Clipboard.setString(playlist.playlistUrl);
                      Alert.alert('Copied!', 'Playlist URL copied to clipboard');
                    }
                  },
                  { text: 'OK' }
                ]
              );
            }
          },
        ]
      );
    } else {
      Alert.alert(
        'Playlist Not Available',
        'This playlist URL is not available. The playlist may have been deleted or there was an error creating it. Contact your group admin to refresh the playlists.'
      );
    }
  };

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'spotify': return '🎵';
      case 'apple-music': return '🍎';
      default: return '🎶';
    }
  };

  const getPlatformName = (platform) => {
    switch (platform) {
      case 'spotify': return 'Spotify';
      case 'apple-music': return 'Apple Music';
      default: return platform;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading playlists...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Group Playlists</Text>
        <Text style={styles.subtitle}>{playlists.length} playlists across your groups</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>🎵 Daily Group Playlists</Text>
        <Text style={styles.infoText}>
          These are persistent playlists that get updated every morning at 8:30am with fresh submissions from your groups. Same playlist, new songs daily!
        </Text>
        <Text style={styles.infoSubtext}>
          💡 If you don't see playlists for your groups, ask your group admin to create them in group settings.
        </Text>
      </View>

      {playlists.map((playlist) => (
        <View key={playlist.id} style={styles.playlistItem}>
          <View style={styles.playlistInfo}>
            <View style={styles.playlistHeader}>
              <Text style={styles.groupName}>
                {playlist.groupEmoji} {playlist.groupName}
              </Text>
              <Text style={styles.platformBadge}>
                {getPlatformIcon(playlist.platform)} {getPlatformName(playlist.platform)}
              </Text>
            </View>
            <Text style={styles.playlistName}>{playlist.playlistName}</Text>
            <Text style={styles.playlistDetails}>
              Last updated: {new Date(playlist.lastUpdated).toLocaleDateString()}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.playButton}
            onPress={() => openPlaylist(playlist)}
          >
            <Text style={styles.playButtonText}>Open</Text>
          </TouchableOpacity>
        </View>
      ))}

      {playlists.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No group playlists yet. Join a group or ask your group admin to create playlists!
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={handleCreatePlaylist}>
            <Text style={styles.emptyButtonText}>Learn More</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  createButton: {
    backgroundColor: '#007AFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoCard: {
    backgroundColor: 'white',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  infoSubtext: {
    fontSize: 12,
    color: '#888',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  playlistItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    margin: 8,
    padding: 16,
    borderRadius: 12,
    alignItems: 'flex-start',
  },
  playlistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  platformBadge: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  playlistDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  playButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  playButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PlaylistsScreen;