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
} from 'react-native';

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

  const handleCreate = async () => {
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

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How Mixtape Works</Text>
          <Text style={styles.infoText}>
            • Everyone submits one song by 11pm daily
          </Text>
          <Text style={styles.infoText}>
            • If anyone misses the deadline, no playlist is created
          </Text>
          <Text style={styles.infoText}>
            • Successful groups get their playlist at 8am
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
});