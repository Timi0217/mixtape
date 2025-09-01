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
  Switch,
  Modal,
  ScrollView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSubscription } from '../context/SubscriptionContext';

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
    primaryButton: '#8B5CF6',
    secondaryButton: '#F3F4F6',
    borderLight: '#E5E7EB',
    shadow: 'rgba(0, 0, 0, 0.1)',
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

export default function GroupCreateScreen({ onClose, onCreateGroup }) {
  const [groupName, setGroupName] = useState('');
  const [maxMembers, setMaxMembers] = useState('6');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const { subscription } = useSubscription();
  
  // Emoji and color customization
  const [emoji, setEmoji] = useState('👥');
  const [backgroundColor, setBackgroundColor] = useState('#8B5CF6');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('😀');

  const handleCreate = async () => {
    // Check if basic user is trying to create groups
    if (subscription?.plan === 'basic') {
      Alert.alert(
        'Upgrade Required', 
        'Basic users cannot create groups. Upgrade to Pro to create unlimited groups!',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade to Pro', onPress: () => onClose() }
        ]
      );
      return;
    }

    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    const maxMembersNum = parseInt(maxMembers);
    if (maxMembersNum < 3 || maxMembersNum > 20) {
      Alert.alert('Error', 'Max members must be between 3 and 20');
      return;
    }

    setLoading(true);
    try {
      await onCreateGroup({
        name: groupName.trim(),
        maxMembers: maxMembersNum,
        isPublic: isPublic,
        emoji: emoji,
        backgroundColor: backgroundColor,
      });
    } catch (error) {
      console.error('Create group error:', error);
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
          <Text style={styles.title}>Create Group</Text>
          <TouchableOpacity 
            onPress={handleCreate} 
            style={styles.createButton}
            disabled={loading}
          >
            <Text style={[styles.createButtonText, loading && styles.disabledText]}>
              {loading ? 'Creating...' : 'Create'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
        <View style={styles.section}>
          <Text style={styles.label}>Group Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., College Friends, Work Squad"
            value={groupName}
            onChangeText={setGroupName}
            maxLength={50}
            autoFocus
          />
          <Text style={styles.helper}>
            Choose a fun name that represents your group
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Max Members</Text>
          <TextInput
            style={styles.input}
            placeholder="6"
            value={maxMembers}
            onChangeText={setMaxMembers}
            keyboardType="number-pad"
            maxLength={2}
          />
          <Text style={styles.helper}>
            Between 3-20 members. You can always adjust this later.
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.label}>Public Group</Text>
              <Text style={styles.helper}>
                Allow anyone to find and join this group
              </Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: theme.colors.borderLight, true: theme.colors.primaryButton }}
            />
          </View>
        </View>

        {/* Group Icon Section */}
        <View style={styles.section}>
          <Text style={styles.label}>Group Icon</Text>
          <TouchableOpacity
            style={styles.emojiButton}
            onPress={() => setShowEmojiPicker(true)}
          >
            <View style={[styles.emojiPreview, { backgroundColor }]}>
              <Text style={styles.emojiButtonEmoji}>{emoji}</Text>
            </View>
            <View style={styles.emojiButtonContent}>
              <Text style={styles.emojiButtonText}>Tap to change icon & color</Text>
              <Text style={styles.emojiButtonSubtext}>
                {BACKGROUND_COLORS.find(c => c.color === backgroundColor)?.name || 'Custom'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
        </View>

        {/* Emoji Picker Modal */}
        <Modal 
          visible={showEmojiPicker} 
          animationType="slide"
          onShow={() => Keyboard.dismiss()}
        >
          <KeyboardAvoidingView 
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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

            {/* Color Selection */}
            <View style={styles.colorSection}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.colorsContainer}
              >
                {BACKGROUND_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color.color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color.color },
                      backgroundColor === color.color && styles.colorOptionSelected
                    ]}
                    onPress={() => setBackgroundColor(color.color)}
                  >
                    {backgroundColor === color.color && (
                      <Text style={styles.colorOptionCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Category Tabs */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryTabs}
            >
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
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.emojiItem,
                    emoji === item && styles.emojiItemSelected
                  ]}
                  onPress={() => setEmoji(item)}
                >
                  <Text style={styles.emojiItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
              </SafeAreaView>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Modal>
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
  createButton: {
    padding: theme.spacing.sm,
  },
  createButtonText: {
    fontSize: 16,
    color: theme.colors.primaryButton,
    fontWeight: '600',
  },
  disabledText: {
    color: theme.colors.textTertiary,
  },
  form: {
    padding: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.surfaceWhite,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    fontSize: 16,
    marginBottom: theme.spacing.sm,
  },
  helper: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: theme.colors.surfaceWhite,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    marginTop: theme.spacing.xl,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: theme.spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  
  // Emoji picker styles
  emojiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceWhite,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
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
    fontSize: 24,
  },
  emojiButtonContent: {
    flex: 1,
  },
  emojiButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  emojiButtonSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  
  // Modal styles
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
  
  // Color picker styles
  colorSection: {
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surfaceWhite,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  colorsContainer: {
    paddingHorizontal: theme.spacing.lg,
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#000',
    borderWidth: 3,
  },
  colorOptionCheck: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  
  // Category tabs
  categoryTabs: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surfaceWhite,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
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
  
  // Emoji grid
  emojiGrid: {
    padding: theme.spacing.lg,
  },
  emojiItem: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 2,
    borderRadius: theme.borderRadius.sm,
  },
  emojiItemSelected: {
    backgroundColor: theme.colors.primaryButton,
  },
  emojiItemText: {
    fontSize: 24,
  },
});