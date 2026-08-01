import React, {
  createContext, useContext, useState, useCallback, useEffect, useRef,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// ── Types ──

export type RoomRole = 'host' | 'co_host' | 'editor' | 'contributor' | 'viewer';

export interface RoomParticipant {
  userId: string;
  fullName: string;
  avatar: string | null;
  isSpeaking: boolean;
  hasCamera: boolean;
  role: RoomRole;
  isMuted: boolean;
  followMode: boolean;
  handRaised: boolean;
}

export interface ActivityEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  detail: string;
  timestamp: string;
}

export interface EditIndicator {
  userId: string;
  userName: string;
  section: string;
  startedAt: string;
}

export type RoomStatus = 'draft' | 'live' | 'ended';

export interface LiveRoom {
  id: string;
  name: string;
  topic: string;
  goal: string;
  category: string;
  visibility: 'public' | 'private' | 'invite_only';
  maxParticipants: number;
  scheduledDate: string | null;
  coverImage: string | null;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string | null;
  participants: RoomParticipant[];
  created_at: string;
  isLocal?: boolean;
  // Room lifecycle
  status: RoomStatus;
  inviteLink: string | null;
  // Presentation
  presentationState: 'idle' | 'presenting' | 'paused';
  presenterId: string | null;
  presenterName: string | null;
  presenterTab?: string;
  openDiscussion: boolean;
  // Activity
  activityLog: ActivityEntry[];
  editIndicators: EditIndicator[];
}

interface RoomContextValue {
  rooms: LiveRoom[];
  currentRoom: LiveRoom | null;
  isLoading: boolean;

  // Room lifecycle
  fetchRooms: () => Promise<void>;
  createRoom: (name: string, topic: string, opts?: {
    goal?: string;
    category?: string;
    visibility?: 'public' | 'private' | 'invite_only';
    maxParticipants?: number;
  }) => Promise<LiveRoom | null>;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  isInRoom: (roomId: string) => boolean;
  goLive: (roomId: string) => void;
  endLive: (roomId: string) => void;
  deleteRoom: (roomId: string) => void;
  generateInviteLink: (roomId: string) => string;

  // Gestures
  toggleRaiseHand: (roomId: string) => void;

  // Audio / Camera
  startSpeaking: (roomId: string) => void;
  stopSpeaking: (roomId: string) => void;
  toggleCamera: (roomId: string) => void;

  // Moderation
  muteParticipant: (roomId: string, userId: string) => void;
  unmuteParticipant: (roomId: string, userId: string) => void;
  muteAllExceptHosts: () => void;
  toggleOpenDiscussion: () => void;
  removeParticipant: (roomId: string, userId: string) => void;
  changeRole: (roomId: string, userId: string, role: RoomRole) => void;

  // Presentation
  startPresenting: () => void;
  stopPresenting: () => void;
  setPresenterTab: (tab: string) => void;
  presenterTab: string | null;
  requestControl: () => void;
  giveControl: (userId: string) => void;
  takeBackControl: () => void;
  approveControlRequest: (userId: string) => void;
  lockPresentationToHost: () => void;

  // Follow mode
  enterFollowMode: () => void;
  leaveFollowMode: () => void;
  returnToLivePresentation: () => void;

  // Activity
  addActivity: (action: string, detail: string) => void;
  setEditIndicator: (section: string) => void;
  clearEditIndicator: (section: string) => void;

  // View mode (Personal Browse vs Shared Presentation)
  viewMode: 'browse' | 'presenting';
  setViewMode: (mode: 'browse' | 'presenting') => void;

  // Persistence guarantee
  syncActivityToSupabase: (entry: ActivityEntry) => void;

  // Permissions check
  canEdit: () => boolean;
  canSpeak: (userId: string) => boolean;
  isHost: () => boolean;
  isCoHostOrAbove: () => boolean;
  getUserRole: () => RoomRole;
}

const RoomContext = createContext<RoomContextValue | undefined>(undefined);

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be inside RoomProvider');
  return ctx;
}

// ── Provider ──
export function RoomProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<LiveRoom | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isTableReady = useRef(false);
  const controlRequestsRef = useRef<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'browse' | 'presenting'>('browse');

  // ── Init ──
  useEffect(() => {
    async function check() {
      try {
        const { error } = await supabase.from('rooms').select('id').limit(1);
        isTableReady.current = !error;
      } catch { isTableReady.current = false; }
    }
    check();
  }, []);

  // ── Helpers ──
  const seededId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const getUserRole = useCallback((): RoomRole => {
    if (!currentRoom || !user) return 'viewer';
    const p = currentRoom.participants.find(pp => pp.userId === user.id);
    return p?.role || 'viewer';
  }, [currentRoom, user]);

  const isHost = useCallback(() => {
    if (!currentRoom || !user) return false;
    if (currentRoom.creatorId === user.id) return true;
    const p = currentRoom.participants.find(pp => pp.userId === user.id);
    return p?.role === 'host';
  }, [currentRoom, user]);

  const isCoHostOrAbove = useCallback(() => {
    if (!currentRoom || !user) return false;
    if (currentRoom.creatorId === user.id) return true;
    const p = currentRoom.participants.find(pp => pp.userId === user.id);
    return p?.role === 'host' || p?.role === 'co_host';
  }, [currentRoom, user]);

  const canEdit = useCallback(() => {
    if (!currentRoom || !user) return false;
    if (currentRoom.creatorId === user.id) return true;
    const p = currentRoom.participants.find(pp => pp.userId === user.id);
    return p?.role === 'host' || p?.role === 'co_host' || p?.role === 'editor';
  }, [currentRoom, user]);

  const canSpeak = useCallback((userId: string) => {
    if (!currentRoom) return true;
    if (!currentRoom.openDiscussion) {
      const p = currentRoom.participants.find(pp => pp.userId === userId);
      if (!p) return false;
      return p.role === 'host' || p.role === 'co_host' || p.role === 'editor';
    }
    const p = currentRoom.participants.find(pp => pp.userId === userId);
    return !p?.isMuted;
  }, [currentRoom]);

  // ── Fetch ──
  const fetchRooms = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isTableReady.current) {
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        if (!error && data) {
          setRooms(data as LiveRoom[]);
          setIsLoading(false);
          return;
        }
      }
    } catch {}
    setIsLoading(false);
  }, []);

  // ── Default participant factory ──
  const makeParticipant = (u: any, role?: RoomRole): RoomParticipant => ({
    userId: u?.id || '',
    fullName: u?.fullName || 'Anonymous',
    avatar: u?.avatar || null,
    isSpeaking: false,
    hasCamera: false,
    role: role || 'contributor',
    isMuted: false,
    followMode: false,
    handRaised: false,
  });

  // ── Create room ──
  const createRoom = useCallback(async (name: string, topic: string, opts?: {
    goal?: string; category?: string; visibility?: 'public' | 'private' | 'invite_only'; maxParticipants?: number;
  }) => {
    const roomId = `room_${seededId()}`;
    const inviteLink = `apparently://live/room/${roomId}`;
    const newRoom: LiveRoom = {
      id: roomId, name, topic,
      goal: opts?.goal || '', category: opts?.category || 'General',
      visibility: opts?.visibility || 'public', maxParticipants: opts?.maxParticipants || 25,
      scheduledDate: null, coverImage: null,
      creatorId: user?.id || '', creatorName: user?.fullName || 'Anonymous',
      creatorAvatar: user?.avatar || null,
      participants: [makeParticipant(user, 'host')],
      created_at: new Date().toISOString(),
      isLocal: true,
      status: 'draft',
      inviteLink,
      presentationState: 'idle',
      presenterId: null,
      presenterName: null,
      presenterTab: undefined,
      openDiscussion: true,
      activityLog: [{
        id: seededId(), userId: user?.id || '', userName: user?.fullName || 'Anonymous',
        action: 'room_created', detail: `Room "${name}" created — setup mode`, timestamp: new Date().toISOString(),
      }],
      editIndicators: [],
    };

    if (isTableReady.current && user?.id) {
      try {
        const { data, error } = await supabase.from('rooms').insert({
          id: roomId, name, topic, creator_id: user.id,
          creator_name: user.fullName, creator_avatar: user.avatar,
          participants: JSON.stringify(newRoom.participants),
        }).select().single();
        if (!error && data) {
          const saved = mapFromDB(data);
          setRooms(prev => [saved, ...prev]);
          return saved;
        }
      } catch {}
    }

    setRooms(prev => [newRoom, ...prev]);
    return newRoom;
  }, [user]);

  // ── Join room ──
  const joinRoom = useCallback((roomId: string) => {
    setRooms(prev => {
      const found = prev.find(r => r.id === roomId);
      if (!found || !user) return prev;
      const already = found.participants.some(p => p.userId === user.id);
      if (already) { setCurrentRoom(found); return prev; }
      const withUser: LiveRoom = {
        ...found,
        participants: [...found.participants, makeParticipant(user)],
        activityLog: [
          { id: seededId(), userId: user.id, userName: user.fullName || '', action: 'user_joined', detail: `${user.fullName} joined the room`, timestamp: new Date().toISOString() },
          ...found.activityLog,
        ],
      };
      setCurrentRoom(withUser);
      return prev.map(r => r.id === roomId ? withUser : r);
    });
  }, [user]);

  const leaveRoom = useCallback((roomId: string) => {
    if (!user) return;
    setCurrentRoom(null);
    setRooms(prev => prev.map(r => {
      if (r.id !== roomId) return r;
      return {
        ...r,
        participants: r.participants.filter(p => p.userId !== user.id),
        activityLog: [
          { id: seededId(), userId: user.id, userName: user.fullName || '', action: 'user_left', detail: `${user.fullName} left the room`, timestamp: new Date().toISOString() },
          ...r.activityLog,
        ],
      };
    }));
  }, [user]);

  const isInRoom = useCallback((roomId: string) => currentRoom?.id === roomId, [currentRoom]);

  // ── Lifecycle: goLive, endLive, deleteRoom, invite link ──
  const goLive = useCallback((roomId: string) => {
    if (!user) return;
    setRooms(prev => prev.map(r => {
      if (r.id !== roomId) return r;
      return {
        ...r,
        status: 'live' as const,
        activityLog: [{
          id: seededId(), userId: user.id, userName: user.fullName || '',
          action: 'went_live', detail: `Live started by ${user.fullName}`, timestamp: new Date().toISOString(),
        }, ...r.activityLog],
      };
    }));
    setCurrentRoom(prev => {
      if (!prev || prev.id !== roomId) return prev;
      return {
        ...prev,
        status: 'live' as const,
        activityLog: [{
          id: seededId(), userId: user.id, userName: user.fullName || '',
          action: 'went_live', detail: `Live started by ${user.fullName}`, timestamp: new Date().toISOString(),
        }, ...prev.activityLog],
      };
    });
  }, [user]);

  const endLive = useCallback((roomId: string) => {
    if (!user) return;
    setRooms(prev => prev.map(r => {
      if (r.id !== roomId) return r;
      return {
        ...r,
        status: 'ended' as const,
        presentationState: 'idle' as const,
        presenterId: null,
        presenterName: null,
        activityLog: [{
          id: seededId(), userId: user.id, userName: user.fullName || '',
          action: 'live_ended', detail: `Live ended by ${user.fullName} — room saved`, timestamp: new Date().toISOString(),
        }, ...r.activityLog],
      };
    }));
    setCurrentRoom(prev => {
      if (!prev || prev.id !== roomId) return prev;
      return {
        ...prev,
        status: 'ended' as const,
        presentationState: 'idle' as const,
        presenterId: null,
        presenterName: null,
        activityLog: [{
          id: seededId(), userId: user.id, userName: user.fullName || '',
          action: 'live_ended', detail: `Live ended by ${user.fullName} — room saved`, timestamp: new Date().toISOString(),
        }, ...prev.activityLog],
      };
    });
  }, [user]);

  const deleteRoom = useCallback((roomId: string) => {
    setRooms(prev => prev.filter(r => r.id !== roomId));
    setCurrentRoom(prev => prev?.id === roomId ? null : prev);
    // also delete from supabase if connected
    if (isTableReady.current) {
      supabase.from('rooms').delete().eq('id', roomId).then(() => {}, () => {});
    }
  }, []);

  const generateInviteLink = useCallback((roomId: string): string => {
    return `apparently://live/room/${roomId}`;
  }, []);

  // ── Push-to-talk ──
  const startSpeaking = useCallback((roomId: string) => {
    if (!user) return;
    if (!canSpeak(user.id)) return;
    setCurrentRoom(prev => {
      if (!prev || prev.id !== roomId) return prev;
      return {
        ...prev,
        participants: prev.participants.map(p =>
          p.userId === user.id ? { ...p, isSpeaking: true } : p
        ),
      };
    });
  }, [user, canSpeak]);

  const stopSpeaking = useCallback((roomId: string) => {
    if (!user) return;
    setCurrentRoom(prev => {
      if (!prev || prev.id !== roomId) return prev;
      return {
        ...prev,
        participants: prev.participants.map(p =>
          p.userId === user.id ? { ...p, isSpeaking: false } : p
        ),
      };
    });
  }, [user]);

  const toggleCamera = useCallback((roomId: string) => {
    if (!user) return;
    setCurrentRoom(prev => {
      if (!prev || prev.id !== roomId) return prev;
      return {
        ...prev,
        participants: prev.participants.map(p =>
          p.userId === user.id ? { ...p, hasCamera: !p.hasCamera } : p
        ),
      };
    });
  }, [user]);

  // ── Moderation ──
  const muteParticipant = useCallback((roomId: string, userId: string) => {
    setCurrentRoom(prev => {
      if (!prev || prev.id !== roomId) return prev;
      return {
        ...prev,
        participants: prev.participants.map(p =>
          p.userId === userId ? { ...p, isMuted: true, isSpeaking: false } : p
        ),
        activityLog: [
          { id: seededId(), userId: user?.id || '', userName: user?.fullName || '', action: 'user_muted', detail: `${prev.participants.find(p => p.userId === userId)?.fullName} was muted`, timestamp: new Date().toISOString() },
          ...prev.activityLog,
        ],
      };
    });
  }, [user]);

  const unmuteParticipant = useCallback((roomId: string, userId: string) => {
    setCurrentRoom(prev => {
      if (!prev || prev.id !== roomId) return prev;
      return {
        ...prev,
        participants: prev.participants.map(p =>
          p.userId === userId ? { ...p, isMuted: false } : p
        ),
        activityLog: [
          { id: seededId(), userId: user?.id || '', userName: user?.fullName || '', action: 'user_unmuted', detail: `${prev.participants.find(p => p.userId === userId)?.fullName} was unmuted`, timestamp: new Date().toISOString() },
          ...prev.activityLog,
        ],
      };
    });
  }, [user]);

  const muteAllExceptHosts = useCallback(() => {
    setCurrentRoom(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        participants: prev.participants.map(p =>
          (p.role === 'host' || p.role === 'co_host') ? p : { ...p, isMuted: true, isSpeaking: false }
        ),
        activityLog: [
          { id: seededId(), userId: user?.id || '', userName: user?.fullName || '', action: 'mute_all', detail: 'All non-host participants muted', timestamp: new Date().toISOString() },
          ...prev.activityLog,
        ],
      };
    });
  }, [user]);

  const toggleOpenDiscussion = useCallback(() => {
    setCurrentRoom(prev => {
      if (!prev) return prev;
      const newState = !prev.openDiscussion;
      return {
        ...prev,
        openDiscussion: newState,
        activityLog: [
          { id: seededId(), userId: user?.id || '', userName: user?.fullName || '', action: newState ? 'discussion_open' : 'discussion_closed', detail: `Open discussion ${newState ? 'enabled' : 'disabled'}`, timestamp: new Date().toISOString() },
          ...prev.activityLog,
        ],
      };
    });
  }, [user]);

  const removeParticipant = useCallback((roomId: string, userId: string) => {
    setCurrentRoom(prev => {
      if (!prev || prev.id !== roomId) return prev;
      const removed = prev.participants.find(p => p.userId === userId);
      return {
        ...prev,
        participants: prev.participants.filter(p => p.userId !== userId),
        activityLog: [
          { id: seededId(), userId: user?.id || '', userName: user?.fullName || '', action: 'user_removed', detail: `${removed?.fullName || 'A user'} was removed from the room`, timestamp: new Date().toISOString() },
          ...prev.activityLog,
        ],
      };
    });
  }, [user]);

  const changeRole = useCallback((roomId: string, userId: string, role: RoomRole) => {
    setCurrentRoom(prev => {
      if (!prev || prev.id !== roomId) return prev;
      const changed = prev.participants.find(p => p.userId === userId);
      return {
        ...prev,
        participants: prev.participants.map(p =>
          p.userId === userId ? { ...p, role } : p
        ),
        activityLog: [
          { id: seededId(), userId: user?.id || '', userName: user?.fullName || '', action: 'role_changed', detail: `${changed?.fullName} role changed to ${role}`, timestamp: new Date().toISOString() },
          ...prev.activityLog,
        ],
      };
    });
  }, [user]);

  // ── Raise Hand ──
  const toggleRaiseHand = useCallback((roomId: string) => {
    if (!user) return;
    setCurrentRoom(prev => {
      if (!prev) return prev;
      const p = prev.participants.find(p => p.userId === user.id);
      const wasRaised = p?.handRaised;
      return {
        ...prev,
        participants: prev.participants.map(p =>
          p.userId === user.id ? { ...p, handRaised: !wasRaised } : p
        ),
        activityLog: [
          { id: seededId(), userId: user.id, userName: user.fullName || '', action: wasRaised ? 'hand_lowered' : 'hand_raised', detail: wasRaised ? `${user.fullName} lowered their hand` : `✋ ${user.fullName} raised their hand`, timestamp: new Date().toISOString() },
          ...prev.activityLog,
        ],
      };
    });
  }, [user]);

  // ── Presentation ──
  const setPresenterTab = useCallback((tab: string) => {
    if (!user || !currentRoom) return;
    setCurrentRoom(prev => prev ? { ...prev, presenterTab: tab } : prev);
    // Broadcast to supabase realtime for followers
    supabase.channel(`room:${currentRoom.id}`).send({
      type: 'broadcast',
      event: 'presenter_tab_change',
      payload: { tab, presenterId: user.id },
    }).then(() => {}, () => {});
  }, [user, currentRoom]);

  const startPresenting = useCallback(() => {
    if (!user) return;
    setCurrentRoom(prev => {
      if (!prev) return prev;
      // Set all participants to follow mode
      return {
        ...prev,
        presentationState: 'presenting',
        presenterId: user.id,
        presenterName: user.fullName || 'Someone',
        participants: prev.participants.map(p => ({
          ...p,
          followMode: true,
        })),
        activityLog: [
          { id: seededId(), userId: user.id, userName: user.fullName || '', action: 'presentation_started', detail: `${user.fullName} is presenting the Live Planner`, timestamp: new Date().toISOString() },
          ...prev.activityLog,
        ],
      };
    });
  }, [user]);

  const stopPresenting = useCallback(() => {
    if (!user) return;
    setCurrentRoom(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        presentationState: 'idle',
        presenterId: null,
        presenterName: null,
        participants: prev.participants.map(p => ({ ...p, followMode: false })),
        activityLog: [
          { id: seededId(), userId: user.id, userName: user.fullName || '', action: 'presentation_ended', detail: 'Presentation ended', timestamp: new Date().toISOString() },
          ...prev.activityLog,
        ],
      };
    });
  }, [user]);

  const requestControl = useCallback(() => {
    if (!user || !currentRoom) return;
    controlRequestsRef.current.add(user.id);
    setCurrentRoom(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        activityLog: [
          { id: seededId(), userId: user.id, userName: user.fullName || '', action: 'control_requested', detail: `${user.fullName} requested presentation control`, timestamp: new Date().toISOString() },
          ...prev.activityLog,
        ],
      };
    });
  }, [user, currentRoom]);

  const giveControl = useCallback((userId: string) => {
    if (!currentRoom) return;
    const target = currentRoom.participants.find(p => p.userId === userId);
    setCurrentRoom(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        presenterId: userId,
        presenterName: target?.fullName || 'Someone',
        activityLog: [
          { id: seededId(), userId: user?.id || '', userName: user?.fullName || '', action: 'control_given', detail: `Control given to ${target?.fullName}`, timestamp: new Date().toISOString() },
          ...prev.activityLog,
        ],
      };
    });
  }, [user, currentRoom]);

  const takeBackControl = useCallback(() => {
    if (!user) return;
    setCurrentRoom(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        presenterId: user.id,
        presenterName: user.fullName || 'Someone',
        activityLog: [
          { id: seededId(), userId: user.id, userName: user.fullName || '', action: 'control_taken', detail: `${user.fullName} took back control`, timestamp: new Date().toISOString() },
          ...prev.activityLog,
        ],
      };
    });
  }, [user]);

  const approveControlRequest = useCallback((userId: string) => {
    if (!currentRoom) return;
    controlRequestsRef.current.delete(userId);
    giveControl(userId);
  }, [currentRoom, giveControl]);

  const lockPresentationToHost = useCallback(() => {
    if (!currentRoom || !user) return;
    setCurrentRoom(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        presenterId: user.id,
        presenterName: user.fullName || 'Someone',
        activityLog: [
          { id: seededId(), userId: user.id, userName: user.fullName || '', action: 'presentation_locked', detail: 'Presentation locked to hosts only', timestamp: new Date().toISOString() },
          ...prev.activityLog,
        ],
      };
    });
  }, [user, currentRoom]);

  // ── Follow mode ──
  const enterFollowMode = useCallback(() => {
    if (!user) return;
    setCurrentRoom(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        participants: prev.participants.map(p =>
          p.userId === user.id ? { ...p, followMode: true } : p
        ),
      };
    });
  }, [user]);

  const leaveFollowMode = useCallback(() => {
    if (!user) return;
    setCurrentRoom(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        participants: prev.participants.map(p =>
          p.userId === user.id ? { ...p, followMode: false } : p
        ),
      };
    });
  }, [user]);

  const returnToLivePresentation = useCallback(() => {
    enterFollowMode();
  }, [enterFollowMode]);

  // ── Activity ──
  const addActivity = useCallback((action: string, detail: string) => {
    if (!user) return;
    setCurrentRoom(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        activityLog: [
          { id: seededId(), userId: user.id, userName: user.fullName || '', action, detail, timestamp: new Date().toISOString() },
          ...prev.activityLog.slice(0, 99),
        ],
      };
    });
  }, [user]);

  const setEditIndicator = useCallback((section: string) => {
    if (!user) return;
    setCurrentRoom(prev => {
      if (!prev) return prev;
      const filtered = prev.editIndicators.filter(e => !(e.userId === user.id && e.section === section));
      return {
        ...prev,
        editIndicators: [
          { userId: user.id, userName: user.fullName || '', section, startedAt: new Date().toISOString() },
          ...filtered,
        ],
      };
    });
  }, [user]);

  const clearEditIndicator = useCallback((section: string) => {
    if (!user) return;
    setCurrentRoom(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        editIndicators: prev.editIndicators.filter(
          e => !(e.userId === user.id && e.section === section)
        ),
      };
    });
  }, [user]);

  // ── Persist activity to Supabase room_history ──
  const syncActivityToSupabase = useCallback((entry: ActivityEntry) => {
    try {
      supabase.from('room_history').insert({
        room_id: currentRoom?.id,
        user_id: entry.userId,
        user_name: entry.userName,
        action: entry.action,
        detail: entry.detail,
        metadata: JSON.stringify({ timestamp: entry.timestamp }),
      }).then(() => {}).then(() => {}, () => {});
    } catch {}
  }, [currentRoom?.id]);

  // ── Auto-sync activity log to Supabase ──
  useEffect(() => {
    if (!currentRoom?.activityLog.length) return;
    const latest = currentRoom.activityLog[0];
    syncActivityToSupabase(latest);
  }, [currentRoom?.activityLog[0]?.id]);

  // Derived: presenter's current tab (for context consumers + followers)
  const presenterTab = currentRoom?.presenterTab ?? null;

  const value: RoomContextValue = {
    rooms, currentRoom, isLoading,
    fetchRooms, createRoom, joinRoom, leaveRoom, isInRoom,
    goLive, endLive, deleteRoom, generateInviteLink,
    startSpeaking, stopSpeaking, toggleCamera,
    toggleRaiseHand,
    muteParticipant, unmuteParticipant, muteAllExceptHosts, toggleOpenDiscussion,
    removeParticipant, changeRole,
    startPresenting, stopPresenting,
    setPresenterTab, presenterTab,
    requestControl, giveControl,
    takeBackControl, approveControlRequest, lockPresentationToHost,
    enterFollowMode, leaveFollowMode, returnToLivePresentation,
    addActivity, setEditIndicator, clearEditIndicator,
    canEdit, canSpeak, isHost, isCoHostOrAbove, getUserRole,
    viewMode, setViewMode,
    syncActivityToSupabase,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

// ── Supabase DB mapper ──
function mapFromDB(data: any): LiveRoom {
  return {
    id: data.id,
    name: data.name,
    topic: data.topic || '',
    goal: data.goal || '',
    category: data.category || 'General',
    visibility: data.visibility || 'public',
    maxParticipants: data.max_participants || 25,
    scheduledDate: data.scheduled_date || null,
    coverImage: data.cover_image || null,
    creatorId: data.creator_id,
    creatorName: data.creator_name,
    creatorAvatar: data.creator_avatar,
    participants: typeof data.participants === 'string'
      ? JSON.parse(data.participants)
      : data.participants || [],
    created_at: data.created_at,
    status: data.status || 'draft',
    inviteLink: data.invite_link || null,
    presentationState: data.presentation_state || 'idle',
    presenterId: data.presenter_id || null,
    presenterName: data.presenter_name || null,
    presenterTab: data.presenter_tab || undefined,
    openDiscussion: data.open_discussion !== false,
    activityLog: data.activity_log || [],
    editIndicators: data.edit_indicators || [],
  };
}
