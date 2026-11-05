/**
 * ApparentlyCalls — native incoming calls (see modules/apparently-calls).
 *
 *  - iPhone: VoIP push (PushKit) + the system call screen (CallKit).
 *  - Android: a full-screen, ringing incoming-call notification with
 *    Answer / Decline, shown by the push receiver even when the app is closed.
 *
 * Builds made before this module existed (and the web) get `null`, so every
 * caller must cope with that — see lib/nativeCalls.ts.
 */
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export type NativeCallEventType =
  | 'incoming'       // iPhone: shown on the system call screen
  | 'answer'         // answered on the system call screen / notification
  | 'open'           // Android: the notification itself was tapped
  | 'declined'       // Android: "Decline" on the notification
  | 'ended'          // iPhone: hung up / declined on the system call screen
  | 'missed'         // nobody answered / the caller hung up while ringing
  | 'mute'           // iPhone: mute switched on the system call screen
  | 'audioActivated' // iPhone: the system handed the call its audio
  | 'voipToken';     // iPhone: new VoIP push token ('' = none)

export interface NativeCallEvent {
  type: NativeCallEventType;
  uuid?: string;
  room_id?: string;
  caller_id?: string;
  caller_name?: string;
  caller_avatar?: string;
  video?: boolean | string;
  notificationId?: string;
  createdAt?: string | number;
  answered?: boolean;
  muted?: boolean;
  token?: string;
  [key: string]: unknown;
}

interface ApparentlyCallsNative {
  isSupported(): boolean;
  getPendingEvents(): NativeCallEvent[];
  getVoipToken(): string | null;
  configure(opts: { supabaseUrl: string; anonKey: string; userId: string }): void;
  dismissIncoming(roomId: string): void;
  setCallMode(on: boolean): void;
  reportEnded(roomId: string, reason: 'ended' | 'missed' | 'answeredElsewhere' | 'declinedElsewhere' | 'failed'): Promise<void>;
  endCall(roomId: string): Promise<void>;
  setMuted(roomId: string, muted: boolean): Promise<void>;
  getActiveRooms(): Promise<string[]>;
  canUseFullScreenIntent?(): boolean;
  openFullScreenIntentSettings?(): void;
  addListener(event: 'onCallEvent', fn: () => void): { remove(): void };
}

const native: ApparentlyCallsNative | null =
  Platform.OS === 'web' ? null : requireOptionalNativeModule<ApparentlyCallsNative>('ApparentlyCalls');

export default native;
