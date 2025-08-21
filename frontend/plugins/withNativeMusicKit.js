const { withXcodeProject, withInfoPlist } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const withNativeMusicKit = (config) => {
  // Add MusicKit framework
  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    
    // Add MusicKit framework
    xcodeProject.addFramework('MusicKit.framework', {
      weak: false,
      sign: true,
    });
    
    // Add MediaPlayer framework
    xcodeProject.addFramework('MediaPlayer.framework', {
      weak: false,
      sign: true,
    });
    
    return config;
  });

  // Add Info.plist entries
  config = withInfoPlist(config, (config) => {
    config.modResults.NSAppleMusicUsageDescription = 
      'Mixtape needs access to your Apple Music library to create and manage playlists for your daily music sharing groups.';
    
    return config;
  });

  return config;
};

module.exports = withNativeMusicKit;