const { withXcodeProject } = require('@expo/config-plugins');

const withMusicKit = (config) => {
  return withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    
    // Add MusicKit framework
    xcodeProject.addFramework('MusicKit.framework', {
      weak: true,
      sign: false,
    });
    
    // Add MediaPlayer framework (often needed with MusicKit)
    xcodeProject.addFramework('MediaPlayer.framework', {
      weak: true,
      sign: false,
    });
    
    return config;
  });
};

module.exports = withMusicKit;