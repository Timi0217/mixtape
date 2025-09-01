import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useSubscription } from '../context/SubscriptionContext';
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

export default function JoinGroupScreen({ onClose, onJoinGroup }) {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const { subscription } = useSubscription();

  const handleJoinByCode = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    // Check if basic user is trying to join additional groups
    if (subscription?.plan === 'basic' && subscription?.features?.maxGroups === 1) {
      // Check if user is already in a group by checking current groups
      try {
        const groupsResponse = await api.get('/user/groups');
        if (groupsResponse.data.groups.length >= 1) {
          Alert.alert(
            'Upgrade Required', 
            'Basic users can only join 1 group. Upgrade to Pro to join unlimited groups!',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Upgrade to Pro', onPress: () => onClose() }
            ]
          );
          return;
        }
      } catch (error) {
        console.error('Error checking user groups:', error);
      }
    }

    setLoading(true);
    try {
      const response = await api.post('/groups/join', {
        inviteCode: inviteCode.trim().toUpperCase(),
      });
      
      await onJoinGroup(response.data.group);
      Alert.alert('Success!', `You've joined "${response.data.group.name}"! 🎉`);
      onClose();
    } catch (error) {
      console.error('Join group error:', error);
      let errorMessage = 'Failed to join group. Please check the invite code.';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const searchGroups = async (query) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await api.get(`/groups/search?q=${encodeURIComponent(query.trim())}`);
      setSearchResults(response.data.groups || []);
    } catch (error) {
      console.error('Search groups error:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleJoinGroup = async (group) => {
    // Check if basic user is trying to join additional groups
    if (subscription?.plan === 'basic' && subscription?.features?.maxGroups === 1) {
      try {
        const groupsResponse = await api.get('/user/groups');
        if (groupsResponse.data.groups.length >= 1) {
          Alert.alert(
            'Upgrade Required', 
            'Basic users can only join 1 group. Upgrade to Pro to join unlimited groups!',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Upgrade to Pro', onPress: () => onClose() }
            ]
          );
          return;
        }
      } catch (error) {
        console.error('Error checking user groups:', error);
      }
    }

    setLoading(true);
    try {
      await api.post(`/groups/${group.id}/join`);
      await onJoinGroup(group);
      Alert.alert('Success!', `You've joined "${group.name}"! 🎉`);
      onClose();
    } catch (error) {
      console.error('Join group error:', error);
      let errorMessage = 'Failed to join group. Please try again.';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Join Group</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.content}>
          {/* Join by Invite Code Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Join with Invite Code</Text>
            <Text style={styles.sectionDescription}>
              Enter the invite code shared by a group member
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="Enter invite code"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              maxLength={8}
              autoFocus
            />
            
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleJoinByCode}
              disabled={loading || !inviteCode.trim()}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.buttonTextPrimary}>Join Group</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Search Public Groups Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Search Public Groups</Text>
            <Text style={styles.sectionDescription}>
              Find and join public groups by name
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="Search group names..."
              onChangeText={searchGroups}
              returnKeyType="search"
            />
            
            {searching && (
              <View style={styles.searchingContainer}>
                <ActivityIndicator color={theme.colors.primaryButton} />
                <Text style={styles.searchingText}>Searching...</Text>
              </View>
            )}
            
            {searchResults.length > 0 && (
              <View style={styles.searchResults}>
                {searchResults.map((group, index) => (
                  <TouchableOpacity
                    key={group.id}
                    style={styles.groupItem}
                    onPress={() => handleJoinGroup(group)}
                    disabled={loading}
                  >
                    <View style={styles.groupInfo}>
                      <Text style={styles.groupName}>{group.name}</Text>
                      <Text style={styles.groupMeta}>
                        {group._count?.members || 0} members • Created by {group.creator?.displayName}
                      </Text>
                      <Text style={styles.groupDescription}>
                        {group.isPublic ? 'Public group - anyone can join' : 'Private group - invite only'}
                      </Text>
                    </View>
                    <View style={[styles.joinButton, !group.isPublic && styles.joinButtonDisabled]}>
                      <Text style={[styles.joinButtonText, !group.isPublic && styles.joinButtonTextDisabled]}>
                        {group.isPublic ? 'Join' : 'Private'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Help Section */}
          <View style={styles.helpSection}>
            <Text style={styles.helpTitle}>How to Join Groups</Text>
            <Text style={styles.helpText}>
              • Ask a group member for an invite code{'\n'}
              • Search for public groups by name{'\n'}
              • Each group has a daily song submission deadline{'\n'}
              • You can be in multiple groups at once
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
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
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  sectionDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
    lineHeight: 20,
  },
  input: {
    backgroundColor: theme.colors.surfaceWhite,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    fontSize: 16,
    marginBottom: theme.spacing.lg,
  },
  button: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButton: {
    backgroundColor: theme.colors.primaryButton,
  },
  buttonTextPrimary: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.borderLight,
  },
  dividerText: {
    marginHorizontal: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.textTertiary,
    fontWeight: '500',
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
  },
  searchingText: {
    marginLeft: theme.spacing.sm,
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  searchResults: {
    gap: theme.spacing.sm,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceWhite,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  groupInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  groupMeta: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
  joinButton: {
    backgroundColor: theme.colors.primaryButton,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  joinButtonDisabled: {
    backgroundColor: theme.colors.secondaryButton,
  },
  joinButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  joinButtonTextDisabled: {
    color: theme.colors.textTertiary,
  },
  helpSection: {
    backgroundColor: theme.colors.surfaceWhite,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.xl,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  helpText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
});