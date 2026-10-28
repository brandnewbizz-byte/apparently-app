import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Alert,
  Modal,
  TextInput,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Wand2,
  Clock,
  Briefcase,
  X,
  DollarSign,
  BellRing,
  Camera,
  Radio,
  Check,
  CalendarDays,
  LayoutGrid,
  MapPin,
  Search,
  MessageSquare,
} from 'lucide-react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner, type Plan } from '@/contexts/PlannerContext';
import { useServiceRequests, SERVICE_CATEGORIES, type ServiceCategory, type RequestStatus } from '@/contexts/ServiceRequestContext';
import { useOrders } from '@/contexts/OrdersContext';
import { localDateKey, dateFromKey, formatMinutes, formatTime12 } from '@/lib/dates';
import { summarizePlan, sortByTime, formatDuration, BLOCK_CATEGORIES, type PlanSummary } from '@/components/planner/planSummary';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const TIME_OPTIONS = Array.from({ length: 34 }, (_, i) => 6 * 60 + i * 30); // 6:00 AM → 10:30 PM
const DURATIONS = [15, 30, 60, 90, 120, 180];

const REQUEST_STATUS: Record<RequestStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: '#10B981' },
  in_progress: { label: 'In progress', color: '#F59E0B' },
  fulfilled: { label: 'Fulfilled', color: '#6B7280' },
  cancelled: { label: 'Cancelled', color: '#EF4444' },
};

const haptic = (kind: 'light' | 'select' | 'success' = 'light') => {
  if (Platform.OS === 'web') return;
  if (kind === 'select') Haptics.selectionAsync();
  else if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

function addDays(key: string, n: number) {
  const d = dateFromKey(key);
  d.setDate(d.getDate() + n);
  return localDateKey(d);
}

function relativeLabel(key: string) {
  const today = localDateKey();
  if (key === today) return 'Today';
  if (key === addDays(today, 1)) return 'Tomorrow';
  if (key === addDays(today, -1)) return 'Yesterday';
  return dateFromKey(key).toLocaleDateString('en-US', { weekday: 'long' });
}

// ═════════════════════════════════════════════════════════════════════════════
// Calendar: week strip that expands into a month grid
// ═════════════════════════════════════════════════════════════════════════════
function DatePicker({ selected, onSelect, marked, colors }: {
  selected: string; onSelect: (k: string) => void; marked: Set<string>; colors: any;
}) {
  const [expanded, setExpanded] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = dateFromKey(selected);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const today = localDateKey();

  const weekStart = useMemo(() => {
    const d = dateFromKey(selected);
    d.setDate(d.getDate() - d.getDay());
    return localDateKey(d);
  }, [selected]);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const monthCells = useMemo(() => {
    const first = new Date(monthCursor.y, monthCursor.m, 1);
    const days = new Date(monthCursor.y, monthCursor.m + 1, 0).getDate();
    const cells: (string | null)[] = Array(first.getDay()).fill(null);
    for (let i = 1; i <= days; i++) cells.push(localDateKey(new Date(monthCursor.y, monthCursor.m, i)));
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [monthCursor]);

  const select = (k: string) => {
    haptic('select');
    onSelect(k);
    const d = dateFromKey(k);
    setMonthCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  const shift = (dir: 1 | -1) => {
    haptic('select');
    if (expanded) {
      setMonthCursor((c) => {
        const m = c.m + dir;
        return m < 0 ? { y: c.y - 1, m: 11 } : m > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m };
      });
    } else {
      select(addDays(selected, dir * 7));
    }
  };

  const renderDay = (k: string) => {
    const isSel = k === selected;
    const isToday = k === today;
    const d = dateFromKey(k);
    return (
      <TouchableOpacity key={k} style={styles.dayCell} onPress={() => select(k)} accessibilityLabel={d.toDateString()} accessibilityState={{ selected: isSel }}>
        <View style={[styles.dayBubble, isSel && { backgroundColor: colors.text }, !isSel && isToday && { borderWidth: 1.5, borderColor: colors.accent }]}>
          <Text style={[styles.dayNum, { color: isSel ? colors.background : isToday ? colors.accent : colors.text }]}>{d.getDate()}</Text>
        </View>
        <View style={[styles.dot, { backgroundColor: marked.has(k) ? (isSel ? colors.text : colors.accent) : 'transparent' }]} />
      </TouchableOpacity>
    );
  };

  const title = expanded
    ? new Date(monthCursor.y, monthCursor.m).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : dateFromKey(weekStart).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <View style={[styles.calCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.calHeader}>
        <TouchableOpacity onPress={() => shift(-1)} hitSlop={10} accessibilityLabel={expanded ? 'Previous month' : 'Previous week'}>
          <ChevronLeft size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.calTitleBtn} onPress={() => { haptic('select'); setExpanded((e) => !e); }} accessibilityLabel={expanded ? 'Show week' : 'Show month'}>
          <Text style={[styles.calTitle, { color: colors.text }]}>{title}</Text>
          {expanded ? <ChevronUp size={16} color={colors.textSecondary} /> : <ChevronDown size={16} color={colors.textSecondary} />}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => shift(1)} hitSlop={10} accessibilityLabel={expanded ? 'Next month' : 'Next week'}>
          <ChevronRight size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => <Text key={i} style={[styles.weekday, { color: colors.textTertiary }]}>{w}</Text>)}
      </View>
      {expanded ? (
        Array.from({ length: monthCells.length / 7 }, (_, r) => (
          <View key={r} style={styles.weekRow}>
            {monthCells.slice(r * 7, r * 7 + 7).map((k, i) => (k ? renderDay(k) : <View key={`e${i}`} style={styles.dayCell} />))}
          </View>
        ))
      ) : (
        <View style={styles.weekRow}>{week.map((k) => renderDay(k))}</View>
      )}
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// One plan row on the day timeline
// ═════════════════════════════════════════════════════════════════════════════
function PlanRow({ plan, summary, colors, onOpen, onToggleDone, onLongPress, showDate }: {
  plan: Plan; summary: PlanSummary; colors: any; onOpen: () => void; onToggleDone: () => void; onLongPress: () => void; showDate?: boolean;
}) {
  const done = plan.status === 'completed';
  const cancelled = plan.status === 'cancelled';
  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onOpen}
      onLongPress={() => { haptic(); onLongPress(); }}
      activeOpacity={0.75}
    >
      <View style={styles.rowTime}>
        {showDate ? (
          <>
            <Text style={[styles.rowTimeMain, { color: colors.text }]}>{dateFromKey(plan.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
            <Text style={[styles.rowTimeSub, { color: colors.textTertiary }]}>{summary.startMins !== null ? formatMinutes(summary.startMins) : dateFromKey(plan.date).toLocaleDateString('en-US', { weekday: 'short' })}</Text>
          </>
        ) : (
          <>
            <Text style={[styles.rowTimeMain, { color: colors.text }]}>{summary.startMins !== null ? formatMinutes(summary.startMins) : 'All day'}</Text>
            {summary.durationMins ? <Text style={[styles.rowTimeSub, { color: colors.textTertiary }]}>{formatDuration(summary.durationMins)}</Text> : null}
          </>
        )}
      </View>
      <View style={[styles.rowBar, { backgroundColor: summary.color, opacity: done || cancelled ? 0.35 : 1 }]} />
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: colors.text }, (done || cancelled) && styles.rowTitleDone, (done || cancelled) && { color: colors.textTertiary }]} numberOfLines={1}>
          {summary.title}
        </Text>
        <View style={styles.rowMetaLine}>
          <Text style={[styles.rowLabel, { color: summary.color }]}>{cancelled ? 'Cancelled' : summary.label}</Text>
          {summary.subtitle ? <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={1}>· {summary.subtitle}</Text> : null}
        </View>
      </View>
      {!cancelled ? (
        <TouchableOpacity
          onPress={() => { haptic(done ? 'light' : 'success'); onToggleDone(); }}
          hitSlop={10}
          style={[styles.check, { borderColor: done ? summary.color : colors.border, backgroundColor: done ? summary.color : 'transparent' }]}
          accessibilityLabel={done ? 'Mark not done' : 'Mark done'}
          accessibilityState={{ checked: done }}
        >
          {done ? <Check size={14} color="#FFF" strokeWidth={3} /> : null}
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Quick add sheet (saves a time block on the selected day)
// ═════════════════════════════════════════════════════════════════════════════
/** Next half hour if planning for today (within the picker's range), else 9 AM. */
function defaultStart(date: string) {
  if (date !== localDateKey()) return 9 * 60;
  const now = new Date();
  const next = Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / 30) * 30;
  const first = TIME_OPTIONS[0];
  const last = TIME_OPTIONS[TIME_OPTIONS.length - 1];
  return Math.min(Math.max(next, first), last);
}

const TIME_CHIP_W = 92; // approx chip width + gap, for scrolling to the selected time

function QuickAddSheet({ visible, date, onClose, colors }: { visible: boolean; date: string; onClose: () => void; colors: any }) {
  const { createPlan } = usePlanner();
  const [title, setTitle] = useState('');
  const [start, setStart] = useState(() => defaultStart(date));
  const timeScroll = React.useRef<ScrollViewInstance>(null);

  // Fresh default time each time the sheet opens, scrolled into view.
  React.useEffect(() => {
    if (!visible) return;
    const t = defaultStart(date);
    setStart(t);
    const idx = Math.max(0, TIME_OPTIONS.indexOf(t) - 1);
    setTimeout(() => timeScroll.current?.scrollTo({ x: idx * TIME_CHIP_W, animated: false }), 60);
  }, [visible, date]);
  const [duration, setDuration] = useState(60);
  const [category, setCategory] = useState<string>('work');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(''); setDuration(60); setCategory('work'); setLocation(''); };

  const save = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    const cat = BLOCK_CATEGORIES.find((c) => c.id === category) || BLOCK_CATEGORIES[BLOCK_CATEGORIES.length - 1];
    const hh = String(Math.floor(start / 60)).padStart(2, '0');
    const mm = String(start % 60).padStart(2, '0');
    const res = await createPlan({
      date,
      date_label: title.trim(),
      location_type: 'home',
      transport: 'none',
      plan_details: {
        location_type: 'home',
        transport: 'none',
        assistance: [],
        payment: 'cash',
        custom_block: {
          title: title.trim(),
          description: '',
          category: cat.id,
          category_label: cat.label,
          category_color: cat.color,
          start_time: `${hh}:${mm}`,
          duration_minutes: duration,
          location: location.trim(),
          priority: 'medium',
        },
      },
    });
    setSaving(false);
    if (res) {
      haptic('success');
      reset();
      onClose();
    } else {
      Alert.alert('Plan not saved', 'Check your connection and try again.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} hitSlop={10}><X size={22} color={colors.text} /></TouchableOpacity>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>New plan · {relativeLabel(date)}</Text>
          <TouchableOpacity onPress={save} disabled={!title.trim() || saving} style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: title.trim() && !saving ? 1 : 0.4 }]}>
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 22 }} keyboardShouldPersistTaps="handled">
          <TextInput
            style={[styles.titleInput, { color: colors.text, borderBottomColor: colors.border }]}
            placeholder="What are you doing?"
            placeholderTextColor={colors.textTertiary}
            value={title}
            onChangeText={setTitle}
            autoFocus
            returnKeyType="done"
          />
          <View>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Starts</Text>
            <ScrollView ref={timeScroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {TIME_OPTIONS.map((t) => {
                const on = t === start;
                return (
                  <TouchableOpacity key={t} onPress={() => { haptic('select'); setStart(t); }} style={[styles.chip, { borderColor: on ? colors.text : colors.border, backgroundColor: on ? colors.text : colors.surface }]}>
                    <Text style={[styles.chipText, { color: on ? colors.background : colors.text }]}>{formatMinutes(t)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
          <View>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>How long</Text>
            <View style={styles.wrap}>
              {DURATIONS.map((d) => {
                const on = d === duration;
                return (
                  <TouchableOpacity key={d} onPress={() => { haptic('select'); setDuration(d); }} style={[styles.chip, { borderColor: on ? colors.text : colors.border, backgroundColor: on ? colors.text : colors.surface }]}>
                    <Text style={[styles.chipText, { color: on ? colors.background : colors.text }]}>{formatDuration(d)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Type</Text>
            <View style={styles.wrap}>
              {BLOCK_CATEGORIES.map((c) => {
                const on = c.id === category;
                return (
                  <TouchableOpacity key={c.id} onPress={() => { haptic('select'); setCategory(c.id); }} style={[styles.chip, { borderColor: on ? c.color : colors.border, backgroundColor: on ? c.color + '1F' : colors.surface }]}>
                    <View style={[styles.catDot, { backgroundColor: c.color }]} />
                    <Text style={[styles.chipText, { color: on ? c.color : colors.text }]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Where (optional)</Text>
            <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <MapPin size={16} color={colors.textTertiary} />
              <TextInput style={[styles.input, { color: colors.text }]} placeholder="Add a place" placeholderTextColor={colors.textTertiary} value={location} onChangeText={setLocation} />
            </View>
          </View>
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            {formatMinutes(start)} – {formatMinutes(start + duration)} on {dateFromKey(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Post-a-request sheet
// ═════════════════════════════════════════════════════════════════════════════
function RequestSheet({ visible, date, onClose, onCreate, colors }: {
  visible: boolean; date: string; onClose: () => void; colors: any;
  onCreate: (r: { title: string; description: string; category: ServiceCategory; location: string; date: string; time: string; budgetMin: number; budgetMax: number; image?: string }) => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('photography');
  const [location, setLocation] = useState('');
  const [time, setTime] = useState(18 * 60);
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [16, 9] });
    if (!r.canceled && r.assets?.[0]) setImage(r.assets[0].uri);
  };

  const submit = () => {
    if (!title.trim()) return;
    const min = parseInt(budgetMin, 10) || 0;
    const max = parseInt(budgetMax, 10) || 0;
    if (max && min > max) { Alert.alert('Check your budget', 'The minimum is higher than the maximum.'); return; }
    haptic('success');
    onCreate({ title: title.trim(), description: description.trim(), category, location: location.trim(), date, time: formatMinutes(time), budgetMin: min, budgetMax: max, image: image || undefined });
    setTitle(''); setDescription(''); setLocation(''); setBudgetMin(''); setBudgetMax(''); setImage(null); setCategory('photography');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} hitSlop={10}><X size={22} color={colors.text} /></TouchableOpacity>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Ask for help</Text>
          <TouchableOpacity onPress={submit} disabled={!title.trim()} style={[styles.saveBtn, { backgroundColor: '#F59E0B', opacity: title.trim() ? 1 : 0.4 }]}>
            <Text style={styles.saveText}>Post</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }} keyboardShouldPersistTaps="handled">
          <TextInput
            style={[styles.titleInput, { color: colors.text, borderBottomColor: colors.border }]}
            placeholder="What do you need? e.g. DJ for Friday"
            placeholderTextColor={colors.textTertiary}
            value={title}
            onChangeText={setTitle}
            autoFocus
          />
          <View>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Category</Text>
            <View style={styles.wrap}>
              {SERVICE_CATEGORIES.map((c) => {
                const on = c.key === category;
                return (
                  <TouchableOpacity key={c.key} onPress={() => { haptic('select'); setCategory(c.key); }} style={[styles.chip, { borderColor: on ? '#F59E0B' : colors.border, backgroundColor: on ? '#F59E0B1F' : colors.surface }]}>
                    <Text style={{ fontSize: 14 }}>{c.icon}</Text>
                    <Text style={[styles.chipText, { color: on ? '#D97706' : colors.text }]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>When · {relativeLabel(date)}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {TIME_OPTIONS.filter((t) => t % 60 === 0).map((t) => {
                const on = t === time;
                return (
                  <TouchableOpacity key={t} onPress={() => { haptic('select'); setTime(t); }} style={[styles.chip, { borderColor: on ? colors.text : colors.border, backgroundColor: on ? colors.text : colors.surface }]}>
                    <Text style={[styles.chipText, { color: on ? colors.background : colors.text }]}>{formatMinutes(t)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
          <View>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Where</Text>
            <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <MapPin size={16} color={colors.textTertiary} />
              <TextInput style={[styles.input, { color: colors.text }]} placeholder="Neighborhood or address" placeholderTextColor={colors.textTertiary} value={location} onChangeText={setLocation} />
            </View>
          </View>
          <View>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Budget</Text>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <View style={[styles.inputRow, { flex: 1, borderColor: colors.border, backgroundColor: colors.surface }]}>
                <DollarSign size={15} color={colors.textTertiary} />
                <TextInput style={[styles.input, { color: colors.text }]} placeholder="Min" placeholderTextColor={colors.textTertiary} value={budgetMin} onChangeText={setBudgetMin} keyboardType="number-pad" />
              </View>
              <Text style={{ color: colors.textTertiary }}>–</Text>
              <View style={[styles.inputRow, { flex: 1, borderColor: colors.border, backgroundColor: colors.surface }]}>
                <DollarSign size={15} color={colors.textTertiary} />
                <TextInput style={[styles.input, { color: colors.text }]} placeholder="Max" placeholderTextColor={colors.textTertiary} value={budgetMax} onChangeText={setBudgetMax} keyboardType="number-pad" />
              </View>
            </View>
          </View>
          <View>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Details (optional)</Text>
            <TextInput
              style={[styles.notes, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              placeholder="Anything a helper should know"
              placeholderTextColor={colors.textTertiary}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />
          </View>
          <TouchableOpacity onPress={pickImage} style={[styles.photoPick, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            {image ? (
              <Image source={{ uri: image }} style={styles.photoPreview} />
            ) : (
              <>
                <Camera size={18} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Add a photo (optional)</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Screen
// ═════════════════════════════════════════════════════════════════════════════
export default function PlannerScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { plans, isLoading, deletePlan, setPlanStatus, updatePlan, refetch } = usePlanner();
  const { requests, createRequest, deleteRequest, updateRequestStatus } = useServiceRequests();
  const { pendingCount: pendingOrders } = useOrders();

  const [tab, setTab] = useState<'schedule' | 'requests'>('schedule');
  const [selected, setSelected] = useState(localDateKey());
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showRequest, setShowRequest] = useState(false);

  const today = localDateKey();
  const marked = useMemo(() => new Set(plans.filter((p) => p.status !== 'cancelled').map((p) => p.date)), [plans]);

  const dayItems = useMemo(
    () => plans.filter((p) => p.date === selected).map((p) => ({ plan: p, summary: summarizePlan(p) })).sort(sortByTime),
    [plans, selected],
  );
  const doneCount = dayItems.filter((i) => i.plan.status === 'completed').length;

  const upcoming = useMemo(() => {
    const from = selected >= today ? selected : today;
    return plans
      .filter((p) => p.date > from && p.status !== 'cancelled' && p.status !== 'completed')
      .map((p) => ({ plan: p, summary: summarizePlan(p) }))
      .sort((a, b) => (a.plan.date === b.plan.date ? sortByTime(a, b) : a.plan.date.localeCompare(b.plan.date)))
      .slice(0, 5);
  }, [plans, selected, today]);

  const myRequests = useMemo(() => requests.filter((r) => r.creatorId && r.creatorId === user?.id), [requests, user?.id]);
  const openRequests = myRequests.filter((r) => r.status === 'open').length;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const openPlan = (p: Plan) => router.push(`/planner/${p.id}` as any);

  const toggleDone = async (p: Plan) => {
    const ok = await setPlanStatus(p.id, p.status === 'completed' ? 'pending' : 'completed');
    if (!ok) Alert.alert('Not updated', 'Check your connection and try again.');
  };

  const planActions = (p: Plan) => {
    Alert.alert(summarizePlan(p).title, undefined, [
      { text: p.status === 'completed' ? 'Mark not done' : 'Mark done', onPress: () => toggleDone(p) },
      ...(p.date !== today ? [{ text: 'Move to today', onPress: () => moveToToday(p) }] : []),
      {
        text: 'Delete', style: 'destructive' as const,
        onPress: async () => {
          try { await deletePlan(p.id); haptic('success'); } catch { Alert.alert('Not deleted', 'Please try again.'); }
        },
      },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const moveToToday = async (p: Plan) => {
    const res = await updatePlan(p.id, { date: today });
    if (!res) Alert.alert('Not moved', 'Please try again.');
    else setSelected(today);
  };

  const dateTitle = relativeLabel(selected);
  const dateSub = dateFromKey(selected).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Planner',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => { haptic(); if (router.canGoBack()) router.back(); else router.navigate('/(tabs)/(home)' as any); }}
              style={styles.headerBack}
              hitSlop={10}
              accessibilityLabel="Back"
            >
              <ChevronLeft size={26} color={colors.text} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={() => { haptic(); router.push('/(tabs)/live' as any); }} style={[styles.headerBtn, { borderColor: colors.border }]} accessibilityLabel="Live rooms">
                <Radio size={17} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { haptic(); if (tab === 'requests') setShowRequest(true); else setShowAdd(true); }}
                style={[styles.headerBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
                accessibilityLabel={tab === 'requests' ? 'Post a request' : 'Add a plan'}
              >
                <Plus size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {/* Segmented control */}
      <View style={[styles.segment, { backgroundColor: colors.surfaceHighlight }]}>
        {([
          { key: 'schedule', label: 'Schedule' },
          { key: 'requests', label: 'Requests' },
        ] as const).map((s) => {
          const on = tab === s.key;
          return (
            <TouchableOpacity key={s.key} style={[styles.segBtn, on && { backgroundColor: colors.background }]} onPress={() => { haptic('select'); setTab(s.key); }} accessibilityState={{ selected: on }}>
              <Text style={[styles.segText, { color: on ? colors.text : colors.textSecondary }]}>{s.label}</Text>
              {s.key === 'requests' && (openRequests > 0 || pendingOrders > 0) ? (
                <View style={[styles.segBadge, { backgroundColor: pendingOrders > 0 ? '#F59E0B' : colors.accent }]}>
                  <Text style={styles.segBadgeText}>{pendingOrders > 0 ? pendingOrders : openRequests}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textTertiary} />}
      >
        {tab === 'schedule' ? (
          <>
            <DatePicker selected={selected} onSelect={setSelected} marked={marked} colors={colors} />

            {/* Day header */}
            <View style={styles.dayHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dayTitle, { color: colors.text }]}>{dateTitle}</Text>
                <Text style={[styles.daySub, { color: colors.textSecondary }]}>
                  {dateSub}{dayItems.length ? ` · ${dayItems.length} plan${dayItems.length === 1 ? '' : 's'}${doneCount ? `, ${doneCount} done` : ''}` : ''}
                </Text>
              </View>
              {selected !== today ? (
                <TouchableOpacity onPress={() => { haptic('select'); setSelected(today); }} style={[styles.todayPill, { borderColor: colors.border }]}>
                  <Text style={[styles.todayText, { color: colors.text }]}>Today</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {dayItems.length > 0 ? (
              <View style={[styles.progressTrack, { backgroundColor: colors.surfaceHighlight }]}>
                <View style={[styles.progressFill, { width: `${Math.round((doneCount / dayItems.length) * 100)}%`, backgroundColor: '#10B981' }]} />
              </View>
            ) : null}

            {/* Quick actions */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
              <ActionChip icon={<Plus size={16} color={colors.accent} />} label="Quick plan" colors={colors} onPress={() => setShowAdd(true)} />
              <ActionChip icon={<LayoutGrid size={16} color="#8B5CF6" />} label="Time block" colors={colors} onPress={() => router.push({ pathname: '/planner/add-block', params: { date: selected } } as any)} />
              <ActionChip icon={<Wand2 size={16} color="#7B61FF" />} label="Plan my day" colors={colors} onPress={() => router.push({ pathname: '/planner/plan-day', params: { date: selected } } as any)} />
              <ActionChip icon={<Briefcase size={16} color="#10B981" />} label="Find jobs" colors={colors} onPress={() => router.push('/planner/browse-jobs' as any)} />
            </ScrollView>

            {/* Day list */}
            {isLoading && plans.length === 0 ? (
              <Text style={[styles.muted, { color: colors.textTertiary }]}>Loading your plans…</Text>
            ) : dayItems.length === 0 ? (
              <TouchableOpacity style={[styles.empty, { borderColor: colors.border }]} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
                <CalendarDays size={26} color={colors.textTertiary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing planned {selected === today ? 'today' : 'yet'}</Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Tap to add something for {dateTitle === 'Today' || dateTitle === 'Tomorrow' ? dateTitle.toLowerCase() : dateSub}</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ gap: 8 }}>
                {dayItems.map(({ plan, summary }) => (
                  <PlanRow key={plan.id} plan={plan} summary={summary} colors={colors} onOpen={() => openPlan(plan)} onToggleDone={() => toggleDone(plan)} onLongPress={() => planActions(plan)} />
                ))}
                <Text style={[styles.tip, { color: colors.textTertiary }]}>Tap the circle to check off · hold a plan for more options</Text>
              </View>
            )}

            {/* Coming up */}
            {upcoming.length > 0 ? (
              <View style={{ marginTop: 26 }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Coming up</Text>
                <View style={{ gap: 8 }}>
                  {upcoming.map(({ plan, summary }) => (
                    <PlanRow key={plan.id} plan={plan} summary={summary} colors={colors} showDate onOpen={() => openPlan(plan)} onToggleDone={() => toggleDone(plan)} onLongPress={() => planActions(plan)} />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <>
            {pendingOrders > 0 ? (
              <TouchableOpacity style={styles.banner} onPress={() => router.push('/(tabs)/manage' as any)} activeOpacity={0.8}>
                <BellRing size={18} color="#D97706" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerTitle}>{pendingOrders} helper{pendingOrders > 1 ? 's' : ''} waiting</Text>
                  <Text style={[styles.bannerSub, { color: colors.textSecondary }]}>Review and accept offers</Text>
                </View>
                <ChevronRight size={18} color="#D97706" />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={[styles.postBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => setShowRequest(true)}>
              <View style={styles.postIcon}><Search size={18} color="#D97706" /></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.postTitle, { color: colors.text }]}>Need a hand?</Text>
                <Text style={[styles.postSub, { color: colors.textSecondary }]}>Post a request and let helpers come to you</Text>
              </View>
              <Plus size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 22 }]}>Your requests</Text>
            {myRequests.length === 0 ? (
              <Text style={[styles.muted, { color: colors.textTertiary }]}>You haven&apos;t posted any requests yet.</Text>
            ) : myRequests.map((r) => {
              const cat = SERVICE_CATEGORIES.find((c) => c.key === r.category);
              const st = REQUEST_STATUS[r.status] || REQUEST_STATUS.open;
              const budget = r.budgetMin && r.budgetMax ? `$${r.budgetMin}–$${r.budgetMax}` : r.budgetMax || r.budgetMin ? `$${r.budgetMax || r.budgetMin}` : null;
              return (
                <View key={r.id} style={[styles.reqCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.reqTop}>
                    <Text style={{ fontSize: 22 }}>{cat?.icon || '✨'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reqTitle, { color: colors.text }]} numberOfLines={2}>{r.title}</Text>
                      <Text style={[styles.reqMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                        {[r.date ? relativeLabel(r.date) : null, r.time ? formatTime12(r.time) : null, r.location || null, budget].filter(Boolean).join(' · ') || cat?.label}
                      </Text>
                    </View>
                    <View style={[styles.status, { backgroundColor: st.color + '1F' }]}>
                      <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>
                  {r.image ? <Image source={{ uri: r.image }} style={styles.reqImage} /> : null}
                  {r.responders > 0 ? (
                    <View style={styles.reqResp}>
                      <MessageSquare size={13} color={colors.accent} />
                      <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>{r.responders} offer{r.responders > 1 ? 's' : ''}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.reqActions, { borderTopColor: colors.border }]}>
                    {r.status === 'open' || r.status === 'in_progress' ? (
                      <TouchableOpacity onPress={() => { haptic('success'); updateRequestStatus(r.id, 'fulfilled'); }} style={styles.reqAction}>
                        <Check size={15} color="#10B981" />
                        <Text style={[styles.reqActionText, { color: '#10B981' }]}>Mark fulfilled</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => updateRequestStatus(r.id, 'open')} style={styles.reqAction}>
                        <Clock size={15} color={colors.textSecondary} />
                        <Text style={[styles.reqActionText, { color: colors.textSecondary }]}>Reopen</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => Alert.alert('Delete request?', `"${r.title}" will be removed.`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => deleteRequest(r.id) },
                      ])}
                      style={styles.reqAction}
                    >
                      <X size={15} color="#EF4444" />
                      <Text style={[styles.reqActionText, { color: '#EF4444' }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      <QuickAddSheet visible={showAdd} date={selected} onClose={() => setShowAdd(false)} colors={colors} />
      <RequestSheet
        visible={showRequest}
        date={selected}
        onClose={() => setShowRequest(false)}
        colors={colors}
        onCreate={(r) => {
          const cat = SERVICE_CATEGORIES.find((c) => c.key === r.category);
          createRequest({
            ...r,
            tags: cat ? [cat.label] : [],
            creatorId: user?.id || '',
            createdBy: { name: user?.fullName || user?.username || 'You', avatar: user?.avatar || '' },
          });
          setTab('requests');
        }}
      />
    </View>
  );
}

function ActionChip({ icon, label, onPress, colors }: { icon: React.ReactNode; label: string; onPress: () => void; colors: any }) {
  return (
    <TouchableOpacity style={[styles.action, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => { haptic(); onPress(); }}>
      {icon}
      <Text style={[styles.actionText, { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  headerBack: { paddingRight: 8, paddingVertical: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  segment: { flexDirection: 'row', marginHorizontal: 16, marginTop: 6, marginBottom: 12, padding: 3, borderRadius: 11 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 9 },
  segText: { fontSize: 14, fontWeight: '700' },
  segBadge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  segBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '800' },

  calCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8, paddingTop: 10, paddingBottom: 6 },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 8 },
  calTitleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  calTitle: { fontSize: 15, fontWeight: '700' },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dayBubble: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontSize: 15, fontWeight: '600' },
  dot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 3 },

  dayHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  dayTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  daySub: { fontSize: 14, marginTop: 2 },
  todayPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  todayText: { fontSize: 13, fontWeight: '700' },
  progressTrack: { height: 4, borderRadius: 2, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },

  actions: { gap: 8, paddingVertical: 14 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  actionText: { fontSize: 13, fontWeight: '700' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  rowTime: { width: 62 },
  rowTimeMain: { fontSize: 13, fontWeight: '700' },
  rowTimeSub: { fontSize: 11, marginTop: 2 },
  rowBar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowTitleDone: { textDecorationLine: 'line-through' },
  rowMetaLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  rowLabel: { fontSize: 12, fontWeight: '700' },
  rowSub: { fontSize: 12, flexShrink: 1 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tip: { fontSize: 12, textAlign: 'center', marginTop: 6 },

  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 10 },
  muted: { fontSize: 14, paddingVertical: 16, textAlign: 'center' },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 28, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed' },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  emptySub: { fontSize: 13 },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: '#F59E0B14', borderWidth: 1, borderColor: '#F59E0B55', marginBottom: 12 },
  bannerTitle: { fontSize: 14, fontWeight: '800', color: '#B45309' },
  bannerSub: { fontSize: 12, marginTop: 1 },
  postBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  postIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F59E0B1F', alignItems: 'center', justifyContent: 'center' },
  postTitle: { fontSize: 15, fontWeight: '800' },
  postSub: { fontSize: 13, marginTop: 2 },
  reqCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginBottom: 10, overflow: 'hidden' },
  reqTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  reqTitle: { fontSize: 15, fontWeight: '700' },
  reqMeta: { fontSize: 12, marginTop: 3 },
  reqImage: { height: 120, marginHorizontal: 14, borderRadius: 10, marginBottom: 10 },
  reqResp: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingBottom: 10 },
  reqActions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  reqAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11 },
  reqActionText: { fontSize: 13, fontWeight: '700' },
  status: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '800' },

  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetTitle: { fontSize: 16, fontWeight: '700' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  saveText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  titleInput: { fontSize: 22, fontWeight: '700', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  fieldLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '700' },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  input: { flex: 1, fontSize: 15 },
  notes: { minHeight: 90, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15 },
  photoPick: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 64, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', overflow: 'hidden' },
  photoPreview: { width: '100%', height: '100%' },
  hint: { fontSize: 13, textAlign: 'center' },
});
