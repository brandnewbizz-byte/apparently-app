import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CalendarDays, Clock, MapPin, Play, Users } from 'lucide-react-native';
import { categoryMeta, formatMoney } from '@/lib/listingCategories';
import type { BuilderColors } from '@/components/builder/BuilderKit';

interface BundlePreviewProps {
  title: string; price: number; value: number; coverUri: string | null; isVideo: boolean; category: string;
  location: string; when: string; items: { name: string; price: number }[]; spots: number; tags: string[];
  creatorName: string; accent: string; colors: BuilderColors;
}

/** Roughly what a bundle card looks like to other people on Home. */
export function BundlePreview(p: BundlePreviewProps) {
  const cat = categoryMeta(p.category);
  const save = p.value > p.price && p.price > 0 ? Math.round((1 - p.price / p.value) * 100) : 0;
  const named = p.items.filter((i) => i.name.trim());
  return (
    <View style={[st.card, { backgroundColor: p.colors.surface, borderColor: p.colors.border }]}>
      <View style={st.coverWrap}>
        {p.coverUri ? (
          p.isVideo ? <View style={[st.cover, st.video]}><Play size={30} color="#FFF" fill="#FFF" /></View>
            : <Image source={{ uri: p.coverUri }} style={st.cover} />
        ) : (
          <LinearGradient colors={[p.accent, `${p.accent}99`]} style={[st.cover, st.center]}>
            <Text style={{ fontSize: 44 }}>{cat.icon}</Text>
          </LinearGradient>
        )}
        <View style={[st.priceBadge, { backgroundColor: p.accent }]}>
          <Text style={st.priceText}>{p.price > 0 ? formatMoney(p.price) : '$—'}</Text>
        </View>
        {save > 0 ? <View style={st.saveBadge}><Text style={st.saveText}>Save {save}%</Text></View> : null}
      </View>
      <View style={st.body}>
        <Text style={[st.kicker, { color: p.accent }]}>{cat.icon} {cat.label.toUpperCase()} BUNDLE</Text>
        <Text style={[st.title, { color: p.colors.text }]} numberOfLines={2}>{p.title.trim() || 'Your bundle title'}</Text>
        <Text style={[st.by, { color: p.colors.textSecondary }]}>by {p.creatorName}</Text>
        <View style={st.metaRow}>
          {p.location.trim() ? <Meta icon={<MapPin size={13} color={p.colors.textTertiary} />} text={p.location.trim()} colors={p.colors} /> : null}
          {p.when.trim() ? <Meta icon={<CalendarDays size={13} color={p.colors.textTertiary} />} text={p.when.trim()} colors={p.colors} /> : null}
          <Meta icon={<Users size={13} color={p.colors.textTertiary} />} text={`${p.spots} spot${p.spots === 1 ? '' : 's'}`} colors={p.colors} />
        </View>
        <View style={[st.items, { borderTopColor: p.colors.border }]}>
          {(named.length ? named : [{ name: 'Add what’s included', price: 0 }]).slice(0, 4).map((i, k) => (
            <View key={k} style={st.itemRow}>
              <View style={[st.dot, { backgroundColor: p.accent }]} />
              <Text style={[st.itemName, { color: named.length ? p.colors.text : p.colors.textTertiary }]} numberOfLines={1}>{i.name}</Text>
              {i.price > 0 ? <Text style={[st.itemPrice, { color: p.colors.textSecondary }]}>{formatMoney(i.price)}</Text> : null}
            </View>
          ))}
          {named.length > 4 ? <Text style={[st.more, { color: p.colors.textTertiary }]}>+{named.length - 4} more</Text> : null}
        </View>
        {p.tags.length ? <Text style={[st.tags, { color: p.accent }]}>{p.tags.map((t) => `#${t}`).join('  ')}</Text> : null}
      </View>
    </View>
  );
}

interface SkillPreviewProps {
  title: string; icon: string; price: number; regular: number; coverUri: string | null; category: string;
  description: string; spots: number; endsLabel: string | null; tags: string[]; creatorName: string; accent: string; colors: BuilderColors;
}

/** Roughly what a skill deal card looks like on Home. */
export function SkillPreview(p: SkillPreviewProps) {
  const cat = categoryMeta(p.category);
  const off = p.regular > p.price && p.price > 0 ? Math.round((1 - p.price / p.regular) * 100) : 0;
  return (
    <View style={[st.card, { backgroundColor: p.colors.surface, borderColor: p.colors.border }]}>
      <View style={st.coverWrap}>
        {p.coverUri ? <Image source={{ uri: p.coverUri }} style={st.cover} /> : (
          <LinearGradient colors={[p.accent, `${p.accent}99`]} style={[st.cover, st.center]}>
            <Text style={{ fontSize: 48 }}>{p.icon}</Text>
          </LinearGradient>
        )}
        {p.endsLabel ? (
          <View style={st.timer}><Clock size={12} color="#FFF" /><Text style={st.timerText}>{p.endsLabel}</Text></View>
        ) : null}
        {off > 0 ? <View style={[st.saveBadge, { left: undefined, right: 10 }]}><Text style={st.saveText}>{off}% off</Text></View> : null}
      </View>
      <View style={st.body}>
        <Text style={[st.kicker, { color: p.accent }]}>{cat.icon} {cat.label.toUpperCase()} · SKILL DEAL</Text>
        <View style={st.skillTitleRow}>
          <Text style={{ fontSize: 20 }}>{p.icon}</Text>
          <Text style={[st.title, { color: p.colors.text, flex: 1 }]} numberOfLines={2}>{p.title.trim() || 'Your skill'}</Text>
        </View>
        <Text style={[st.by, { color: p.colors.textSecondary }]}>by {p.creatorName}</Text>
        {p.description.trim() ? <Text style={[st.desc, { color: p.colors.textSecondary }]} numberOfLines={3}>{p.description.trim()}</Text> : null}
        <View style={[st.footer, { borderTopColor: p.colors.border }]}>
          <View style={st.priceRow}>
            <Text style={[st.bigPrice, { color: p.accent }]}>{p.price > 0 ? formatMoney(p.price) : '$—'}</Text>
            {off > 0 ? <Text style={[st.was, { color: p.colors.textTertiary }]}>{formatMoney(p.regular)}</Text> : null}
          </View>
          <Meta icon={<Users size={13} color={p.colors.textTertiary} />} text={`${p.spots} spot${p.spots === 1 ? '' : 's'}`} colors={p.colors} />
        </View>
        {p.tags.length ? <Text style={[st.tags, { color: p.accent }]}>{p.tags.map((t) => `#${t}`).join('  ')}</Text> : null}
      </View>
    </View>
  );
}

function Meta({ icon, text, colors }: { icon: React.ReactNode; text: string; colors: BuilderColors }) {
  return (
    <View style={st.meta}>{icon}<Text style={[st.metaText, { color: colors.textSecondary }]} numberOfLines={1}>{text}</Text></View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  coverWrap: { aspectRatio: 16 / 9, position: 'relative' },
  cover: { width: '100%', height: '100%' },
  center: { alignItems: 'center', justifyContent: 'center' },
  video: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D0D12' },
  priceBadge: { position: 'absolute', right: 10, bottom: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  priceText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  saveBadge: { position: 'absolute', left: 10, top: 10, backgroundColor: '#10B981', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  saveText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  timer: { position: 'absolute', left: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  timerText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  body: { padding: 14 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 4 },
  title: { fontSize: 18, fontWeight: '800' },
  skillTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  by: { fontSize: 13, marginTop: 2 },
  desc: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  metaText: { fontSize: 13 },
  items: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 10, gap: 7 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  itemName: { flex: 1, fontSize: 14, fontWeight: '600' },
  itemPrice: { fontSize: 13 },
  more: { fontSize: 12, marginLeft: 14 },
  tags: { fontSize: 13, fontWeight: '600', marginTop: 10 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 10 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  bigPrice: { fontSize: 22, fontWeight: '800' },
  was: { fontSize: 15, textDecorationLine: 'line-through' },
});
