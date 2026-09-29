/**
 * PostPresenceIndicator — compact "N here now · M talking" pill.
 */
import { Text, View } from 'react-native';

interface PostPresenceIndicatorProps {
  presenceCount: number;
  talkingCount: number;
  connected: boolean;
}

export default function PostPresenceIndicator({
  presenceCount,
  talkingCount,
  connected,
}: PostPresenceIndicatorProps) {
  let label: string;
  if (presenceCount <= 1) {
    label = "You're here";
  } else {
    label = `${presenceCount} here now`;
    if (talkingCount > 0) {
      label += ` · ${talkingCount} talking`;
    }
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(0,0,0,0.45)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 16,
      }}
    >
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: connected ? '#22C55E' : 'rgba(255,255,255,0.5)',
        }}
      />
      <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
