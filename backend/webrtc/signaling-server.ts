/**
 * WebRTC Signaling + Audio Relay Server
 *
 * Hono WebSocket integration — callbacks called from hono.ts.
 * Handles:
 *  - Room join/leave (peer discovery)
 *  - SDP offer/answer exchange
 *  - ICE candidate relay
 *  - Audio chunk relay for push-to-talk streaming
 *  - TURN/STUN configuration
 *
 * Multi-speaker: audio from any peer is broadcast to all others in the room.
 * No speaking queue — natural team discussion.
 */

import type { WSContext } from "hono/ws";

// ── Types ──

export interface SignalingMessage {
  type:
    | "join"
    | "leave"
    | "offer"
    | "answer"
    | "ice_candidate"
    | "audio_chunk"
    | "mute"
    | "unmute"
    | "peer_joined"
    | "peer_left"
    | "speaker_start"
    | "speaker_stop"
    | "error";
  roomId: string;
  peerId?: string;
  peerName?: string;
  targetPeerId?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  iceServers?: RTCIceServer[];
  existingPeers?: Array<{ peerId: string; peerName: string; isMuted: boolean }>;
  audioData?: string;
  sequence?: number;
  muted?: boolean;
  error?: string;
}

interface PeerInfo {
  ws: WSContext;
  peerId: string;
  peerName: string;
  isMuted: boolean;
  joinedAt: number;
}

// ── ICE Servers (public STUN — TCP candidates for mobile reliability) ──

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

// ── Room Registry ──

const rooms = new Map<string, Map<string, PeerInfo>>();

// ── Broadcast / unicast ──

function broadcastToRoom(roomId: string, msg: SignalingMessage, excludePeerId?: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  const payload = JSON.stringify(msg);
  for (const [peerId, peer] of room) {
    if (peerId === excludePeerId) continue;
    try { peer.ws.send(payload); } catch { /* dead peer */ }
  }
}

function sendToPeer(roomId: string, peerId: string, msg: SignalingMessage) {
  const room = rooms.get(roomId);
  if (!room) return;
  const peer = room.get(peerId);
  if (!peer) return;
  try { peer.ws.send(JSON.stringify(msg)); } catch { /* dead peer */ }
}

// ── Join ──

function joinRoom(peer: PeerInfo, ws: WSContext) {
  const { peerId, peerName } = peer;
  const roomId = peer.peerId; // We'll use roomId stored separately

  // The actual roomId comes from the message, not the peer object
  // We handle this in handleMessage below
}

// ── Leave ──

function leaveRoom(roomId: string, peerId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  const peer = room.get(peerId);
  room.delete(peerId);

  if (room.size === 0) {
    rooms.delete(roomId);
  } else {
    broadcastToRoom(roomId, {
      type: "peer_left",
      roomId,
      peerId,
      peerName: peer?.peerName || "Someone",
    });
  }
}

// ── Audio relay (multi-speaker — all simultaneous) ──

function relayAudio(roomId: string, fromPeerId: string, audioData: string, sequence: number) {
  const room = rooms.get(roomId);
  if (!room) return;

  const fromPeer = room.get(fromPeerId);
  if (!fromPeer || fromPeer.isMuted) return;

  for (const [peerId, peer] of room) {
    if (peerId === fromPeerId) continue;
    try {
      peer.ws.send(JSON.stringify({
        type: "audio_chunk",
        roomId,
        peerId: fromPeerId,
        peerName: fromPeer.peerName,
        audioData,
        sequence,
      }));
    } catch { /* skip dead */ }
  }
}

// ── Main message handler ──

export function handleSignalingMessage(
  raw: string,
  ws: WSContext,
  roomRef: { roomId: string | null; peerId: string | null }
) {
  let msg: SignalingMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    ws.send(JSON.stringify({ type: "error", roomId: "", error: "Invalid JSON" }));
    return;
  }

  const { type, roomId } = msg;

  switch (type) {
    case "join": {
      const { roomId, peerId, peerName } = msg;
      if (!roomId || !peerId) {
        ws.send(JSON.stringify({ type: "error", roomId: roomId || "", error: "roomId and peerId required" }));
        return;
      }

      roomRef.roomId = roomId;
      roomRef.peerId = peerId;

      if (!rooms.has(roomId)) rooms.set(roomId, new Map());
      const room = rooms.get(roomId)!;

      // Replace stale connection if reconnecting
      if (room.has(peerId)) {
        try { room.get(peerId)!.ws.close(); } catch {}
      }

      const peerInfo: PeerInfo = { ws, peerId, peerName: peerName || "Anonymous", isMuted: false, joinedAt: Date.now() };
      room.set(peerId, peerInfo);

      // Send ICE servers + existing peers to the joiner
      ws.send(JSON.stringify({
        type: "join",
        roomId,
        peerId,
        iceServers: ICE_SERVERS,
        existingPeers: Array.from(room.entries())
          .filter(([id]) => id !== peerId)
          .map(([id, p]) => ({ peerId: id, peerName: p.peerName, isMuted: p.isMuted })),
      }));

      // Notify others
      broadcastToRoom(roomId, { type: "peer_joined", roomId, peerId, peerName: peerInfo.peerName }, peerId);
      break;
    }

    case "leave":
      if (roomRef.roomId && roomRef.peerId) leaveRoom(roomRef.roomId, roomRef.peerId);
      break;

    case "offer":
    case "answer":
    case "ice_candidate":
      if (msg.targetPeerId && roomId) sendToPeer(roomId, msg.targetPeerId, msg);
      break;

    case "audio_chunk":
      if (roomRef.roomId && roomRef.peerId)
        relayAudio(roomRef.roomId, roomRef.peerId, msg.audioData || "", msg.sequence || 0);
      break;

    case "mute":
    case "unmute": {
      if (!roomId || !msg.peerId) break;
      const r = rooms.get(roomId);
      if (!r) break;
      const p = r.get(msg.peerId);
      if (!p) break;
      p.isMuted = type === "mute";
      sendToPeer(roomId, msg.peerId, { type, roomId, peerId: msg.peerId, muted: p.isMuted });
      broadcastToRoom(roomId, {
        type: p.isMuted ? "speaker_stop" : "speaker_start",
        roomId, peerId: msg.peerId, peerName: p.peerName, muted: p.isMuted,
      });
      break;
    }

    default:
      ws.send(JSON.stringify({ type: "error", roomId: roomId || "", error: `Unknown type: ${type}` }));
  }
}

export function handleSignalingClose(roomId: string | null, peerId: string | null) {
  if (roomId && peerId) leaveRoom(roomId, peerId);
}

// ── Stats ──

export function getRoomStats() {
  const stats: Record<string, { peerCount: number; peers: string[] }> = {};
  for (const [roomId, room] of rooms) {
    stats[roomId] = {
      peerCount: room.size,
      peers: Array.from(room.values()).map((p) => `${p.peerName}${p.isMuted ? " 🔇" : ""}`),
    };
  }
  return stats;
}

export function getRoomCount() { return rooms.size; }
export function getTotalPeerCount() {
  let c = 0;
  for (const r of rooms.values()) c += r.size;
  return c;
}
