import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  Linking,
  Modal,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import api from '../services/api';
import oauthPolling from '../services/oauthPolling';
import { useAuth } from '../context/AuthContext';

WebBrowser.maybeCompleteAuthSession();

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
    spotify: '#1DB954',
    apple: '#FA57C1',
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

export default function MusicSettingsScreen({ onClose }) {
  const { refreshUser, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [platforms, setPlatforms] = useState([]);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [preferences, setPreferences] = useState({
    preferredPlatform: 'spotify',
    autoMatchSongs: true,
    highQualityOnly: false,
    explicitContentFilter: false,
  });
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeData, setMergeData] = useState(null);

  useEffect(() => {
    loadMusicSettings();
    
    // Listen for deep link returns from OAuth
    const handleUrl = (event) => {
      const { url } = event;
      console.log('🔗 Received deep link:', url);
      
      if (url.includes('mixtape://auth/success')) {
        console.log('✅ OAuth success detected, reloading settings...');
        
        // Parse URL parameters (custom scheme safe parsing)
        const urlParts = url.split('?');
        const queryString = urlParts[1] || '';
        const params = new URLSearchParams(queryString);
        const platform = params.get('platform');
        const linked = params.get('linked');
        const merged = params.get('merged');
        
        console.log(`🎵 OAuth success details: platform=${platform}, linked=${linked}, merged=${merged}`);
        
        // Show success feedback
        if (linked === 'true') {
          Alert.alert('Success!', `${platform || 'Account'} linked successfully!`);
        } else if (merged === 'true') {
          Alert.alert('Success!', `Accounts merged successfully!`);
        }
        
        setTimeout(async () => {
          console.log('🔄 Reloading music settings and user data...');
          console.log('🔄 Before reload - current connected accounts:', connectedAccounts.length);
          await loadMusicSettings();
          await refreshUser();
          console.log('🔄 After reload - current connected accounts:', connectedAccounts.length);
          setLoading(false);
        }, 1000);
      } else if (url.includes('mixtape://auth/merge')) {
        console.log('🔀 Account merge needed, showing modal...');
        
        // Parse merge data from URL
        const urlParts = url.split('?');
        const queryString = urlParts[1] || '';
        const params = new URLSearchParams(queryString);
        
        try {
          const mergeDataEncoded = params.get('data');
          if (mergeDataEncoded) {
            const mergeInfo = JSON.parse(decodeURIComponent(mergeDataEncoded));
            showAccountMergeModal({ id: mergeInfo.platform }, mergeInfo);
          }
        } catch (error) {
          console.error('Failed to parse merge data:', error);
          Alert.alert('Error', 'Failed to load account merge information');
        }
        setLoading(false);
      } else if (url.includes('mixtape://auth/error')) {
        console.log('❌ OAuth error detected');
        const urlParts = url.split('?');
        const queryString = urlParts[1] || '';
        const params = new URLSearchParams(queryString);
        const error = params.get('error');
        Alert.alert('Authentication Error', error || 'Failed to authenticate');
        setLoading(false);
      }
    };
    
    const subscription = Linking.addEventListener('url', handleUrl);
    
    return () => {
      subscription?.remove();
    };
  }, []);

  const loadMusicSettings = async () => {
    try {
      setLoading(true);
      
      // Load available platforms
      try {
        const platformsResponse = await api.get('/music/platforms');
        setPlatforms(platformsResponse.data.platforms || []);
      } catch (platformError) {
        console.error('Failed to load platforms:', platformError);
        setPlatforms([]);
      }
      
      // Load connected accounts
      try {
        const accountsResponse = await api.get('/music/accounts');
        console.log('📱 Connected accounts from API:', accountsResponse.data);
        console.log('📱 Individual accounts:', accountsResponse.data.accounts);
        console.log('📱 Number of accounts:', accountsResponse.data.accounts?.length || 0);
        setConnectedAccounts(accountsResponse.data.accounts || []);
      } catch (accountError) {
        console.error('Failed to load accounts:', accountError);
        console.log('📱 Setting empty accounts array due to error');
        setConnectedAccounts([]);
      }
      
      // Load user preferences
      try {
        const preferencesResponse = await api.get('/music/preferences');
        if (preferencesResponse.data.preferences) {
          setPreferences({...preferences, ...preferencesResponse.data.preferences});
        }
      } catch (prefError) {
        console.error('Failed to load preferences:', prefError);
        // Keep default preferences if loading fails
      }
    } catch (error) {
      console.error('Failed to load music settings:', error);
      Alert.alert('Error', 'Failed to load music settings. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const connectSpotifyWithAuthSession = async () => {
    try {
      // Get auth URL from backend - same as login flow
      const response = await api.post('/music/auth/spotify', {});
      
      console.log('🎵 Backend response:', response.data);
      
      if (!response.data.authUrl) {
        throw new Error('No auth URL received from server');
      }

      const { authUrl, state } = response.data;
      console.log('🎵 Opening Spotify auth URL:', authUrl);
      console.log('🔗 OAuth state for linking:', state);

      // Open OAuth flow in browser with same options as login
      const browserTask = WebBrowser.openBrowserAsync(authUrl, {
        dismissButtonStyle: 'close',
        presentationStyle: 'pageSheet',
      });
      
      // Start polling for completion like login flow does
      console.log('Starting polling for linking completion');
      startLinkingPolling(state, 'spotify', browserTask);
      
      // Handle browser close events
      browserTask.then((result) => {
        if (result.type === 'cancel') {
          console.log('User cancelled linking flow');
          setLoading(false);
        }
      });
      
    } catch (error) {
      console.error('❌ Spotify connection error:', error);
      setLoading(false);
      Alert.alert('Error', error.message || 'Failed to connect Spotify account');
    }
  };

  const startLinkingPolling = (tokenId, platform, browserTask) => {
    console.log('Starting linking polling for:', tokenId);
    let attempts = 0;
    const maxAttempts = 60; // Poll for up to 5 minutes
    
    const interval = setInterval(async () => {
      attempts++;
      console.log(`🔍 Polling attempt ${attempts}/${maxAttempts} for linking completion`);
      
      try {
        // Check if linking is complete - use same endpoint as login
        const response = await api.get(`/oauth/check-token/${tokenId}`);
        
        if (response.data.success) {
          console.log('✅ Linking completed successfully!');
          clearInterval(interval);
          
          // Auto-dismiss browser
          if (browserTask) {
            WebBrowser.dismissBrowser();
          }
          
          // Reload accounts to show new connection
          await loadSettings();
          setLoading(false);
          
          Alert.alert('Success', 'Spotify account connected successfully!');
        }
      } catch (error) {
        console.log('Polling error (expected during auth):', error.message);
      }
      
      if (attempts >= maxAttempts) {
        console.log('❌ Polling timeout - stopping');
        clearInterval(interval);
        setLoading(false);
        Alert.alert('Timeout', 'Authentication took too long. Please try again.');
      }
    }, 3000); // Poll every 3 seconds
  };

  const showAccountMergeModal = (platform, mergeInfo) => {
    // Use real merge data from OAuth flow
    setMergeData(mergeInfo);
    setShowMergeModal(true);
  };

  const handleMergeSelection = async (selectedAccount) => {
    try {
      setShowMergeModal(false);
      setLoading(true);
      
      console.log('🔀 User selected account:', selectedAccount);
      
      // Start the proper linking flow
      try {
        const response = await api.post(`/music/auth/${mergeData.platform}`, {});
        
        if (response.data.authUrl) {
          console.log('🔗 Starting linking flow via browser...');
          await WebBrowser.openBrowserAsync(response.data.authUrl);
        } else {
          throw new Error('No auth URL received');
        }
      } catch (apiError) {
        console.error('Failed to start linking flow:', apiError);
        Alert.alert('Error', 'Failed to connect account. Please try again.');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Merge error:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to connect account. Please try again.');
    }
  };

  const handleConnectPlatform = async (platform) => {
    try {
      if (platform.id === 'apple-music') {
        // Start Apple Music OAuth flow
        setLoading(true);
        try {
          const response = await api.get('/oauth/apple/login');
          if (response.data.authUrl && response.data.state) {
            // Open the auth URL in browser
            await Linking.openURL(response.data.authUrl);
            
            // Start polling for completion (using same polling service)
            oauthPolling.startPolling(
              response.data.state,
              async (token, user) => {
                console.log('Apple Music connection successful:', { token, user });
                setLoading(false);
                // Reload settings to show the new connection
                await loadMusicSettings();
                // Refresh user data in auth context
                await refreshUser();
                Alert.alert('Success', 'Apple Music account connected successfully!');
              },
              (error) => {
                console.error('Apple Music connection failed:', error);
                setLoading(false);
                Alert.alert('Error', error || 'Failed to connect Apple Music account. Please try again.');
              }
            );
          } else {
            throw new Error('Invalid response from server');
          }
        } catch (error) {
          console.error('Failed to initiate Apple Music connection:', error);
          setLoading(false);
          Alert.alert('Error', 'Failed to connect to Apple Music. Please try again.');
        }
      } else if (platform.id === 'spotify') {
        // Start Spotify linking flow - will auto-merge if needed
        setLoading(true);
        try {
          const response = await api.post('/music/auth/spotify', {});
          
          if (!response.data.authUrl) {
            throw new Error('No auth URL received from server');
          }

          const { authUrl } = response.data;
          console.log('🎵 Opening Spotify auth URL:', authUrl);

          // Open auth URL - backend will auto-merge accounts
          await WebBrowser.openBrowserAsync(authUrl);
          setLoading(false);
          
        } catch (error) {
          console.error('❌ Spotify connection error:', error);
          setLoading(false);
          Alert.alert('Error', error.message || 'Failed to connect Spotify account');
        }
      } else {
        Alert.alert('Error', 'Platform not supported yet.');
      }
    } catch (error) {
      console.error('Connect platform error:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to initiate connection. Please try again.');
    }
  };

  const handleDisconnectPlatform = async (account) => {
    try {
      Alert.alert(
        'Disconnect Account',
        `Are you sure you want to disconnect your ${account.platform} account? This will remove access to your music library.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disconnect',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.delete(`/music/accounts/${account.id}`);
                await loadMusicSettings();
                Alert.alert('Success', 'Account disconnected successfully.');
              } catch (error) {
                console.error('Failed to disconnect account:', error);
                Alert.alert('Error', 'Failed to disconnect account. Please try again.');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Disconnect account error:', error);
    }
  };

  const updatePreference = async (key, value) => {
    try {
      const newPreferences = { ...preferences, [key]: value };
      setPreferences(newPreferences);
      
      await api.put('/music/preferences', newPreferences);
    } catch (error) {
      console.error('Failed to update preference:', error);
      Alert.alert('Error', 'Failed to save preference. Please try again.');
      // Revert the change
      setPreferences(preferences);
    }
  };

  const getPlatformColor = (platformId) => {
    switch (platformId) {
      case 'spotify': return '#1DB954'; // Spotify green
      case 'apple-music': return '#FC3C44'; // Apple Music red  
      default: return theme.colors.primaryButton;
    }
  };

  const getPlatformShadowColor = (platformId) => {
    switch (platformId) {
      case 'spotify': return '#1DB954';
      case 'apple-music': return '#FC3C44';
      default: return theme.colors.primaryButton;
    }
  };

  const renderConnectedAccounts = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Connected Accounts</Text>
      <Text style={styles.sectionDescription}>
        Manage your music streaming service connections
      </Text>
      
      {platforms.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No music platforms available</Text>
          <Text style={styles.emptyStateSubtext}>
            Please check your app configuration or try again later
          </Text>
        </View>
      ) : (
        platforms.map((platform) => {
          const isConnected = connectedAccounts.some(acc => acc.platform === platform.id);
          console.log(`🔍 Platform ${platform.id}: isConnected=${isConnected}, accounts:`, 
            connectedAccounts.map(acc => `${acc.platform}`));
          
          return (
            <View key={platform.id} style={styles.platformItem}>
              <View style={styles.platformInfo}>
                <View style={[
                  styles.platformIcon, 
                  { 
                    backgroundColor: getPlatformColor(platform.id),
                    shadowColor: getPlatformShadowColor(platform.id),
                  }
                ]} />
                <View style={styles.platformDetails}>
                  <Text style={styles.platformName}>{platform.name}</Text>
                  <Text style={[
                    styles.platformStatus,
                    isConnected ? styles.connectedStatus : styles.disconnectedStatus
                  ]}>
                    {isConnected ? '✓ Connected' : 'Not connected'}
                  </Text>
                  {!platform.available && (
                    <Text style={styles.unavailableText}>Service unavailable</Text>
                  )}
                </View>
              </View>
              
              <TouchableOpacity
                style={[
                  styles.platformButton,
                  isConnected ? styles.disconnectButton : styles.connectButton,
                  !platform.available && styles.disabledButton
                ]}
                onPress={() => {
                  if (!platform.available) {
                    Alert.alert('Service Unavailable', `${platform.name} is currently unavailable. Please try again later.`);
                    return;
                  }
                  
                  if (isConnected) {
                    const account = connectedAccounts.find(acc => acc.platform === platform.id);
                    handleDisconnectPlatform(account);
                  } else {
                    handleConnectPlatform(platform);
                  }
                }}
                disabled={!platform.available}
              >
                <Text style={[
                  styles.platformButtonText,
                  isConnected ? styles.disconnectButtonText : styles.connectButtonText,
                  !platform.available && styles.disabledButtonText
                ]}>
                  {!platform.available ? 'Unavailable' : (isConnected ? 'Disconnect' : 'Connect')}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}
      
      {connectedAccounts.length === 0 && platforms.length > 0 && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Connect at least one music service to use Mixtape's features
          </Text>
        </View>
      )}
    </View>
  );

  const renderPreferences = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Music Preferences</Text>
      <Text style={styles.sectionDescription}>
        Customize how Mixtape handles your music
      </Text>
      
      <View style={styles.preferenceItem}>
        <View style={styles.preferenceInfo}>
          <Text style={styles.preferenceTitle}>Auto-match songs</Text>
          <Text style={styles.preferenceDescription}>
            Automatically find songs on your preferred platform
          </Text>
        </View>
        <Switch
          value={preferences.autoMatchSongs}
          onValueChange={(value) => updatePreference('autoMatchSongs', value)}
          trackColor={{ false: theme.colors.borderLight, true: theme.colors.primaryButton }}
        />
      </View>
      
      <View style={styles.preferenceItem}>
        <View style={styles.preferenceInfo}>
          <Text style={styles.preferenceTitle}>High quality only</Text>
          <Text style={styles.preferenceDescription}>
            Prefer high-quality audio when available
          </Text>
        </View>
        <Switch
          value={preferences.highQualityOnly}
          onValueChange={(value) => updatePreference('highQualityOnly', value)}
          trackColor={{ false: theme.colors.borderLight, true: theme.colors.primaryButton }}
        />
      </View>
      
      <View style={styles.preferenceItem}>
        <View style={styles.preferenceInfo}>
          <Text style={styles.preferenceTitle}>Filter explicit content</Text>
          <Text style={styles.preferenceDescription}>
            Hide explicit content from search results
          </Text>
        </View>
        <Switch
          value={preferences.explicitContentFilter}
          onValueChange={(value) => updatePreference('explicitContentFilter', value)}
          trackColor={{ false: theme.colors.borderLight, true: theme.colors.primaryButton }}
        />
      </View>
    </View>
  );

  const renderDataUsage = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Data & Storage</Text>
      <Text style={styles.sectionDescription}>
        Manage how Mixtape uses your data
      </Text>
      
      <TouchableOpacity style={styles.actionButton}>
        <Text style={styles.actionButtonText}>Clear search history</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.actionButton}>
        <Text style={styles.actionButtonText}>Clear cached album art</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={[styles.actionButton, styles.dangerButton]}>
        <Text style={[styles.actionButtonText, styles.dangerButtonText]}>Reset all settings</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Music Settings</Text>
        <View style={styles.placeholder} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primaryButton} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderConnectedAccounts()}
          {renderPreferences()}
          {renderDataUsage()}
        </ScrollView>
      )}
      
      {/* In-App Account Merge Modal */}
      <Modal
        visible={showMergeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMergeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Account Found</Text>
              <TouchableOpacity 
                onPress={() => setShowMergeModal(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              We found an existing {mergeData?.platform === 'spotify' ? 'Spotify' : mergeData?.platform === 'apple-music' ? 'Apple Music' : ''} account. Choose your primary account.
            </Text>
            
            {mergeData && (
              <>
                <TouchableOpacity 
                  style={styles.accountOption}
                  onPress={() => handleMergeSelection('current')}
                >
                  <View style={styles.accountHeader}>
                    <View style={[styles.platformIcon, { backgroundColor: '#6B7280' }]} />
                    <View style={styles.accountDetails}>
                      <Text style={styles.accountName}>{mergeData.currentUser.displayName}</Text>
                      <Text style={styles.accountEmail}>Current Account</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.accountOption}
                  onPress={() => handleMergeSelection('existing')}
                >
                  <View style={styles.accountHeader}>
                    <View style={[styles.platformIcon, { backgroundColor: mergeData.platform === 'spotify' ? '#1DB954' : '#FF3B30' }]} />
                    <View style={styles.accountDetails}>
                      <Text style={styles.accountName}>{mergeData.existingUser.displayName}</Text>
                      <Text style={styles.accountEmail}>{mergeData.platform === 'spotify' ? 'Spotify Account' : 'Apple Music Account'}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setShowMergeModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  content: {
    flex: 1,
    padding: theme.spacing.lg,
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
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
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
  platformItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceWhite,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  platformInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  platformIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: theme.spacing.md,
    // Enhanced shadow for depth
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    // Subtle border for definition
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  platformDetails: {
    flex: 1,
  },
  platformName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  platformStatus: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  connectedStatus: {
    color: theme.colors.success,
    fontWeight: '600',
  },
  disconnectedStatus: {
    color: theme.colors.textSecondary,
  },
  unavailableText: {
    fontSize: 12,
    color: theme.colors.error,
    fontStyle: 'italic',
    marginTop: 2,
  },
  platformButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    width: 110,
    alignItems: 'center',
  },
  connectButton: {
    backgroundColor: theme.colors.primaryButton,
  },
  disconnectButton: {
    backgroundColor: theme.colors.secondaryButton,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  platformButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  connectButtonText: {
    color: 'white',
  },
  disconnectButtonText: {
    color: theme.colors.textSecondary,
  },
  disabledButton: {
    backgroundColor: theme.colors.borderLight,
    opacity: 0.6,
  },
  disabledButtonText: {
    color: theme.colors.textTertiary,
  },
  emptyState: {
    backgroundColor: theme.colors.surfaceWhite,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: theme.colors.surfaceWhite,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primaryButton,
    marginTop: theme.spacing.md,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceWhite,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  preferenceInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  actionButton: {
    backgroundColor: theme.colors.surfaceWhite,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  dangerButton: {
    backgroundColor: theme.colors.error,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  dangerButtonText: {
    color: 'white',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContainer: {
    backgroundColor: theme.colors.surfaceWhite,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 400,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  modalCloseButton: {
    padding: theme.spacing.sm,
  },
  modalCloseText: {
    fontSize: 20,
    color: theme.colors.textSecondary,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  accountOption: {
    backgroundColor: theme.colors.surfaceWhite,
    borderWidth: 1.5,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  platformIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: theme.spacing.md,
  },
  accountDetails: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  accountEmail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  cancelButton: {
    backgroundColor: theme.colors.secondaryButton,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});