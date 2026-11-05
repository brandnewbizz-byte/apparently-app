/**
 * iPhone calls that ring like WhatsApp: CallKit + VoIP push (PushKit).
 *
 * When a VoIP push arrives (app open, in the background, closed or the phone
 * locked) iOS wakes the app and we show the system incoming-call screen
 * straight away from native code — Apple requires that, or it stops
 * delivering VoIP pushes. The JS side (lib/callkit.ts) then joins the call
 * when it's answered.
 *
 * Android is unchanged (its call notification already rings on the lock
 * screen), so the two libraries are linked on iOS only (react-native.config.js).
 */
const { withAppDelegate, withDangerousMod, withInfoPlist, withXcodeProject, IOSConfig } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withBackgroundModes = (config) =>
  withInfoPlist(config, (c) => {
    const modes = Array.isArray(c.modResults.UIBackgroundModes) ? c.modResults.UIBackgroundModes : [];
    for (const m of ['voip', 'audio', 'remote-notification']) if (!modes.includes(m)) modes.push(m);
    c.modResults.UIBackgroundModes = modes;
    return c;
  });

const withFrameworksAndHeaders = (config) =>
  withXcodeProject(config, (c) => {
    const project = c.modResults;
    const target = IOSConfig.XcodeUtils.getApplicationNativeTarget({ project, projectName: c.modRequest.projectName });
    project.addFramework('CallKit.framework', { target: target.uuid });
    project.addFramework('PushKit.framework', { target: target.uuid });
    project.addFramework('Intents.framework', { target: target.uuid, weak: true });
    const configs = project.pbxXCBuildConfigurationSection();
    const paths = [
      '"$(SRCROOT)/../node_modules/react-native-callkeep/ios/RNCallKeep"',
      '"$(SRCROOT)/../node_modules/react-native-voip-push-notification/ios/RNVoipPushNotification"',
    ];
    for (const key of Object.keys(configs)) {
      const bs = configs[key] && configs[key].buildSettings;
      if (!bs || !bs.PRODUCT_NAME) continue;
      let hsp = bs.HEADER_SEARCH_PATHS || ['"$(inherited)"'];
      if (!Array.isArray(hsp)) hsp = [hsp];
      for (const p of paths) if (!hsp.includes(p)) hsp.push(p);
      bs.HEADER_SEARCH_PATHS = hsp;
    }
    return c;
  });

const withBridgingHeader = (config) =>
  withDangerousMod(config, ['ios', async (c) => {
    const dir = path.join(c.modRequest.platformProjectRoot, c.modRequest.projectName);
    const file = fs.readdirSync(dir).find((f) => f.endsWith('-Bridging-Header.h'));
    if (file) {
      const p = path.join(dir, file);
      let s = fs.readFileSync(p, 'utf8');
      for (const line of ['#import "RNCallKeep.h"', '#import "RNVoipPushNotificationManager.h"']) {
        if (!s.includes(line)) s += `\n${line}`;
      }
      fs.writeFileSync(p, s.endsWith('\n') ? s : `${s}\n`);
    }
    return c;
  }]);

const NATIVE = `
// MARK: - Apparently calls (CallKit + VoIP push) — added by plugins/withVoipCalls.js
final class ApparentlyVoip: NSObject, PKPushRegistryDelegate {
  static let shared = ApparentlyVoip()
  private var registry: PKPushRegistry?

  func start() {
    // CallKit is ready before any push arrives, even on a cold start.
    RNCallKeep.setup([
      "appName": "Apparently",
      "supportsVideo": true,
      "maximumCallGroups": "1",
      "maximumCallsPerCallGroup": "1",
      "includesCallsInRecents": false,
      "ringtoneSound": "ringtone.wav",
    ])
    let r = PKPushRegistry(queue: DispatchQueue.main)
    r.delegate = self
    r.desiredPushTypes = [.voIP]
    registry = r
  }

  func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
    RNVoipPushNotificationManager.didUpdate(pushCredentials, forType: type.rawValue)
  }

  func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {}

  func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType, completion: @escaping () -> Void) {
    let d = payload.dictionaryPayload
    let uuid = (d["uuid"] as? String) ?? UUID().uuidString
    let callerId = (d["callerId"] as? String) ?? "apparently"
    let callerName = (d["callerName"] as? String) ?? "Apparently"
    let hasVideo = (d["video"] as? Bool) ?? ((d["video"] as? String) == "1")
    // Tell JS first (it keeps the call details), then ring.
    RNVoipPushNotificationManager.addCompletionHandler(uuid, completionHandler: completion)
    RNVoipPushNotificationManager.didReceiveIncomingPush(with: payload, forType: type.rawValue)
    RNCallKeep.reportNewIncomingCall(
      uuid,
      handle: callerId,
      handleType: "generic",
      hasVideo: hasVideo,
      localizedCallerName: callerName,
      supportsHolding: false,
      supportsDTMF: false,
      supportsGrouping: false,
      supportsUngrouping: false,
      fromPushKit: true,
      payload: d,
      withCompletionHandler: nil
    )
  }
}
`;

const withAppDelegateCode = (config) =>
  withAppDelegate(config, (c) => {
    let s = c.modResults.contents;
    if (c.modResults.language !== 'swift' || s.includes('ApparentlyVoip')) return c;
    s = s.replace(/import React\n/, 'import React\nimport PushKit\nimport CallKit\n');
    s = s.replace(
      /(\n\s*)return super\.application\(application, didFinishLaunchingWithOptions: launchOptions\)/,
      '$1ApparentlyVoip.shared.start()$1return super.application(application, didFinishLaunchingWithOptions: launchOptions)',
    );
    s += NATIVE;
    c.modResults.contents = s;
    return c;
  });

module.exports = (config) => {
  config = withBackgroundModes(config);
  config = withFrameworksAndHeaders(config);
  config = withBridgingHeader(config);
  config = withAppDelegateCode(config);
  return config;
};
