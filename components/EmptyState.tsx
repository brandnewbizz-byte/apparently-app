import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as LucideIcons from 'lucide-react-native';

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

interface EmptyStateProps {
  icon: keyof typeof LucideIcons;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  color?: string;
}

/**
 * Reusable empty state component.
 * Shows an icon, title, optional subtitle, and optional action button.
 *
 * @example
 *   <EmptyState
 *     icon="Inbox"
 *     title="No posts yet"
 *     subtitle="Posts you create will appear here."
 *   />
 */
export function EmptyState({ icon, title, subtitle, action, color = '#9CA3AF' }: EmptyStateProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconComponent = (LucideIcons as any)[icon] as LucideIcon | undefined;

  return (
    <View style={styles.container}>
      {IconComponent && (
        <IconComponent size={64} color={color} strokeWidth={1.5} />
      )}
      <Text style={[styles.title, { color }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color }]}>{subtitle}</Text>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  action: {
    marginTop: 24,
  },
});
