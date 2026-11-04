/**
 * Undo / Redo for a Spot room — your own actions: adding stickers, notes,
 * photos and doodles, deleting things, moving, resizing and editing them.
 *
 * Undoing a delete puts the thing back (as a fresh copy for everyone);
 * Redo does the action again. Doing something new clears Redo, like any editor.
 */
import { useCallback, useRef, useState } from 'react';
import type { SpotItem } from '@/lib/spot';

type Pos = { x: number; y: number; z: number };
type Action =
  | { t: 'add'; id: string; data: SpotItem }
  | { t: 'remove'; id: string; data: SpotItem }
  | { t: 'move'; id: string; from: Pos; to: Pos }
  | { t: 'resize'; id: string; from: number; to: number }
  | { t: 'edit'; id: string; from: string; to: string };

interface RoomApi {
  items: SpotItem[];
  add: (input: any) => Promise<SpotItem | null>;
  remove: (id: string) => Promise<boolean>;
  dragTo: (id: string, x: number, y: number, z: number) => void;
  dropAt: (id: string, x: number, y: number, z: number) => Promise<void>;
  resize: (id: string, scale: number) => Promise<void>;
  editText: (id: string, text: string) => Promise<void>;
}

const LIMIT = 50;

function addInput(it: SpotItem) {
  const { kind, x, y, emoji, text, color, imageUrl, points, width, cutout, aspect, bare } = it;
  return { kind, x, y, emoji, text, color, imageUrl, points, width, cutout, aspect, bare };
}

export function useSpotHistory(room: RoomApi) {
  const undoStack = useRef<Action[]>([]);
  const redoStack = useRef<Action[]>([]);
  const [, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);
  const busy = useRef(false);
  const roomRef = useRef(room);
  roomRef.current = room;

  /** A thing came back with a new id: point every saved step at the new one. */
  const renameId = (oldId: string, newId: string) => {
    for (const st of [undoStack.current, redoStack.current]) {
      for (const a of st) if (a.id === oldId) a.id = newId;
    }
  };

  const record = useCallback((a: Action) => {
    undoStack.current.push(a);
    if (undoStack.current.length > LIMIT) undoStack.current.shift();
    redoStack.current = [];
    bump();
  }, []);

  /** Put a removed thing back (with its size), returning its new id. */
  const restore = async (data: SpotItem): Promise<string | null> => {
    const r = roomRef.current;
    const it = await r.add(addInput(data));
    if (!it) return null;
    if (data.scale && Math.abs(data.scale - 1) > 0.01) await r.resize(it.id, data.scale);
    return it.id;
  };

  const apply = async (a: Action, dir: 'undo' | 'redo'): Promise<boolean> => {
    const r = roomRef.current;
    const goBack = dir === 'undo';
    switch (a.t) {
      case 'add':
      case 'remove': {
        // "add" undone = remove it; "remove" undone = put it back. Redo flips that.
        const shouldExist = (a.t === 'add') !== goBack;
        if (shouldExist) {
          const newId = await restore(a.data);
          if (!newId) return false;
          renameId(a.id, newId);
          return true;
        }
        return r.remove(a.id);
      }
      case 'move': {
        const p = goBack ? a.from : a.to;
        r.dragTo(a.id, p.x, p.y, p.z);
        await r.dropAt(a.id, p.x, p.y, p.z);
        return true;
      }
      case 'resize':
        await r.resize(a.id, goBack ? a.from : a.to);
        return true;
      case 'edit':
        await r.editText(a.id, goBack ? a.from : a.to);
        return true;
    }
  };

  const step = async (dir: 'undo' | 'redo') => {
    if (busy.current) return;
    const from = dir === 'undo' ? undoStack.current : redoStack.current;
    const to = dir === 'undo' ? redoStack.current : undoStack.current;
    const a = from.pop();
    if (!a) return;
    busy.current = true;
    bump();
    try {
      const exists = roomRef.current.items.some((i) => i.id === a.id);
      // Someone else already deleted it: skip steps that need it.
      if (!exists && a.t !== 'remove' && !(a.t === 'add' && dir === 'redo')) return;
      if (await apply(a, dir)) to.push(a);
    } finally {
      busy.current = false;
      bump();
    }
  };

  return {
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    undo: () => step('undo'),
    redo: () => step('redo'),
    recordAdd: (it: SpotItem | null) => { if (it) record({ t: 'add', id: it.id, data: it }); },
    recordRemove: (it: SpotItem) => record({ t: 'remove', id: it.id, data: it }),
    recordMove: (id: string, from: Pos, to: Pos) => {
      if (Math.abs(from.x - to.x) + Math.abs(from.y - to.y) < 0.002) return;
      record({ t: 'move', id, from, to });
    },
    recordResize: (id: string, from: number, to: number) => { if (from !== to) record({ t: 'resize', id, from, to }); },
    recordEdit: (id: string, from: string, to: string) => { if (from !== to) record({ t: 'edit', id, from, to }); },
  };
}
