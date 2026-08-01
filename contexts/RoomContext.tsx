import React, {
  createContext, useContext, useState, useCallback, useEffect, useRef,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// ── Types ──
export interface LiveRoom {
  id: string;
  name: string;
  topic: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string | null;
  participants: RoomParticipant[];
  created_at: string;
  isLocal?: boolean;
}

export interface RoomParticipant {
  userId: string;
  fullName: string;
  avatar: string | null;
  isSpeaking: boolean;
  hasCamera: boolean;
}

interface RoomContextValue {
  rooms: LiveRoom[];
  currentRoom: LiveRoom | null;
  isLoading: boolean;
  fetchRooms: () => Promise<void>;
  createRoom: (name: string, topic: string) => Promise<LiveRoom | null>;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  isInRoom: (roomId: string) => boolean;
  startSpeaking: (roomId: string) => void;
  stopSpeaking: (roomId: string) => void;
  toggleCamera: (roomId: string) => void;
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
  const channelRef = useRef<any>(null);
  const isTableReady = useRef(false);

  // ── Init: check tables ──
  useEffect(() => {
    async function check() {
      try {
        const { error } = await supabase.from('rooms').select('id').limit(1);
        isTableReady.current = !error;
      } catch {
        isTableReady.current = false;
      }
    }
    check();
  }, []);

  // ── Fetch active rooms ──
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
          return;
        }
      }
      // Fallback: keep whatever is in local state
    } catch {
      // silent
    }
    setIsLoading(false);
  }, []);

  // ── Create room ──
  const createRoom = useCallback(async (name: string, topic: string) => {
    const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newRoom: LiveRoom = {
      id: roomId,
      name,
      topic,
      creatorId: user?.id || '',
      creatorName: user?.fullName || 'Anonymous',
      creatorAvatar: user?.avatar || null,
      participants: [{
        userId: user?.id || '',
        fullName: user?.fullName || 'Anonymous',
        avatar: user?.avatar || null,
        isSpeaking: false,
        hasCamera: false,
      }],
      created_at: new Date().toISOString(),
      isLocal: true,
    };

    if (isTableReady.current && user?.id) {
      try {
        const { data, error } = await supabase
          .from('rooms')
          .insert({
            id: roomId,
            name,
            topic,
            creator_id: user.id,
            creator_name: user.fullName,
            creator_avatar: user.avatar,
            participants: JSON.stringify(newRoom.participants),
          })
          .select()
          .single();
        if (!error && data) {
          const saved: LiveRoom = {
            id: data.id,
            name: data.name,
            topic: data.topic || '',
            creatorId: data.creator_id,
            creatorName: data.creator_name,
            creatorAvatar: data.creator_avatar,
            participants: typeof data.participants === 'string'
              ? JSON.parse(data.participants)
              : data.participants || [],
            created_at: data.created_at,
          };
          setRooms((prev) => [saved, ...prev]);
          return saved;
        }
      } catch {
        // fall through to local
      }
    }

    // Local fallback
    setRooms((prev) => [newRoom, ...prev]);
    return newRoom;
  }, [user]);

  // ── Join room ──
  const joinRoom = useCallback((roomId: string) => {
    setRooms((prev) => {
      const updated = prev.find((r) => r.id === roomId);
      if (!updated || !user) return prev;
      const already = updated.participants.some((p) => p.userId === user.id);
      if (already) {
        setCurrentRoom(updated);
        return prev;
      }
      const withUser: LiveRoom = {
        ...updated,
        participants: [
          ...updated.participants,
          {
            userId: user.id,
            fullName: user.fullName || 'Anonymous',
            avatar: user.avatar || null,
            isSpeaking: false,
            hasCamera: false,
          },
        ],
      };
      setCurrentRoom(withUser);
      return prev.map((r) => (r.id === roomId ? withUser : r));
    });

    // Supabase Realtime unsubscribe happens on leaveRoom
  }, [user]);

  const leaveRoom = useCallback((roomId: string) => {
    setCurrentRoom(null);
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== roomId || !user) return r;
        return {
          ...r,
          participants: r.participants.filter((p) => p.userId !== user.id),
        };
      }),
    );
  }, [user]);

  const isInRoom = useCallback((roomId: string) => {
    return currentRoom?.id === roomId;
  }, [currentRoom]);

  // ── Push-to-talk ──
  const startSpeaking = useCallback((roomId: string) => {
    setCurrentRoom((prev) => {
      if (!prev || prev.id !== roomId || !user) return prev;
      return {
        ...prev,
        participants: prev.participants.map((p) =>
          p.userId === user.id ? { ...p, isSpeaking: true } : p,
        ),
      };
    });
  }, [user]);

  const stopSpeaking = useCallback((roomId: string) => {
    setCurrentRoom((prev) => {
      if (!prev || prev.id !== roomId || !user) return prev;
      return {
        ...prev,
        participants: prev.participants.map((p) =>
          p.userId === user.id ? { ...p, isSpeaking: false } : p,
        ),
      };
    });
  }, [user]);

  // ── Camera toggle ──
  const toggleCamera = useCallback((roomId: string) => {
    setCurrentRoom((prev) => {
      if (!prev || prev.id !== roomId || !user) return prev;
      return {
        ...prev,
        participants: prev.participants.map((p) =>
          p.userId === user.id ? { ...p, hasCamera: !p.hasCamera } : p,
        ),
      };
    });
  }, [user]);

  const value: RoomContextValue = {
    rooms,
    currentRoom,
    isLoading,
    fetchRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    isInRoom,
    startSpeaking,
    stopSpeaking,
    toggleCamera,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}
