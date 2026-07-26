import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function IndexScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.accent || '#0095F6'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
