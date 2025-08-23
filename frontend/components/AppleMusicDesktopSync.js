import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import webViewMusicKitService from '../services/webViewMusicKitService';

const AppleMusicDesktopSync = ({ visible, onSuccess, onError, onCancel }) => {
  const [syncCode, setSyncCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState('instructions'); // 'instructions' | 'enter_code' | 'processing'

  const openDesktopAuth = async () => {
    try {
      const desktopUrl = 'https://mixtape-production.up.railway.app/api/oauth/apple/desktop-auth';
      console.log('🖥️ Opening desktop auth URL:', desktopUrl);
      await Linking.openURL(desktopUrl);
      setStep('enter_code');
    } catch (error) {
      console.error('❌ Failed to open desktop auth:', error);
      Alert.alert('Error', 'Could not open desktop authentication page');
    }
  };

  const exchangeSyncCode = async () => {
    if (!syncCode || syncCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a valid 6-digit sync code');
      return;
    }

    setIsLoading(true);
    setStep('processing');

    try {
      console.log('🔄 Exchanging sync code:', syncCode);

      const response = await fetch('https://mixtape-production.up.railway.app/api/oauth/apple/exchange-sync-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          syncCode: syncCode.trim()
        })
      });

      const result = await response.json();
      console.log('🔄 Sync code exchange result:', result);

      if (result.success && result.token) {
        console.log('✅ Apple Music desktop sync successful!');
        
        // Call the success callback in the format expected by LoginScreen
        onSuccess({
          success: true,
          userToken: result.token, // Use userToken key to match existing handler
          token: result.token,     // Also include token key as backup
          user: result.user,
          platform: 'apple-music',
          method: 'desktop-sync'
        });
      } else {
        throw new Error(result.error || 'Sync code exchange failed');
      }

    } catch (error) {
      console.error('❌ Sync code exchange failed:', error);
      
      let errorMessage = 'Sync code exchange failed';
      if (error.message.includes('not found')) {
        errorMessage = 'Sync code not found or expired';
      } else if (error.message.includes('expired')) {
        errorMessage = 'Sync code has expired';
      } else if (error.message.includes('used')) {
        errorMessage = 'Sync code has already been used';
      }
      
      Alert.alert('Authentication Failed', errorMessage);
      onError(error.message);
      setStep('enter_code');
    } finally {
      setIsLoading(false);
    }
  };

  const formatSyncCode = (text) => {
    // Only allow numbers and limit to 6 digits
    const numbers = text.replace(/[^0-9]/g, '').slice(0, 6);
    setSyncCode(numbers);
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      {step === 'instructions' && (
        <View style={styles.content}>
          <Text style={styles.title}>🖥️ Desktop Authentication</Text>
          <Text style={styles.subtitle}>
            Apple Music works better when authenticated on desktop
          </Text>
          
          <View style={styles.stepContainer}>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepText}>
                Tap below to open desktop authentication in your browser
              </Text>
            </View>
            
            <TouchableOpacity style={styles.desktopButton} onPress={openDesktopAuth}>
              <Text style={styles.desktopButtonText}>🖥️ Open Desktop Auth</Text>
            </TouchableOpacity>
            
            <View style={styles.step}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepText}>
                Complete Apple Music authentication on desktop
              </Text>
            </View>
            
            <View style={styles.step}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepText}>
                Get your 6-digit sync code and enter it below
              </Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.skipButton} onPress={() => setStep('enter_code')}>
            <Text style={styles.skipButtonText}>I already have a sync code</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'enter_code' && (
        <View style={styles.content}>
          <Text style={styles.title}>🔢 Enter Sync Code</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code from your desktop browser
          </Text>
          
          <View style={styles.codeInputContainer}>
            <TextInput
              style={styles.codeInput}
              value={syncCode}
              onChangeText={formatSyncCode}
              placeholder="123456"
              placeholderTextColor="#999"
              keyboardType="numeric"
              maxLength={6}
              autoFocus={true}
              textAlign="center"
            />
          </View>
          
          <TouchableOpacity 
            style={[styles.submitButton, syncCode.length === 6 ? {} : styles.disabledButton]} 
            onPress={exchangeSyncCode}
            disabled={syncCode.length !== 6 || isLoading}
          >
            <Text style={styles.submitButtonText}>
              {isLoading ? 'Authenticating...' : 'Connect Apple Music'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.backButton} onPress={() => setStep('instructions')}>
            <Text style={styles.backButtonText}>← Back to Instructions</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'processing' && (
        <View style={styles.content}>
          <Text style={styles.title}>🔄 Connecting...</Text>
          <Text style={styles.subtitle}>
            Exchanging sync code for Apple Music access
          </Text>
          
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Please wait...</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  content: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    margin: 20,
    maxWidth: 400,
    width: '90%',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 22,
  },
  stepContainer: {
    width: '100%',
    marginBottom: 20,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  stepNumber: {
    backgroundColor: '#007AFF',
    color: 'white',
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: 'bold',
    marginRight: 15,
    fontSize: 14,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  desktopButton: {
    backgroundColor: '#FC3C44',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    marginVertical: 20,
    width: '100%',
  },
  desktopButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  codeInputContainer: {
    marginBottom: 30,
  },
  codeInput: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    minWidth: 200,
    letterSpacing: 8,
  },
  submitButton: {
    backgroundColor: '#34C759',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    marginBottom: 15,
    width: '100%',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  skipButton: {
    marginBottom: 15,
  },
  skipButtonText: {
    color: '#007AFF',
    fontSize: 16,
    textAlign: 'center',
  },
  backButton: {
    marginBottom: 15,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
  },
  loadingContainer: {
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
});

export default AppleMusicDesktopSync;