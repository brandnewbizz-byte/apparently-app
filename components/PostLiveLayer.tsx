/**
 * PostLiveLayer — orchestrates realtime presence + voice for a single active
 * post. Mounted only when the post is the user's active post, so unmount on
 * scroll-away automatically tears down both channels (cleanest cleanup path).
 *
 * All three overlays are flat absolute-positioned siblings (no nested flex-row
 * overlays) to avoid the native flexShrink/space-between crash seen on RN 0.86.
 */
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import CallVideo from '@/components/CallVideo';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { usePostPresence } from '@/hooks/usePostPresence';
import { usePostVoiceRoom } from '@/hooks/usePostVoiceRoom';
import PostPresenceIndicator from '@/components/PostPresenceIndicator';
import PostVoiceControls from '@/components/PostVoiceControls';
import ActiveSpeakers from '@/components/ActiveSpeakers';

interface PostLiveLayerProps {
  postId: string;
  userId: string;
  userName: string;
  avatar: string | null;
  /** Extra space at the bottom (the tab bar sits over the post). */
  bottomOffset?: number;
  /** Space taken by the floating top bar. */
  topOffset?: number;
  /** Tells the post when someone is live on it (the video goes quiet). */
  onLiveChange?: (active: boolean) => void;
}

export default function PostLiveLayer({ postId, userId, userName, avatar, bottomOffset = 0, topOffset = 0, onLiveChange }: PostLiveLayerProps) {
  const voice = usePostVoiceRoom({ postId, userId, userName, enabled: !!userId });
  useEffect(() => { onLiveChange?.(voice.liveActive); }, [voice.liveActive, onLiveChange]);
  useEffect(() => () => onLiveChange?.(false), [onLiveChange]);

  // Live with your mic on: the screen stays awake (Instagram Live). Mic muted
  // or not live: the phone sleeps normally. The lock button always works.
  const keepAwake = voice.live && !voice.micMuted;
  useEffect(() => {
    if (!keepAwake) return;
    const tag = `post-live-${postId}`;
    activateKeepAwakeAsync(tag).catch(() => {});
    return () => { try { deactivateKeepAwake(tag); } catch {} };
  }, [keepAwake, postId]);

  // While you hold the mic you're "talking" — bridged into presence so
  // other viewers see "N here now · M talking" without subscribing to audio.
  const isTalking = voice.talking;
  const presence = usePostPresence({
    postId,
    userId,
    userName,
    avatar,
    enabled: !!userId,
    isTalking,
  });

  if (!userId) return null;

  return (
    <>
      {/* Phones play live voices by themselves; browsers need a player. */}
      {Platform.OS === 'web'
        ? voice.remotes.map((r) => <CallVideo key={r.uid} stream={r.stream} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />)
        : null}
      {/* Presence pill — top-left, below the author overlay (author pill is ~54px tall with a location line) */}
      <View style={{ position: 'absolute', top: 60 + topOffset, left: 12, zIndex: 12 }}>
        <PostPresenceIndicator
          presenceCount={presence.presenceCount}
          talkingCount={presence.talkingCount}
          connected={presence.isConnected}
        />
      </View>

      {/* Active speakers — bottom-left, above the voice controls */}
      <View style={{ position: 'absolute', bottom: 100 + bottomOffset, left: 12, zIndex: 12 }} pointerEvents="none">
        <ActiveSpeakers participants={presence.participants} speakingIds={voice.speakingIds} />
      </View>

      {/* Voice controls — bottom-center, above the comment preview (which reaches ~102px tall) */}
      <View style={{ position: 'absolute', bottom: 60 + bottomOffset, left: 0, right: 0, alignItems: 'center', zIndex: 13 }}>
        <PostVoiceControls
          soundOn={voice.soundOn}
          live={voice.live}
          micMuted={voice.micMuted}
          connectionState={voice.connectionState}
          error={voice.error}
          onToggleSound={voice.toggleSound}
          onGoLive={voice.goLive}
          onEndLive={voice.endLive}
          onToggleMic={voice.toggleMic}
        />
      </View>
    </>
  );
}
