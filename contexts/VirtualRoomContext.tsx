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

// ── In-memory store (replaces Supabase until migration applied) ──
const localStore: Record<string, VirtualRoomState> = {};

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

let _nextId = 1;
function genId(): string {
  return `vobj_${Date.now()}_${_nextId++}`;
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
  }, [initialEnvironment]);

  // ── Autosave (debounced 2s) ──
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      setState(s => {
        const snapshot: VirtualRoomState = {
          ...s,
          isLoading: false,
          isSaving: false,
        };
        localStore[roomIdRef.current] = snapshot;
        // TODO: persist to Supabase when migration applied
        return { ...s, isSaving: false };
      });
    }, 2000);
    setState(s => ({ ...s, isSaving: true }));
  }, []);

  const saveState = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setState(s => {
      const snapshot: VirtualRoomState = { ...s, isLoading: false, isSaving: false };
      localStore[roomIdRef.current] = snapshot;
      return snapshot;
    });
  }, []);

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
    },
    [],
  );

  // ── Image Upload ──
  const uploadImage = useCallback(
    async (uri: string, name: string): Promise<VirtualObject | null> => {
      // In-memory: use local URI directly
      const obj = addObject('image', 150, 150, uri, name);
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
