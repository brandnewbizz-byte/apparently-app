const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'ideas', label: 'Ideas' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'budget', label: 'Budget' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'files', label: 'Files' },
  { key: 'chat', label: 'Chat' },
  { key: 'people', label: 'People' },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: '#6B7280', medium: '#3B82F6', high: '#F59E0B', critical: '#EF4444',
};
const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started', in_progress: 'In Progress',
  waiting: 'Waiting', needs_review: 'Needs Review', completed: 'Completed',
};
const STAGES = [
  { key: 'idea' as const, label: 'Idea', icon: '💡' },
  { key: 'build' as const, label: 'Build', icon: '🔨' },
  { key: 'assign' as const, label: 'Assign', icon: '👥' },
  { key: 'launch' as const, label: 'Launch', icon: '🚀' },
];
