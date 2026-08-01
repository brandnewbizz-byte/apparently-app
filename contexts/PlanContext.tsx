import React, {
  createContext, useContext, useState, useCallback, useRef, useEffect,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

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
  id: string; name: string; type: string; url: string; uploadedBy: string;
  uploadedAt: string; attachedTo: { type: 'section' | 'task' | 'idea'; id: string };
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
  votes: VoteItem[];
  createdAt: string;
  updatedAt: string;
}

interface PlanContextValue {
  plan: PlanData | null;
  isLoading: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  createPlan: (roomId: string, data: Partial<PlanData>) => Promise<void>;
  loadPlan: (roomId: string) => Promise<void>;
  updatePlan: (updates: Partial<PlanData>) => void;
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
    timeline: [], files: [], votes: [],
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
  const [activeTab, setActiveTab] = useState('overview');

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

  const savePlan = (p: PlanData) => {
    setPlan(p);
    try {
      supabase.from('plans').upsert({
        id: p.id, room_id: p.roomId, title: p.title, goal: p.goal,
        description: p.description, project_type: p.projectType,
        start_date: p.startDate, target_date: p.targetDate,
        stage: p.stage, progress: p.progress, owner_id: p.ownerId,
        data: JSON.stringify(p), updated_at: new Date().toISOString(),
      }).then(() => {});
    } catch {}
  };

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
      plan, isLoading, activeTab, setActiveTab,
      createPlan, loadPlan, updatePlan,
      addTask, updateTask, deleteTask,
      addIdea, updateIdea, voteIdea, reactToIdea, convertIdeaToTask, deleteIdea,
      addBudgetItem, updateBudgetItem, deleteBudgetItem,
      addVote, castVote, decideVote,
      addFile, deleteFile,
      addSection, updateSection,
      addTimelineItem, updateTimelineItem,
    }}>
      {children}
    </PlanContext.Provider>
  );
}
