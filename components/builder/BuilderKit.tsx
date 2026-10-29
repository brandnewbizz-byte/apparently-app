import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Camera, Check, ImagePlus, Minus, Play, Plus, X } from 'lucide-react-native';
import { LISTING_CATEGORIES } from '@/lib/listingCategories';

/** Theme colors the builder pieces need (from useTheme().colors). */
export interface BuilderColors {
  background: string; surface: string; surfaceHighlight: string; border: string;
  text: string; textSecondary: string; textTertiary: string; error: string; success: string;
}

/** A titled card section with an optional number badge and hint. */
export function Section({ n, title, hint, right, colors, children }: {
  n?: number; title: string; hint?: string; right?: React.ReactNode; colors: BuilderColors; children: React.ReactNode;
}) {
  return (
    <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={s.sectionHead}>
        {n ? (
          <View style={[s.stepBadge, { backgroundColor: colors.surfaceHighlight }]}>
            <Text style={[s.stepBadgeText, { color: colors.textSecondary }]}>{n}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>{title}</Text>
          {hint ? <Text style={[s.sectionHint, { color: colors.textTertiary }]}>{hint}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

/** Labelled text field. */
export function Field({ label, colors, counter, error, style, ...input }: React.ComponentProps<typeof TextInput> & {
  label?: string; colors: BuilderColors; counter?: { value: number; max: number }; error?: string | null;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      {label || counter ? (
        <View style={s.labelRow}>
          {label ? <Text style={[s.label, { color: colors.textSecondary }]}>{label}</Text> : <View />}
          {counter ? <Text style={[s.counter, { color: counter.value > counter.max * 0.9 ? colors.error : colors.textTertiary }]}>{counter.value}/{counter.max}</Text> : null}
        </View>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textTertiary}
        onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); input.onBlur?.(e); }}
        style={[
          s.input,
          { backgroundColor: colors.background, color: colors.text, borderColor: error ? colors.error : focused ? colors.text : colors.border },
          input.multiline && s.multiline,
          style,
        ]}
        {...input}
      />
      {error ? <Text style={[s.error, { color: colors.error }]}>{error}</Text> : null}
    </View>
  );
}

/** Wrapping grid of emoji chips; one selected. */
export function CategoryGrid({ value, onChange, accent, colors }: {
  value: string; onChange: (k: string) => void; accent: string; colors: BuilderColors;
}) {
  return (
    <View style={s.chipWrap}>
      {LISTING_CATEGORIES.map((c) => {
        const on = value === c.key;
        return (
          <TouchableOpacity
            key={c.key}
            onPress={() => onChange(c.key)}
            activeOpacity={0.75}
            style={[s.catChip, { borderColor: on ? accent : colors.border, backgroundColor: on ? `${accent}18` : colors.background }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Text style={s.catEmoji}>{c.icon}</Text>
            <Text style={[s.catLabel, { color: on ? accent : colors.text }]}>{c.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Small pill choices (quick picks). */
export function Pills({ options, value, onChange, accent, colors }: {
  options: { key: string; label: string }[]; value?: string; onChange: (k: string) => void; accent: string; colors: BuilderColors;
}) {
  return (
    <View style={s.chipWrap}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <TouchableOpacity key={o.key} onPress={() => onChange(o.key)} activeOpacity={0.75}
            style={[s.pill, { borderColor: on ? accent : colors.border, backgroundColor: on ? accent : colors.background }]}>
            <Text style={[s.pillText, { color: on ? '#FFFFFF' : colors.text }]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** − 3 + counter. */
export function Stepper({ value, onChange, min = 1, max = 999, colors, suffix }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; colors: BuilderColors; suffix?: string;
}) {
  const btn = (disabled: boolean) => [s.stepBtn, { borderColor: colors.border, backgroundColor: colors.background, opacity: disabled ? 0.4 : 1 }];
  return (
    <View style={s.stepper}>
      <TouchableOpacity style={btn(value <= min)} disabled={value <= min} onPress={() => onChange(Math.max(min, value - 1))} accessibilityLabel="Fewer">
        <Minus size={18} color={colors.text} />
      </TouchableOpacity>
      <View style={s.stepValueWrap}>
        <TextInput
          value={String(value)}
          onChangeText={(t) => { const n = parseInt(t.replace(/\D/g, ''), 10); onChange(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min); }}
          keyboardType="number-pad"
          style={[s.stepValue, { color: colors.text }]}
          maxLength={4}
        />
        {suffix ? <Text style={[s.stepSuffix, { color: colors.textTertiary }]}>{suffix}</Text> : null}
      </View>
      <TouchableOpacity style={btn(value >= max)} disabled={value >= max} onPress={() => onChange(Math.min(max, value + 1))} accessibilityLabel="More">
        <Plus size={18} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

/** Big 16:9 cover tile: pick, replace, remove. */
export function CoverPicker({ uri, isVideo, onPick, onRemove, busy, accent, colors, label = 'Add a cover photo', sub }: {
  uri: string | null; isVideo?: boolean; onPick: () => void; onRemove: () => void; busy?: boolean;
  accent: string; colors: BuilderColors; label?: string; sub?: string;
}) {
  return (
    <Pressable onPress={onPick} style={[s.cover, { borderColor: uri ? 'transparent' : colors.border, backgroundColor: colors.surfaceHighlight }]} accessibilityRole="button" accessibilityLabel={uri ? 'Change cover' : label}>
      {uri ? (
        <>
          {isVideo ? (
            <View style={[s.coverImg, s.videoTile]}><Play size={34} color="#FFF" fill="#FFF" /></View>
          ) : (
            <Image source={{ uri }} style={s.coverImg} />
          )}
          <View style={s.coverActions}>
            <View style={s.coverBtn}><Camera size={14} color="#FFF" /><Text style={s.coverBtnText}>Change</Text></View>
            <TouchableOpacity onPress={onRemove} style={s.coverBtn} hitSlop={8} accessibilityLabel="Remove cover">
              <X size={14} color="#FFF" />
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={s.coverEmpty}>
          <View style={[s.coverIcon, { backgroundColor: `${accent}1F` }]}><ImagePlus size={26} color={accent} /></View>
          <Text style={[s.coverLabel, { color: colors.text }]}>{label}</Text>
          {sub ? <Text style={[s.coverSub, { color: colors.textTertiary }]}>{sub}</Text> : null}
        </View>
      )}
      {busy ? <View style={s.coverBusy}><ActivityIndicator color="#FFF" /></View> : null}
    </Pressable>
  );
}

/** Up to `max` hashtags with one-tap suggestions. */
export function TagEditor({ tags, onChange, ideas = [], max = 5, accent, colors }: {
  tags: string[]; onChange: (t: string[]) => void; ideas?: string[]; max?: number; accent: string; colors: BuilderColors;
}) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const t = raw.trim().replace(/^#/, '').replace(/\s+/g, ' ').slice(0, 24);
    if (!t || tags.length >= max || tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    onChange([...tags, t]);
    setDraft('');
  };
  const free = ideas.filter((i) => !tags.some((t) => t.toLowerCase() === i.toLowerCase()));
  return (
    <View>
      <View style={[s.tagBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
        {tags.map((t) => (
          <TouchableOpacity key={t} onPress={() => onChange(tags.filter((x) => x !== t))} style={[s.tag, { backgroundColor: `${accent}1A` }]} accessibilityLabel={`Remove ${t}`}>
            <Text style={[s.tagText, { color: accent }]}>#{t}</Text>
            <X size={12} color={accent} />
          </TouchableOpacity>
        ))}
        {tags.length < max ? (
          <TextInput
            value={draft}
            onChangeText={(v) => (v.endsWith(',') ? add(v.slice(0, -1)) : setDraft(v))}
            onSubmitEditing={() => add(draft)}
            placeholder={tags.length ? 'Add another' : 'Type a tag and press enter'}
            placeholderTextColor={colors.textTertiary}
            style={[s.tagInput, { color: colors.text }]}
            returnKeyType="done"
            blurOnSubmit={false}
          />
        ) : null}
      </View>
      {free.length && tags.length < max ? (
        <View style={[s.chipWrap, { marginTop: 8 }]}>
          {free.slice(0, 4).map((i) => (
            <TouchableOpacity key={i} onPress={() => add(i)} style={[s.idea, { borderColor: colors.border }]}>
              <Plus size={12} color={colors.textSecondary} />
              <Text style={[s.ideaText, { color: colors.textSecondary }]}>{i}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Ready-to-post checklist shown above the post button. */
export function ReadyList({ items, colors }: { items: { label: string; done: boolean }[]; colors: BuilderColors }) {
  return (
    <View style={s.readyRow}>
      {items.map((i) => (
        <View key={i.label} style={s.readyItem}>
          <View style={[s.readyDot, { backgroundColor: i.done ? colors.success : 'transparent', borderColor: i.done ? colors.success : colors.border }]}>
            {i.done ? <Check size={10} color="#FFF" strokeWidth={3} /> : null}
          </View>
          <Text style={[s.readyText, { color: i.done ? colors.textSecondary : colors.textTertiary }]}>{i.label}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  section: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  stepBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepBadgeText: { fontSize: 12, fontWeight: '800' },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  sectionHint: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '700' },
  counter: { fontSize: 12 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  multiline: { minHeight: 92, textAlignVertical: 'top', lineHeight: 21, paddingTop: 13 },
  error: { fontSize: 12, marginTop: 5, marginLeft: 2 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5 },
  catEmoji: { fontSize: 15 },
  catLabel: { fontSize: 14, fontWeight: '600' },
  pill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 14, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  stepBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepValueWrap: { width: 56, alignItems: 'center' },
  stepValue: { width: 56, fontSize: 22, fontWeight: '800', textAlign: 'center', padding: 0 },
  stepSuffix: { fontSize: 11, marginTop: -2 },
  cover: { borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', overflow: 'hidden', aspectRatio: 16 / 9, marginBottom: 14 },
  coverImg: { width: '100%', height: '100%' },
  videoTile: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D0D12' },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 16 },
  coverIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  coverLabel: { fontSize: 16, fontWeight: '700' },
  coverSub: { fontSize: 13, textAlign: 'center' },
  coverActions: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', gap: 8 },
  coverBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999 },
  coverBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  coverBusy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  tagBox: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, minHeight: 50 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  tagText: { fontSize: 13, fontWeight: '700' },
  tagInput: { flexGrow: 1, minWidth: 120, fontSize: 15, paddingVertical: 6 },
  idea: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderStyle: 'dashed' },
  ideaText: { fontSize: 13, fontWeight: '600' },
  readyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10 },
  readyItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  readyDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  readyText: { fontSize: 12, fontWeight: '600' },
});
