import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, Ellipse, Line, LinearGradient, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { SpotTheme } from '@/lib/spot';

/**
 * Where the back wall sits, as fractions of the canvas. Items placed above
 * BACK_FLOOR read as "on the back wall"; below it they stand on the floor.
 */
export const ROOM = { left: 0.13, right: 0.87, top: 0.15, floor: 0.44 };

/** How much bigger an item looks the closer it is to you (lower on screen). */
export function depthScale(y: number): number {
  const t = Math.min(1, Math.max(0, (y - ROOM.floor + 0.06) / (1 - ROOM.floor + 0.06)));
  return 0.72 + 0.48 * t;
}

interface Props { width: number; height: number; theme: SpotTheme }

/** A simple 3D box room: ceiling, side walls, back wall and a perspective floor. */
function RoomScene({ width: W, height: H, theme }: Props) {
  if (!W || !H) return null;
  const bx0 = W * ROOM.left;
  const bx1 = W * ROOM.right;
  const by0 = H * ROOM.top;
  const by1 = H * ROOM.floor;
  const [c0, c1] = theme.colors;
  const line = theme.dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)';
  const edge = theme.dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.12)';

  // Floor grid: rays from the back wall to the front edge…
  const rays = 10;
  const rayLines = Array.from({ length: rays + 1 }, (_, i) => {
    const t = i / rays;
    return { x1: bx0 + (bx1 - bx0) * t, y1: by1, x2: -W * 0.35 + W * 1.7 * t, y2: H };
  });
  // …and cross lines that get further apart as they come towards you.
  const rows = 7;
  const rowLines = Array.from({ length: rows }, (_, i) => {
    const t = Math.pow((i + 1) / (rows + 1), 1.8);
    const y = by1 + (H - by1) * t;
    const k = (y - by1) / (H - by1);
    return { x1: bx0 - (bx0 + W * 0.35) * k, x2: bx1 + (W * 1.35 - bx1) * k, y };
  });

  return (
    <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c0} />
          <Stop offset="1" stopColor={c1} />
        </LinearGradient>
        <LinearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c1} />
          <Stop offset="1" stopColor={c0} />
        </LinearGradient>
        <RadialGradient id="glow" cx="50%" cy="35%" r="60%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={theme.dark ? 0.22 : 0.5} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* Base */}
      <Rect x={0} y={0} width={W} height={H} fill="url(#wall)" />

      {/* Ceiling */}
      <Polygon points={`0,0 ${W},0 ${bx1},${by0} ${bx0},${by0}`} fill="#000" fillOpacity={theme.dark ? 0.28 : 0.08} />
      {/* Side walls */}
      <Polygon points={`0,0 ${bx0},${by0} ${bx0},${by1} 0,${H}`} fill="#000" fillOpacity={theme.dark ? 0.18 : 0.05} />
      <Polygon points={`${W},0 ${bx1},${by0} ${bx1},${by1} ${W},${H}`} fill="#000" fillOpacity={theme.dark ? 0.22 : 0.07} />
      {/* Back wall + soft light */}
      <Rect x={bx0} y={by0} width={bx1 - bx0} height={by1 - by0} fill="url(#wall)" />
      <Rect x={bx0} y={by0} width={bx1 - bx0} height={by1 - by0} fill="url(#glow)" />
      {/* Floor */}
      <Polygon points={`${bx0},${by1} ${bx1},${by1} ${W},${H} 0,${H}`} fill="url(#floor)" />
      <Polygon points={`${bx0},${by1} ${bx1},${by1} ${W},${H} 0,${H}`} fill="#000" fillOpacity={theme.dark ? 0.12 : 0.04} />
      {rayLines.map((l, i) => <Line key={`r${i}`} {...l} stroke={line} strokeWidth={1} />)}
      {rowLines.map((l, i) => <Line key={`h${i}`} x1={l.x1} y1={l.y} x2={l.x2} y2={l.y} stroke={line} strokeWidth={1} />)}
      {/* Room edges */}
      <Line x1={0} y1={0} x2={bx0} y2={by0} stroke={edge} strokeWidth={1.2} />
      <Line x1={W} y1={0} x2={bx1} y2={by0} stroke={edge} strokeWidth={1.2} />
      <Line x1={0} y1={H} x2={bx0} y2={by1} stroke={edge} strokeWidth={1.2} />
      <Line x1={W} y1={H} x2={bx1} y2={by1} stroke={edge} strokeWidth={1.2} />
      <Rect x={bx0} y={by0} width={bx1 - bx0} height={by1 - by0} fill="none" stroke={edge} strokeWidth={1.2} />
      {/* Light pool on the floor */}
      <Ellipse cx={W / 2} cy={by1 + (H - by1) * 0.45} rx={W * 0.42} ry={(H - by1) * 0.22} fill="#FFF" fillOpacity={theme.dark ? 0.05 : 0.18} />
    </Svg>
  );
}

export default memo(RoomScene);
