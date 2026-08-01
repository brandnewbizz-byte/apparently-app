import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { X, Users } from 'lucide-react-native';

// ── Types ──
export interface EditIndicatorData {
  userId: string;
  userName: string;
  section: string;
  tab: string;
  startedAt: string;
}

interface EditIndicatorProps {
  indicators: EditIndicatorData[];
  currentUserId?: string;
  onDismiss?: () => void;
}

// ── Component ──
export function EditIndicator({ indicators, currentUserId, onDismiss }: EditIndicatorProps) {
  // Filter out self
  const others = indicators.filter(i => i.userId !== currentUserId);

  if (others.length === 0) return null;

  // Group by section
  const bySection: Record<string, EditIndicatorData[]> = {};
  for (const i of others) {
    if (!bySection[i.section]) bySection[i.section] = [];
    bySection[i.section].push(i);
  }

  return (
    <View style={styles.container}>
      {Object.entries(bySection).map(([section, editors]) => {
        const names = editors.map(e => e.userName).join(', ');
        const sectionLabel = section.charAt(0).toUpperCase() + section.slice(1).replace(/_/g, ' ');
        return (
          <View key={section} style={styles.banner}>
            <View style={styles.dotRow}>
              <View style={styles.pulsingDot} />
              <Text style={styles.text} numberOfLines={1}>
                {editors.length === 1
                  ? `${editors[0].userName} is editing ${sectionLabel}`
                  : `${names} are editing ${sectionLabel}`}
              </Text>
            </View>
            {onDismiss && editors.length === 1 && (
              <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
                <X size={12} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ── Edit Banner for tab content area "Jada is editing this section" ──
interface EditBannerProps {
  userName: string;
  section: string;
}

export function EditBanner({ userName, section }: EditBannerProps) {
  return (
    <View style={styles.editBanner}>
      <View style={styles.editDotRow}>
        <View style={styles.pulsingDotSmall} />
        <Text style={styles.editBannerText}>
          {userName} is editing this section
        </Text>
      </View>
    </View>
  );
}

// ── Presence indicator for member list ──
interface PresenceDotProps {
  isOnline: boolean;
  isEditing: boolean;
}

export function PresenceDot({ isOnline, isEditing }: PresenceDotProps) {
  return (
    <View style={[
      styles.presenceDot,
      isEditing ? styles.presenceDotEditing : (isOnline ? styles.presenceDotOnline : styles.presenceDotOffline),
    ]}>
      {isEditing && <Text style={styles.presenceDotIcon}>✎</Text>}
    </View>
  );
}

// ── Tab-level edit indicator (shows edit count on tab icon) ──
interface TabEditBadgeProps {
  count: number;
}

export function TabEditBadge({ count }: TabEditBadgeProps) {
  if (count === 0) return null;
  return (
    <View style={styles.badge}>
      <Users size={8} color="#FFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 2,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(139,92,246,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139,92,246,0.15)',
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#A78BFA',
    opacity: 0.9,
  },
  pulsingDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#A78BFA',
    opacity: 0.9,
  },
  text: {
    color: '#D8B4FE',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  dismissBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Edit banner inside tab content
  editBanner: {
    backgroundColor: 'rgba(139,92,246,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139,92,246,0.1)',
  },
  editDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBannerText: {
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '500',
  },

  // Presence dot
  presenceDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presenceDotOnline: {
    backgroundColor: '#10B981',
  },
  presenceDotEditing: {
    backgroundColor: '#A78BFA',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  presenceDotOffline: {
    backgroundColor: '#6B7280',
  },
  presenceDotIcon: {
    fontSize: 8,
    color: '#FFF',
    fontWeight: '700',
  },

  // Tab badge
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
