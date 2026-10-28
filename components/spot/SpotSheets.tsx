import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ImageIcon, StickyNote, Smile, Trash2, ArrowUpToLine, Minus, Plus, Pencil, X } from 'lucide-react-native';
import { NOTE_COLORS, REACTIONS, STICKER_GROUPS, type SpotItem } from '@/lib/spot';

// ─────────────────────────────────────────────────────────────────────────────
// Bottom sheet shell
// ─────────────────────────────────────────────────────────────────────────────
function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.anchor} pointerEvents="box-none">
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 14 }]}>
          <View style={styles.grab} />
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add: stickers / note / photo
// ─────────────────────────────────────────────────────────────────────────────
type AddTab = 'stickers' | 'note' | 'photo';

export function AddSheet({ visible, onClose, onSticker, onNote, onPhoto, uploading }: {
  visible: boolean;
  onClose: () => void;
  onSticker: (emoji: string) => void;
  onNote: (text: string, color: string) => void;
  onPhoto: (source: 'camera' | 'library') => void;
  uploading: boolean;
}) {
  const [tab, setTab] = useState<AddTab>('stickers');
  const [text, setText] = useState('');
  const [color, setColor] = useState(NOTE_COLORS[0]);

  useEffect(() => { if (visible) { setText(''); } }, [visible]);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.tabs}>
        {([
          { key: 'stickers', label: 'Items', icon: Smile },
          { key: 'note', label: 'Note', icon: StickyNote },
          { key: 'photo', label: 'Photo', icon: ImageIcon },
        ] as const).map((t) => {
          const on = tab === t.key;
          const Icon = t.icon;
          return (
            <TouchableOpacity key={t.key} style={[styles.tab, on && styles.tabOn]} onPress={() => setTab(t.key)} accessibilityState={{ selected: on }}>
              <Icon size={17} color={on ? '#111' : '#6B7280'} />
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'stickers' ? (
        <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
          {STICKER_GROUPS.map((g) => (
            <View key={g.title} style={{ marginBottom: 12 }}>
              <Text style={styles.groupTitle}>{g.title}</Text>
              <View style={styles.grid}>
                {g.items.map((e) => (
                  <TouchableOpacity key={e} style={styles.cell} onPress={() => onSticker(e)} accessibilityLabel={`Add ${e}`}>
                    <Text style={{ fontSize: 30 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      ) : tab === 'note' ? (
        <View style={{ gap: 14 }}>
          <View style={[styles.notePreview, { backgroundColor: color }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Write a note for the room…"
              placeholderTextColor="rgba(31,41,55,0.45)"
              style={styles.noteInput}
              multiline
              maxLength={140}
              autoFocus
            />
          </View>
          <View style={styles.swatches}>
            {NOTE_COLORS.map((c) => (
              <TouchableOpacity key={c} onPress={() => setColor(c)} style={[styles.swatch, { backgroundColor: c }, c === color && styles.swatchOn]} accessibilityLabel="Note colour" />
            ))}
          </View>
          <TouchableOpacity
            style={[styles.primary, !text.trim() && { opacity: 0.4 }]}
            disabled={!text.trim()}
            onPress={() => onNote(text.trim(), color)}
          >
            <Text style={styles.primaryText}>Stick it in the room</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 14 }}>
          <View style={styles.photoIcon}><ImageIcon size={30} color="#7C3AED" /></View>
          <Text style={styles.photoText}>Snap something — a car, a pair of shoes, your dog — then trace around it and only that part lands in the room. ✂️</Text>
          <TouchableOpacity style={[styles.primary, { alignSelf: 'stretch' }]} onPress={() => onPhoto('camera')} disabled={uploading} accessibilityLabel="Take a photo">
            {uploading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Take a photo</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primary, { alignSelf: 'stretch', backgroundColor: '#F3F4F6' }]} onPress={() => onPhoto('library')} disabled={uploading} accessibilityLabel="Choose from library">
            <Text style={[styles.primaryText, { color: '#111' }]}>Choose from library</Text>
          </TouchableOpacity>
        </View>
      )}
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Item menu (long-press)
// ─────────────────────────────────────────────────────────────────────────────
export function ItemMenu({ item, myId, canRemove, onClose, onReact, onResize, onFront, onEdit, onRemove }: {
  item: SpotItem | null;
  myId: string;
  canRemove: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onResize: (delta: number) => void;
  onFront: () => void;
  onEdit: (text: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  useEffect(() => { setEditing(false); setText(item?.text || ''); }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;
  const label = item.kind === 'sticker' ? `${item.emoji} added by` : item.kind === 'note' ? 'Note by' : 'Photo by';
  return (
    <Sheet visible={!!item} onClose={onClose}>
      <View style={styles.menuHead}>
        <Text style={styles.menuTitle}>{label} {item.ownerId === myId ? 'you' : item.ownerName}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={10}><X size={20} color="#6B7280" /></TouchableOpacity>
      </View>

      <View style={styles.reactRow}>
        {REACTIONS.map((e) => {
          const mine = (item.reactions[e] || []).includes(myId);
          return (
            <TouchableOpacity key={e} onPress={() => onReact(e)} style={[styles.reactBtn, mine && styles.reactOn]} accessibilityLabel={`React ${e}`}>
              <Text style={{ fontSize: 26 }}>{e}</Text>
              {item.reactions[e]?.length ? <Text style={styles.reactCount}>{item.reactions[e].length}</Text> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {editing ? (
        <View style={{ gap: 10 }}>
          <TextInput value={text} onChangeText={setText} style={styles.editInput} multiline maxLength={140} autoFocus />
          <TouchableOpacity style={styles.primary} onPress={() => { onEdit(text.trim()); setEditing(false); }}>
            <Text style={styles.primaryText}>Save note</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.action} onPress={() => onResize(-0.2)}><Minus size={18} color="#111" /><Text style={styles.actionText}>Smaller</Text></TouchableOpacity>
          <TouchableOpacity style={styles.action} onPress={() => onResize(0.2)}><Plus size={18} color="#111" /><Text style={styles.actionText}>Bigger</Text></TouchableOpacity>
          <TouchableOpacity style={styles.action} onPress={onFront}><ArrowUpToLine size={18} color="#111" /><Text style={styles.actionText}>To front</Text></TouchableOpacity>
          {item.kind === 'note' && item.ownerId === myId ? (
            <TouchableOpacity style={styles.action} onPress={() => setEditing(true)}><Pencil size={18} color="#111" /><Text style={styles.actionText}>Edit</Text></TouchableOpacity>
          ) : null}
          {canRemove ? (
            <TouchableOpacity style={styles.action} onPress={onRemove}><Trash2 size={18} color="#EF4444" /><Text style={[styles.actionText, { color: '#EF4444' }]}>Remove</Text></TouchableOpacity>
          ) : null}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 8 },
  grab: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 12 },
  tabs: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 3, marginBottom: 14 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10 },
  tabOn: { backgroundColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tabText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  tabTextOn: { color: '#111' },
  groupTitle: { fontSize: 12, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '16.66%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  notePreview: { borderRadius: 10, padding: 14, minHeight: 120 },
  noteInput: { fontSize: 17, fontWeight: '600', color: '#1F2937', minHeight: 90, textAlignVertical: 'top' },
  swatches: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'rgba(0,0,0,0.08)' },
  swatchOn: { borderColor: '#111', transform: [{ scale: 1.15 }] },
  primary: { backgroundColor: '#111827', borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  photoIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' },
  photoText: { fontSize: 14, color: '#4B5563', textAlign: 'center', paddingHorizontal: 20 },
  menuHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  menuTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  reactRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  reactBtn: { width: 50, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  reactOn: { backgroundColor: '#E0F2FE', borderWidth: 1.5, borderColor: '#38BDF8' },
  reactCount: { fontSize: 11, fontWeight: '800', color: '#0369A1', marginTop: -2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 42, borderRadius: 21, backgroundColor: '#F3F4F6' },
  actionText: { fontSize: 14, fontWeight: '700', color: '#111' },
  editInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, minHeight: 80, fontSize: 16, textAlignVertical: 'top' },
});
