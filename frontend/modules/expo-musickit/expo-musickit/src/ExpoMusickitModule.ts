import { NativeModulesProxy, EventEmitter, Subscription } from 'expo-modules-core';

// Import the native module. On web, it will be resolved to ExpoMusickit.web.ts
// and on native platforms to ExpoMusickitModule.ts
import ExpoMusickitModule from './ExpoMusickitModule';

export default ExpoMusickitModule;