import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Animated, Dimensions, KeyboardAvoidingView, Platform,
} from 'react-native';
import { X, Send, GripHorizontal } from 'lucide-react-native';

// ── Types ──
export interface PresentationState {
  isPresenting: boolean;
  presenterId: string | null;
  presenterName: string | null;
  navigations: NavAction[];
}

export interface NavAction {
  type: 'tab_change' | 'scroll_to' | 'expand_section' | 'collapse_section' | 'focus_task' | 'focus_idea' | 'focus_budget' | 'focus_timeline';
  payload?: any;
  timestamp: string;
  userId: string;
}

interface PresentationOverlayProps {
  visible: boolean;
  isPresenter: boolean;
  presenterName: string | null;
  isFollowing: boolean;
  onStartPresenting: () => void;
  onStopPresenting: () => void;
  onEnterFollow: () => void;
  onLeaveFollow: () => void;
  onRequestControl: () => void;
  onTakeBackControl: () => void;
  pendingRequests: string[];
  onApproveRequest: (userId: string) => void;
  canPresent: boolean;
}

// ── Component ──
export function PresentationOverlay({
  visible,
  isPresenter,
  presenterName,
  isFollowing,
  onStartPresenting,
  onStopPresenting,
  onEnterFollow,
  onLeaveFollow,
  onRequestControl,
  onTakeBackControl,
  pendingRequests,
  onApproveRequest,
  canPresent,
}: PresentationOverlayProps) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      {/* Presenting banner */}
      {isPresenter ? (
        <View style={styles.presentingBar}>
          <View style={styles.presentingRow}>
            <View style={styles.liveDot} />
            <Text style={styles.presentingLabel}>You're presenting</Text>
            <Text style={styles.presentingSub}>
              Everyone is following your navigation
            </Text>
          </View>
          <TouchableOpacity style={styles.stopBtn} onPress={onStopPresenting}>
            <Text style={styles.stopBtnText}>Stop</Text>
          </TouchableOpacity>
        </View>
      ) : isFollowing ? (
        <View style={styles.followingBar}>
          <View style={styles.followingRow}>
            <View style={styles.liveDot} />
            <Text style={styles.followingLabel}>
              Following {presenterName || 'Presenter'}
            </Text>
          </View>
          <View style={styles.followingActions}>
            <TouchableOpacity style={styles.requestBtn} onPress={onRequestControl}>
              <Text style={styles.requestBtnText}>Request Control</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.browseBtn} onPress={onLeaveFollow}>
              <Text style={styles.browseBtnText}>Browse freely</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : presenterName ? (
        // Someone else is presenting, but you're not following
        <View style={styles.availableBar}>
          <View style={styles.availableRow}>
            <View style={styles.liveDot} />
            <Text style={styles.availableText}>
              {presenterName} is presenting
            </Text>
          </View>
          <View style={styles.availableActions}>
            <TouchableOpacity style={styles.followBtn} onPress={onEnterFollow}>
              <Text style={styles.followBtnText}>Follow</Text>
            </TouchableOpacity>
            {canPresent && (
              <TouchableOpacity style={styles.requestBtn} onPress={onRequestControl}>
                <Text style={styles.requestBtnText}>Request Control</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : canPresent ? (
        // No one presenting, user can start
        <View style={styles.idleBar}>
          <View style={styles.idleRow}>
            <Text style={styles.idleText}>
              Present the Live Planner to everyone
            </Text>
          </View>
          <TouchableOpacity style={styles.startBtn} onPress={onStartPresenting}>
            <Text style={styles.startBtnText}>Start Presenting</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Pending control requests */}
      {isPresenter && pendingRequests.length > 0 && (
        <View style={styles.requestsBar}>
          {pendingRequests.map(userId => (
            <View key={userId} style={styles.requestRow}>
              <Text style={styles.requestText}>
                Control requested
              </Text>
              <TouchableOpacity
                style={styles.approveBtn}
                onPress={() => onApproveRequest(userId)}
              >
                <Text style={styles.approveBtnText}>Approve</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Navigation Overlay (shows shared navigation events) ──
interface NavOverlayProps {
  navAction?: NavAction;
}

export function NavOverlay({ navAction }: NavOverlayProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (navAction) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }
  }, [navAction?.timestamp]);

  if (!navAction) return null;

  const actionLabel = {
    tab_change: 'Switched tab',
    scroll_to: 'Scrolled',
    expand_section: 'Expanded section',
    collapse_section: 'Collapsed section',
    focus_task: 'Opened task',
    focus_idea: 'Opened idea',
    focus_budget: 'Viewed budget',
    focus_timeline: 'Viewed timeline',
  }[navAction.type] || navAction.type;

  return (
    <Animated.View style={[styles.navPopup, { opacity }]}>
      <Text style={styles.navText}>📋 {actionLabel}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 90,
    elevation: 10,
  },

  // Presenting
  presentingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(16,185,129,0.15)',
  },
  presentingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  presentingLabel: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
  },
  presentingSub: {
    color: '#6EE7B7',
    fontSize: 11,
    marginLeft: 4,
  },
  stopBtn: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 10,
  },
  stopBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },

  // Following
  followingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(139,92,246,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139,92,246,0.12)',
  },
  followingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  followingLabel: {
    color: '#A78BFA',
    fontSize: 13,
    fontWeight: '600',
  },
  followingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  requestBtn: {
    backgroundColor: 'rgba(139,92,246,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  requestBtnText: {
    color: '#A78BFA',
    fontSize: 10,
    fontWeight: '600',
  },
  browseBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  browseBtnText: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '600',
  },

  // Available (someone else is presenting)
  availableBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(139,92,246,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139,92,246,0.08)',
  },
  availableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  availableText: {
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '500',
  },
  availableActions: {
    flexDirection: 'row',
    gap: 8,
  },
  followBtn: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  followBtnText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },

  // Idle
  idleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  idleRow: {
    flex: 1,
  },
  idleText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
  },
  startBtn: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  startBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // Requests
  requestsBar: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,158,11,0.12)',
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestText: {
    color: '#FCD34D',
    fontSize: 12,
    fontWeight: '500',
  },
  approveBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  approveBtnText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },

  // Nav popup
  navPopup: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  navText: {
    backgroundColor: 'rgba(31,41,55,0.95)',
    color: '#D1D5DB',
    fontSize: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
