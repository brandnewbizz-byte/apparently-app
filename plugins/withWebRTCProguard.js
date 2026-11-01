/**
 * Android release builds shrink code with R8. react-native-webrtc's native
 * library references classes R8 can't see, so keep the whole org.webrtc
 * package (otherwise the Play Store build fails with "Missing class
 * org.webrtc.Dav1dDecoder$Natives").
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const RULES = `
# react-native-webrtc (voice and video calls)
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**
`;

module.exports = function withWebRTCProguard(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (!current.includes('-keep class org.webrtc.**')) fs.writeFileSync(file, current + RULES);
      return cfg;
    },
  ]);
};
