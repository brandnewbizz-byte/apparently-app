import React, { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
// The encoder only (no canvas/file renderers), so it bundles on iOS, Android and web.
import { create } from 'qrcode/lib/core/qrcode';

/**
 * A scannable QR code drawn with react-native-svg. Keep at least ~3px per module
 * on screen (41 modules for a profile link → 130px+) so phone cameras read it.
 */
export function QRCode({ value, size, color = '#111111', background = '#FFFFFF', quiet = 2, level = 'M' }: {
  value: string; size: number; color?: string; background?: string; quiet?: number; level?: 'L' | 'M' | 'Q' | 'H';
}) {
  const { path, n } = useMemo(() => {
    const qr = create(value, { errorCorrectionLevel: level });
    const count = qr.modules.size;
    const data = qr.modules.data;
    let d = '';
    for (let y = 0; y < count; y++) {
      for (let x = 0; x < count; x++) {
        if (data[y * count + x]) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
      }
    }
    return { path: d, n: count + quiet * 2 };
  }, [value, level, quiet]);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} accessibilityLabel="QR code">
      <Rect x={0} y={0} width={n} height={n} fill={background} />
      <Path d={path} fill={color} />
    </Svg>
  );
}
