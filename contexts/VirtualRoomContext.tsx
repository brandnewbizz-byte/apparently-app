import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import {
  VirtualObject,
  VirtualEnvironment,
  VirtualRoomState,
  EnvironmentType,
  ObjectType,
  DEFAULT_OBJECT_SIZE,
} from '@/types/virtual-room';
import { supabase } from '@/lib/supabase';
import { uploadImageToStorage } from '@/lib/storage';
import { isLocalFileUri } from '@/lib/media';
import { logger } from '@/lib/logger';
import { uuid } from '@/lib/uuid';

// ── In-memory cache so re-entering a room is instant; Supabase
// (virtual_room_objects) is the shared source of truth. ──
const localStore: Record<string, VirtualRoomState> = {};

function mapRowToObject(r: any): VirtualObject {
  return {
    id: r.id,
    roomId: r.room_id,
    objectType: r.object_type,
    name: r.name || '',
    description: r.description || '',
    notes: r.notes || '',
    imageUrl: r.image_url || undefined,
    x: Number(r.position_x) || 0,
    y: Number(r.position_y) || 0,
    width: Number(r.width) || 100,
    height: Number(r.height) || 100,
    rotation: Number(r.rotation) || 0,
    scale: Number(r.scale) || 1,
    zIndex: Number(r.z_index) || 0,
    ownerId: r.owner_id || undefined,
    ownerName: r.owner_name || undefined,
    metadata: r.metadata || {},
    price: r.price != null ? Number(r.price) : undefined,
    isListed: !!r.is_listed,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapObjectToRow(o: VirtualObject) {
  return {
    id: o.id,
    room_id: o.roomId,
    object_type: o.objectType,
    name: o.name,
    description: o.description,
    notes: o.notes,
    // Never persist a device-local file path — other people can't load it.
    image_url: o.imageUrl && !isLocalFileUri(o.imageUrl) ? o.imageUrl : null,
    position_x: o.x,
    position_y: o.y,
    width: o.width,
    height: o.height,
    rotation: o.rotation,
    scale: o.scale,
    z_index: o.zIndex,
    owner_id: o.ownerId || null,
    owner_name: o.ownerName || null,
    metadata: o.metadata || {},
    price: o.price ?? null,
    is_listed: o.isListed ?? false,
    updated_at: o.updatedAt,
  };
}

interface VirtualRoomContextValue extends VirtualRoomState {
  // Environment
  setEnvironment: (type: EnvironmentType) => void;
  updateEnvironment: (updates: Partial<VirtualEnvironment>) => void;
  // Camera
  setCamera: (x: number, y: number, scale: number) => void;
  resetCamera: () => void;
  // Objects
  addObject: (
    type: ObjectType,
    x: number,
    y: number,
    imageUrl?: string,
    name?: string,
  ) => VirtualObject;
  updateObject: (id: string, updates: Partial<VirtualObject>) => void;
  removeObject: (id: string) => void;
  selectObject: (id: string | null) => void;
  selectedObject: VirtualObject | null;
  moveObjectToTop: (id: string) => void;
  // Upload
  uploadImage: (uri: string, name: string) => Promise<VirtualObject | null>;
  // Sync
  loadRoom: (roomId: string) => void;
  saveState: () => void;
}

const VirtualRoomContext = createContext<VirtualRoomContextValue | null>(null);

// virtual_room_objects.id is a UUID column.
function genId(): string {
  return uuid();
}

function genEnvId(): string {
  return `venv_${Date.now()}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

export function VirtualRoomProvider({
  roomId,
  userId,
  userName,
  initialEnvironment,
  children,
}: {
  roomId: string;
  userId?: string;
  userName?: string;
  initialEnvironment?: EnvironmentType;
  children: ReactNode;
}) {
  const [state, setState] = useState<VirtualRoomState>({
    environment: null,
    objects: [],
    cameraX: 0,
    cameraY: 0,
    cameraScale: 1,
    selectedObjectId: null,
    isLoading: true,
    isSaving: false,
  });

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const stateRef = useRef(state);
  stateRef.current = state;
  // Objects deleted since the last save (so the DB rows get removed too).
  const removedIdsRef = useRef<Set<string>>(new Set());

  const persistToSupabase = useCallback(async (snapshot: VirtualRoomState) => {
    const rid = roomIdRef.current;
    const removed = Array.from(removedIdsRef.current);
    removedIdsRef.current = new Set();
    try {
      if (snapshot.objects.length) {
        const { error } = await supabase
          .from('virtual_room_objects')
          .upsert(snapshot.objects.map(mapObjectToRow), { onConflict: 'id' });
        if (error) logger.warn('VirtualRoom', 'Saving objects failed', { message: error.message });
      }
      if (removed.length) {
        const { error } = await supabase.from('virtual_room_objects').delete().in('id', removed);
        if (error) logger.warn('VirtualRoom', 'Deleting objects failed', { message: error.message });
      }
      if (snapshot.environment) {
        await supabase.from('rooms').update({ environment: snapshot.environment.environmentType }).eq('id', rid);
      }
    } catch (e: any) {
      logger.warn('VirtualRoom', 'Persist failed', { message: e?.message });
    }
  }, []);

  // ── Load room state (local for now, Supabase realtime later) ──
  const loadRoom = useCallback((rid: string) => {
    const existing = localStore[rid];
    if (existing) {
      setState({ ...existing, isLoading: false, isSaving: false });
    } else if (initialEnvironment) {
      const newState: VirtualRoomState = {
        environment: {
          id: genEnvId(),
          roomId: rid,
          environmentType: initialEnvironment,
          backgroundColor: '#F0F0F0',
          cameraX: 0,
          cameraY: 0,
          cameraScale: 1,
          createdAt: nowISO(),
          updatedAt: nowISO(),
        },
        objects: [],
        cameraX: 0,
        cameraY: 0,
        cameraScale: 1,
        selectedObjectId: null,
        isLoading: false,
        isSaving: false,
      };
      localStore[rid] = newState;
      setState(newState);
    } else {
      setState(s => ({ ...s, isLoading: false }));
    }

    // Pull the shared layout so everyone in the room sees the same objects.
    supabase
      .from('virtual_room_objects')
      .select('*')
      .eq('room_id', rid)
      .order('z_index', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          logger.warn('VirtualRoom', 'Loading objects failed', { message: error.message });
          return;
        }
        if (roomIdRef.current !== rid || !data) return;
        const remoteObjects = data.map(mapRowToObject);
        setState(s => {
          const next = { ...s, objects: remoteObjects, isLoading: false };
          localStore[rid] = next;
          return next;
        });
      });
  }, [initialEnvironment]);

  // ── Autosave (debounced 2s) ──
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const snapshot: VirtualRoomState = { ...stateRef.current, isLoading: false, isSaving: false };
      localStore[roomIdRef.current] = snapshot;
      setState(s => ({ ...s, isSaving: false }));
      persistToSupabase(snapshot);
    }, 2000);
    setState(s => ({ ...s, isSaving: true }));
  }, [persistToSupabase]);

  const saveState = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const snapshot: VirtualRoomState = { ...stateRef.current, isLoading: false, isSaving: false };
    localStore[roomIdRef.current] = snapshot;
    setState(snapshot);
    persistToSupabase(snapshot);
  }, [persistToSupabase]);

  // ── Environment ──
  const setEnvironment = useCallback(
    (type: EnvironmentType) => {
      setState(s => ({
        ...s,
        environment: {
          id: genEnvId(),
          roomId: roomIdRef.current,
          environmentType: type,
          backgroundColor: '#F0F0F0',
          cameraX: 0,
          cameraY: 0,
          cameraScale: 1,
          createdAt: nowISO(),
          updatedAt: nowISO(),
        },
      }));
      scheduleSave();
    },
    [scheduleSave],
  );

  const updateEnvironment = useCallback(
    (updates: Partial<VirtualEnvironment>) => {
      setState(s => ({
        ...s,
        environment: s.environment
          ? { ...s.environment, ...updates, updatedAt: nowISO() }
          : null,
      }));
      scheduleSave();
    },
    [scheduleSave],
  );

  // ── Camera ──
  const setCamera = useCallback(
    (x: number, y: number, scale: number) => {
      setState(s => ({ ...s, cameraX: x, cameraY: y, cameraScale: scale }));
    },
    [],
  );

  const resetCamera = useCallback(() => {
    setState(s => ({ ...s, cameraX: 0, cameraY: 0, cameraScale: 1 }));
  }, []);

  // ── Objects ──
  const addObject = useCallback(
    (type: ObjectType, x: number, y: number, imageUrl?: string, name?: string): VirtualObject => {
      const defaults = DEFAULT_OBJECT_SIZE[type] || { w: 100, h: 100 };
      const obj: VirtualObject = {
        id: genId(),
        roomId: roomIdRef.current,
        objectType: type,
        name: name || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description: '',
        notes: '',
        imageUrl,
        x: x - defaults.w / 2,
        y: y - defaults.h / 2,
        width: defaults.w,
        height: defaults.h,
        rotation: 0,
        scale: 1,
        zIndex: (state.objects.length + 1) * 10,
        ownerId: userId,
        ownerName: userName,
        metadata: {},
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };
      setState(s => ({ ...s, objects: [...s.objects, obj], selectedObjectId: obj.id }));
      scheduleSave();
      return obj;
    },
    [userId, userName, state.objects.length, scheduleSave],
  );

  const updateObject = useCallback(
    (id: string, updates: Partial<VirtualObject>) => {
      setState(s => ({
        ...s,
        objects: s.objects.map(o =>
          o.id === id ? { ...o, ...updates, updatedAt: nowISO() } : o,
        ),
      }));
      scheduleSave();
    },
    [scheduleSave],
  );

  const removeObject = useCallback(
    (id: string) => {
      removedIdsRef.current.add(id);
      setState(s => ({
        ...s,
        objects: s.objects.filter(o => o.id !== id),
        selectedObjectId: s.selectedObjectId === id ? null : s.selectedObjectId,
      }));
      scheduleSave();
    },
    [scheduleSave],
  );

  const selectObject = useCallback((id: string | null) => {
    setState(s => ({ ...s, selectedObjectId: id }));
  }, []);

  const selectedObject =
    state.objects.find(o => o.id === state.selectedObjectId) ?? null;

  const moveObjectToTop = useCallback(
    (id: string) => {
      setState(s => {
        const maxZ = Math.max(...s.objects.map(o => o.zIndex), 0);
        return {
          ...s,
          objects: s.objects.map(o =>
            o.id === id ? { ...o, zIndex: maxZ + 10 } : o,
          ),
        };
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  // ── Image Upload ──
  const uploadImage = useCallback(
    async (uri: string, name: string): Promise<VirtualObject | null> => {
      // Upload first so other participants can load the image.
      const hosted = isLocalFileUri(uri)
        ? await uploadImageToStorage(uri, 'user-media', `rooms/${roomIdRef.current}`)
        : uri;
      const obj = addObject('image', 150, 150, hosted, name);
      return obj;
    },
    [addObject],
  );

  // ── Load on mount ──
  useEffect(() => {
    loadRoom(roomId);
  }, [roomId, loadRoom]);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const value: VirtualRoomContextValue = {
    ...state,
    selectedObject,
    setEnvironment,
    updateEnvironment,
    setCamera,
    resetCamera,
    addObject,
    updateObject,
    removeObject,
    selectObject,
    moveObjectToTop,
    uploadImage,
    loadRoom,
    saveState,
  };

  return (
    <VirtualRoomContext.Provider value={value}>
      {children}
    </VirtualRoomContext.Provider>
  );
}

export function useVirtualRoom(): VirtualRoomContextValue {
  const ctx = useContext(VirtualRoomContext);
  if (!ctx) {
    throw new Error('useVirtualRoom must be used within VirtualRoomProvider');
  }
  return ctx;
}
