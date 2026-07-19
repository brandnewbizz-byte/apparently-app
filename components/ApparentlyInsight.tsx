import { Briefcase, MapPin, TrendingUp, Sparkles } from 'lucide-react-native';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import Colors from '@/constants/colors';
import { Insight } from '@/mocks/data';

const iconMap: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  'briefcase': Briefcase,
  'map-pin': MapPin,
  'trending-up': TrendingUp,
  'sparkles': Sparkles,
};

interface Props {
  insight: Insight;
  onPress?: () => void;
}

const ApparentlyInsight = React.memo(function ApparentlyInsight({ insight, onPress }: Props) {
  const IconComponent = iconMap[insight.icon] || Sparkles;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={[Colors.dark.gradient1 + '15', Colors.dark.gradient2 + '15']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.iconContainer}>
        <LinearGradient
          colors={[Colors.dark.gradient1, Colors.dark.gradient2]}
          style={styles.iconGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <IconComponent size={18} color={Colors.dark.text} />
        </LinearGradient>
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.label}>Apparently...</Text>
          <View style={styles.relevanceBadge}>
            <Text style={styles.relevanceText}>{insight.relevanceScore}% relevant</Text>
          </View>
        </View>
        <Text style={styles.title}>{insight.title}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {insight.description}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

export default ApparentlyInsight;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.accent + '30',
    backgroundColor: Colors.dark.surface,
    overflow: 'hidden',
    gap: 14,
  },
  iconContainer: {
    alignSelf: 'flex-start',
  },
  iconGradient: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.dark.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  relevanceBadge: {
    backgroundColor: Colors.dark.accentGlow,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  relevanceText: {
    fontSize: 11,
    color: Colors.dark.accent,
    fontWeight: '500' as const,
  },
  title: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
});
