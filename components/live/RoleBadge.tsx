import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Shield, Crown, Edit3, User, Eye, ChevronDown } from 'lucide-react-native';
import type { RoomRole } from '@/contexts/RoomContext';

// ── Types ──
interface RoleBadgeProps {
  role: RoomRole;
  isCreator?: boolean;
  size?: 'sm' | 'md';
  onPress?: () => void;
  showLabel?: boolean;
}

// ── Role config ──
const ROLE_CONFIG: Record<RoomRole, { label: string; color: string; icon: React.FC<{size:number;color:string}>; bg: string }> = {
  host:     { label: 'Host',       color: '#F59E0B', icon: Crown,  bg: 'rgba(245,158,11,0.15)' },
  co_host:  { label: 'Co-Host',    color: '#F59E0B', icon: Shield, bg: 'rgba(245,158,11,0.12)' },
  editor:   { label: 'Editor',     color: '#8B5CF6', icon: Edit3,  bg: 'rgba(139,92,246,0.15)' },
  contributor: { label: 'Contributor', color: '#3B82F6', icon: User, bg: 'rgba(59,130,246,0.12)' },
  viewer:   { label: 'Viewer',     color: '#9CA3AF', icon: Eye,    bg: 'rgba(156,163,175,0.10)' },
};

// ── Component ──
export function RoleBadge({ role, isCreator, size = 'sm', onPress, showLabel = true }: RoleBadgeProps) {
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;
  const isSmall = size === 'sm';
  const iconSize = isSmall ? 10 : 14;

  const content = (
    <View style={[
      styles.badge,
      { backgroundColor: config.bg },
      isSmall ? styles.badgeSm : styles.badgeMd,
    ]}>
      {isCreator ? (
        <Text style={{ fontSize: isSmall ? 10 : 12 }}>👑</Text>
      ) : (
        <Icon size={iconSize} color={config.color} />
      )}
      {showLabel && (
        <Text style={[
          styles.label,
          { color: config.color, fontSize: isSmall ? 9 : 11 },
        ]}>
          {isCreator ? 'Host' : config.label}
        </Text>
      )}
      {onPress && <ChevronDown size={iconSize} color={config.color} />}
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{content}</TouchableOpacity>;
  }

  return content;
}

// ── Role selector component ──
interface RoleSelectorProps {
  currentRole: RoomRole;
  isCreator?: boolean;
  onSelect: (role: RoomRole) => void;
  visible: boolean;
  onClose: () => void;
}

export function RoleSelector({ currentRole, isCreator, onSelect, visible, onClose }: RoleSelectorProps) {
  if (!visible) return null;

  const roles: { key: RoomRole; label: string; desc: string }[] = [
    { key: 'co_host', label: 'Co-Host', desc: 'Can manage room + approve requests' },
    { key: 'editor', label: 'Editor', desc: 'Can edit planner + upload resources' },
    { key: 'contributor', label: 'Contributor', desc: 'Add ideas, resources, comments' },
    { key: 'viewer', label: 'Viewer', desc: 'Listen, browse, follow presentations' },
  ];

  return (
    <View style={styles.selector}>
      <Text style={styles.selectorTitle}>Change Role</Text>
      {roles.map(r => {
        const config = ROLE_CONFIG[r.key];
        const Icon = config.icon;
        const isActive = currentRole === r.key;
        return (
          <TouchableOpacity
            key={r.key}
            style={[styles.selectorRow, isActive && styles.selectorRowActive]}
            onPress={() => onSelect(r.key)}
          >
            <View style={[styles.selectorIconWrap, { backgroundColor: config.bg }]}>
              <Icon size={16} color={config.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.selectorLabel, isActive && { color: config.color }]}>
                {r.label}
              </Text>
              <Text style={styles.selectorDesc}>{r.desc}</Text>
            </View>
            {isActive && <View style={[styles.selectorDot, { backgroundColor: config.color }]} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeMd: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: {
    fontWeight: '600',
  },

  // Selector
  selector: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 6,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    padding: 8,
    minWidth: 240,
    zIndex: 999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  selectorTitle: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  selectorRowActive: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  selectorIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorLabel: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '600',
  },
  selectorDesc: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 2,
  },
  selectorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
