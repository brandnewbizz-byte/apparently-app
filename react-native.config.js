// CallKit + VoIP push are iPhone-only (see plugins/withVoipCalls.js), so these
// two libraries aren't built into the Android app.
module.exports = {
  dependencies: {
    'react-native-callkeep': { platforms: { android: null } },
    'react-native-voip-push-notification': { platforms: { android: null } },
  },
};
