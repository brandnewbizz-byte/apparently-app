import React from 'react';
import { View, StyleSheet, Image, Dimensions } from 'react-native';
import Svg, {
  Rect, Circle, Line, Polygon, Ellipse, G, Path,
  Text as SvgText,
} from 'react-native-svg';
import { EnvironmentType } from '@/types/virtual-room';

const { width: SW, height: SH } = Dimensions.get('window');

interface Props {
  type: EnvironmentType;
  style?: any;
}

const CANVAS_W = SW * 3;
const CANVAS_H = SH * 3;

const SoccerField = () => (
  <Svg width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
    <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#2D8C3C" />
    <Rect x={CANVAS_W * 0.1} y={CANVAS_H * 0.15} width={CANVAS_W * 0.8} height={CANVAS_H * 0.7}
      fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={3} />
    <Line x1={CANVAS_W * 0.5} y1={CANVAS_H * 0.15} x2={CANVAS_W * 0.5} y2={CANVAS_H * 0.85}
      stroke="rgba(255,255,255,0.6)" strokeWidth={3} />
    <Circle cx={CANVAS_W * 0.5} cy={CANVAS_H * 0.5} r={60}
      stroke="rgba(255,255,255,0.6)" strokeWidth={3} fill="none" />
    <Circle cx={CANVAS_W * 0.5} cy={CANVAS_H * 0.5} r={6} fill="rgba(255,255,255,0.6)" />
    <Rect x={CANVAS_W * 0.1} y={CANVAS_H * 0.35} width={CANVAS_W * 0.08} height={CANVAS_H * 0.3}
      fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
    <Rect x={CANVAS_W * 0.82} y={CANVAS_H * 0.35} width={CANVAS_W * 0.08} height={CANVAS_H * 0.3}
      fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
    {/* Grid marks */}
    {[0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map(x => (
      <Circle key={`gx-${x}`} cx={CANVAS_W * x} cy={CANVAS_H * 0.5} r={2} fill="rgba(255,255,255,0.2)" />
    ))}
    {[0.25, 0.35, 0.45, 0.55, 0.65, 0.75].map(y => (
      <React.Fragment key={`gy-${y}`}>
        <Circle cx={CANVAS_W * 0.5} cy={CANVAS_H * y} r={2} fill="rgba(255,255,255,0.2)" />
      </React.Fragment>
    ))}
  </Svg>
);

const BasketballCourt = () => (
  <Svg width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
    <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#C4873A" />
    {Array.from({ length: 20 }).map((_, i) => (
      <Line key={`plank-${i}`} x1={0} y1={i * CANVAS_H / 20} x2={CANVAS_W} y2={i * CANVAS_H / 20}
        stroke="rgba(139,90,43,0.5)" strokeWidth={2} />
    ))}
    <Rect x={CANVAS_W * 0.08} y={CANVAS_H * 0.08} width={CANVAS_W * 0.84} height={CANVAS_H * 0.84}
      fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={4} />
    <Line x1={CANVAS_W * 0.5} y1={CANVAS_H * 0.08} x2={CANVAS_W * 0.5} y2={CANVAS_H * 0.92}
      stroke="rgba(255,255,255,0.5)" strokeWidth={3} />
    <Circle cx={CANVAS_W * 0.5} cy={CANVAS_H * 0.5} r={80}
      stroke="rgba(255,255,255,0.5)" strokeWidth={3} fill="none" />
    <Circle cx={CANVAS_W * 0.15} cy={CANVAS_H * 0.5} r={50}
      stroke="rgba(255,255,255,0.5)" strokeWidth={3} fill="none" />
    <Circle cx={CANVAS_W * 0.85} cy={CANVAS_H * 0.5} r={50}
      stroke="rgba(255,255,255,0.5)" strokeWidth={3} fill="none" />
    <Rect x={CANVAS_W * 0.13} y={CANVAS_H * 0.42} width={CANVAS_W * 0.04} height={CANVAS_H * 0.16}
      fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
    <Rect x={CANVAS_W * 0.83} y={CANVAS_H * 0.42} width={CANVAS_W * 0.04} height={CANVAS_H * 0.16}
      fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
  </Svg>
);

const Office = () => (
  <Svg width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
    <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#E8E0D5" />
    {/* Floorboards */}
    {Array.from({ length: 16 }).map((_, i) => (
      <Line key={`fb-${i}`} x1={0} y1={i * CANVAS_H / 16} x2={CANVAS_W} y2={i * CANVAS_H / 16}
        stroke="rgba(0,0,0,0.05)" strokeWidth={1} />
    ))}
    {/* Desk */}
    <Rect x={CANVAS_W * 0.25} y={CANVAS_H * 0.3} width={CANVAS_W * 0.5} height={20}
      fill="#6B5B4D" rx={4} />
    <Rect x={CANVAS_W * 0.28} y={CANVAS_H * 0.3 + 20} width={12} height={CANVAS_H * 0.15} fill="#5A4A3D" />
    <Rect x={CANVAS_W * 0.68} y={CANVAS_H * 0.3 + 20} width={12} height={CANVAS_H * 0.15} fill="#5A4A3D" />
    {/* Chair */}
    <Rect x={CANVAS_W * 0.44} y={CANVAS_H * 0.2} width={CANVAS_W * 0.12} height={90}
      fill="#4A4A4A" rx={6} />
    <Rect x={CANVAS_W * 0.43} y={CANVAS_H * 0.2} width={CANVAS_W * 0.14} height={15}
      fill="#3A3A3A" rx={3} />
    {/* Window */}
    <Rect x={CANVAS_W * 0.65} y={0} width={CANVAS_W * 0.18} height={CANVAS_H * 0.2}
      fill="#A8D8F0" stroke="#8B7355" strokeWidth={4} rx={2} />
    <Line x1={CANVAS_W * 0.74} y1={0} x2={CANVAS_W * 0.74} y2={CANVAS_H * 0.2}
      stroke="#8B7355" strokeWidth={3} />
    {/* Plant */}
    <Circle cx={CANVAS_W * 0.7} cy={CANVAS_H * 0.6} r={30} fill="#4CAF50" opacity={0.7} />
    <Rect x={CANVAS_W * 0.695} y={CANVAS_H * 0.62} width={10} height={40} fill="#795548" rx={2} />
    {/* Bookshelf */}
    <Rect x={CANVAS_W * 0.08} y={CANVAS_H * 0.1} width={CANVAS_W * 0.08} height={CANVAS_H * 0.35}
      fill="#8B7355" rx={3} />
    {[0.1, 0.17, 0.24, 0.31].map((y, i) => (
      <React.Fragment key={`shelf-${i}`}>
        <Rect x={CANVAS_W * 0.08 + 4} y={CANVAS_H * y} width={CANVAS_W * 0.08 - 8} height={4}
          fill="#6B5B4D" />
        {[0, 1, 2].map(j => (
          <Rect key={`book-${i}-${j}`}
            x={CANVAS_W * 0.085 + j * 25} y={CANVAS_H * (y - 0.06)} width={18} height={CANVAS_H * 0.05}
            fill={`hsl(${(i+j)*60}, 60%, ${40 + j*10}%)`} rx={1} />
        ))}
      </React.Fragment>
    ))}
  </Svg>
);

const Classroom = () => (
  <Svg width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
    <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#F5F0E0" />
    {/* Floor tiles */}
    {[0, 1, 2, 3, 4, 5, 6].map(i => (
      <React.Fragment key={`tile-${i}`}>
        <Line x1={0} y1={CANVAS_H * 0.35 + i * 80} x2={CANVAS_W} y2={CANVAS_H * 0.35 + i * 80}
          stroke="rgba(0,0,0,0.04)" strokeWidth={1} />
      </React.Fragment>
    ))}
    {/* Whiteboard */}
    <Rect x={CANVAS_W * 0.28} y={CANVAS_H * 0.05} width={CANVAS_W * 0.44} height={CANVAS_H * 0.15}
      fill="#FFFFFF" stroke="#888" strokeWidth={3} rx={4} />
    <Line x1={CANVAS_W * 0.3} y1={CANVAS_H * 0.1} x2={CANVAS_W * 0.7} y2={CANVAS_H * 0.1}
      stroke="rgba(0,0,0,0.2)" strokeWidth={1} />
    <Circle cx={CANVAS_W * 0.35} cy={CANVAS_H * 0.13} r={15} fill="none" stroke="#3366CC" strokeWidth={2} />
    <SvgText x={CANVAS_W * 0.45} y={CANVAS_H * 0.14} fontSize={14} fill="#333">Agenda</SvgText>
    {/* Desks */}
    {[[0.18, 0.35], [0.42, 0.35], [0.66, 0.35], [0.18, 0.5], [0.42, 0.5], [0.66, 0.5], [0.18, 0.65], [0.42, 0.65], [0.66, 0.65]].map(([x, y], i) => (
      <React.Fragment key={`desk-${i}`}>
        <Rect x={CANVAS_W * x} y={CANVAS_H * y} width={CANVAS_W * 0.14} height={10}
          fill="#C4A882" rx={3} />
        <Rect x={CANVAS_W * (x + 0.04)} y={CANVAS_H * (y - 0.03)} width={CANVAS_W * 0.06} height={CANVAS_H * 0.03}
          fill="#8B7355" rx={2} />
      </React.Fragment>
    ))}
  </Svg>
);

const WeddingVenue = () => (
  <Svg width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
    <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#FFF5F5" />
    {/* Carpet/aisle */}
    <Rect x={CANVAS_W * 0.35} y={CANVAS_H * 0.2} width={CANVAS_W * 0.3} height={CANVAS_H * 0.7}
      fill="#FDE8E8" rx={8} />
    {/* Arch */}
    <G>
      <Path d={`M ${CANVAS_W*0.3} ${CANVAS_H*0.25} Q ${CANVAS_W*0.5} ${CANVAS_H*0.05} ${CANVAS_W*0.7} ${CANVAS_H*0.25}`}
        stroke="#D4A574" strokeWidth={8} fill="none" />
      <Rect x={CANVAS_W * 0.29} y={CANVAS_H * 0.23} width={CANVAS_W * 0.42} height={10}
        fill="#D4A574" rx={4} />
    </G>
    {/* Flowers on arch */}
    <Circle cx={CANVAS_W * 0.3} cy={CANVAS_H * 0.24} r={15} fill="#FF6B8A" opacity={0.7} />
    <Circle cx={CANVAS_W * 0.7} cy={CANVAS_H * 0.24} r={15} fill="#FF6B8A" opacity={0.7} />
    <Circle cx={CANVAS_W * 0.5} cy={CANVAS_H * 0.08} r={20} fill="#FF85A1" opacity={0.6} />
    {/* Chairs */}
    {[0.25, 0.38, 0.62, 0.75].map((x, i) => (
      <React.Fragment key={`wchair-${i}`}>
        <Rect x={CANVAS_W * (x - 0.03)} y={CANVAS_H * 0.4} width={CANVAS_W * 0.04} height={CANVAS_H * 0.08}
          fill={`hsl(${45+i*20}, 30%, 70%)`} rx={2} />
        <Rect x={CANVAS_W * (x - 0.04)} y={CANVAS_H * 0.38} width={CANVAS_W * 0.06} height={8}
          fill={`hsl(${45+i*20}, 30%, 65%)`} rx={2} />
      </React.Fragment>
    ))}
    {/* Petals */}
    {Array.from({ length: 30 }).map((_, i) => (
      <Ellipse key={`petal-${i}`}
        cx={CANVAS_W * (0.4 + Math.random() * 0.2)}
        cy={CANVAS_H * (0.3 + Math.random() * 0.55)}
        rx={4 + Math.random() * 6} ry={2 + Math.random() * 3}
        fill={`hsl(${340 + Math.random() * 20}, 80%, ${70 + Math.random() * 20}%)`}
        opacity={0.5 + Math.random() * 0.3} />
    ))}
  </Svg>
);

const Beach = () => (
  <Svg width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
    {/* Sky */}
    <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H * 0.45} fill="#87CEEB" />
    {/* Water */}
    <Rect x={0} y={CANVAS_H * 0.35} width={CANVAS_W} height={CANVAS_H * 0.2} fill="#4A90D9" />
    {Array.from({ length: 12 }).map((_, i) => (
      <Line key={`wave-${i}`} x1={CANVAS_W * (i * 0.09)} y1={CANVAS_H * (0.37 + (i % 3) * 0.04)}
        x2={CANVAS_W * (i * 0.09 + 0.08)} y2={CANVAS_H * (0.35 + (i % 3) * 0.04)}
        stroke="rgba(255,255,255,0.3)" strokeWidth={2} />
    ))}
    {/* Sand */}
    <Rect x={0} y={CANVAS_H * 0.55} width={CANVAS_W} height={CANVAS_H * 0.45} fill="#F4D29B" />
    {/* Shoreline */}
    <Rect x={0} y={CANVAS_H * 0.5} width={CANVAS_W} height={CANVAS_H * 0.08} fill="#E8C97A" rx={40} />
    {/* Umbrella */}
    <Line x1={CANVAS_W * 0.5} y1={CANVAS_H * 0.65} x2={CANVAS_W * 0.5} y2={CANVAS_H * 0.35}
      stroke="#8B7355" strokeWidth={5} />
    <Path d={`M ${CANVAS_W*0.38} ${CANVAS_H*0.35} Q ${CANVAS_W*0.5} ${CANVAS_H*0.2} ${CANVAS_W*0.62} ${CANVAS_H*0.35}`}
      fill="#FF6B35" stroke="#E55525" strokeWidth={2} />
    {/* Towel */}
    <Rect x={CANVAS_W * 0.3} y={CANVAS_H * 0.65} width={CANVAS_W * 0.15} height={CANVAS_H * 0.1}
      fill="#FF4757" rx={4} transform={`rotate(${-5}, ${CANVAS_W*0.375}, ${CANVAS_H*0.7})`} />
    <Rect x={CANVAS_W * 0.3} y={CANVAS_H * 0.65} width={CANVAS_W * 0.15} height={8}
      fill="#FF6B81" rx={2} transform={`rotate(${-5}, ${CANVAS_W*0.375}, ${CANVAS_H*0.65})`} />
    {/* Sun */}
    <Circle cx={CANVAS_W * 0.8} cy={CANVAS_H * 0.12} r={40} fill="#FFD93D" opacity={0.9} />
    {/* Seagulls */}
    <Path d={`M ${CANVAS_W*0.2} ${CANVAS_H*0.1} Q ${CANVAS_W*0.21} ${CANVAS_H*0.07} ${CANVAS_W*0.22} ${CANVAS_H*0.1}`}
      stroke="#FFF" strokeWidth={2} fill="none" />
    <Path d={`M ${CANVAS_W*0.25} ${CANVAS_H*0.08} Q ${CANVAS_W*0.26} ${CANVAS_H*0.05} ${CANVAS_W*0.27} ${CANVAS_H*0.08}`}
      stroke="#FFF" strokeWidth={2} fill="none" />
    {/* Beach ball */}
    <Circle cx={CANVAS_W * 0.6} cy={CANVAS_H * 0.75} r={25} fill="#FFF" />
    <Path d={`M ${CANVAS_W*0.6} ${CANVAS_H*0.725} A 25 25 0 0 1 ${CANVAS_W*0.6} ${CANVAS_H*0.775}`}
      fill="#FF0000" />
    <Path d={`M ${CANVAS_W*0.575} ${CANVAS_H*0.75} A 25 25 0 0 1 ${CANVAS_W*0.625} ${CANVAS_H*0.75}`}
      fill="#0055FF" />
  </Svg>
);

const GenericRoom = () => (
  <Svg width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
    {/* Walls */}
    <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H * 0.08} fill="#E8E0D8" />
    <Rect x={0} y={0} width={CANVAS_W * 0.05} height={CANVAS_H} fill="#E8E0D8" />
    <Rect x={CANVAS_W * 0.95} y={0} width={CANVAS_W * 0.05} height={CANVAS_H} fill="#E8E0D8" />
    {/* Floor */}
    <Rect x={CANVAS_W * 0.05} y={CANVAS_H * 0.8} width={CANVAS_W * 0.9} height={CANVAS_H * 0.2} fill="#D4C4B0" />
    {/* Floor line */}
    <Line x1={CANVAS_W * 0.05} y1={CANVAS_H * 0.8} x2={CANVAS_W * 0.95} y2={CANVAS_H * 0.8}
      stroke="#C0A890" strokeWidth={2} />
    {/* Door */}
    <Rect x={CANVAS_W * 0.42} y={CANVAS_H * 0.65} width={CANVAS_W * 0.16} height={CANVAS_H * 0.15}
      fill="#8B7355" rx={4} stroke="#6B5335" strokeWidth={2} />
    <Circle cx={CANVAS_W * 0.55} cy={CANVAS_H * 0.72} r={6} fill="#D4A840" />
    {/* Window */}
    <Rect x={CANVAS_W * 0.7} y={CANVAS_H * 0.2} width={CANVAS_W * 0.15} height={CANVAS_H * 0.2}
      fill="#B0D8F0" rx={2} stroke="#C0A890" strokeWidth={3} />
    <Line x1={CANVAS_W * 0.775} y1={CANVAS_H * 0.2} x2={CANVAS_W * 0.775} y2={CANVAS_H * 0.4}
      stroke="#C0A890" strokeWidth={2} />
    <Line x1={CANVAS_W * 0.7} y1={CANVAS_H * 0.3} x2={CANVAS_W * 0.85} y2={CANVAS_H * 0.3}
      stroke="#C0A890" strokeWidth={2} />
    {/* Ceiling light */}
    <Rect x={CANVAS_W * 0.44} y={CANVAS_H * 0.05} width={CANVAS_W * 0.12} height={CANVAS_H * 0.04}
      fill="#E0D060" rx={3} opacity={0.5} />
  </Svg>
);

const ENVIRONMENT_MAP: Record<string, React.FC> = {
  generic: GenericRoom,
  soccer_field: SoccerField,
  basketball_court: BasketballCourt,
  office: Office,
  classroom: Classroom,
  wedding_venue: WeddingVenue,
  beach: Beach,
};

export default function EnvironmentBackground({ type }: Props) {
  const Component = ENVIRONMENT_MAP[type] || GenericRoom;
  return (
    <View style={[styles.container]}>
      <Component />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    width: CANVAS_W,
    height: CANVAS_H,
  },
});
