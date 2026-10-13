// ── Virtual Room Types ──
// Extensible foundation for future marketplace features.

export type ObjectType =
  | 'image'
  | 'shape'
  | 'sticky_note'
  | 'ball'
  | 'goal'
  | 'trophy'
  | 'chair'
  | 'table'
  | 'whiteboard'
  | 'tv'
  | 'document'
  | 'pdf'
  | 'video'
  | 'logo'
  | 'product_photo'
  | 'flyer'
  | 'custom';

export type EnvironmentType =
  | 'soccer_field'
  | 'basketball_court'
  | 'office'
  | 'classroom'
  | 'wedding_venue'
  | 'beach'
  | 'generic';

export interface VirtualObject {
  id: string;
  roomId: string;
  objectType: ObjectType;
  name: string;
  description: string;
  notes: string;
  imageUrl?: string;
  // Transform
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  zIndex: number;
  // Ownership
  ownerId?: string;
  ownerName?: string;
  // Extensible metadata
  metadata: Record<string, unknown>;
  // ── Future marketplace foundation (NOT built yet) ──
  price?: number;
  isListed?: boolean;
  sponsorId?: string;
  rewardPoints?: number;
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface VirtualEnvironment {
  id: string;
  roomId: string;
  environmentType: EnvironmentType;
  backgroundColor: string;
  cameraX: number;
  cameraY: number;
  cameraScale: number;
  createdAt: string;
  updatedAt: string;
}

export interface VirtualRoomState {
  environment: VirtualEnvironment | null;
  objects: VirtualObject[];
  cameraX: number;
  cameraY: number;
  cameraScale: number;
  selectedObjectId: string | null;
  isLoading: boolean;
  isSaving: boolean;
}

export const ENVIRONMENT_OPTIONS: { key: EnvironmentType; label: string; emoji: string; bgColor: string }[] = [
  { key: 'soccer_field', label: 'Soccer Field', emoji: '⚽', bgColor: '#2D8C3C' },
  { key: 'basketball_court', label: 'Basketball Court', emoji: '🏀', bgColor: '#C4873A' },
  { key: 'office', label: 'Office', emoji: '🏢', bgColor: '#E8E0D5' },
  { key: 'classroom', label: 'Classroom', emoji: '📚', bgColor: '#F5F0E0' },
  { key: 'wedding_venue', label: 'Wedding Venue', emoji: '💒', bgColor: '#FFF5F5' },
  { key: 'beach', label: 'Beach', emoji: '🏖️', bgColor: '#87CEEB' },
  { key: 'generic', label: 'Generic Room', emoji: '🏠', bgColor: '#F0F0F0' },
];

export const DEFAULT_OBJECT_SIZE: Record<string, { w: number; h: number }> = {
  image: { w: 120, h: 120 },
  shape: { w: 80, h: 80 },
  sticky_note: { w: 100, h: 100 },
  ball: { w: 60, h: 60 },
  goal: { w: 100, h: 60 },
  trophy: { w: 50, h: 70 },
  chair: { w: 50, h: 50 },
  table: { w: 100, h: 60 },
  whiteboard: { w: 140, h: 90 },
  tv: { w: 100, h: 70 },
  document: { w: 80, h: 100 },
  pdf: { w: 80, h: 100 },
  video: { w: 100, h: 80 },
  logo: { w: 80, h: 80 },
  product_photo: { w: 100, h: 100 },
  flyer: { w: 90, h: 120 },
  custom: { w: 100, h: 100 },
};
