/**
 * PostLiveLayer — orchestrates realtime presence + voice for a single active
 * post. Mounted only when the post is the user's active post, so unmount on
 * scroll-away automatically tears down both channels (cleanest cleanup path).
 *
 * All three overlays are flat absolute-positioned siblings (no nested flex-row
 * overlays) to avoid the native flexShrink/space-between crash seen on RN 0.86.
 */
import { View } from 'react-native';
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
}

export default function PostLiveLayer({ postId, userId, userName, avatar, bottomOffset = 0, topOffset = 0 }: PostLiveLayerProps) {
  const voice = usePostVoiceRoom({ postId, userId, userName, enabled: !!userId });

  // Our mic is "talking" when it's on and unmuted — bridged into presence so
  // other viewers see "N here now · M talking" without subscribing to audio.
  const isTalking = voice.isMicActive && !voice.isMuted;
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
          listening={voice.isListening}
          micActive={voice.isMicActive}
          muted={voice.isMuted}
          connectionState={voice.connectionState}
          error={voice.error}
          onToggleListen={voice.isListening ? voice.stopListening : voice.startListening}
          onToggleTalk={voice.isMicActive ? voice.stopTalking : voice.startTalking}
          onToggleMute={voice.toggleMute}
        />
      </View>
    </>
  );
}
