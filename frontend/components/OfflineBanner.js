import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '../services/networkService';

const theme = {
  colors: {
    error: '#EF4444',
    warning: '#F59E0B',
    textWhite: '#FFFFFF',
  },
  spacing: {
    sm: 8,
    md: 16,
  },
};

export default function OfflineBanner() {
  const isConnected = useNetworkStatus();

  if (isConnected) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline-outline" size={16} color={theme.colors.textWhite} />
      <Text style={styles.text}>No internet connection</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: theme.colors.error,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: theme.colors.textWhite,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: theme.spacing.sm,
  },
});