/**
 * PostVoiceControls — compact Listen / Talk / Mute controls overlaid on a post.
 *
 * Flat row (no flexShrink / flex:1 / space-between) to avoid the native
 * flex-row-in-absolute-overlay crash seen on RN 0.86.
 */
import { Text, TouchableOpacity, View } from 'react-native';
import { Headphones, Mic, MicOff } from 'lucide-react-native';
import type { VoiceConnectionState } from '@/hooks/usePostVoiceRoom';

interface PostVoiceControlsProps {
  listening: boolean;
  micActive: boolean;
  muted: boolean;
  connectionState: VoiceConnectionState;
  error: string | null;
  onToggleListen: () => void;
  onToggleTalk: () => void;
  onToggleMute: () => void;
}

const pillBase = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 6,
  paddingHorizontal: 12,
  paddingVertical: 7,
  borderRadius: 18,
  backgroundColor: 'rgba(0,0,0,0.55)',
};

export default function PostVoiceControls({
  listening,
  micActive,
  muted,
  connectionState,
  error,
  onToggleListen,
  onToggleTalk,
  onToggleMute,
}: PostVoiceControlsProps) {
  const connecting = connectionState === 'connecting';

  return (
    <View style={{ alignItems: 'flex-start', gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {/* Listen */}
        <TouchableOpacity
          style={[pillBase, listening && { backgroundColor: 'rgba(34,197,94,0.85)' }]}
          onPress={onToggleListen}
          disabled={connecting}
          activeOpacity={0.8}
        >
          <Headphones size={15} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
            {listening ? 'Listening' : 'Listen'}
          </Text>
        </TouchableOpacity>

        {/* Talk */}
        <TouchableOpacity
          style={[pillBase, micActive && { backgroundColor: 'rgba(239,68,68,0.85)' }]}
          onPress={onToggleTalk}
          disabled={connecting}
          activeOpacity={0.8}
        >
          <Mic size={15} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
            {micActive ? 'Mic On' : 'Talk'}
          </Text>
        </TouchableOpacity>

        {/* Mute — only visible while the mic is on */}
        {micActive && (
          <TouchableOpacity
            style={[pillBase, muted && { backgroundColor: 'rgba(245,158,11,0.85)' }]}
            onPress={onToggleMute}
            activeOpacity={0.8}
          >
            <MicOff size={15} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
              {muted ? 'Muted' : 'Mute'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <Text
          numberOfLines={1}
          style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
