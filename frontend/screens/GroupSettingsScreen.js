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
  TextInput,
  Share,
  Clipboard,
  Modal,
  Linking,
  FlatList,
  Haptics,
} from 'react-native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
// Removed: Apple upgrade service - now only using Apple Music MusicKit authentication

// Apple-level extensive emoji collection with iOS categories
const EMOJI_CATEGORIES = {
  '😀': [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '🫠', '😉', '😊', '😇', '🥰', '😍',
    '🤩', '😘', '😗', '☺️', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🫢',
    '🫣', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😶‍🌫️', '😏', '😒', '🙄', '😬', '😮‍💨',
    '🤥', '🫨', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴',
    '😵', '😵‍💫', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '🫤', '😟', '🙁', '☹️', '😮', '😯',
    '😲', '😳', '🥺', '🥹', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓',
    '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻',
    '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'
  ],
  
  '🐶': [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵',
    '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗',
    '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🦂',
    '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋',
    '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🦣', '🐘', '🦏', '🦛', '🐪', '🐫', '🦒', '🦘', '🦬',
    '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛',
    '🪶', '🐓', '🦃', '🦤', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥',
    '🐁', '🐀', '🐿️', '🦔', '🌲', '🌳', '🌴', '🌵', '🌶️', '🍄', '🌾', '💐', '🌷', '🌹', '🥀', '🌺'
  ],
  
  '🍎': [
    '🍎', '🍏', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝',
    '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐',
    '🥖', '🍞', '🥨', '🥯', '🧇', '🥞', '🧈', '🍯', '🥜', '🌰', '🍳', '🥚', '🧀', '🥓', '🥩', '🍗',
    '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕',
    '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢',
    '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰',
    '🥛', '🍼', '🫖', '☕', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹',
    '🧊', '🥄', '🍴', '🍽️', '🥣', '🥡', '🥢', '🧂'
  ],
  
  '⚽': [
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍',
    '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿',
    '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺', '🤾', '🏌️', '🏇', '🧘', '🏃', '🚶', '🧎', '🧍',
    '🎪', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎵', '🎶', '🥇', '🥈', '🥉', '🏆', '🏅', '🎖️',
    '🎗️', '🎫', '🎟️', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎵', '🎶', '🎯', '🎲',
    '🎮', '🕹️', '🎳', '♠️', '♥️', '♦️', '♣️', '♟️', '🃏', '🀄', '🎴'
  ],
  
  '🚗': [
    '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵',
    '🚲', '🛴', '🛹', '🛼', '🚁', '🛸', '✈️', '🛩️', '🪂', '💺', '🚀', '🛰️', '🚊', '🚉', '🚞', '🚝',
    '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚃', '🚋', '🚟', '🚠', '🚡', '⛴️', '🛥️', '🚤', '⛵', '🛶',
    '🚢', '⚓', '🪝', '⛽', '🚧', '🚨', '🚥', '🚦', '🛑', '🚏', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯',
    '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🛖',
    '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩',
    '💒', '🏛️', '⛪', '🕌', '🛕', '🕍', '🕋', '⛩️', '🛤️', '🛣️', '🗾', '🎑', '🏞️', '🌅', '🌄', '🌠',
    '🎇', '🎆', '🌇', '🌆', '🏙️', '🌃', '🌌', '🌉', '🌁'
  ],
  
  '📱': [
    '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼',
    '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭',
    '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🪫', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️',
    '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒️',
    '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️',
    '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺',
    '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🪣', '🧽', '🧴', '🛎️', '🔑', '🗝️', '🚪',
    '🪑', '🛋️', '🛏️', '🛌', '🧸', '🪆', '🖼️', '🪞', '🪟', '🛍️', '🎁', '🎈', '🎏', '🎀', '🪄', '🪅'
  ],
  
  '❤️': [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓',
    '💗', '💖', '💘', '💝', '💟', '♥️', '💌', '💋', '💍', '💎', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️',
    '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓',
    '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐',
    '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔',
    '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️',
    '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎',
    '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹'
  ],
  
  '🎨': [
    '🎨', '🖌️', '🖍️', '✏️', '✒️', '🖊️', '🖋️', '✂️', '📐', '📏', '📌', '📍', '📎', '🖇️', '📂', '📁',
    '📄', '📃', '📑', '📊', '📈', '📉', '📜', '📋', '📅', '📆', '🗓️', '📇', '🗃️', '🗳️', '🗄️', '📗',
    '📘', '📙', '📓', '📔', '📒', '📚', '📖', '🔖', '🧷', '🔗', '📰', '🗞️', '📺', '📻', '🎭', '🎪',
    '🎨', '🎬', '🎤', '🎧', '🎼', '🎵', '🎶', '🎸', '🥁', '🎹', '🎺', '🎷', '🎻', '🪕', '🥀', '🌹',
    '🌺', '🌸', '🌼', '🌻', '💐', '🎈', '🎉', '🎊', '🎁', '🎀', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️'
  ]
};

// Flatten all emojis for the grid display
const ALL_EMOJIS = Object.values(EMOJI_CATEGORIES).flat();

// Background color options
const BACKGROUND_COLORS = [
  { name: 'Purple', color: '#8B5CF6' },
  { name: 'Blue', color: '#3B82F6' },
  { name: 'Green', color: '#10B981' },
  { name: 'Red', color: '#EF4444' },
  { name: 'Orange', color: '#F97316' },
  { name: 'Pink', color: '#EC4899' },
  { name: 'Yellow', color: '#F59E0B' },
  { name: 'Indigo', color: '#6366F1' },
  { name: 'Teal', color: '#14B8A6' },
  { name: 'Rose', color: '#F43F5E' },
  { name: 'Gray', color: '#6B7280' },
  { name: 'Black', color: '#1F2937' },
];

const theme = {
  colors: {
    bgPrimary: '#f8f9fa',
    surfaceWhite: '#ffffff',
    textPrimary: '#1a1a1a',
    textSecondary: '#6b7280',
    textTertiary: '#9ca3af',
    primaryButton: '#007AFF',
    primaryButtonPressed: '#0056CC',
    secondaryButton: '#F3F4F6',
    borderLight: '#E5E7EB',
    shadow: 'rgba(0, 0, 0, 0.08)',
    success: '#10B981',
    error: '#FF3B30',
    warning: '#FF9500',
    spotify: '#1DB954',
    appleMusic: '#FA243C',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
};

// Playlist Permissions Management Component
const PlaylistPermissionsSection = ({ groupId, members }) => {
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Filter to only show Spotify users (non-phone users)
  const spotifyUsers = members.filter(member => {
    const isPhoneUser = member.user.email?.startsWith('+');
    return !isPhoneUser;
  });

  useEffect(() => {
    loadPlaylistPermissions();
  }, [groupId]);

  const loadPlaylistPermissions = async () => {
    try {
      const response = await api.get(`/groups/${groupId}/playlist-permissions`);
      setPermissions(response.data.permissions || {});
    } catch (error) {
      console.log('Failed to load playlist permissions, using empty permissions');
      // If endpoint fails, start with empty permissions
      setPermissions({});
    } finally {
      setLoading(false);
    }
  };

  const toggleUserPermission = async (userId) => {
    const currentPermission = permissions[userId] || false;
    const newPermission = !currentPermission;
    
    setUpdating(true);
    try {
      await api.put(`/groups/${groupId}/playlist-permissions`, {
        userId,
        canCreatePlaylists: newPermission
      });
      
      setPermissions(prev => ({
        ...prev,
        [userId]: newPermission
      }));
      
      // Get user name for success message
      const user = members.find(m => m.user.id === userId);
      const userName = user?.user.displayName || 'User';
      const permissionText = newPermission ? 'can create playlists' : 'cannot create playlists';
      
      Alert.alert(
        'Success! 🎉', 
        `${userName} ${permissionText}.`
      );
    } catch (error) {
      console.error('Failed to update playlist permission:', error);
      Alert.alert('Error', 'Failed to update playlist permissions. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={{ margin: 20 }} />;
  }

  if (spotifyUsers.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>
          No Spotify users in this group yet.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.permissionsContainer}>
      {spotifyUsers.map((member) => (
        <View key={member.user.id} style={styles.permissionItem}>
          <View style={styles.permissionUserInfo}>
            <Text style={styles.permissionUserName}>{member.user.displayName}</Text>
            <Text style={styles.permissionUserEmail}>{member.user.email}</Text>
          </View>
          <Switch
            value={permissions[member.user.id] || false}
            onValueChange={() => toggleUserPermission(member.user.id)}
            disabled={updating}
            trackColor={{ false: '#f2f2f7', true: '#8B5CF6' }}
            thumbColor={permissions[member.user.id] ? '#ffffff' : '#f2f2f7'}
          />
        </View>
      ))}
      <Text style={styles.permissionHint}>
        Enabled users can create playlists when delegated.
      </Text>
    </View>
  );
};

// Group Playlists Management Component
const GroupPlaylistsSection = ({ groupId }) => {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updatingNames, setUpdatingNames] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState(null);
  const [editPlaylistName, setEditPlaylistName] = useState('');

  useEffect(() => {
    loadGroupPlaylists();
  }, [groupId]);

  const loadGroupPlaylists = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/playlists/group/${groupId}`);
      setPlaylists(response.data.groupPlaylists || []);
    } catch (error) {
      console.error('Failed to load group playlists:', error);
      
      let errorMessage = 'Failed to load group playlists.';
      
      if (error.response?.status === 401) {
        errorMessage = 'Please log in again to view playlists.';
      } else if (error.response?.status === 403) {
        errorMessage = error.response.data?.message || 'You do not have permission to view this group\'s playlists.';
      } else if (error.response?.status === 404) {
        errorMessage = error.response.data?.message || 'Group not found or no longer exists.';
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.message || 'Invalid request.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
        if (error.response.data.message) {
          errorMessage += ': ' + error.response.data.message;
        }
      } else if (error.response?.data?.details) {
        errorMessage += ' Details: ' + error.response.data.details;
      }
      
      // Show specific alerts for different error types
      if (error.response?.status === 404) {
        Alert.alert('Group Not Found', errorMessage);
      } else if (error.response?.status === 403) {
        // Don't show alert for permission errors in settings - user is already in the group
        console.log('Permission error (expected in some cases):', errorMessage);
      } else if (error.response?.status !== 403) {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const updatePlaylistNames = async () => {
    // Prevent multiple simultaneous calls
    if (updatingNames) {
      console.log('Update already in progress, ignoring duplicate call');
      return;
    }

    try {
      setUpdatingNames(true);
      console.log(`Calling API: /groups/${groupId}/update-playlist-names`);
      const response = await api.post(`/groups/${groupId}/update-playlist-names`);
      
      if (response.data.success) {
        Alert.alert('Success!', response.data.message);
        await loadGroupPlaylists(); // Reload to show updated names
      }
    } catch (error) {
      console.error('Failed to update playlist names:', error);
      let errorMessage = 'Failed to update playlist names.';
      
      if (error.response?.status === 403) {
        errorMessage = 'You must be the group admin to update playlist names.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setUpdatingNames(false);
    }
  };

  const createGroupPlaylists = async () => {
    try {
      setCreating(true);
      const response = await api.post(`/playlists/group/${groupId}/create`);
      
      if (response.data.success) {
        const playlistCount = response.data.groupPlaylists?.length || 0;
        if (playlistCount > 0) {
          Alert.alert(
            'Success!', 
            `Created ${playlistCount} group playlists successfully!\n\nPlaylists will be updated daily at 8am with fresh submissions.`
          );
        } else {
          Alert.alert(
            'No Playlists Created', 
            'No playlists were created. Make sure you have connected your music accounts (Spotify or Apple Music) before creating playlists.'
          );
        }
        await loadGroupPlaylists(); // Reload to show new playlists
      } else {
        throw new Error(response.data.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Failed to create group playlists:', error);
      
      let errorMessage = 'Failed to create group playlists.';
      
      if (error.response?.status === 403) {
        errorMessage = error.response.data?.message || 'You must be the group admin to create playlists.';
      } else if (error.response?.status === 400) {
        const backendMessage = error.response.data?.message || '';
        
        // Check if it's a music account connection error
        if (backendMessage.includes('admin needs to have connected music accounts')) {
          Alert.alert(
            'Music Account Required',
            'To create playlists, you need to have connected music accounts (Spotify or Apple Music). Please log out and sign in with a music platform to create playlists.',
            [{ text: 'OK' }]
          );
          return;
        }
        
        errorMessage = backendMessage || 'Make sure you have connected music accounts (Spotify or Apple Music) to create playlists.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
        if (error.response.data.message) {
          errorMessage += ': ' + error.response.data.message;
        }
      } else if (error.response?.data?.details) {
        errorMessage = error.response.data.details;
      } else if (error.message?.includes('token') || error.message?.includes('auth')) {
        errorMessage = 'Music account authentication expired. Please reconnect your music accounts in settings.';
      } else if (error.message?.includes('network') || error.message?.includes('connection')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const startEditingPlaylist = (playlist) => {
    setEditingPlaylist(playlist.id);
    setEditPlaylistName(playlist.playlistName);
  };

  const savePlaylistName = async (playlistId) => {
    try {
      const response = await api.put(`/playlists/${playlistId}/name`, {
        name: editPlaylistName.trim()
      });
      
      if (response.data.success) {
        Alert.alert('Success!', 'Playlist name updated successfully!');
        await loadGroupPlaylists(); // Reload to show updated name
        setEditingPlaylist(null);
        setEditPlaylistName('');
      }
    } catch (error) {
      console.error('Failed to update playlist name:', error);
      let errorMessage = 'Failed to update playlist name.';
      
      if (error.response?.status === 403) {
        errorMessage = 'Only group admins can edit playlist names.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      Alert.alert('Error', errorMessage);
    }
  };

  const cancelEditingPlaylist = () => {
    setEditingPlaylist(null);
    setEditPlaylistName('');
  };

  const openPlaylist = (playlist) => {
    if (playlist.playlistUrl) {
      Alert.alert(
        'Open Playlist',
        `Open ${playlist.playlistName} in ${getPlatformName(playlist.platform)}?\n\nThis playlist is updated daily with fresh submissions from your group.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open', 
            onPress: () => {
              Linking.openURL(playlist.playlistUrl).catch(() => {
                Alert.alert(
                  'Can\'t Open Playlist',
                  `Unable to open ${getPlatformName(playlist.platform)}. Make sure the app is installed.`
                );
              });
            }
          },
        ]
      );
    } else {
      Alert.alert(
        'Playlist Not Available',
        'This playlist URL is not available. The playlist may have been deleted or there was an error creating it.'
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

  const getPlatformColor = (platform) => {
    switch (platform) {
      case 'spotify': return theme.colors.spotify;
      case 'apple-music': return theme.colors.appleMusic;
      default: return theme.colors.primaryButton;
    }
  };

  if (loading) {
    return (
      <View style={styles.playlistsCard}>
        <ActivityIndicator size="small" color={theme.colors.primaryButton} />
        <Text style={styles.loadingText}>Loading playlists...</Text>
      </View>
    );
  }

  return (
    <View style={styles.playlistsCard}>
      {playlists.length === 0 ? (
        <View style={styles.emptyPlaylistsState}>
          <View style={styles.playlistsHeaderRow}>
            <Text style={styles.emptyPlaylistIconText}>♪</Text>
            <Text style={styles.playlistsUpdateText}>Daily playlists update at 8 AM.</Text>
          </View>
          <Text style={styles.emptyPlaylistsTitle}>No Playlists</Text>
          <Text style={styles.emptyPlaylistsText}>
            Create playlists for your group.
          </Text>
          <TouchableOpacity
            style={styles.createPlaylistButton}
            onPress={createGroupPlaylists}
            disabled={creating}
            activeOpacity={0.8}
          >
            <View style={styles.createPlaylistButtonContent}>
              {creating ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Text style={styles.createPlaylistIcon}>+</Text>
                  <Text style={styles.createPlaylistButtonText}>Create Playlists</Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {playlists.map((playlist) => (
            <View key={playlist.id} style={styles.playlistCard}>
              <View style={styles.playlistCardContent}>
                <View style={[
                  styles.playlistIcon,
                  { backgroundColor: getPlatformColor(playlist.platform) + '15' }
                ]}>
                  <Text style={[
                    styles.playlistIconText,
                    { color: getPlatformColor(playlist.platform) }
                  ]}>
                    {getPlatformIcon(playlist.platform)}
                  </Text>
                </View>
                
                <View style={styles.playlistInfo}>
                  <View style={styles.playlistHeader}>
                    <Text style={[
                      styles.playlistPlatform,
                      { color: getPlatformColor(playlist.platform) }
                    ]}>
                      {getPlatformName(playlist.platform)}
                    </Text>
                    <Text style={styles.playlistLastUpdated}>
                      Updated {new Date(playlist.lastUpdated).toLocaleDateString()}
                    </Text>
                  </View>
                  
                  {editingPlaylist === playlist.id ? (
                    <View style={styles.editPlaylistNameContainer}>
                      <TextInput
                        style={styles.editPlaylistNameInput}
                        value={editPlaylistName}
                        onChangeText={setEditPlaylistName}
                        autoFocus
                        selectTextOnFocus
                        returnKeyType="done"
                        onSubmitEditing={() => savePlaylistName(playlist.id)}
                      />
                      <View style={styles.editPlaylistNameActions}>
                        <TouchableOpacity
                          style={styles.editPlaylistNameCancel}
                          onPress={cancelEditingPlaylist}
                        >
                          <Text style={styles.editPlaylistNameCancelText}>✕</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.editPlaylistNameSave}
                          onPress={() => savePlaylistName(playlist.id)}
                        >
                          <Text style={styles.editPlaylistNameSaveText}>✓</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.playlistNameContainer}
                      onLongPress={() => startEditingPlaylist(playlist)}
                      delayLongPress={500}
                    >
                      <Text style={styles.playlistName}>{playlist.playlistName}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                
                {editingPlaylist !== playlist.id && (
                  <TouchableOpacity
                    style={styles.playlistActionIcon}
                    onPress={() => openPlaylist(playlist)}
                  >
                    <Text style={styles.chevronRight}>›</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
          
          <View style={styles.playlistActions}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={createGroupPlaylists}
              disabled={creating}
              activeOpacity={0.8}
            >
              {creating ? (
                <ActivityIndicator color={theme.colors.primaryButton} size="small" />
              ) : (
                <Text style={styles.secondaryButtonText}>Refresh Playlists</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={updatePlaylistNames}
              disabled={updatingNames || creating}
              activeOpacity={0.8}
            >
              {updatingNames ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Update Names</Text>
              )}
            </TouchableOpacity>
          </View>
          
        </>
      )}
    </View>
  );
};

export default function GroupSettingsScreen({ onClose, group, onGroupUpdated }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [groupData, setGroupData] = useState(null);
  const [editedName, setEditedName] = useState('');
  const [editedEmoji, setEditedEmoji] = useState('👥');
  const [editedBackgroundColor, setEditedBackgroundColor] = useState('#8B5CF6');
  const [editedMaxMembers, setEditedMaxMembers] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('😀');
  const [userHasPlaylistPermission, setUserHasPlaylistPermission] = useState(false);

  const isAdmin = groupData?.adminUserId === user?.id;

  useEffect(() => {
    if (group?.id) {
      loadGroupData();
      checkUserPlaylistPermissions();
    }
  }, [group?.id]);

  const checkUserPlaylistPermissions = async () => {
    if (!user?.id || !group?.id) return;
    
    try {
      const response = await api.get(`/groups/${group.id}/playlist-permissions`);
      const permissions = response.data.permissions || {};
      setUserHasPlaylistPermission(permissions[user.id] || false);
    } catch (error) {
      console.log('Could not check playlist permissions (user might not be admin)');
      setUserHasPlaylistPermission(false);
    }
  };

  const loadGroupData = async () => {
    if (!group?.id) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/groups/${group.id}`);
      setGroupData(response.data.group);
      setEditedName(response.data.group.name);
      setEditedEmoji(response.data.group.emoji || '👥');
      setEditedBackgroundColor(response.data.group.backgroundColor || '#8B5CF6');
      setEditedMaxMembers(response.data.group.maxMembers.toString());
    } catch (error) {
      console.error('Failed to load group data:', error);
      Alert.alert('Error', 'Failed to load group settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateGroup = async (updates) => {
    if (!group?.id) return;
    
    try {
      setUpdating(true);
      const response = await api.put(`/groups/${group.id}`, updates);
      setGroupData(response.data.group);
      if (onGroupUpdated) {
        onGroupUpdated(response.data.group);
      }
      return response.data.group;
    } catch (error) {
      console.error('Failed to update group:', error);
      throw error;
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveBasicInfo = async () => {
    if (!editedName.trim()) {
      Alert.alert('Error', 'Group name cannot be empty');
      return;
    }

    const maxMembers = parseInt(editedMaxMembers);
    if (maxMembers < 3 || maxMembers > 20) {
      Alert.alert('Error', 'Max members must be between 3 and 20');
      return;
    }

    try {
      console.log('Updating group with:', {
        name: editedName.trim(),
        emoji: editedEmoji,
        maxMembers: maxMembers,
      });
      
      const updatedGroup = await updateGroup({
        name: editedName.trim(),
        emoji: editedEmoji,
        backgroundColor: editedBackgroundColor,
        maxMembers: maxMembers,
      });
      
      console.log('Group update response:', updatedGroup);
      setIsEditing(false);
      // Reload group data to ensure UI is in sync
      await loadGroupData();
      Alert.alert('Success', 'Group settings updated successfully!');
    } catch (error) {
      console.error('Group update error:', error);
      Alert.alert('Error', 'Failed to update group settings. Please try again.');
    }
  };

  const handleTogglePublic = async (isPublic) => {
    const action = isPublic ? 'make public' : 'make private';
    Alert.alert(
      `${isPublic ? 'Make Public' : 'Make Private'}`,
      `Are you sure you want to ${action} this group? ${isPublic ? 'Anyone will be able to find and join it.' : 'Only people with the invite code will be able to join.'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setToggleLoading(true);
              const updatedGroup = await updateGroup({ isPublic });
              console.log('Group updated:', updatedGroup);
              Alert.alert('Success', `Group is now ${isPublic ? 'public' : 'private'}!`);
            } catch (error) {
              console.error('Failed to update group visibility:', error);
              Alert.alert('Error', 'Failed to update group visibility. Please try again.');
            } finally {
              setToggleLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRegenerateInviteCode = async () => {
    Alert.alert(
      'Regenerate Invite Code',
      'This will create a new invite code and invalidate the old one. Members who haven\'t joined yet will need the new code.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await api.post(`/groups/${group.id}/invite-code`);
              setGroupData({ ...groupData, inviteCode: response.data.inviteCode });
              Alert.alert('Success', 'New invite code generated!');
            } catch (error) {
              Alert.alert('Error', 'Failed to regenerate invite code. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleShareInviteCode = async () => {
    const inviteMessage = `Join my Mixtape group "${groupData.name}"! Use invite code: ${groupData.inviteCode}`;
    
    try {
      await Share.share({
        message: inviteMessage,
        title: 'Join My Mixtape Group',
      });
    } catch (error) {
      // Fallback to clipboard
      Clipboard.setString(groupData.inviteCode);
      Alert.alert('Copied!', 'Invite code copied to clipboard');
    }
  };

  const handleCopyInviteCode = () => {
    Clipboard.setString(groupData.inviteCode);
    Alert.alert('Copied!', 'Invite code copied to clipboard');
  };

  const handleRemoveMember = async (member) => {
    if (member.userId === user.id) {
      Alert.alert('Error', 'You cannot remove yourself from the group.');
      return;
    }

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.user.displayName} from the group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/groups/${group.id}/members/${member.userId}`);
              await loadGroupData(); // Reload to get updated member list
              Alert.alert('Success', 'Member removed from group.');
            } catch (error) {
              Alert.alert('Error', 'Failed to remove member. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = async () => {
    Alert.alert(
      'Leave Group',
      isAdmin 
        ? 'As the admin, leaving will delete this group for everyone. Are you sure?' 
        : 'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/groups/${group.id}/leave`);
              // Close modal immediately after successful deletion to prevent rendering errors
              onClose();
              Alert.alert(
                'Left Group', 
                isAdmin ? 'Group has been deleted.' : 'You have left the group.'
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to leave group. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (!group) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Group Settings</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>No group selected</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Group Settings</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primaryButton} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Group Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Basic Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Information</Text>
          
          {isEditing ? (
            <View style={styles.editForm}>
              <Text style={styles.label}>Group Name</Text>
              <TextInput
                style={styles.input}
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Enter group name"
                maxLength={100}
              />
              
              <Text style={styles.label}>Group Icon</Text>
              <TouchableOpacity
                style={styles.emojiButton}
                onPress={() => setShowEmojiPicker(true)}
              >
                <View style={[styles.emojiPreview, { backgroundColor: editedBackgroundColor }]}>
                  <Text style={styles.emojiButtonEmoji}>{editedEmoji}</Text>
                </View>
                <View style={styles.emojiButtonContent}>
                  <Text style={styles.emojiButtonText}>Tap to change icon & color</Text>
                  <Text style={styles.emojiButtonSubtext}>
                    {BACKGROUND_COLORS.find(c => c.color === editedBackgroundColor)?.name || 'Custom'}
                  </Text>
                </View>
              </TouchableOpacity>
              
              <Text style={styles.label}>Max Members</Text>
              <TextInput
                style={styles.input}
                value={editedMaxMembers}
                onChangeText={setEditedMaxMembers}
                placeholder="Max members (3-20)"
                keyboardType="number-pad"
                maxLength={2}
              />
              
              
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={() => {
                    setEditedName(groupData.name);
                    setEditedEmoji(groupData.emoji || '👥');
                    setEditedBackgroundColor(groupData.backgroundColor || '#8B5CF6');
                    setEditedMaxMembers(groupData.maxMembers.toString());
                    setIsEditing(false);
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={handleSaveBasicInfo}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Name</Text>
                <Text style={styles.infoValue}>{groupData.name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Members</Text>
                <Text style={styles.infoValue}>
                  {groupData._count?.members || 0} / {groupData.maxMembers}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Admin</Text>
                <Text style={styles.infoValue}>{groupData.admin?.displayName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Created</Text>
                <Text style={styles.infoValue}>
                  {new Date(groupData.createdAt).toLocaleDateString()}
                </Text>
              </View>
              
              {isAdmin && (
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton, { marginTop: theme.spacing.md }]}
                  onPress={() => setIsEditing(true)}
                >
                  <Text style={styles.secondaryButtonText}>Edit Info</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Privacy Settings (Admin Only) */}
        {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Privacy Settings</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Public Group</Text>
                <Text style={styles.settingDescription}>
                  Allow anyone to find and join this group
                </Text>
              </View>
              <Switch
                value={groupData.isPublic}
                onValueChange={handleTogglePublic}
                trackColor={{ false: theme.colors.borderLight, true: theme.colors.primaryButton }}
                thumbColor={toggleLoading ? theme.colors.textTertiary : undefined}
                disabled={updating || toggleLoading}
              />
            </View>
          </View>
        )}

        {/* Invite Code Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invite Members</Text>
          
          <View style={styles.inviteCard}>
            <Text style={styles.inviteTitle}>Invite Code</Text>
            <Text style={styles.inviteCode}>{groupData.inviteCode}</Text>
            <Text style={styles.inviteDescription}>
              Share this code with friends to invite them to your group
            </Text>
            
            <View style={styles.inviteActions}>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={handleCopyInviteCode}
              >
                <Text style={styles.secondaryButtonText}>Copy Code</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={handleShareInviteCode}
              >
                <Text style={styles.primaryButtonText}>Share</Text>
              </TouchableOpacity>
            </View>
            
            {isAdmin && (
              <TouchableOpacity
                style={[styles.button, styles.warningButton, { marginTop: theme.spacing.sm }]}
                onPress={handleRegenerateInviteCode}
              >
                <Text style={styles.warningButtonText}>Regenerate Code</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Group Playlists Section (Admin or Users with Permissions) */}
        {(isAdmin || userHasPlaylistPermission) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Group Playlists</Text>
            <GroupPlaylistsSection groupId={group?.id} />
          </View>
        )}

        {/* Playlist Permissions Section (Admin Only) */}
        {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Playlist Permissions</Text>
            <Text style={styles.sectionDescription}>
              Choose who can create playlists.
            </Text>
            <PlaylistPermissionsSection groupId={group?.id} members={groupData.members || []} />
          </View>
        )}

        {/* Members Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Members ({groupData._count?.members || 0})
          </Text>
          
          {groupData.members?.map((member, index) => (
            <View key={member.id} style={styles.memberItem}>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.user.displayName}</Text>
                <Text style={styles.memberRole}>
                  {member.userId === groupData.adminUserId ? 'Admin' : 'Member'}
                </Text>
                <Text style={styles.memberJoined}>
                  Joined {new Date(member.joinedAt).toLocaleDateString()}
                </Text>
              </View>
              
              {isAdmin && member.userId !== user.id && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveMember(member)}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.error }]}>
            Danger Zone
          </Text>
          
          <TouchableOpacity
            style={[styles.button, styles.dangerButton]}
            onPress={handleLeaveGroup}
          >
            <Text style={styles.dangerButtonText}>
              {isAdmin ? 'Delete Group' : 'Leave Group'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Emoji Picker Modal */}
      <Modal
        visible={showEmojiPicker}
        animationType="slide"
      >
        <SafeAreaView style={styles.emojiPickerContainer}>
          <View style={styles.emojiPickerHeader}>
            <TouchableOpacity 
              onPress={() => setShowEmojiPicker(false)}
              style={styles.emojiPickerClose}
            >
              <Text style={styles.emojiPickerCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.emojiPickerTitle}>Choose Icon & Color</Text>
            <TouchableOpacity 
              onPress={() => setShowEmojiPicker(false)}
              style={styles.emojiPickerDone}
            >
              <Text style={styles.emojiPickerDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
          
          {/* Preview Section */}
          <View style={styles.previewSection}>
            <View style={[styles.previewIcon, { backgroundColor: editedBackgroundColor }]}>
              <Text style={styles.previewEmoji}>{editedEmoji}</Text>
            </View>
            <Text style={styles.previewText}>Preview</Text>
          </View>
          
          {/* Background Color Section */}
          <View style={styles.colorSection}>
            <Text style={styles.sectionTitle}>Background Color</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorScroll}>
              {BACKGROUND_COLORS.map((colorOption, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.colorOption,
                    { backgroundColor: colorOption.color },
                    editedBackgroundColor === colorOption.color && styles.colorOptionSelected
                  ]}
                  onPress={() => setEditedBackgroundColor(colorOption.color)}
                >
                  {editedBackgroundColor === colorOption.color && (
                    <Text style={styles.colorOptionCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          
          {/* Category Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryTabs}>
            {Object.keys(EMOJI_CATEGORIES).map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryTab,
                  selectedCategory === category && styles.categoryTabActive
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text style={[
                  styles.categoryTabText,
                  selectedCategory === category && styles.categoryTabTextActive
                ]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {/* Emoji Grid */}
          <FlatList
            data={EMOJI_CATEGORIES[selectedCategory]}
            numColumns={8}
            keyExtractor={(item, index) => `${selectedCategory}-${index}`}
            contentContainerStyle={styles.emojiGrid}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.emojiItem,
                  editedEmoji === item && styles.emojiItemSelected
                ]}
                onPress={() => setEditedEmoji(item)}
              >
                <Text style={styles.emojiItemText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
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
    marginBottom: theme.spacing.lg,
  },
  infoCard: {
    backgroundColor: theme.colors.surfaceWhite,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  infoLabel: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  editForm: {
    backgroundColor: theme.colors.surfaceWhite,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  input: {
    backgroundColor: theme.colors.bgPrimary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    fontSize: 16,
    marginBottom: theme.spacing.md,
  },
  editActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceWhite,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  settingInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  inviteCard: {
    backgroundColor: theme.colors.surfaceWhite,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  inviteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  inviteCode: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.primaryButton,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: theme.spacing.sm,
    fontFamily: 'monospace',
  },
  inviteDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    lineHeight: 20,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  memberItem: {
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
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  memberRole: {
    fontSize: 14,
    color: theme.colors.primaryButton,
    fontWeight: '500',
    marginBottom: 2,
  },
  memberJoined: {
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
  removeButton: {
    backgroundColor: theme.colors.error,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  removeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButton: {
    backgroundColor: theme.colors.primaryButton,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: theme.colors.secondaryButton,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  warningButton: {
    backgroundColor: theme.colors.warning,
  },
  warningButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: theme.colors.error,
  },
  dangerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Emoji picker styles
  emojiButton: {
    backgroundColor: theme.colors.bgPrimary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  emojiPreview: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  emojiButtonEmoji: {
    fontSize: 28,
  },
  emojiButtonContent: {
    flex: 1,
  },
  emojiButtonText: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontWeight: '600',
    marginBottom: 2,
  },
  emojiButtonSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  emojiPickerContainer: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  emojiPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surfaceWhite,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  emojiPickerClose: {
    padding: theme.spacing.sm,
  },
  emojiPickerCloseText: {
    fontSize: 20,
    color: theme.colors.textSecondary,
  },
  emojiPickerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  emojiPickerDone: {
    padding: theme.spacing.sm,
  },
  emojiPickerDoneText: {
    fontSize: 16,
    color: theme.colors.primaryButton,
    fontWeight: '600',
  },
  previewSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceWhite,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
  },
  previewIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  previewEmoji: {
    fontSize: 40,
  },
  previewText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  colorSection: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  colorScroll: {
    flexDirection: 'row',
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: theme.colors.textPrimary,
  },
  colorOptionCheck: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  categoryTabs: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surfaceWhite,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    paddingVertical: theme.spacing.md,
  },
  categoryTab: {
    width: 50,
    height: 50,
    marginRight: theme.spacing.md,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bgPrimary,
  },
  categoryTabActive: {
    backgroundColor: theme.colors.primaryButton + '20',
    borderWidth: 2,
    borderColor: theme.colors.primaryButton,
  },
  categoryTabText: {
    fontSize: 24,
    color: theme.colors.textPrimary,
  },
  categoryTabTextActive: {
    fontSize: 24,
    color: theme.colors.textPrimary,
  },
  emojiGrid: {
    padding: theme.spacing.lg,
    paddingTop: 0,
  },
  emojiItem: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceWhite,
  },
  emojiItemSelected: {
    backgroundColor: theme.colors.primaryButton + '20',
    borderWidth: 2,
    borderColor: theme.colors.primaryButton,
  },
  emojiItemText: {
    fontSize: 24,
  },
  
  // Playlist styles
  playlistsCard: {
    backgroundColor: theme.colors.surfaceWhite,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  playlistsDescription: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: theme.spacing.lg,
    fontWeight: '400',
  },
  emptyPlaylistsState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  playlistsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    justifyContent: 'center',
  },
  emptyPlaylistIconText: {
    fontSize: 20,
    color: theme.colors.textSecondary,
    marginRight: theme.spacing.sm,
  },
  playlistsUpdateText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '400',
  },
  emptyPlaylistsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    letterSpacing: -0.1,
  },
  emptyPlaylistsText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: theme.spacing.lg,
    fontWeight: '400',
    paddingHorizontal: theme.spacing.md,
  },
  createPlaylistButton: {
    backgroundColor: theme.colors.primaryButton,
    borderRadius: theme.borderRadius.lg,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  createPlaylistButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  createPlaylistIcon: {
    fontSize: 20,
    color: 'white',
    fontWeight: '300',
    marginRight: theme.spacing.sm,
  },
  createPlaylistButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: 'white',
    letterSpacing: -0.1,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.bgPrimary,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  playlistInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  playlistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  playlistPlatform: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  playlistLastUpdated: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    fontWeight: '400',
  },
  playlistName: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    letterSpacing: -0.2,
  },
  playlistDescription: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    fontWeight: '400',
  },
  playlistHelpText: {
    backgroundColor: theme.colors.bgPrimary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.warning,
  },
  helpText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  
  // Updated Apple-like playlist styles
  playlistCard: {
    backgroundColor: theme.colors.surfaceWhite,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 0.5,
    borderColor: theme.colors.borderLight,
  },
  playlistCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  playlistIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  playlistIconText: {
    fontSize: 24,
  },
  playlistActionIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronRight: {
    fontSize: 20,
    color: theme.colors.textTertiary,
    fontWeight: '300',
  },
  // Playlist actions
  playlistActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  
  // Playlist editing styles
  playlistNameContainer: {
    flex: 1,
    paddingVertical: theme.spacing.xs,
  },
  editPlaylistNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  editPlaylistNameInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.bgPrimary,
    borderRadius: theme.borderRadius.sm,
    marginRight: theme.spacing.sm,
  },
  editPlaylistNameActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  editPlaylistNameCancel: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editPlaylistNameCancelText: {
    fontSize: 14,
    color: theme.colors.error,
    fontWeight: '600',
  },
  editPlaylistNameSave: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.success + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editPlaylistNameSaveText: {
    fontSize: 14,
    color: theme.colors.success,
    fontWeight: '600',
  },
  
  // Playlist permissions styles
  sectionDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },
  permissionsContainer: {
    marginTop: theme.spacing.sm,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceWhite,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  permissionUserInfo: {
    flex: 1,
  },
  permissionUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  permissionUserEmail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  permissionHint: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    fontStyle: 'italic',
  },
});