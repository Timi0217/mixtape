import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, Alert, ActivityIndicator, Modal, Animated, Easing, Dimensions, Image, Linking } from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import MusicSearchScreen from '../screens/MusicSearchScreen';
import GroupCreateScreen from '../screens/GroupCreateScreen';
import HistoryScreen from '../screens/HistoryScreen';
import JoinGroupScreen from '../screens/JoinGroupScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import AboutScreen from '../screens/AboutScreen';
import GroupSettingsScreen from '../screens/GroupSettingsScreen';

// Theme - Modern Consumer App Design
const theme = {
  colors: {
    // Main Colors - Enhanced depth
    bgPrimary: '#f2f2f7',      // iOS-style background
    surfaceWhite: '#ffffff',   // Pure white cards
    surfaceTinted: '#f1f3f4',  // Light gray tint
    surfaceElevated: '#ffffff', // Elevated white surface
    
    // Text - Apple-style hierarchy
    textPrimary: '#000000',    // True black for maximum contrast
    textSecondary: '#3c3c43',  // iOS secondary text
    textTertiary: '#8e8e93',   // iOS tertiary text
    
    // Buttons & Actions - Purple and green theme
    primaryButton: '#8B5CF6',  // Purple - primary actions
    secondaryButton: '#F2F2F7', // iOS secondary background  
    accent: '#10B981',         // Emerald green - accent color
    tabAccent: '#8B5CF6',      // Purple - tab active states (unified with buttons)
    cardAccent: '#6B7280',     // Warm gray - accent cards
    
    // States & Status
    success: '#34C759',        // iOS green - success states
    active: '#8B5CF6',         // Purple - active tabs
    groupHeader: '#1d1d1f',    // Apple-style dark text
    pending: '#D1D5DB',        // Light gray - pending states
    error: '#FF3B30',          // iOS red - error states
    warning: '#FF9500',        // iOS orange - warning states
    
    // Borders
    borderLight: '#C6C6C8',    // iOS separator light
    borderMedium: '#8E8E93',   // iOS separator medium
    
    // Shadow - Apple-style depth
    shadow: 'rgba(0, 0, 0, 0.04)', // Subtle shadow
    shadowMedium: 'rgba(0, 0, 0, 0.08)', // Medium shadow
    shadowStrong: 'rgba(0, 0, 0, 0.16)', // Strong shadow
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 8,
    md: 16,
    lg: 20,
    xl: 24,
  },
};

// Confetti Animation Component
function ConfettiParticle({ delay, duration, color }) {
  const { width } = Dimensions.get('window');
  const translateY = useRef(new Animated.Value(-50)).current;
  const translateX = useRef(new Animated.Value(Math.random() * width)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animateParticle = () => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 600,
          duration: duration,
          delay: delay,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 1,
          duration: duration,
          delay: delay,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: duration * 0.8,
          delay: delay + duration * 0.2,
          useNativeDriver: true,
        }),
      ]).start();
    };

    animateParticle();
  }, [delay, duration, translateY, translateX, rotate, opacity]);

  const rotateInterpolate = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.confettiParticle,
        {
          backgroundColor: color,
          transform: [
            { translateX },
            { translateY },
            { rotate: rotateInterpolate },
          ],
          opacity,
        },
      ]}
    />
  );
}

// Confetti Burst Component
function ConfettiBurst({ show, onComplete }) {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    delay: Math.random() * 200,
    duration: 2000 + Math.random() * 1000,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));

  useEffect(() => {
    if (show && onComplete) {
      const timer = setTimeout(onComplete, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <View style={styles.confettiContainer} pointerEvents="none">
      {particles.map((particle) => (
        <ConfettiParticle
          key={particle.id}
          delay={particle.delay}
          duration={particle.duration}
          color={particle.color}
        />
      ))}
    </View>
  );
}


// Animated Digit Component - Fixed to avoid useInsertionEffect warnings
function AnimatedDigit({ value, style }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const previousValue = useRef(value);

  useEffect(() => {
    // Only animate if value actually changed and this isn't the initial render
    if (value !== previousValue.current && previousValue.current !== undefined) {
      if (!isAnimating) {
        setIsAnimating(true);
        
        // Delay animation to next frame to avoid useInsertionEffect conflicts
        const timeoutId = setTimeout(() => {
          // Exit animation
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: -30,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            })
          ]).start(() => {
            // Update value at opacity 0
            setDisplayValue(value);
            translateY.setValue(30);
            
            // Small delay before enter animation
            setTimeout(() => {
              // Enter animation
              Animated.parallel([
                Animated.timing(translateY, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                  toValue: 1,
                  duration: 150,
                  useNativeDriver: true,
                })
              ]).start(() => {
                setIsAnimating(false);
              });
            }, 50);
          });
        }, 16); // One frame delay
        
        return () => clearTimeout(timeoutId);
      }
    } else {
      // First render or same value - just update without animation
      setDisplayValue(value);
    }
    
    previousValue.current = value;
  }, [value, isAnimating]);

  return (
    <View style={{ overflow: 'hidden', height: 44 }}>
      <Animated.Text
        style={[
          style,
          {
            transform: [{ translateY }],
            opacity,
          }
        ]}
      >
        {displayValue}
      </Animated.Text>
    </View>
  );
}

// Countdown Timer Component with animations
function CountdownTimer({ targetDate, label = "TIME LEFT TO SUBMIT" }) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const target = targetDate.getTime();
      const difference = target - now;
      

      if (difference > 0) {
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ hours, minutes, seconds });
      } else {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
      }
    };

    // Update immediately
    updateTimer();
    
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  const formatTime = (time) => time.toString().padStart(2, '0');

  return (
    <View style={styles.timerContainer}>
      <Text style={styles.timerLabel}>{label}</Text>
      <View style={styles.timer}>
        {timeLeft.hours > 0 && (
          <>
            <Text style={styles.timerText}>{formatTime(timeLeft.hours)}</Text>
            <Text style={styles.timerSeparator}>:</Text>
          </>
        )}
        <Text style={styles.timerText}>{formatTime(timeLeft.minutes)}</Text>
        <Text style={styles.timerSeparator}>:</Text>
        <Text style={styles.timerText}>{formatTime(timeLeft.seconds)}</Text>
      </View>
    </View>
  );
}

// Button Component with Apple-style micro-interactions
function Button({ title, onPress, variant = 'primary', style }) {
  const scaleValue = useRef(new Animated.Value(1)).current;
  const opacityValue = useRef(new Animated.Value(1)).current;

  const getButtonStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.buttonPrimary;
      case 'secondary':
        return styles.buttonSecondary;
      case 'music':
        return styles.buttonMusic;
      default:
        return styles.buttonPrimary;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.buttonTextPrimary;
      case 'secondary':
        return styles.buttonTextSecondary;
      case 'music':
        return styles.buttonTextMusic;
      default:
        return styles.buttonTextPrimary;
    }
  };

  const handlePressIn = () => {
    // Apple-style press down animation
    Animated.parallel([
      Animated.spring(scaleValue, {
        toValue: 0.95,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(opacityValue, {
        toValue: 0.6,
        duration: 50,
        useNativeDriver: true,
      })
    ]).start();
  };

  const handlePressOut = () => {
    // Apple-style spring back animation
    Animated.parallel([
      Animated.spring(scaleValue, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(opacityValue, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      })
    ]).start();
  };

  return (
    <TouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      activeOpacity={1} // Disable default opacity since we handle it with animations
    >
      <Animated.View
        style={[
          styles.button,
          getButtonStyle(),
          style,
          {
            transform: [{ scale: scaleValue }],
            opacity: opacityValue,
          }
        ]}
      >
        <Text style={[styles.buttonText, getTextStyle()]} numberOfLines={1}>
          {title}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const AppNavigator = () => {
  const { user, logout } = useAuth();
  
  // Detect user's music platform (phone users = Apple Music, OAuth = Spotify)
  const getUserMusicPlatform = () => {
    // Debug logging
    console.log('🎵 Platform Detection Debug:', {
      userEmail: user?.email,
      hasPhoneEmail: user?.email?.includes('@phone.mixtape'),
      detectedPlatform: user?.email?.includes('@phone.mixtape') ? 'apple-music' : 'spotify'
    });
    
    // If user has email with phone auth pattern, they're Apple Music users
    if (user?.email?.includes('@phone.mixtape')) {
      return 'apple-music';
    }
    // Otherwise they used Spotify OAuth
    return 'spotify';
  };
  
  const userPlatform = getUserMusicPlatform();
  
  // Create deadline for 11 PM today (updated time)
  const getDeadline = () => {
    const now = new Date();
    const today = new Date();
    today.setHours(23, 0, 0, 0); // 11 PM today
    
    // If current time is past today's 11 PM, use tomorrow's 11 PM
    const deadline = now.getTime() > today.getTime() ? 
      new Date(today.getTime() + 24 * 60 * 60 * 1000) : today;
    
    return deadline;
  };

  // Create drop time for 8 AM tomorrow
  const getDropTime = () => {
    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0); // 8 AM tomorrow
    
    return tomorrow;
  };

  const [deadline] = useState(getDeadline());
  const [dropTime] = useState(getDropTime());
  const [currentScreen, setCurrentScreen] = useState('today');
  const [loading, setLoading] = useState(true);
  const [userGroups, setUserGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [currentRound, setCurrentRound] = useState(null);
  const [yesterdayPlaylist, setYesterdayPlaylist] = useState(null);
  const [yesterdayRound, setYesterdayRound] = useState(null);
  const [userVote, setUserVote] = useState(null);
  const [showSongsModal, setShowSongsModal] = useState(false);
  const [groupCardTab, setGroupCardTab] = useState('progress'); // 'progress' or 'vote'
  const [showMusicSearch, setShowMusicSearch] = useState(false);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [selectedGroupForSettings, setSelectedGroupForSettings] = useState(null);
  const [showGroupSelection, setShowGroupSelection] = useState(false);
  const [pendingSong, setPendingSong] = useState(null);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  
  // Animation states for group switching
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const [isGroupSwitching, setIsGroupSwitching] = useState(false);
  
  // Confetti animation state
  const [showConfetti, setShowConfetti] = useState(false);

  // Onboarding animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const featureAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;
  
  // Load user data on mount
  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      
      // Load user's groups
      const groupsResponse = await api.get('/groups');
      const groups = groupsResponse.data.groups.map(gm => gm.group);
      setUserGroups(groups);
      
      // Set the first group as active (or show onboarding if no groups)
      if (groups.length > 0) {
        setActiveGroup(groups[0]);
        await loadCurrentRound(groups[0].id);
        await loadYesterdayPlaylist(groups[0].id);
        await loadYesterdayRound(groups[0].id);
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
      Alert.alert('Error', 'Failed to load your data. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  };

  // Onboarding animation functions
  const startOnboardingAnimations = () => {
    // Main content fade in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Stagger feature animations
    featureAnims.forEach((anim, index) => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 600,
        delay: 400 + (index * 150), // Stagger by 150ms
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });

    // Button animation last
    Animated.timing(buttonAnim, {
      toValue: 1,
      duration: 600,
      delay: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  // Trigger animations when onboarding loads
  useEffect(() => {
    if (userGroups.length === 0 && !loading) {
      startOnboardingAnimations();
    }
  }, [userGroups.length, loading]);

  const loadCurrentRound = async (groupId) => {
    try {
      const roundResponse = await api.get(`/submissions/groups/${groupId}/current`);
      setCurrentRound(roundResponse.data.round);
    } catch (error) {
      console.error('Failed to load current round:', error);
      // Round might not exist yet, that's ok
    }
  };

  const loadYesterdayPlaylist = async (groupId) => {
    try {
      // First try to get the group's playlists
      const playlistResponse = await api.get('/playlists');
      const groupPlaylists = playlistResponse.data.playlists?.filter(
        playlist => playlist.groupId === groupId
      );
      
      if (groupPlaylists && groupPlaylists.length > 0) {
        // Use the first playlist (most recent) for now
        setYesterdayPlaylist(groupPlaylists[0]);
      }
    } catch (error) {
      console.error('Failed to load yesterday playlist:', error);
      // No playlist available, that's ok
    }
  };

  const loadYesterdayRound = async (groupId) => {
    try {
      // Get the most recent completed round for voting (only allow voting on latest)
      const response = await api.get(`/submissions/groups/${groupId}/history?limit=1`);
      const rounds = response.data.rounds || [];
      
      console.log('🗳️ Yesterday round data:', { 
        roundsFound: rounds.length, 
        firstRound: rounds[0] ? {
          id: rounds[0].id,
          status: rounds[0].status,
          submissionCount: rounds[0].submissions?.length
        } : null 
      });
      
      if (rounds.length > 0 && rounds[0].status === 'completed') {
        const round = rounds[0];
        
        // Only set as votable round if it's truly the most recent completed round
        // (Backend will enforce this, but frontend should also check)
        setYesterdayRound(round);
        
        // Check if user has already voted
        try {
          const voteResponse = await api.get(`/votes/rounds/${round.id}/user`);
          setUserVote(voteResponse.data.vote);
          console.log('✅ User vote found:', voteResponse.data.vote);
        } catch (voteError) {
          // No vote found, that's ok
          setUserVote(null);
          console.log('ℹ️ No existing vote found for user');
        }
      } else {
        // Clear voting if no recent completed round
        setYesterdayRound(null);
        setUserVote(null);
        console.log('❌ No completed rounds available for voting');
      }
    } catch (error) {
      console.error('Failed to load yesterday round:', error);
      setYesterdayRound(null);
      setUserVote(null);
    }
  };

  const submitVote = async (submissionId) => {
    try {
      if (!yesterdayRound) return;
      
      console.log('🗳️ Submitting vote:', {
        roundId: yesterdayRound.id,
        submissionId: submissionId,
        userId: user?.id
      });
      
      const response = await api.post('/votes', {
        roundId: yesterdayRound.id,
        submissionId: submissionId
      });
      
      setUserVote(response.data.vote);
      
      // Reload the round to get updated vote counts
      await loadYesterdayRound(activeGroup.id);
      
      Alert.alert('Vote Submitted!', 'Thanks for voting on yesterday\'s mixtape! 🗳️');
    } catch (error) {
      console.error('❌ Failed to submit vote:', error);
      console.error('Error details:', {
        status: error.response?.status,
        message: error.response?.data?.error || error.message,
        data: error.response?.data
      });
      
      const errorMessage = error.response?.data?.error || 'Failed to submit your vote. Please try again.';
      Alert.alert('Error', errorMessage);
    }
  };

  const openYesterdayPlaylist = () => {
    if (yesterdayPlaylist && yesterdayPlaylist.playlistUrl) {
      Alert.alert(
        'Listen to Yesterday\'s Mixtape',
        `Open ${yesterdayPlaylist.playlistName} in ${yesterdayPlaylist.platform === 'spotify' ? 'Spotify' : 'Apple Music'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open', 
            onPress: () => {
              // Note: In a real app, you'd use Linking.openURL(yesterdayPlaylist.playlistUrl)
              Alert.alert(
                'Opening Playlist',
                `This would open your ${yesterdayPlaylist.platform === 'spotify' ? 'Spotify' : 'Apple Music'} app with yesterday's mixtape.\n\nURL: ${yesterdayPlaylist.playlistUrl}`,
                [{ text: 'OK' }]
              );
            }
          },
        ]
      );
    } else {
      Alert.alert(
        'No Playlist Available',
        'Yesterday\'s mixtape is not available yet. This could be your first day in the group or the playlist hasn\'t been created.'
      );
    }
  };

  const handleSongSubmission = async (song, selectedGroup = null) => {
    try {
      // If user has multiple groups, let them select which group to submit to
      let targetGroup = selectedGroup || activeGroup;
      let targetRound = currentRound;

      if (userGroups.length > 1 && !selectedGroup && !activeGroup) {
        // Show group selection modal only if no active group is selected
        setShowMusicSearch(false); // Close music search first
        showGroupSelectionForSong(song);
        return;
      }

      if (!targetRound && targetGroup) {
        // Try to get the current round for the target group
        const roundResponse = await api.get(`/submissions/groups/${targetGroup.id}/current-round`);
        targetRound = roundResponse.data.round;
      }

      if (!targetRound) {
        Alert.alert('Error', 'No active round found for this group');
        return;
      }

      console.log('Submitting song:', song);

      // Validate required fields
      if (!song.title || !song.artist || !song.platform || !song.platformId) {
        console.error('Missing required song fields:', { 
          title: song.title, 
          artist: song.artist, 
          platform: song.platform, 
          platformId: song.platformId 
        });
        Alert.alert('Error', 'Song is missing required information. Please try selecting a different song.');
        return;
      }

      // First, create or find the song
      const songData = {
        title: song.title.trim(),
        artist: song.artist.trim(),
        platformIds: { [song.platform]: song.platformId },
      };

      // Only add optional fields if they have valid values
      if (song.album && song.album.trim()) {
        songData.album = song.album.trim();
      }
      if (song.duration && Number.isInteger(song.duration)) {
        songData.duration = song.duration;
      }
      if (song.imageUrl && song.imageUrl.trim()) {
        songData.imageUrl = song.imageUrl.trim();
      }
      if (song.previewUrl && song.previewUrl.trim()) {
        songData.previewUrl = song.previewUrl.trim();
      }

      console.log('Creating song with data:', songData);
      
      const songResponse = await api.post('/music/songs', songData);

      console.log('Song created successfully:', songResponse.data);

      // Then submit the song to the round
      await api.post('/submissions', {
        roundId: targetRound.id,
        songId: songResponse.data.song.id,
      });

      // Refresh the round data for the target group
      await loadCurrentRound(targetGroup.id);
      await loadYesterdayPlaylist(targetGroup.id);
      await loadYesterdayRound(targetGroup.id);
      
      // If we submitted to a different group, switch to that group
      if (targetGroup.id !== activeGroup?.id) {
        setActiveGroup(targetGroup);
      }
      setShowMusicSearch(false);
      
      // Trigger confetti animation
      setShowConfetti(true);
      
      Alert.alert('Success!', 'Your song has been submitted! 🎵');
    } catch (error) {
      console.error('Failed to submit song:', error);
      
      let errorMessage = 'Failed to submit your song. Please try again.';
      
      if (error.response) {
        console.error('Error response:', error.response.data);
        if (error.response.status === 400 && error.response.data?.details) {
          errorMessage = `Validation error: ${error.response.data.details.map(d => d.msg).join(', ')}`;
        } else if (error.response.data?.error) {
          errorMessage = error.response.data.error;
        }
      }
      
      Alert.alert('Error', errorMessage);
    }
  };

  const showGroupSelectionForSong = (song) => {
    setPendingSong(song);
    setShowGroupSelection(true);
  };

  const handleGroupSelectionForSong = (selectedGroup) => {
    setShowGroupSelection(false);
    if (pendingSong && selectedGroup) {
      handleSongSubmission(pendingSong, selectedGroup);
    }
    setPendingSong(null);
  };

  const handleGroupPick = (selectedGroup) => {
    setShowGroupPicker(false);
    if (selectedGroup.id !== activeGroup?.id) {
      performGroupSwitchAnimation(() => {
        setActiveGroup(selectedGroup);
        loadCurrentRound(selectedGroup.id);
        loadYesterdayPlaylist(selectedGroup.id);
        loadYesterdayRound(selectedGroup.id);
      });
    }
  };

  // Enhanced Apple-style group switching animation
  const performGroupSwitchAnimation = (switchCallback) => {
    if (isGroupSwitching) return; // Prevent multiple animations
    
    setIsGroupSwitching(true);
    
    // Smooth crossfade with Apple-style timing
    Animated.timing(contentOpacity, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      // Perform the switch at opacity 0
      switchCallback();
      
      // Brief pause before fade in for smoother transition
      setTimeout(() => {
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start(() => {
          setIsGroupSwitching(false);
        });
      }, 20); // Apple-style micro-pause
    });
  };

  const handleCreateGroup = async (groupData) => {
    try {
      const response = await api.post('/groups', groupData);
      const newGroup = response.data.group;
      
      setUserGroups([...userGroups, newGroup]);
      setActiveGroup(newGroup);
      
      // Load round data for the new group (non-blocking for new groups)
      try {
        await loadCurrentRound(newGroup.id);
        await loadYesterdayPlaylist(newGroup.id);
        await loadYesterdayRound(newGroup.id);
      } catch (roundError) {
        console.log('Round data not available for new group (expected):', roundError);
        // This is expected for new groups - no rounds exist yet
      }
      
      setShowGroupCreate(false);
      
      Alert.alert('Success!', `Group "${groupData.name}" created! 🎉`);
    } catch (error) {
      console.error('Failed to create group:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    }
  };

  const handleJoinGroup = async (joinedGroup) => {
    try {
      // Reload user groups to get the updated list
      await loadUserData();
      setActiveGroup(joinedGroup);
    } catch (error) {
      console.error('Failed to handle joined group:', error);
    }
  };

  const handleOpenGroupSettings = (group) => {
    setSelectedGroupForSettings(group);
    setShowGroupSettings(true);
  };

  const handleGroupUpdated = (updatedGroup) => {
    console.log('Group updated:', updatedGroup.name, 'emoji:', updatedGroup.emoji);
    
    // Update the group in the userGroups list
    setUserGroups(userGroups.map(g => g.id === updatedGroup.id ? updatedGroup : g));
    
    // Update activeGroup if it's the one that was updated
    if (activeGroup?.id === updatedGroup.id) {
      setActiveGroup(updatedGroup);
      console.log('Active group updated with emoji:', updatedGroup.emoji);
    }
  };

  const handleGroupDeleted = async () => {
    // Refresh the user's groups list after a group is deleted
    try {
      await loadUserData();
    } catch (error) {
      console.error('Failed to refresh groups after deletion:', error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primaryButton} />
        <Text style={styles.loadingText}>Loading your mixtapes...</Text>
      </SafeAreaView>
    );
  }


  // Show onboarding if user has no groups
  if (userGroups.length === 0) {
    const handleLogout = () => {
      Alert.alert(
        'Logout',
        'Are you sure you want to log out?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Logout', 
            style: 'destructive',
            onPress: async () => {
              await logout();
            }
          }
        ]
      );
    };

    return (
      <SafeAreaView style={styles.onboardingSafeArea}>
        {/* Logout button in top right */}
        <View style={styles.onboardingHeader}>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButtonSmall}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView 
          style={styles.onboardingContainer} 
          contentContainerStyle={styles.onboardingContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <Animated.View 
            style={[
              styles.onboardingHero,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim },
                  { scale: scaleAnim }
                ]
              }
            ]}
          >
            <View style={styles.appIconContainer}>
              <View style={styles.appIcon}>
                <Text style={styles.appIconEmoji}>🎧</Text>
              </View>
            </View>
            <Text style={styles.onboardingTitle}>Welcome to Mixtape</Text>
            <Text style={styles.onboardingTagline}>Share music with friends daily.</Text>
          </Animated.View>

          {/* Features Card */}
          <View style={styles.featuresCard}>
            <Animated.View 
              style={[
                styles.featureItem,
                {
                  opacity: featureAnims[0],
                  transform: [{
                    translateX: featureAnims[0].interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0]
                    })
                  }]
                }
              ]}
            >
              <View style={styles.featureIconContainer}>
                <Text style={styles.featureIcon}>👥</Text>
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>Create groups</Text>
                <Text style={styles.featureDescription}>Start with friends and family</Text>
              </View>
            </Animated.View>

            <Animated.View 
              style={[
                styles.featureDivider,
                { opacity: featureAnims[0] }
              ]} 
            />

            <Animated.View 
              style={[
                styles.featureItem,
                {
                  opacity: featureAnims[1],
                  transform: [{
                    translateX: featureAnims[1].interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0]
                    })
                  }]
                }
              ]}
            >
              <View style={styles.featureIconContainer}>
                <Text style={styles.featureIcon}>🎶</Text>
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>Share daily</Text>
                <Text style={styles.featureDescription}>Add songs by 11 PM each day</Text>
              </View>
            </Animated.View>

            <Animated.View 
              style={[
                styles.featureDivider,
                { opacity: featureAnims[1] }
              ]} 
            />

            <Animated.View 
              style={[
                styles.featureItem,
                {
                  opacity: featureAnims[2],
                  transform: [{
                    translateX: featureAnims[2].interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0]
                    })
                  }]
                }
              ]}
            >
              <View style={styles.featureIconContainer}>
                <Text style={styles.featureIcon}>📱</Text>
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>Get playlists</Text>
                <Text style={styles.featureDescription}>Fresh mixtapes at 8 AM daily</Text>
              </View>
            </Animated.View>
          </View>

          {/* Call to Action */}
          <Animated.View 
            style={[
              styles.onboardingCTA,
              {
                opacity: buttonAnim,
                transform: [{
                  translateY: buttonAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0]
                  })
                }]
              }
            ]}
          >
            <Button
              title="Create your first group"
              onPress={() => setShowGroupCreate(true)}
              variant="primary"
              style={styles.onboardingPrimaryButton}
            />
            <Text style={styles.onboardingHint}>
              You can invite friends after creating.
            </Text>
          </Animated.View>
        </ScrollView>
        
        <Modal visible={showGroupCreate} animationType="slide">
          <GroupCreateScreen
            onClose={() => setShowGroupCreate(false)}
            onCreateGroup={handleCreateGroup}
          />
        </Modal>
      </SafeAreaView>
    );
  }

  const renderTodayScreen = () => {
    if (!activeGroup || !currentRound) {
      return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.greeting}>Hi {user?.displayName || 'there'} 👋</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long',
                month: 'long', 
                day: 'numeric' 
              })}
            </Text>
          </View>

          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No Active Round</Text>
            <Text style={styles.emptyStateText}>
              {!activeGroup 
                ? "Join or create a group to start sharing music with friends."
                : "Loading your group's daily round..."
              }
            </Text>
          </View>
        </ScrollView>
      );
    }

    const userSubmission = currentRound.submissions?.find(s => s.user.id === user?.id);
    const isComplete = currentRound.submissions?.length === activeGroup.members?.length;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Hi {user?.displayName || 'there'} 👋</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long',
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
        </View>

        {/* Group Selector - consistent design regardless of group count */}
        {userGroups.length > 0 && (
          <View style={styles.groupSelector}>
            <TouchableOpacity 
              style={styles.groupSelectorButton}
              onPress={() => setShowGroupPicker(true)}
            >
              <View style={styles.groupSelectorContent}>
                <View style={styles.groupSelectorLeft}>
                  <View style={[styles.groupIcon, { backgroundColor: activeGroup?.backgroundColor || '#8B5CF6' }]}>
                    <Text style={styles.groupIconText}>{activeGroup?.emoji || '👥'}</Text>
                  </View>
                  <View style={styles.groupSelectorInfo}>
                    <Text style={styles.groupSelectorName}>
                      {activeGroup?.name || 'Select Group'}
                    </Text>
                    <Text style={styles.groupSelectorMeta}>
                      {activeGroup ? `${activeGroup.members?.length || 0} members` : `${userGroups.length} groups available`}
                    </Text>
                  </View>
                </View>
                <View style={styles.groupSelectorRight}>
                  <View style={styles.groupSelectorArrowContainer}>
                    <Text style={styles.groupSelectorArrow}>⌄</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Mixtape Player - Always prominent, Apple-style */}
        <View style={styles.mixtapePlayerCard}>
          {(yesterdayPlaylist || yesterdayRound) ? (
            <>
              <View style={styles.playerHeader}>
                <Text style={styles.playerTitle}>Latest Mixtape</Text>
                <Text style={styles.playerSubtitle}>
                  {yesterdayRound?.submissions?.length || 0} songs from {activeGroup?.name}
                </Text>
              </View>
              
              <View style={styles.playlistButtonsContainer}>
                {yesterdayPlaylist && (
                  <Button
                    title="Open Playlist"
                    onPress={openYesterdayPlaylist}
                    variant="primary"
                    style={[
                      styles.playlistButton,
                      {
                        backgroundColor: activeGroup?.backgroundColor || '#007AFF',
                        shadowColor: activeGroup?.backgroundColor || '#007AFF',
                      }
                    ]}
                  />
                )}
                {yesterdayRound && yesterdayRound.submissions && (
                  <Button
                    title="View Songs"
                    onPress={() => setShowSongsModal(true)}
                    variant="secondary"
                    style={styles.playlistButton}
                  />
                )}
              </View>
            </>
          ) : (
            <>
              <View style={styles.playerHeader}>
                <Text style={styles.playerTitle}>No Mixtape Yet</Text>
                <Text style={styles.playerSubtitle}>
                  Submit songs with friends to create your first mixtape
                </Text>
              </View>
              <View style={styles.emptyPlayerActions}>
                <Text style={styles.emptyPlayerHint}>🎵 Songs will appear here after completion</Text>
              </View>
            </>
          )}
        </View>

        {/* Submission Timer - Secondary */}
        <View style={styles.timerSection}>
          {userSubmission ? (
            <CountdownTimer 
              targetDate={dropTime} 
              label="New mixtape drops in" 
            />
          ) : (
            <CountdownTimer targetDate={deadline} label="Submit your song" />
          )}
        </View>


        {!userSubmission && (
          <View style={styles.submissionPrompt}>
            <Text style={styles.promptTitle}>What's your vibe today?</Text>
            <Text style={styles.promptSubtitle}>
              Add one song to today's mixtape
            </Text>
            <View style={styles.songButtonContainer}>
              <Button
                title="Add Your Song"
                onPress={() => setShowMusicSearch(true)}
                variant="music"
                style={styles.selectButton}
              />
            </View>
          </View>
        )}

        <View style={styles.groupStatus}>
          
          {/* Tab Selector */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, groupCardTab === 'progress' && styles.tabButtonActive]}
              onPress={() => setGroupCardTab('progress')}
            >
              <Text style={[styles.tabText, groupCardTab === 'progress' && styles.tabTextActive]}>
                Progress
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, groupCardTab === 'vote' && styles.tabButtonActive]}
              onPress={() => setGroupCardTab('vote')}
            >
              <Text style={[styles.tabText, groupCardTab === 'vote' && styles.tabTextActive]}>
                Tape of the Day
              </Text>
            </TouchableOpacity>
          </View>

          {groupCardTab === 'progress' ? (
            <>
              <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { width: `${((currentRound.submissions?.length || 0) / (activeGroup.members?.length || 1)) * 100}%` }
                ]} 
              />
            </View>
            <Text style={[
              styles.progressText,
              isComplete && { color: theme.colors.success, fontWeight: '700' }
            ]}>
              {isComplete ? 
                '🔥 Squad is complete! Mixtape incoming...' :
                `${currentRound.submissions?.length || 0}/${activeGroup.members?.length || 0} friends added songs`
              }
            </Text>
          </View>

          <View style={styles.memberList}>
            {currentRound.submissions?.map((submission, index) => {
              const isCurrentUser = submission.user.id === user?.id;
              return (
                <View key={index} style={styles.memberItem}>
                  <View style={[styles.memberCircle, styles.submitted]}>
                    <Text style={styles.checkmark}>✓</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{submission.user.displayName}</Text>
                    <Text style={styles.songInfo}>
                      {`${submission.song.title} • ${submission.song.artist}`}
                    </Text>
                  </View>
                </View>
              );
            })}
            
            {activeGroup.members?.filter(member => 
              !currentRound.submissions?.some(s => s.user.id === member.user.id)
            ).map((member, index) => (
              <View key={`missing-${index}`} style={styles.memberItem}>
                <View style={[styles.memberCircle, styles.pending]}>
                  <Text style={styles.pendingIcon}>⏳</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.user.displayName}</Text>
                  <Text style={styles.songInfo}>Waiting...</Text>
                </View>
              </View>
            ))}
          </View>
            </>
          ) : (
            /* Voting Tab Content */
            <ScrollView style={styles.votingTabContent} showsVerticalScrollIndicator={false}>
              {!yesterdayRound || !yesterdayRound.submissions || yesterdayRound.submissions.length === 0 ? (
                <View style={styles.emptyVotingState}>
                  <Text style={styles.emptyVotingIcon}>🗳️</Text>
                  <Text style={styles.emptyVotingTitle}>No votes yet</Text>
                  <Text style={styles.emptyVotingText}>Vote opens after submissions</Text>
                </View>
              ) : (
                yesterdayRound.submissions.map((submission, index) => {
                const hasVoted = userVote !== null;
                const isSelected = userVote?.submissionId === submission.id;
                const voteCount = hasVoted ? (submission.voteCount || 0) : null;
                
                return (
                  <TouchableOpacity
                    key={submission.id}
                    style={styles.votingItem}
                    onPress={() => !hasVoted && submitVote(submission.id)}
                    disabled={hasVoted}
                  >
                    {submission.song.imageUrl ? (
                      <Image source={{ uri: submission.song.imageUrl }} style={styles.votingAlbumImage} />
                    ) : (
                      <View style={[styles.votingAlbumImage, styles.votingPlaceholderImage]}>
                        <Text style={styles.votingPlaceholderText}>🎵</Text>
                      </View>
                    )}
                    
                    <View style={styles.votingInfo}>
                      <Text style={styles.votingSongTitle}>{submission.song.title}</Text>
                      <Text style={styles.votingSongArtist}>{submission.song.artist}</Text>
                    </View>
                    
                    <TouchableOpacity 
                      style={[styles.votingCircle, isSelected && styles.votingCircleSelected]}
                      onPress={() => !hasVoted && submitVote(submission.id)}
                      disabled={hasVoted}
                    >
                      {isSelected && (
                        <Text style={styles.votingCheckmark}>✓</Text>
                      )}
                    </TouchableOpacity>
                    
                    {hasVoted && (
                      <View style={styles.votingItemRight}>
                        <Text style={styles.voteCount}>{voteCount}</Text>
                        <Text style={styles.voteLabel}>votes</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
                })
              )}
            </ScrollView>
          )}
        </View>

      </ScrollView>
    );
  };

  const renderGroupsScreen = () => (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Groups</Text>
        <Text style={styles.subtitle}>{userGroups.length} {userGroups.length === 1 ? 'group' : 'groups'}</Text>
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.createGroupButton]}
          onPress={() => setShowGroupCreate(true)}
        >
          <Text style={[styles.actionButtonText, styles.primaryActionText]}>Create Group</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.joinGroupButton]}
          onPress={() => setShowJoinGroup(true)}
        >
          <Text style={styles.actionButtonText}>Join Group</Text>
        </TouchableOpacity>
      </View>

      {userGroups.length > 0 ? (
        userGroups.map((group, index) => (
          <View key={group.id} style={styles.groupCard}>
            <TouchableOpacity 
              style={styles.groupCardMain}
              onPress={() => {
                if (group.id !== activeGroup?.id) {
                  performGroupSwitchAnimation(() => {
                    setActiveGroup(group);
                    setCurrentScreen('today');
                    loadCurrentRound(group.id);
                    loadYesterdayPlaylist(group.id);
                    loadYesterdayRound(group.id);
                  });
                } else {
                  setCurrentScreen('today');
                }
              }}
            >
              <View style={styles.groupCardHeader}>
                <Text style={styles.groupCardName}>{group.name}</Text>
                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={() => handleOpenGroupSettings(group)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.settingsButtonText}>⚙️</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.groupCardMeta}>
                {group.members?.length || 0} members
                {group.createdBy === user.id ? ' • Admin' : ''}
                {group.isPublic ? ' • Public' : ' • Private'}
              </Text>
              <View style={styles.groupCardStats}>
                <Text style={styles.groupCardStat}>
                  Created {new Date(group.createdAt).toLocaleDateString()}
                </Text>
                <Text style={styles.groupCardStat}>
                  {activeGroup?.id === group.id ? 'Active' : 'Tap to switch'}
                </Text>
                {activeGroup?.id === group.id && (
                  <Text style={[styles.groupCardStat, { color: theme.colors.primaryButton }]}>
                    ● Current
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No Groups Yet</Text>
          <Text style={styles.emptyStateText}>
            Create your first group to start sharing music with friends!
          </Text>
        </View>
      )}

      <Button
        title="‹  Back to Today"
        onPress={() => setCurrentScreen('today')}
        variant="secondary"
        style={styles.backButton}
      />
    </ScrollView>
  );

  const renderHistoryScreen = () => (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>Past mixtape entries</Text>
      </View>

      {/* Group Selector for History */}
      {activeGroup && (
        <View style={styles.groupSelector}>
          <TouchableOpacity 
            style={styles.groupSelectorButton}
            onPress={() => setShowGroupPicker(true)}
          >
            <View style={styles.groupSelectorContent}>
              <View style={styles.groupSelectorLeft}>
                <View style={[styles.groupIcon, { backgroundColor: activeGroup?.backgroundColor || '#8B5CF6' }]}>
                  <Text style={styles.groupIconText}>{activeGroup?.emoji || '👥'}</Text>
                </View>
                <View style={styles.groupSelectorInfo}>
                  <Text style={styles.groupSelectorName}>
                    {activeGroup?.name || 'Select Group'}
                  </Text>
                  <Text style={styles.groupSelectorMeta}>
                    Viewing history for this group
                  </Text>
                </View>
              </View>
              <View style={styles.groupSelectorRight}>
                <View style={styles.groupSelectorArrowContainer}>
                  <Text style={styles.groupSelectorArrow}>⌄</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Embedded History Content */}
      <View style={styles.historyContainer}>
        <HistoryScreen
          onClose={null} // No close function needed since it's embedded
          activeGroup={activeGroup}
          embedded={true} // Pass a prop to indicate it's embedded
        />
      </View>
    </ScrollView>
  );

  const renderProfileScreen = () => {
    // Helper functions for clean profile display
    const getDisplayName = () => {
      if (!user?.displayName) return 'User';
      
      // For Apple Music users, extract clean name from full display name
      if (user.displayName === 'Apple User') {
        // Try to get name from Apple credential if available
        return user.displayName;
      }
      
      // For both platforms, return the display name as-is
      return user.displayName;
    };

    const getDisplayEmail = () => {
      if (!user?.email) return 'No email';
      
      // Hide ugly internal Apple Music emails
      if (user.email.includes('@mixtape.internal')) {
        return 'Connected via Apple ID';
      }
      
      return user.email;
    };

    const getPlatformName = () => {
      // Determine platform from email or music accounts
      if (user?.email?.includes('@mixtape.internal') || 
          user?.musicAccounts?.some(acc => acc.platform === 'apple-music')) {
        return 'Apple Music';
      }
      
      return 'Spotify';
    };

    const handleLogout = () => {
      Alert.alert(
        'Logout',
        'Are you sure you want to log out?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Logout', 
            style: 'destructive',
            onPress: async () => {
              await logout();
            }
          }
        ]
      );
    };

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Manage your account</Text>
        </View>

        <View style={styles.profileCard}>
          <Text style={styles.profileName}>{getDisplayName()}</Text>
          <Text style={styles.profileEmail}>{getDisplayEmail()}</Text>
          <Text style={styles.profileMeta}>
            Member since {new Date(user?.createdAt || new Date()).toLocaleDateString('en-US', { 
              month: 'long', 
              year: 'numeric' 
            })}
          </Text>
        </View>

        <View style={styles.profileActions}>
          <Button
            title="🔔 Notifications"
            onPress={() => setShowNotifications(true)}
            variant="secondary"
            style={styles.profileActionButton}
          />
          <Button
            title="📱 About Mixtape"
            onPress={() => setShowAbout(true)}
            variant="secondary"
            style={styles.profileActionButton}
          />
        </View>

        <View style={styles.dangerZone}>
          <Button
            title="Logout"
            onPress={handleLogout}
            style={styles.logoutButton}
          />
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Simple Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, currentScreen === 'today' && styles.tabActive]}
          onPress={() => setCurrentScreen('today')}
        >
          <Text style={[styles.tabText, currentScreen === 'today' && styles.tabTextActive]}>
            Today
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, currentScreen === 'groups' && styles.tabActive]}
          onPress={() => setCurrentScreen('groups')}
        >
          <Text style={[styles.tabText, currentScreen === 'groups' && styles.tabTextActive]}>
            Groups
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, currentScreen === 'history' && styles.tabActive]}
          onPress={() => setCurrentScreen('history')}
        >
          <Text style={[styles.tabText, currentScreen === 'history' && styles.tabTextActive]}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, currentScreen === 'profile' && styles.tabActive]}
          onPress={() => setCurrentScreen('profile')}
        >
          <Text style={[styles.tabText, currentScreen === 'profile' && styles.tabTextActive]}>Profile</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
        {currentScreen === 'today' && renderTodayScreen()}
        {currentScreen === 'groups' && renderGroupsScreen()}
        {currentScreen === 'history' && renderHistoryScreen()}
        {currentScreen === 'profile' && renderProfileScreen()}
      </Animated.View>

      {/* Music Search Modal */}
      <Modal visible={showMusicSearch} animationType="slide">
        <MusicSearchScreen
          onClose={() => setShowMusicSearch(false)}
          onSelectSong={handleSongSubmission}
        />
      </Modal>

      {/* Group Create Modal */}
      <Modal visible={showGroupCreate} animationType="slide">
        <GroupCreateScreen
          onClose={() => setShowGroupCreate(false)}
          onCreateGroup={handleCreateGroup}
        />
      </Modal>

      {/* History Modal */}
      <Modal visible={showHistory} animationType="slide">
        <HistoryScreen
          onClose={() => setShowHistory(false)}
          activeGroup={activeGroup}
        />
      </Modal>

      {/* Join Group Modal */}
      <Modal visible={showJoinGroup} animationType="slide">
        <JoinGroupScreen
          onClose={() => setShowJoinGroup(false)}
          onJoinGroup={handleJoinGroup}
        />
      </Modal>


      {/* Notifications Modal */}
      <Modal visible={showNotifications} animationType="slide">
        <NotificationsScreen
          onClose={() => setShowNotifications(false)}
        />
      </Modal>

      {/* About Modal */}
      <Modal visible={showAbout} animationType="slide">
        <AboutScreen
          onClose={() => setShowAbout(false)}
        />
      </Modal>

      {/* Group Settings Modal */}
      <Modal visible={showGroupSettings} animationType="slide">
        <GroupSettingsScreen
          onClose={() => {
            setShowGroupSettings(false);
            setSelectedGroupForSettings(null);
            handleGroupDeleted(); // Refresh groups list in case a group was deleted
          }}
          group={selectedGroupForSettings}
          onGroupUpdated={handleGroupUpdated}
        />
      </Modal>

      {/* Songs List Modal */}
      <Modal visible={showSongsModal} animationType="slide">
        <SafeAreaView style={styles.songsModalContainer}>
          <View style={styles.songsModalHeader}>
            <Text style={styles.songsModalTitle}>Songs in Mixtape</Text>
            <TouchableOpacity 
              onPress={() => setShowSongsModal(false)}
              style={styles.songsModalClose}
            >
              <Text style={styles.songsModalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.songsModalContent}>
            {yesterdayRound?.submissions?.map((submission, index) => (
              <View key={submission.id || index} style={styles.songItem}>
                <View style={styles.songItemLeft}>
                  <View style={styles.songNumber}>
                    <Text style={styles.songNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.songInfo}>
                    <Text style={styles.songTitle}>{submission.song.title}</Text>
                    <Text style={styles.songArtist}>{submission.song.artist}</Text>
                    <Text style={styles.songSubmitter}>by {submission.user.displayName}</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.playButton}
                  onPress={() => {
                    const query = encodeURIComponent(`${submission.song.title} ${submission.song.artist}`);
                    let musicURL;
                    let platformName;
                    
                    if (userPlatform === 'apple-music') {
                      musicURL = `https://music.apple.com/search?term=${query}`;
                      platformName = 'Apple Music';
                    } else {
                      musicURL = `https://open.spotify.com/search/${query}`;
                      platformName = 'Spotify';
                    }
                    
                    Linking.openURL(musicURL).catch(() => {
                      Alert.alert(
                        `Search ${platformName}`,
                        `Search for: "${submission.song.title}" by ${submission.song.artist}`,
                        [{ text: 'OK' }]
                      );
                    });
                  }}
                >
                  <Text style={styles.playButtonIcon}>▶</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          
        </SafeAreaView>
      </Modal>

      {/* Group Selection Modal for Song Submission */}
      <Modal visible={showGroupSelection} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.groupSelectionModal}>
            <View style={styles.groupSelectionHeader}>
              <Text style={styles.groupSelectionTitle}>Select Group</Text>
              <TouchableOpacity 
                onPress={() => setShowGroupSelection(false)}
                style={styles.modalCloseButton}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.groupSelectionSubtitle}>
              Which group would you like to add this song to?
            </Text>
            
            <ScrollView style={styles.groupSelectionList}>
              {userGroups.map((group) => (
                <TouchableOpacity
                  key={group.id}
                  style={styles.groupSelectionItem}
                  onPress={() => handleGroupSelectionForSong(group)}
                >
                  <View style={styles.groupSelectionItemContent}>
                    <Text style={styles.groupSelectionItemName}>{group.name}</Text>
                    <Text style={styles.groupSelectionItemMeta}>
                      {group.members?.length || 0} members • {group.isPublic ? 'Public' : 'Private'}
                    </Text>
                  </View>
                  <Text style={styles.groupSelectionArrow}>→</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Group Picker Modal */}
      <Modal visible={showGroupPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.groupPickerModal}>
            <View style={styles.groupPickerHeader}>
              <Text style={styles.groupPickerTitle}>Switch Group</Text>
              <TouchableOpacity 
                onPress={() => setShowGroupPicker(false)}
                style={styles.modalCloseButton}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.groupPickerSubtitle}>
              Select which group you'd like to view:
            </Text>
            
            <ScrollView style={styles.groupPickerList}>
              {userGroups.map((group) => (
                <TouchableOpacity
                  key={group.id}
                  style={[
                    styles.groupPickerItem,
                    activeGroup?.id === group.id && styles.groupPickerItemActive
                  ]}
                  onPress={() => handleGroupPick(group)}
                >
                  <View style={styles.groupPickerItemLeft}>
                    <View style={[
                      styles.groupPickerIcon,
                      { backgroundColor: group.backgroundColor || '#8B5CF6' },
                      activeGroup?.id === group.id && styles.groupPickerIconActive
                    ]}>
                      <Text style={[
                        styles.groupPickerIconText,
                        activeGroup?.id === group.id && styles.groupPickerIconTextActive
                      ]}>
                        {group.emoji || '👥'}
                      </Text>
                    </View>
                    <View style={styles.groupPickerItemContent}>
                      <Text style={[
                        styles.groupPickerItemName,
                        activeGroup?.id === group.id && styles.groupPickerItemNameActive
                      ]}>
                        {group.name}
                      </Text>
                      <Text style={[
                        styles.groupPickerItemMeta,
                        activeGroup?.id === group.id && styles.groupPickerItemMetaActive
                      ]}>
                        {group.members?.length || 0} members • {group.isPublic ? 'Public' : 'Private'}
                      </Text>
                    </View>
                  </View>
                  {activeGroup?.id === group.id && (
                    <Text style={styles.groupPickerCheckmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confetti Animation */}
      <ConfettiBurst 
        show={showConfetti} 
        onComplete={() => setShowConfetti(false)} 
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 100,
  },
  
  // Tab Bar - Apple-style depth
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceElevated,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 0.33,
    borderColor: theme.colors.borderLight,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    marginHorizontal: 2,
  },
  tabActive: {
    backgroundColor: theme.colors.primaryButton,
    shadowColor: theme.colors.primaryButton,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  // Header
  header: {
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  date: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },

  // Timer - Apple Music-style depth
  timerContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.xl,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 16,
    borderWidth: 0.33,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    // Apple-style layered background
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    // Subtle inner shadow
    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0))',
  },
  timerLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerText: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  timerSeparator: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.colors.textTertiary,
    marginHorizontal: theme.spacing.xs,
  },

  // Submission Prompt
  submissionPrompt: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  promptTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  promptSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: 24,
  },
  selectButton: {
    paddingHorizontal: theme.spacing.xl + theme.spacing.md,
    minHeight: 56,
  },

  // Group Status - Apple Music-style card with rich depth
  groupStatus: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    elevation: 20,
    borderWidth: 0.33,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    // Apple-style subtle gradient overlay
    overflow: 'hidden',
  },
  groupName: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.groupHeader,
    marginBottom: theme.spacing.lg,
    letterSpacing: -0.3,
  },
  progressContainer: {
    marginBottom: theme.spacing.lg,
  },
  progressBar: {
    height: 4,
    backgroundColor: theme.colors.pending,
    borderRadius: 2,
    marginBottom: theme.spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.success,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  memberList: {
    gap: theme.spacing.md,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  submitted: {
    backgroundColor: theme.colors.success,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  pending: {
    backgroundColor: theme.colors.pending,
    borderWidth: 1,
    borderColor: theme.colors.borderMedium,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pendingIcon: {
    fontSize: 14,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  songInfo: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },

  // Group Card - Apple Music-style with premium depth
  groupCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 36,
    elevation: 18,
    borderWidth: 0.33,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    // Apple-style backdrop filter effect
    overflow: 'hidden',
  },
  groupCardName: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  groupCardMeta: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  groupCardStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  groupCardStat: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },

  // Buttons - Apple Music-style with premium depth
  button: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonPrimary: {
    // backgroundColor and shadowColor now set dynamically via inline styles
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 0,
  },
  buttonSecondary: {
    backgroundColor: '#F2F2F7', // Apple's gray background  
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.08)', // Subtle border for depth
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 1,
  },
  buttonMusic: {
    backgroundColor: theme.colors.primaryButton,
    shadowColor: theme.colors.primaryButton,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 16,
    borderWidth: 0.33,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    // Apple-style gradient overlay for music button
    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0))',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  buttonTextPrimary: {
    color: '#ffffff',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  buttonTextSecondary: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.1,
  },
  buttonTextMusic: {
    color: '#ffffff',
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
    minHeight: 52, // Apple's recommended touch target
    borderRadius: theme.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  createGroupButton: {
    backgroundColor: theme.colors.surfaceWhite,
    borderWidth: 1.5,
    borderColor: theme.colors.primaryButton,
    shadowColor: theme.colors.primaryButton,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  joinGroupButton: {
    backgroundColor: theme.colors.surfaceWhite,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    letterSpacing: 0.1,
  },
  primaryActionText: {
    color: theme.colors.primaryButton,
    fontWeight: '600',
  },
  backButton: {
    marginTop: theme.spacing.lg,
  },

  // Yesterday Banner - Apple Music-style
  yesterdayBanner: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)', // Light iOS green background (matches success)
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  yesterdayTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.primaryButton,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  yesterdaySubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: theme.spacing.lg,
  },
  yesterdayButton: {
    backgroundColor: theme.colors.primaryButton,
    borderWidth: 0,
    shadowColor: theme.colors.primaryButton,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  // Mixtape Player Card - Apple Music-esque, always prominent
  mixtapePlayerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 24, // More padding from card edges
    paddingBottom: 24,
    marginBottom: theme.spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  playerHeader: {
    marginBottom: theme.spacing.md,
  },
  playerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  playerSubtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  emptyPlayerActions: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  emptyPlayerHint: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    fontStyle: 'italic',
  },
  
  // Timer Section - Secondary
  timerSection: {
    marginBottom: theme.spacing.lg,
  },
  
  playlistButtonsContainer: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistButton: {
    flex: 1,
    marginTop: 0,
    height: 50, // Fixed height for consistency
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Songs Modal Styles
  songsModalContainer: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  songsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surfaceWhite,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  songsModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  songsModalClose: {
    padding: theme.spacing.sm,
  },
  songsModalCloseText: {
    fontSize: 20,
    color: theme.colors.textSecondary,
  },
  songsModalContent: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceWhite,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  songItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  songNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primaryButton,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  songNumberText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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
  songSubmitter: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    fontStyle: 'italic',
  },
  playButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonIcon: {
    fontSize: 20,
    color: '#000000',
    marginLeft: 2, // Slight offset to center the play triangle
  },
  songsModalFooter: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceWhite,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  songsModalFooterText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  // Voting Card - Apple Music-style matching group status card
  votingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    elevation: 20,
    borderWidth: 0.33,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    overflow: 'hidden',
  },
  votingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  votingSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: theme.spacing.lg,
  },
  votingList: {
    marginTop: theme.spacing.md,
    maxHeight: 300, // Fixed height for scrolling
  },
  votingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  votingItemClickable: {
    // No special styling for clickable state
  },
  votingItemSelected: {
    // No special styling for selected state - indicated by checkmark
  },
  votingCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.borderLight,
    marginLeft: theme.spacing.sm,
  },
  votingCircleSelected: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  votingCheckmark: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  votingInfo: {
    flex: 1,
  },
  votingSongTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  votingSongArtist: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  votingAlbumImage: {
    width: 50,
    height: 50,
    borderRadius: theme.borderRadius.sm,
    marginRight: theme.spacing.md,
  },
  votingPlaceholderImage: {
    backgroundColor: theme.colors.bgPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  votingPlaceholderText: {
    fontSize: 20,
  },
  votingItemRight: {
    alignItems: 'flex-end',
    marginLeft: theme.spacing.sm,
  },
  voteCount: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primaryButton,
  },
  voteLabel: {
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
  yourVoteIndicator: {
    fontSize: 12,
    color: theme.colors.primaryButton,
    fontWeight: '600',
    marginTop: 4,
  },

  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.bgPrimary,
    borderRadius: theme.borderRadius.md,
    padding: 4,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  tabButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: theme.colors.tabAccent,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    color: 'white',
  },
  votingTabContent: {
    maxHeight: 300,
  },


  // New styles
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },
  // Apple-style onboarding design
  onboardingSafeArea: {
    flex: 1,
    backgroundColor: '#F2F2F7', // iOS system background
  },
  onboardingContainer: {
    flex: 1,
  },
  onboardingContent: {
    paddingHorizontal: 20,
    paddingBottom: 34, // iOS safe area bottom
    justifyContent: 'space-between',
    minHeight: '100%',
  },
  onboardingHero: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
    flex: 1,
    justifyContent: 'center',
  },
  appIconContainer: {
    marginBottom: 32,
  },
  appIcon: {
    width: 90,
    height: 90,
    backgroundColor: '#007AFF', // iOS blue
    borderRadius: 20, // iOS app icon corner radius
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  appIconEmoji: {
    fontSize: 36,
    color: 'white',
    fontWeight: '600',
  },
  onboardingTitle: {
    fontSize: 34,
    fontWeight: '700', // iOS Large Title Bold
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.41, // iOS Large Title tracking
    lineHeight: 41,
    fontFamily: 'System', // iOS San Francisco
  },
  onboardingTagline: {
    fontSize: 17,
    color: '#6D6D80', // iOS secondary label
    textAlign: 'center',
    fontWeight: '400', // iOS Body Regular
    lineHeight: 22,
    letterSpacing: -0.41, // iOS Body tracking
    fontFamily: 'System',
  },
  featuresCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16, // iOS card corner radius
    marginHorizontal: 0,
    marginBottom: 32,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 0.33,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  featureIconContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureIcon: {
    fontSize: 18,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: '600', // iOS Body Semibold
    color: '#000000',
    marginBottom: 2,
    letterSpacing: -0.41, // iOS Body tracking
    fontFamily: 'System',
  },
  featureDescription: {
    fontSize: 15,
    color: '#6D6D80',
    fontWeight: '400', // iOS Footnote Regular
    letterSpacing: -0.24, // iOS Footnote tracking
    lineHeight: 20,
    fontFamily: 'System',
  },
  featureDivider: {
    height: 0.33,
    backgroundColor: 'rgba(60, 60, 67, 0.29)', // iOS separator
    marginLeft: 60, // Align with text
  },
  onboardingCTA: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
  },
  onboardingPrimaryButton: {
    minHeight: 50, // iOS standard button height
    minWidth: '100%',
    borderRadius: 14, // iOS button corner radius
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  onboardingHint: {
    fontSize: 13,
    color: '#8E8E93', // iOS tertiary label
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '400', // iOS Caption Regular
    lineHeight: 18,
    letterSpacing: -0.08, // iOS Caption tracking
    fontFamily: 'System',
  },
  onboardingHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  logoutButtonSmall: {
    backgroundColor: theme.colors.error,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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

  // Profile styles - Apple Music-style
  profileCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 14,
    alignItems: 'center',
    borderWidth: 0.33,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    overflow: 'hidden',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  profileEmail: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  profileMeta: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    textAlign: 'center',
  },
  profileActions: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  profileActionButton: {
    justifyContent: 'flex-start',
    paddingHorizontal: theme.spacing.lg,
  },
  dangerZone: {
    marginTop: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  logoutButton: {
    backgroundColor: theme.colors.error,
    borderWidth: 0,
    shadowColor: theme.colors.error,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  
  // New group card styles
  groupCardMain: {
    flex: 1,
  },
  groupCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  settingsButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(142, 142, 147, 0.12)', // iOS system gray background
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButtonText: {
    fontSize: 14,
    color: '#8E8E93', // iOS system gray text
  },

  // Group Selector Styles
  groupSelector: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  groupSelectorButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: theme.borderRadius.md,
    borderWidth: 0.33,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  groupSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  groupSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  groupIconText: {
    fontSize: 18,
  },
  groupSelectorInfo: {
    flex: 1,
  },
  groupSelectorName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  groupSelectorMeta: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  groupSelectorRight: {
    marginLeft: theme.spacing.sm,
  },
  groupSelectorArrowContainer: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(142, 142, 147, 0.12)', // iOS system gray background
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupSelectorArrow: {
    fontSize: 12,
    color: '#8E8E93', // iOS system gray text
    fontWeight: '600',
    transform: [{ scaleY: 0.6 }], // Make it more horizontally compressed like iOS
  },

  // Group Selection Modal Styles - Apple Music-style
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  groupSelectionModal: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    paddingTop: theme.spacing.lg,
    maxHeight: '60%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 20,
  },
  groupSelectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  groupSelectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  groupSelectionSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  groupSelectionList: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 40,
  },
  groupSelectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  groupSelectionItemContent: {
    flex: 1,
  },
  groupSelectionItemName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  groupSelectionItemMeta: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  groupSelectionArrow: {
    fontSize: 20,
    color: theme.colors.primaryButton,
    marginLeft: theme.spacing.sm,
  },

  // Group Picker Modal Styles - Apple Music-style
  groupPickerModal: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    paddingTop: theme.spacing.lg,
    maxHeight: '70%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 20,
  },
  groupPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  groupPickerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  groupPickerSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  groupPickerList: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 40,
  },
  groupPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  groupPickerItemActive: {
    backgroundColor: theme.colors.primaryButton + '15', // Light purple background
  },
  groupPickerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupPickerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  groupPickerIconActive: {
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  groupPickerIconText: {
    fontSize: 20,
  },
  groupPickerIconTextActive: {
    fontSize: 20,
  },
  groupPickerItemContent: {
    flex: 1,
  },
  groupPickerItemName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  groupPickerItemNameActive: {
    color: theme.colors.primaryButton,
  },
  groupPickerItemMeta: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  groupPickerItemMetaActive: {
    color: theme.colors.primaryButton + 'CC', // Slightly transparent purple
  },
  groupPickerCheckmark: {
    fontSize: 20,
    color: theme.colors.primaryButton,
    fontWeight: '700',
    marginLeft: theme.spacing.sm,
  },

  // Animation styles
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  confettiParticle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  songButtonContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  songAddedButton: {
    backgroundColor: theme.colors.primaryButton,
  },
  
  // Close button styling for modals
  modalCloseButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderLight,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '700',
    lineHeight: 16,
  },
  
  // History container for embedded history screen
  historyContainer: {
    flex: 1,
    minHeight: 400,
  },
  
  // Empty voting state styles - Apple minimal design
  emptyVotingState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyVotingIcon: {
    fontSize: 32,
    marginBottom: theme.spacing.sm,
  },
  emptyVotingTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyVotingText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});

export default AppNavigator;