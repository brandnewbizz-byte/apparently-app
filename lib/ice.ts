/**
 * ICE servers for calls and live voice.
 *
 * STUN finds a direct path between two phones. When that's impossible (many
 * mobile networks and some Wi-Fi put phones behind strict NAT), the TURN relay
 * carries the audio instead, so people can still hear each other.
 */
export const ICE_SERVERS: any[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
  // Free public relay (Open Relay Project by Metered).
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
      'turns:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];
