import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { EnvironmentType } from '@/types/virtual-room';

const { width: SW, height: SH } = Dimensions.get('window');

interface Props {
  type: EnvironmentType;
  style?: any;
}

const CANVAS_W = SW * 3;
const CANVAS_H = SH * 3;

// ── Color themes per environment ──
const ENV_COLORS: Record<string, { bg: string; floor: string; accent: string; details: string }> = {
  soccer_field: { bg: '#2D8C3C', floor: '#226B2E', accent: 'rgba(255,255,255,0.3)', details: 'rgba(255,255,255,0.15)' },
  basketball_court: { bg: '#D4956A', floor: '#C47E50', accent: 'rgba(255,255,255,0.4)', details: 'rgba(255,255,255,0.2)' },
  office: { bg: '#F5F0EB', floor: '#D4C4B0', accent: '#C0A890', details: '#E8E0D8' },
  classroom: { bg: '#F7F5F0', floor: '#C8B898', accent: '#8B7355', details: '#E8DCC8' },
  wedding_venue: { bg: '#FFF8F0', floor: '#E8D5C0', accent: '#D4A0A0', details: '#F0E0D0' },
  beach: { bg: '#87CEEB', floor: '#F4D29B', accent: '#E8C97A', details: 'rgba(255,255,255,0.3)' },
  generic: { bg: '#F0EDE8', floor: '#D4C4B0', accent: '#C0A890', details: '#E8E0D8' },
};

export default function EnvironmentBackground({ type, style }: Props) {
  const colors = ENV_COLORS[type] || ENV_COLORS.generic;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }, style]}>
      {/* ── Ceiling border ── */}
      <View style={[styles.ceiling, { backgroundColor: colors.details }]} />

      {/* ── Walls (side bars) ── */}
      <View style={[styles.wallLeft, { backgroundColor: colors.details }]} />
      <View style={[styles.wallRight, { backgroundColor: colors.details }]} />

      {/* ── Floor ── */}
      <View style={[styles.floor, { backgroundColor: colors.floor }]}>
        {/* Floor line / baseboard */}
        <View style={[styles.floorLine, { backgroundColor: colors.accent }]} />
      </View>

      {/* ── Center field/court markings for sports environments ── */}
      {type === 'soccer_field' && (
        <>
          <View style={[styles.fieldOutline, { borderColor: colors.accent }]} />
          <View style={[styles.centerLine, { backgroundColor: colors.accent }]} />
          <View style={[styles.centerCircle, { borderColor: colors.accent }]} />
          <View style={[styles.centerDot, { backgroundColor: colors.accent }]} />
          <View style={[styles.penaltyBoxLeft, { borderColor: colors.accent }]} />
          <View style={[styles.penaltyBoxRight, { borderColor: colors.accent }]} />
        </>
      )}

      {type === 'basketball_court' && (
        <>
          <View style={[styles.courtSurface, { backgroundColor: colors.floor }]} />
          <View style={[styles.courtOutline, { borderColor: 'rgba(255,255,255,0.5)' }]} />
          <View style={[styles.centerCircleBB, { borderColor: 'rgba(255,255,255,0.5)' }]} />
          <View style={[styles.freeThrowLeft, { borderColor: 'rgba(255,255,255,0.5)' }]} />
          <View style={[styles.freeThrowRight, { borderColor: 'rgba(255,255,255,0.5)' }]} />
          <View style={[styles.threePointLeft, { borderColor: 'rgba(255,255,255,0.4)' }]} />
          <View style={[styles.threePointRight, { borderColor: 'rgba(255,255,255,0.4)' }]} />
        </>
      )}

      {/* ── Environment-specific decorations ── */}
      {type === 'office' && (
        <>
          {/* Desk */}
          <View style={[styles.desk, { backgroundColor: '#8B7355' }]} />
          {/* Monitor */}
          <View style={[styles.monitor, { backgroundColor: '#333' }]} />
          <View style={[styles.monitorStand, { backgroundColor: '#555' }]} />
          {/* Plant */}
          <View style={[styles.plantPot, { backgroundColor: '#D4845A' }]} />
          <View style={[styles.plantLeaf, { backgroundColor: '#4CAF50' }]} />
        </>
      )}

      {type === 'classroom' && (
        <>
          {/* Whiteboard */}
          <View style={[styles.whiteboard, { backgroundColor: '#F5F5F5', borderColor: '#888' }]} />
          {/* Desks */}
          <View style={[styles.studentDesk1, { backgroundColor: '#A0856B' }]} />
          <View style={[styles.studentDesk2, { backgroundColor: '#A0856B' }]} />
          <View style={[styles.studentDesk3, { backgroundColor: '#A0856B' }]} />
        </>
      )}

      {type === 'wedding_venue' && (
        <>
          {/* Aisle */}
          <View style={[styles.aisle, { backgroundColor: 'rgba(220,180,180,0.4)' }]} />
          {/* Altar/arch */}
          <View style={[styles.archLeft, { backgroundColor: '#D4A0A0' }]} />
          <View style={[styles.archRight, { backgroundColor: '#D4A0A0' }]} />
          <View style={[styles.archTop, { backgroundColor: '#D4A0A0' }]} />
          {/* Flower decorations */}
          <View style={[styles.flowerLeft, { backgroundColor: '#FFB6C1' }]} />
          <View style={[styles.flowerRight, { backgroundColor: '#FFB6C1' }]} />
        </>
      )}

      {type === 'beach' && (
        <>
          {/* Water */}
          <View style={[styles.water, { backgroundColor: '#5CACEE' }]} />
          {/* Sand area */}
          <View style={[styles.sand, { backgroundColor: '#F4D29B' }]} />
          {/* Shoreline */}
          <View style={[styles.shoreline, { backgroundColor: '#E8C97A' }]} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CANVAS_W,
    height: CANVAS_H,
  },
  ceiling: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: CANVAS_H * 0.06,
  },
  wallLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CANVAS_W * 0.04,
    height: CANVAS_H,
  },
  wallRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: CANVAS_W * 0.04,
    height: CANVAS_H,
  },
  floor: {
    position: 'absolute',
    bottom: 0,
    left: CANVAS_W * 0.04,
    right: CANVAS_W * 0.04,
    height: CANVAS_H * 0.25,
  },
  floorLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },

  // ── Soccer Field ──
  fieldOutline: {
    position: 'absolute',
    top: CANVAS_H * 0.15,
    left: CANVAS_W * 0.1,
    width: CANVAS_W * 0.8,
    height: CANVAS_H * 0.55,
    borderWidth: 3,
    borderRadius: 0,
  },
  centerLine: {
    position: 'absolute',
    top: CANVAS_H * 0.15,
    left: CANVAS_W * 0.5,
    width: 3,
    height: CANVAS_H * 0.55,
  },
  centerCircle: {
    position: 'absolute',
    top: CANVAS_H * 0.32,
    left: CANVAS_W * 0.42,
    width: CANVAS_W * 0.16,
    height: CANVAS_W * 0.16,
    borderRadius: CANVAS_W * 0.08,
    borderWidth: 3,
  },
  centerDot: {
    position: 'absolute',
    top: CANVAS_H * 0.425 - 6,
    left: CANVAS_W * 0.5 - 6,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  penaltyBoxLeft: {
    position: 'absolute',
    top: CANVAS_H * 0.28,
    left: CANVAS_W * 0.1,
    width: CANVAS_W * 0.08,
    height: CANVAS_H * 0.3,
    borderWidth: 2,
  },
  penaltyBoxRight: {
    position: 'absolute',
    top: CANVAS_H * 0.28,
    right: CANVAS_W * 0.1,
    width: CANVAS_W * 0.08,
    height: CANVAS_H * 0.3,
    borderWidth: 2,
  },

  // ── Basketball Court ──
  courtSurface: {},
  courtOutline: {
    position: 'absolute',
    top: CANVAS_H * 0.12,
    left: CANVAS_W * 0.08,
    width: CANVAS_W * 0.84,
    height: CANVAS_H * 0.6,
    borderWidth: 3,
  },
  centerCircleBB: {
    position: 'absolute',
    top: CANVAS_H * 0.32,
    left: CANVAS_W * 0.42,
    width: CANVAS_W * 0.16,
    height: CANVAS_W * 0.16,
    borderRadius: CANVAS_W * 0.08,
    borderWidth: 3,
  },
  freeThrowLeft: {
    position: 'absolute',
    top: CANVAS_H * 0.22,
    left: CANVAS_W * 0.08,
    width: CANVAS_W * 0.14,
    height: CANVAS_H * 0.35,
    borderWidth: 2,
  },
  freeThrowRight: {
    position: 'absolute',
    top: CANVAS_H * 0.22,
    right: CANVAS_W * 0.08,
    width: CANVAS_W * 0.14,
    height: CANVAS_H * 0.35,
    borderWidth: 2,
  },
  threePointLeft: {
    position: 'absolute',
    top: CANVAS_H * 0.18,
    left: CANVAS_W * 0.08,
    width: CANVAS_W * 0.16,
    height: CANVAS_H * 0.45,
    borderWidth: 2,
    borderTopRightRadius: CANVAS_W * 0.08,
    borderBottomRightRadius: CANVAS_W * 0.08,
  },
  threePointRight: {
    position: 'absolute',
    top: CANVAS_H * 0.18,
    right: CANVAS_W * 0.08,
    width: CANVAS_W * 0.16,
    height: CANVAS_H * 0.45,
    borderWidth: 2,
    borderTopLeftRadius: CANVAS_W * 0.08,
    borderBottomLeftRadius: CANVAS_W * 0.08,
  },

  // ── Office ──
  desk: {
    position: 'absolute',
    bottom: CANVAS_H * 0.28,
    left: CANVAS_W * 0.35,
    width: CANVAS_W * 0.3,
    height: CANVAS_H * 0.06,
    borderRadius: 4,
  },
  monitor: {
    position: 'absolute',
    bottom: CANVAS_H * 0.34,
    left: CANVAS_W * 0.42,
    width: CANVAS_W * 0.08,
    height: CANVAS_H * 0.1,
    borderRadius: 3,
  },
  monitorStand: {
    position: 'absolute',
    bottom: CANVAS_H * 0.28,
    left: CANVAS_W * 0.44,
    width: CANVAS_W * 0.04,
    height: CANVAS_H * 0.06,
  },
  plantPot: {
    position: 'absolute',
    bottom: CANVAS_H * 0.25,
    right: CANVAS_W * 0.25,
    width: 30,
    height: 35,
    borderRadius: 4,
  },
  plantLeaf: {
    position: 'absolute',
    bottom: CANVAS_H * 0.25 + 30,
    right: CANVAS_W * 0.25 - 5,
    width: 40,
    height: 40,
    borderRadius: 20,
  },

  // ── Classroom ──
  whiteboard: {
    position: 'absolute',
    top: CANVAS_H * 0.12,
    left: CANVAS_W * 0.3,
    width: CANVAS_W * 0.4,
    height: CANVAS_H * 0.2,
    borderRadius: 6,
    borderWidth: 3,
  },
  studentDesk1: {
    position: 'absolute',
    bottom: CANVAS_H * 0.3,
    left: CANVAS_W * 0.15,
    width: CANVAS_W * 0.08,
    height: CANVAS_H * 0.04,
    borderRadius: 3,
  },
  studentDesk2: {
    position: 'absolute',
    bottom: CANVAS_H * 0.3,
    left: CANVAS_W * 0.35,
    width: CANVAS_W * 0.08,
    height: CANVAS_H * 0.04,
    borderRadius: 3,
  },
  studentDesk3: {
    position: 'absolute',
    bottom: CANVAS_H * 0.3,
    left: CANVAS_W * 0.55,
    width: CANVAS_W * 0.08,
    height: CANVAS_H * 0.04,
    borderRadius: 3,
  },

  // ── Wedding Venue ──
  aisle: {
    position: 'absolute',
    top: CANVAS_H * 0.15,
    left: CANVAS_W * 0.4 - 30,
    width: 60,
    height: CANVAS_H * 0.65,
  },
  archLeft: {
    position: 'absolute',
    top: CANVAS_H * 0.1,
    left: CANVAS_W * 0.35,
    width: 8,
    height: CANVAS_H * 0.18,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  archRight: {
    position: 'absolute',
    top: CANVAS_H * 0.1,
    right: CANVAS_W * 0.35,
    width: 8,
    height: CANVAS_H * 0.18,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  archTop: {
    position: 'absolute',
    top: CANVAS_H * 0.1,
    left: CANVAS_W * 0.35,
    width: CANVAS_W * 0.3,
    height: 6,
    borderRadius: 3,
  },
  flowerLeft: {
    position: 'absolute',
    top: CANVAS_H * 0.18,
    left: CANVAS_W * 0.3,
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  flowerRight: {
    position: 'absolute',
    top: CANVAS_H * 0.18,
    right: CANVAS_W * 0.3,
    width: 40,
    height: 40,
    borderRadius: 20,
  },

  // ── Beach ──
  water: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: CANVAS_H * 0.5,
  },
  sand: {
    position: 'absolute',
    top: CANVAS_H * 0.55,
    left: 0,
    right: 0,
    height: CANVAS_H * 0.45,
  },
  shoreline: {
    position: 'absolute',
    top: CANVAS_H * 0.5,
    left: 0,
    right: 0,
    height: CANVAS_H * 0.08,
    borderRadius: 40,
  },
});
