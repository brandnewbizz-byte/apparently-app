import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Path, Defs, Pattern, Circle, Rect } from 'react-native-svg';
import type { SpotItem, SpotPoint } from '@/lib/spot';
import type { LiveStroke } from '@/hooks/useSpotRoom';

/** Smooth path through normalised points (quadratic midpoints). */
export function strokePath(points: SpotPoint[], w: number, h: number): string {
  if (!points.length) return '';
  const p = points.map((pt) => ({ x: pt.x * w, y: pt.y * h }));
  if (p.length === 1) return `M ${p[0].x} ${p[0].y} l 0.01 0.01`;
  let d = `M ${p[0].x} ${p[0].y}`;
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i].x + p[i + 1].x) / 2;
    const my = (p[i].y + p[i + 1].y) / 2;
    d += ` Q ${p[i].x} ${p[i].y} ${mx} ${my}`;
  }
  const last = p[p.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/** Stroke widths are saved for a 400pt-wide canvas and scaled to fit. */
export const strokeWidthFor = (width: number | undefined, canvasW: number) => Math.max(1.5, (width || 5) * (canvasW / 400));

interface Props {
  width: number;
  height: number;
  ink: string;
  doodles: SpotItem[];
  live: LiveStroke[];
  /** Draw the dot grid (off when the 3D room scene is behind). */
  grid?: boolean;
}

/** Dot-grid background + every saved and in-progress doodle. */
function DoodleLayer({ width, height, ink, doodles, live, grid = true }: Props) {
  if (!width || !height) return null;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
          <Circle cx="2" cy="2" r="1.3" fill={ink} />
        </Pattern>
      </Defs>
      {grid ? <Rect x="0" y="0" width={width} height={height} fill="url(#dots)" /> : null}
      {doodles.map((d) => (
        <Path
          key={d.id}
          d={strokePath(d.points || [], width, height)}
          stroke={d.color || '#111827'}
          strokeWidth={strokeWidthFor(d.width, width)}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
      {live.map((s, i) => (
        <Path
          key={`live-${i}`}
          d={strokePath(s.points, width, height)}
          stroke={s.color}
          strokeWidth={strokeWidthFor(s.width, width)}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.85}
        />
      ))}
    </Svg>
  );
}

export default memo(DoodleLayer);
