import React, {
  createContext, useContext, useState, useCallback, useRef, useEffect,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Platform, Alert } from 'react-native';

// ── Types ──
export type PlanStage = 'idea' | 'build' | 'assign' | 'launch';
export type TaskStatus = 'not_started' | 'in_progress' | 'waiting' | 'needs_review' | 'completed';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type RoomRole = 'host' | 'co_host' | 'editor' | 'contributor' | 'viewer';
export type RoomVisibility = 'public' | 'private' | 'invite_only';

export interface PlanMember {
  userId: string; fullName: string; avatar: string | null; role: RoomRole;
}

export interface PlanSection {
  id: string; title: string; description: string; progress: number;
  members: string[]; createdAt: string;
}

export interface TaskItem {
  id: string; title: string; description: string; assignedTo: string | null;
  priority: Priority; dueDate: string | null; status: TaskStatus;
  checklist: { id: string; text: string; done: boolean }[];
  attachments: FileRef[]; comments: Comment[]; sectionId: string | null;
  createdAt: string;
}

export interface IdeaCard {
  id: string; type: 'idea' | 'note' | 'image' | 'link' | 'voice' | 'drawing' | 'question' | 'inspiration';
  title: string; content: string; authorId: string; authorName: string;
  votes: string[]; reactions: { emoji: string; userIds: string[] }[];
  comments: Comment[]; attachments: FileRef[];
  convertedToTaskId: string | null; createdAt: string;
}

export interface BudgetItem {
  id: string; name: string; category: string; estimatedCost: number;
  actualCost: number; supplier: string; paymentStatus: 'pending' | 'paid' | 'overdue';
  responsibleId: string | null; createdAt: string;
}

export interface TimelineItem {
  id: string; type: 'stage' | 'task' | 'milestone' | 'deadline' | 'meeting' | 'launch';
  title: string; date: string; description: string; completed: boolean;
}

export interface VoteItem {
  id: string; question: string; options: { text: string; count: number }[];
  deadline: string | null; winnerId: string | null; decided: boolean;
  decidedResult: string | null; createdAt: string;
}

export interface FileRef {
  id: string; name: string; type: string; url: string; sizeBytes: number;
  uploadedBy: string; uploadedAt: string;
  attachedTo: { type: 'section' | 'task' | 'idea'; id: string };
}

interface Comment { id: string; text: string; authorId: string; authorName: string; createdAt: string; }

export interface PlanData {
  id: string;
  roomId: string;
  title: string;
  goal: string;
  description: string;
  projectType: string;
  startDate: string | null;
  targetDate: string | null;
  stage: PlanStage;
  progress: number;
  ownerId: string;
  members: PlanMember[];
  sections: PlanSection[];
  tasks: TaskItem[];
  ideas: IdeaCard[];
  budget: { total: number; plannedCost: number; actualCost: number; remaining: number; expectedRevenue: number; expectedProfit: number; items: BudgetItem[] };
  timeline: TimelineItem[];
  files: FileRef[];
  storageUsedBytes: number;
  votes: VoteItem[];
  createdAt: string;
  updatedAt: string;
}

export type PlanViewMode = 'browse' | 'presenting';

export interface PlanVersion {
  id: string; planId: string; version: number;
  editedBy: string; editedByName: string;
  createdAt: string;
}

interface PlanContextValue {
  plan: PlanData | null;
  isLoading: boolean;
  isSyncing: boolean;
  isSaving: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  viewMode: PlanViewMode;
  setViewMode: (mode: PlanViewMode) => void;
  lastSavedVersion: number;
  versions: PlanVersion[];
  createPlan: (roomId: string, data: Partial<PlanData>) => Promise<void>;
  loadPlan: (roomId: string) => Promise<void>;
  loadVersions: () => Promise<void>;
  rollbackToVersion: (versionId: string) => Promise<void>;
  updatePlan: (updates: Partial<PlanData>) => void;
  saveNow: (summary?: string) => Promise<void>;
  // Tasks
  addTask: (task: Partial<TaskItem>) => void;
  updateTask: (taskId: string, updates: Partial<TaskItem>) => void;
  deleteTask: (taskId: string) => void;
  // Ideas
  addIdea: (idea: Partial<IdeaCard>) => void;
  updateIdea: (ideaId: string, updates: Partial<IdeaCard>) => void;
  voteIdea: (ideaId: string) => void;
  reactToIdea: (ideaId: string, emoji: string) => void;
  convertIdeaToTask: (ideaId: string) => void;
  deleteIdea: (ideaId: string) => void;
  // Budget
  addBudgetItem: (item: Partial<BudgetItem>) => void;
  updateBudgetItem: (itemId: string, updates: Partial<BudgetItem>) => void;
  deleteBudgetItem: (itemId: string) => void;
  // Vote
  addVote: (vote: Partial<VoteItem>) => void;
  castVote: (voteId: string, optionIndex: number) => void;
  decideVote: (voteId: string, result: string) => void;
  // Files
  addFile: (file: Partial<FileRef>) => void;
  deleteFile: (fileId: string) => void;
  uploadFile: (uri: string, name: string, mimeType: string, type: string) => Promise<boolean>;
  storageUsedBytes: number;
  storageLimit: number;
  // Sections
  addSection: (section: Partial<PlanSection>) => void;
  updateSection: (sectionId: string, updates: Partial<PlanSection>) => void;
  // Timeline
  addTimelineItem: (item: Partial<TimelineItem>) => void;
  updateTimelineItem: (itemId: string, updates: Partial<TimelineItem>) => void;
}

const PlanContext = createContext<PlanContextValue | undefined>(undefined);

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be inside PlanProvider');
  return ctx;
}

let nextId = () => `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

function defaultPlan(roomId: string, ownerId?: string): PlanData {
  return {
    id: nextId(), roomId, title: '', goal: '', description: '', projectType: '',
    startDate: null, targetDate: null, stage: 'idea', progress: 0, ownerId: ownerId || '',
    members: [], sections: [], tasks: [], ideas: [],
    budget: { total: 0, plannedCost: 0, actualCost: 0, remaining: 0, expectedRevenue: 0, expectedProfit: 0, items: [] },
    timeline: [], files: [], storageUsedBytes: 0, votes: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

function recalcProgress(plan: PlanData): number {
  const totalTasks = plan.tasks.length;
  if (totalTasks === 0) return plan.stage === 'launch' ? 100 : 0;
  const done = plan.tasks.filter(t => t.status === 'completed').length;
  return Math.round((done / totalTasks) * 100);
}

function stageFromProgress(pct: number): PlanStage {
  if (pct >= 90) return 'launch';
  if (pct >= 60) return 'assign';
  if (pct >= 20) return 'build';
  return 'idea';
}

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [viewMode, setViewMode] = useState<PlanViewMode>('browse');
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveVersionRef = useRef(0);

  // ── Realtime subscription ──
  useEffect(() => {
    if (!plan?.roomId) return;
    const channel = supabase
      .channel(`plan-realtime-${plan.roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'plans',
        filter: `room_id=eq.${plan.roomId}`,
      }, (payload: any) => {
        const remote = payload.new?.data;
        if (!remote) return;
        const parsed = typeof remote === 'string' ? JSON.parse(remote) : remote;
        // Don't overwrite if we're the ones who made the change
        if (parsed.id !== plan?.id) return;
        setPlan(prev => {
          if (!prev) return prev;
          // Merge: use remote timestamp to avoid stale writes
          if (parsed.updatedAt <= prev.updatedAt) return prev;
          return { ...prev, ...parsed, updatedAt: parsed.updatedAt };
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [plan?.roomId]);

  const createPlan = useCallback(async (roomId: string, data: Partial<PlanData>) => {
    const newPlan: PlanData = { ...defaultPlan(roomId, user?.id), ...data, id: nextId(), updatedAt: new Date().toISOString() };
    setPlan(newPlan);
    try {
      await supabase.from('plans').upsert({
        id: newPlan.id, room_id: roomId, title: newPlan.title, goal: newPlan.goal,
        description: newPlan.description, project_type: newPlan.projectType,
        start_date: newPlan.startDate, target_date: newPlan.targetDate,
        stage: newPlan.stage, progress: newPlan.progress, owner_id: user?.id,
        data: JSON.stringify(newPlan), updated_at: newPlan.updatedAt,
      });
    } catch {}
  }, [user]);

  const loadPlan = useCallback(async (roomId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('plans').select('*').eq('room_id', roomId).single();
      if (!error && data?.data) {
        setPlan(typeof data.data === 'string' ? JSON.parse(data.data) : data.data);
      }
    } catch {}
    setIsLoading(false);
  }, []);

  const savePlan = useCallback((p: PlanData, summary?: string) => {
    setPlan(p);
    setIsSaving(true);

    // Debounced autosave — 2 second delay
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const newVersion = saveVersionRef.current + 1;
      saveVersionRef.current = newVersion;

      try {
        supabase.from('plan_sync').insert({
          id: `v_${p.id}_${newVersion}`,
          room_id: p.roomId,
          plan_id: p.id,
          section: 'full',
          field: 'data',
          value: JSON.stringify(p),
          version: newVersion,
          edited_by: user?.id || '',
          edited_by_name: user?.fullName || '',
          created_at: new Date().toISOString(),
        }).then(() => {});

        supabase.from('plans').upsert({
          id: p.id, room_id: p.roomId, title: p.title, goal: p.goal,
          description: p.description, project_type: p.projectType,
          start_date: p.startDate, target_date: p.targetDate,
          stage: p.stage, progress: p.progress, owner_id: p.ownerId,
          data: JSON.stringify(p), updated_at: new Date().toISOString(),
        }).then(() => {});

        // Log to room history if summary provided
        if (summary) {
          supabase.from('room_history').insert({
            room_id: p.roomId, user_id: user?.id || '',
            user_name: user?.fullName || '', action: 'plan_edited',
            detail: summary,
            metadata: JSON.stringify({ version: newVersion, planId: p.id }),
          }).then(() => {});
        }
      } catch {}
      setIsSaving(false);
    }, 2000);
  }, [user]);

  // Immediate save (flushes debounce)
  const saveNow = useCallback(async (summary?: string) => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    setPlan(prev => {
      if (!prev) return prev;
      const newVersion = saveVersionRef.current + 1;
      saveVersionRef.current = newVersion;
      setIsSaving(true);

      supabase.from('plan_sync').insert({
        id: `v_${prev.id}_${newVersion}`,
        room_id: prev.roomId, plan_id: prev.id,
        section: 'full', field: 'data',
        value: JSON.stringify(prev), version: newVersion,
        edited_by: user?.id || '', edited_by_name: user?.fullName || '',
        created_at: new Date().toISOString(),
      }).then(() => {});

      supabase.from('plans').upsert({
        id: prev.id, room_id: prev.roomId, title: prev.title,
        goal: prev.goal, description: prev.description, project_type: prev.projectType,
        start_date: prev.startDate, target_date: prev.targetDate,
        stage: prev.stage, progress: prev.progress, owner_id: prev.ownerId,
        data: JSON.stringify(prev), updated_at: new Date().toISOString(),
      }).then(() => setIsSaving(false));

      if (summary) {
        supabase.from('room_history').insert({
          room_id: prev.roomId, user_id: user?.id || '',
          user_name: user?.fullName || '', action: 'plan_edited',
          detail: summary,
        }).then(() => {});
      }

      return prev;
    });
  }, [user]);

  // Version history
  const loadVersions = useCallback(async () => {
    if (!plan?.id) return;
    try {
      const { data } = await supabase.from('plan_sync')
        .select('*').eq('plan_id', plan.id)
        .order('version', { ascending: false }).limit(50);
      if (data) {
        setVersions(data.map((r: any) => ({
          id: r.id, planId: r.plan_id, version: r.version,
          editedBy: r.edited_by, editedByName: r.edited_by_name,
          createdAt: r.created_at,
        })));
      }
    } catch {}
  }, [plan?.id]);

  const rollbackToVersion = useCallback(async (versionId: string) => {
    try {
      const { data } = await supabase.from('plan_sync')
        .select('value').eq('id', versionId).single();
      if (data?.value) {
        const restored = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        setPlan(restored);
        saveNow(`Rolled back to version ${versionId}`);
      }
    } catch {}
  }, [saveNow]);

  // Set initial version from DB
  useEffect(() => {
    if (!plan?.id) return;
    supabase.from('plan_sync')
      .select('version').eq('plan_id', plan.id)
      .order('version', { ascending: false }).limit(1).single()
      .then(({ data }) => { if (data?.version) saveVersionRef.current = data.version; })
      .then(() => {}, () => {});
  }, [plan?.id]);

  // Flush on unmount
  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  const updatePlan = useCallback((updates: Partial<PlanData>) => {
    setPlan(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates, updatedAt: new Date().toISOString() };
      savePlan(updated);
      return updated;
    });
  }, []);

  const addTask = useCallback((task: Partial<TaskItem>) => {
    setPlan(prev => {
      if (!prev) return prev;
      const newTask: TaskItem = {
        id: nextId(), title: task.title || '', description: task.description || '',
        assignedTo: task.assignedTo || null, priority: task.priority || 'medium',
        dueDate: task.dueDate || null, status: 'not_started',
        checklist: [], attachments: [], comments: [], sectionId: task.sectionId || null,
        createdAt: new Date().toISOString(),
      };
      const updated = { ...prev, tasks: [...prev.tasks, newTask], updatedAt: new Date().toISOString() };
      updated.progress = recalcProgress(updated);
      updated.stage = stageFromProgress(updated.progress);
      savePlan(updated);
      return updated;
    });
  }, []);

  const updateTask = useCallback((taskId: string, updates: Partial<TaskItem>) => {
    setPlan(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        tasks: prev.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t),
        updatedAt: new Date().toISOString(),
      };
      updated.progress = recalcProgress(updated);
      updated.stage = stageFromProgress(updated.progress);
      savePlan(updated);
      return updated;
    });
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setPlan(prev => {
      if (!prev) return prev;
      const updated = { ...prev, tasks: prev.tasks.filter(t => t.id !== taskId), updatedAt: new Date().toISOString() };
      updated.progress = recalcProgress(updated);
      updated.stage = stageFromProgress(updated.progress);
      savePlan(updated);
      return updated;
    });
  }, []);

  const addIdea = useCallback((idea: Partial<IdeaCard>) => {
    setPlan(prev => {
      if (!prev) return prev;
      const newIdea: IdeaCard = {
        id: nextId(), type: idea.type || 'idea', title: idea.title || '', content: idea.content || '',
        authorId: user?.id || '', authorName: user?.fullName || 'Anonymous',
        votes: [], reactions: [], comments: [], attachments: [],
        convertedToTaskId: null, createdAt: new Date().toISOString(),
      };
      const updated = { ...prev, ideas: [...prev.ideas, newIdea], updatedAt: new Date().toISOString() };
      savePlan(updated);
      return updated;
    });
  }, [user]);

  const updateIdea = useCallback((ideaId: string, updates: Partial<IdeaCard>) => {
    setPlan(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ideas: prev.ideas.map(i => i.id === ideaId ? { ...i, ...updates } : i), updatedAt: new Date().toISOString() };
      savePlan(updated);
      return updated;
    });
  }, []);

  const voteIdea = useCallback((ideaId: string) => {
    setPlan(prev => {
      if (!prev || !user) return prev;
      const updated = {
        ...prev,
        ideas: prev.ideas.map(i => {
          if (i.id !== ideaId) return i;
          const hasVoted = i.votes.includes(user.id);
          return { ...i, votes: hasVoted ? i.votes.filter(v => v !== user.id) : [...i.votes, user.id] };
        }),
        updatedAt: new Date().toISOString(),
      };
      savePlan(updated);
      return updated;
    });
  }, [user]);

  const reactToIdea = useCallback((ideaId: string, emoji: string) => {
    setPlan(prev => {
      if (!prev || !user) return prev;
      const updated = {
        ...prev,
        ideas: prev.ideas.map(i => {
          if (i.id !== ideaId) return i;
          const existing = i.reactions.find(r => r.emoji === emoji);
          let reactions;
          if (existing) {
            const hasReacted = existing.userIds.includes(user.id);
            reactions = i.reactions.map(r =>
              r.emoji === emoji
                ? { ...r, userIds: hasReacted ? r.userIds.filter(u => u !== user.id) : [...r.userIds, user.id] }
                : r
            ).filter(r => r.userIds.length > 0);
          } else {
            reactions = [...i.reactions, { emoji, userIds: [user.id] }];
          }
          return { ...i, reactions };
        }),
        updatedAt: new Date().toISOString(),
      };
      savePlan(updated);
      return updated;
    });
  }, [user]);

  const convertIdeaToTask = useCallback((ideaId: string) => {
    setPlan(prev => {
      if (!prev) return prev;
      const idea = prev.ideas.find(i => i.id === ideaId);
      if (!idea || idea.convertedToTaskId) return prev;
      const newTask: TaskItem = {
        id: nextId(), title: idea.title, description: idea.content,
        assignedTo: null, priority: 'medium', dueDate: null, status: 'not_started',
        checklist: [], attachments: [], comments: [],
        sectionId: null, createdAt: new Date().toISOString(),
      };
      const updated = {
        ...prev,
        ideas: prev.ideas.map(i => i.id === ideaId ? { ...i, convertedToTaskId: newTask.id } : i),
        tasks: [...prev.tasks, newTask],
        updatedAt: new Date().toISOString(),
      };
      updated.progress = recalcProgress(updated);
      savePlan(updated);
      return updated;
    });
  }, []);

  const deleteIdea = useCallback((ideaId: string) => {
    setPlan(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ideas: prev.ideas.filter(i => i.id !== ideaId), updatedAt: new Date().toISOString() };
      savePlan(updated);
      return updated;
    });
  }, []);

  const addBudgetItem = useCallback((item: Partial<BudgetItem>) => {
    setPlan(prev => {
      if (!prev) return prev;
      const newItem: BudgetItem = {
        id: nextId(), name: item.name || '', category: item.category || '',
        estimatedCost: item.estimatedCost || 0, actualCost: item.actualCost || 0,
        supplier: item.supplier || '', paymentStatus: 'pending',
        responsibleId: item.responsibleId || null, createdAt: new Date().toISOString(),
      };
      const budget = { ...prev.budget, items: [...prev.budget.items, newItem] };
      budget.plannedCost = budget.items.reduce((s, i) => s + i.estimatedCost, 0);
      budget.actualCost = budget.items.reduce((s, i) => s + i.actualCost, 0);
      budget.remaining = budget.total - budget.actualCost;
      const updated = { ...prev, budget, updatedAt: new Date().toISOString() };
      savePlan(updated);
      return updated;
    });
  }, []);

  const updateBudgetItem = useCallback((itemId: string, updates: Partial<BudgetItem>) => {
    setPlan(prev => {
      if (!prev) return prev;
      const items = prev.budget.items.map(i => i.id === itemId ? { ...i, ...updates } : i);
      const budget = {
        ...prev.budget, items,
        plannedCost: items.reduce((s, i) => s + i.estimatedCost, 0),
        actualCost: items.reduce((s, i) => s + i.actualCost, 0),
        remaining: prev.budget.total - items.reduce((s, i) => s + i.actualCost, 0),
      };
      const updated = { ...prev, budget, updatedAt: new Date().toISOString() };
      savePlan(updated);
      return updated;
    });
  }, []);

  const deleteBudgetItem = useCallback((itemId: string) => {
    setPlan(prev => {
      if (!prev) return prev;
      const items = prev.budget.items.filter(i => i.id !== itemId);
      const budget = {
        ...prev.budget, items,
        plannedCost: items.reduce((s, i) => s + i.estimatedCost, 0),
        actualCost: items.reduce((s, i) => s + i.actualCost, 0),
        remaining: prev.budget.total - items.reduce((s, i) => s + i.actualCost, 0),
      };
      const updated = { ...prev, budget, updatedAt: new Date().toISOString() };
      savePlan(updated);
      return updated;
    });
  }, []);

  const addVote = useCallback((vote: Partial<VoteItem>) => {
    setPlan(prev => {
      if (!prev) return prev;
      const newVote: VoteItem = {
        id: nextId(), question: vote.question || '',
        options: vote.options || [], deadline: vote.deadline || null,
        winnerId: null, decided: false, decidedResult: null,
        createdAt: new Date().toISOString(),
      };
      const updated = { ...prev, votes: [...prev.votes, newVote], updatedAt: new Date().toISOString() };
      savePlan(updated);
      return updated;
    });
  }, []);

  const castVote = useCallback((voteId: string, optionIndex: number) => {
    setPlan(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        votes: prev.votes.map(v => {
          if (v.id !== voteId) return v;
          const opts = v.options.map((o, i) => i === optionIndex ? { ...o, count: o.count + 1 } : o);
          return { ...v, options: opts };
        }),
        updatedAt: new Date().toISOString(),
      };
      savePlan(updated);
      return updated;
    });
  }, []);

  const decideVote = useCallback((voteId: string, result: string) => {
    setPlan(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        votes: prev.votes.map(v => v.id === voteId ? { ...v, decided: true, decidedResult: result } : v),
        updatedAt: new Date().toISOString(),
      };
      savePlan(updated);
      return updated;
    });
  }, []);

  const addFile = useCallback((file: Partial<FileRef>) => {
    setPlan(prev => {
      if (!prev) return prev;
      const newFile: FileRef = {
        id: nextId(), name: file.name || '', type: file.type || '', url: file.url || '',
        sizeBytes: file.sizeBytes || 0,
        uploadedBy: user?.id || '', uploadedAt: new Date().toISOString(),
        attachedTo: file.attachedTo || { type: 'section', id: '' },
      };
      const updated = { ...prev, files: [...prev.files, newFile], updatedAt: new Date().toISOString() };
      savePlan(updated);
      return updated;
    });
  }, [user]);

  const deleteFile = useCallback((fileId: string) => {
    setPlan(prev => {
      if (!prev) return prev;
      const updated = { ...prev, files: prev.files.filter(f => f.id !== fileId), updatedAt: new Date().toISOString() };
      savePlan(updated);
      return updated;
    });
  }, []);

  // ── Helpers ──
  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function decodeBase64(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  // ── Upload file to Supabase Storage ──
  const STORAGE_LIMIT = 5 * 1024 * 1024 * 1024; // 5 GB

  const uploadFile = useCallback(async (uri: string, name: string, mimeType: string, fileType: string): Promise<boolean> => {
    const roomId = plan?.roomId;
    if (!roomId) return false;

    // 1. Get file size
    let fileSize = 1_000_000; // default 1MB if unknown
    try {
      const resp = await fetch(uri, { method: 'HEAD' });
      const contentLength = parseInt(resp.headers.get('content-length') || '0', 10);
      if (contentLength > 0) fileSize = contentLength;
    } catch {}

    // 2. Check storage limit (use latest state via state snapshot)
    const currentUsed = plan?.storageUsedBytes || 0;
    if (currentUsed + fileSize > STORAGE_LIMIT) {
      Alert.alert('Storage Full', `Upload would exceed the 5 GB limit. (${(currentUsed / 1e9).toFixed(1)} GB used)`);
      return false;
    }

    // 3. Fetch file as blob, convert to base64
    try {
      const fileResp = await fetch(uri);
      const blob = await fileResp.blob();
      const base64 = await blobToBase64(blob);

      const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileId = nextId();
      const storagePath = `${roomId}/${fileId}-${safeName}`;

      // 4. Upload to Supabase Storage (non-negotiable — no local fallback)
      const { error: uploadErr } = await supabase.storage
        .from('room-files')
        .upload(storagePath, decodeBase64(base64), {
          contentType: mimeType,
          cacheControl: '3600',
        });

      if (uploadErr) {
        console.log('[uploadFile] Supabase storage upload failed:', uploadErr.message);
        Alert.alert('Upload Failed', `Could not upload "${name}" to cloud storage. Check your connection and try again.`);
        return false;
      }

      // 5. Get public URL
      const { data: urlData } = supabase.storage.from('room-files').getPublicUrl(storagePath);
      const publicUrl = urlData?.publicUrl || '';

      if (!publicUrl) {
        Alert.alert('Upload Failed', 'Could not retrieve file URL from cloud storage. Please try again.');
        return false;
      }

      // 6. Build file reference
      const newFile: FileRef = {
        id: fileId, name, type: fileType, url: publicUrl, sizeBytes: fileSize,
        uploadedBy: user?.id || '', uploadedAt: new Date().toISOString(),
        attachedTo: { type: 'section', id: '' },
      };

      // 7. Update plan state AND immediately sync to Supabase (no debounce)
      setPlan(prev => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          files: [...prev.files, newFile],
          storageUsedBytes: (prev.storageUsedBytes || 0) + fileSize,
          updatedAt: new Date().toISOString(),
        };
        // Immediately upsert to plans table — file references must survive app restarts/updates
        supabase.from('plans').upsert({
          id: updated.id, room_id: updated.roomId, title: updated.title, goal: updated.goal,
          description: updated.description, project_type: updated.projectType,
          start_date: updated.startDate, target_date: updated.targetDate,
          stage: updated.stage, progress: updated.progress, owner_id: updated.ownerId,
          data: JSON.stringify(updated), updated_at: updated.updatedAt,
        }).then(({ error }) => {
          if (error) console.log('[uploadFile] plan upsert error:', error.message);
        });
        // Also log a version snapshot
        supabase.from('plan_sync').insert({
          id: `v_${updated.id}_file_${fileId}`,
          room_id: updated.roomId, plan_id: updated.id,
          section: 'full', field: 'data',
          value: JSON.stringify(updated),
          version: Date.now(),
          edited_by: user?.id || '',
          edited_by_name: user?.fullName || '',
          created_at: new Date().toISOString(),
        }).then(({ error }) => {
          if (error) console.log('[uploadFile] plan_sync insert error:', error.message);
        });
        return updated;
      });

      // 8. Update storage quota
      try {
        await supabase.from('room_storage_quota').upsert({
          room_id: roomId, bytes_used: currentUsed + fileSize,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'room_id' });
      } catch {}

      return true;
    } catch (e: any) {
      console.log('[uploadFile] Upload failed:', e?.message);
      Alert.alert('Upload Failed', 'Could not upload the file. Please check your connection and try again.');
      return false;
    }
  }, [plan?.roomId, plan?.storageUsedBytes, user]);

  const addSection = useCallback((section: Partial<PlanSection>) => {
    setPlan(prev => {
      if (!prev) return prev;
      const newSection: PlanSection = {
        id: nextId(), title: section.title || '', description: section.description || '',
        progress: 0, members: section.members || [], createdAt: new Date().toISOString(),
      };
      const updated = { ...prev, sections: [...prev.sections, newSection], updatedAt: new Date().toISOString() };
      savePlan(updated);
      return updated;
    });
  }, []);

  const updateSection = useCallback((sectionId: string, updates: Partial<PlanSection>) => {
    setPlan(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        sections: prev.sections.map(s => s.id === sectionId ? { ...s, ...updates } : s),
        updatedAt: new Date().toISOString(),
      };
      savePlan(updated);
      return updated;
    });
  }, []);

  const addTimelineItem = useCallback((item: Partial<TimelineItem>) => {
    setPlan(prev => {
      if (!prev) return prev;
      const newItem: TimelineItem = {
        id: nextId(), type: item.type || 'task', title: item.title || '',
        date: item.date || new Date().toISOString(), description: item.description || '',
        completed: false,
      };
      const updated = { ...prev, timeline: [...prev.timeline, newItem], updatedAt: new Date().toISOString() };
      savePlan(updated);
      return updated;
    });
  }, []);

  const updateTimelineItem = useCallback((itemId: string, updates: Partial<TimelineItem>) => {
    setPlan(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        timeline: prev.timeline.map(t => t.id === itemId ? { ...t, ...updates } : t),
        updatedAt: new Date().toISOString(),
      };
      savePlan(updated);
      return updated;
    });
  }, []);

  return (
    <PlanContext.Provider value={{
      plan, isLoading, isSyncing, isSaving, activeTab, setActiveTab,
      viewMode, setViewMode,
      lastSavedVersion: saveVersionRef.current,
      versions,
      createPlan, loadPlan, loadVersions, rollbackToVersion, updatePlan, saveNow,
      addTask, updateTask, deleteTask,
      addIdea, updateIdea, voteIdea, reactToIdea, convertIdeaToTask, deleteIdea,
      addBudgetItem, updateBudgetItem, deleteBudgetItem,
      addVote, castVote, decideVote,
      addFile, deleteFile, uploadFile,
      storageUsedBytes: plan?.storageUsedBytes || 0,
      storageLimit: STORAGE_LIMIT,
      addSection, updateSection,
      addTimelineItem, updateTimelineItem,
    }}>
      {children}
    </PlanContext.Provider>
  );
}
