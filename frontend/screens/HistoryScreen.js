import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import api from '../services/api';

const theme = {
  colors: {
    bgPrimary: '#f8f9fa',
    surfaceWhite: '#ffffff',
    textPrimary: '#1a1a1a',
    textSecondary: '#6b7280',
    textTertiary: '#9ca3af',
    primaryButton: '#8B5CF6',
    secondaryButton: '#F3F4F6',
    borderLight: '#E5E7EB',
    shadow: 'rgba(0, 0, 0, 0.1)',
    success: '#10B981',
    error: '#EF4444',
  },
  spacing: {
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 8,
    md: 16,
    lg: 20,
  },
};

export default function HistoryScreen({ onClose, activeGroup, embedded = false }) {
  const [loading, setLoading] = useState(true);
  const [groupHistory, setGroupHistory] = useState([]);
  const [userHistory, setUserHistory] = useState([]);
  const [viewMode, setViewMode] = useState('group'); // 'group' or 'personal'

  useEffect(() => {
    loadHistory();
  }, [activeGroup, viewMode]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      
      if (viewMode === 'group' && activeGroup) {
        const response = await api.get(`/submissions/groups/${activeGroup.id}/history?limit=20`);
        setGroupHistory(response.data.rounds || []);
      } else if (activeGroup) {
        // Filter user's submissions to only show submissions for the current group
        const response = await api.get('/submissions/history?limit=20');
        const allUserSubmissions = response.data.submissions || [];
        const groupFilteredSubmissions = allUserSubmissions.filter(
          submission => submission.round.group.id === activeGroup.id
        );
        setUserHistory(groupFilteredSubmissions);
      } else {
        // Fallback to all submissions if no active group
        const response = await api.get('/submissions/history?limit=20');
        setUserHistory(response.data.submissions || []);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
      Alert.alert('Error', 'Failed to load history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderGroupHistory = () => {
    if (!groupHistory.length) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No History Yet</Text>
          <Text style={styles.emptyStateText}>
            This group hasn't completed any mixtapes yet. Keep submitting songs daily!
          </Text>
        </View>
      );
    }

    // Flatten submissions from all rounds to show individual songs like My Submissions
    const allSubmissions = [];
    groupHistory.forEach(round => {
      round.submissions.forEach(submission => {
        allSubmissions.push({
          ...submission,
          roundDate: round.date,
          roundStatus: round.status,
          roundPlaylist: round.playlist,
        });
      });
    });

    return allSubmissions.map((submission, index) => (
      <View key={`${submission.id}-${index}`} style={styles.historyCard}>
        <View style={styles.songItem}>
          {submission.song.imageUrl && (
            <Image source={{ uri: submission.song.imageUrl }} style={styles.songImage} />
          )}
          <View style={styles.songInfo}>
            <Text style={styles.songTitle}>{submission.song.title}</Text>
            <Text style={styles.songArtist}>{submission.song.artist}</Text>
            {submission.song.album && (
              <Text style={styles.songAlbum}>{submission.song.album}</Text>
            )}
            <Text style={styles.submissionMeta}>
              by {submission.user.displayName}
            </Text>
            {submission.comment && (
              <Text style={styles.songComment}>"{submission.comment}"</Text>
            )}
          </View>
        </View>
      </View>
    ));
  };

  const renderUserHistory = () => {
    if (!userHistory.length) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No Submissions Yet</Text>
          <Text style={styles.emptyStateText}>
            You haven't submitted any songs yet. Join a group and start sharing your music!
          </Text>
        </View>
      );
    }

    return userHistory.map((submission, index) => (
      <View key={submission.id} style={styles.historyCard}>
        <View style={styles.songItem}>
          {submission.song.imageUrl && (
            <Image source={{ uri: submission.song.imageUrl }} style={styles.songImage} />
          )}
          <View style={styles.songInfo}>
            <Text style={styles.songTitle}>{submission.song.title}</Text>
            <Text style={styles.songArtist}>{submission.song.artist}</Text>
            {submission.song.album && (
              <Text style={styles.songAlbum}>{submission.song.album}</Text>
            )}
            <Text style={styles.submissionMeta}>
              {new Date(submission.createdAt || submission.round.date).toLocaleDateString()}
            </Text>
            {submission.comment && (
              <Text style={styles.songComment}>"{submission.comment}"</Text>
            )}
          </View>
        </View>
      </View>
    ));
  };

  const Container = embedded ? View : SafeAreaView;
  
  return (
    <Container style={embedded ? styles.embeddedContainer : styles.container}>
      {!embedded && (
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>History</Text>
          <View style={styles.placeholder} />
        </View>
      )}

      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'group' && styles.toggleButtonActive]}
          onPress={() => setViewMode('group')}
        >
          <Text style={[styles.toggleText, viewMode === 'group' && styles.toggleTextActive]}>
            Group History
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'personal' && styles.toggleButtonActive]}
          onPress={() => setViewMode('personal')}
        >
          <Text style={[styles.toggleText, viewMode === 'personal' && styles.toggleTextActive]}>
            My Submissions
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primaryButton} />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {viewMode === 'group' ? renderGroupHistory() : renderUserHistory()}
        </ScrollView>
      )}
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  embeddedContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surfaceWhite,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  closeButtonText: {
    fontSize: 20,
    color: theme.colors.textSecondary,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  placeholder: {
    width: 36,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceWhite,
    margin: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.primaryButton,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  toggleTextActive: {
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl * 2,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  emptyStateText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  historyCard: {
    backgroundColor: theme.colors.surfaceWhite,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  historyDate: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
    marginLeft: theme.spacing.sm,
    marginTop: 2,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  historyMeta: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  playlistInfo: {
    fontSize: 14,
    color: theme.colors.primaryButton,
    fontWeight: '500',
    marginBottom: theme.spacing.md,
  },
  songsList: {
    gap: theme.spacing.sm,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.sm,
  },
  songImage: {
    width: 50,
    height: 50,
    borderRadius: theme.borderRadius.sm,
    marginRight: theme.spacing.md,
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  songArtist: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  songAlbum: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    marginBottom: 4,
  },
  submissionMeta: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    marginBottom: 4,
  },
  songComment: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontStyle: 'italic',
    marginTop: theme.spacing.sm,
  },
});