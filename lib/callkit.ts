/**
 * iPhone system calls (CallKit + VoIP push) live in callkit.ios.ts. Android
 * and the web ring with the app's own call notification / screen, so here
 * everything is a no-op.
 */
export interface CallKitHandlers {
  userId: string;
  /** Someone answered on the system call screen. */
  onAnswer: (data: Record<string, any>) => void;
  /** Declined on the system call screen (or it timed out). */
  onDecline: (data: Record<string, any>) => void;
}

/** True when calls ring through the iPhone's own call screen. */
export function callKitReady(): boolean { return false; }
/** This call is already ringing on the system call screen. */
export function callKitHasRoom(_roomId: string): boolean { return false; }
/** Start listening for VoIP pushes and system call actions. Returns a cleanup. */
export function startCallKit(_h: CallKitHandlers): () => void { return () => {}; }
/** The call ended in the app: close the system call too. */
export function callKitEndRoom(_roomId: string): void {}
/** Hanging up on the system call screen (lock screen, Dynamic Island) runs fn. */
export function onCallKitHangUp(_roomId: string, _fn: () => void): () => void { return () => {}; }
/** Forget this device's VoIP token on sign-out. */
export async function clearVoipToken(_userId: string): Promise<void> {}
