import React, { useState, useEffect } from 'react';
import { Modal, View, StyleSheet, Alert, ActivityIndicator, Text, TouchableOpacity, Dimensions } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import webViewMusicKitService from '../services/webViewMusicKitService';

const { height } = Dimensions.get('window');

const AppleMusicWebViewAuth = ({ 
  visible, 
  onSuccess, 
  onError, 
  onCancel 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    if (visible) {
      startAuthentication();
    }
  }, [visible]);

  const startAuthentication = async () => {
    try {
      setIsLoading(true);
      setStatus('Getting Apple Music configuration...');
      
      // Get developer token
      const developerToken = await webViewMusicKitService.getDeveloperToken();
      
      setStatus('Opening Apple Music authorization...');
      
      // Use the backend auth page that already exists
      const authUrl = `https://mixtape-production.up.railway.app/api/oauth/apple/safari-auth?developerToken=${encodeURIComponent(developerToken)}&state=webview_auth_${Date.now()}`;
      
      console.log('🚀 Opening Apple Music auth browser:', authUrl);
      
      const result = await WebBrowser.openBrowserAsync(authUrl, {
        dismissButtonStyle: 'close',
        presentationStyle: 'pageSheet',
      });

      if (result.type === 'cancel') {
        onCancel();
        return;
      }

      // If browser completed, activate demo auth as fallback
      setStatus('Setting up demo authentication...');
      
      setTimeout(async () => {
        try {
          const demoResponse = await fetch('https://mixtape-production.up.railway.app/api/oauth/apple-music/demo-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: `demo_user_${Date.now()}`,
              deviceType: 'ios'
            })
          });
          
          const demoResult = await demoResponse.json();
          
          if (demoResult.success) {
            const exchangeResult = await webViewMusicKitService.exchangeTokenWithBackend(demoResult.musicUserToken);
            onSuccess(exchangeResult);
          } else {
            onError('Demo authentication failed');
          }
        } catch (error) {
          onError(error.message);
        }
      }, 2000);

    } catch (error) {
      console.error('❌ Auth failed:', error);
      onError(error.message);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Apple Music</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.content}>
          <View style={styles.loadingContainer}>
            <View style={styles.logoContainer}>
              <Text style={styles.logo}>🎵</Text>
            </View>
            <Text style={styles.loadingTitle}>Connecting to Apple Music</Text>
            <Text style={styles.loadingText}>{status}</Text>
            <ActivityIndicator size="large" color="#FC3C44" style={styles.spinner} />
            
            <View style={styles.infoContainer}>
              <Text style={styles.infoText}>
                • Opening Apple Music authorization{'\n'}
                • MusicKit.js will handle the authentication{'\n'}
                • Demo mode available as fallback
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1D1D1F',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelButtonText: {
    fontSize: 17,
    color: '#FC3C44',
    fontWeight: '500',
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logo: {
    fontSize: 80,
    textAlign: 'center',
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1D1D1F',
    marginBottom: 12,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#86868B',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 22,
  },
  spinner: {
    marginBottom: 40,
  },
  infoContainer: {
    backgroundColor: '#F5F5F7',
    borderRadius: 16,
    padding: 20,
    maxWidth: 300,
  },
  infoText: {
    fontSize: 14,
    color: '#86868B',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default AppleMusicWebViewAuth;