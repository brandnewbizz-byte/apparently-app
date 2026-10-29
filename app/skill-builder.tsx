import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, Zap, ChevronDown } from 'lucide-react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useSkills, type UserSkill } from '@/contexts/SkillContext';
import { Section, Field, CategoryGrid, Pills, Stepper, CoverPicker, TagEditor, ReadyList } from '@/components/builder/BuilderKit';
import { SkillPreview } from '@/components/builder/ListingPreview';
import { pickCover, uploadCover, confirmDiscard, type PickedCover } from '@/lib/coverMedia';
import {
  TAG_IDEAS, SKILL_EMOJIS, DEAL_LENGTHS, categoryMeta, cleanMoneyInput, parseMoney, formatMoney,
} from '@/lib/listingCategories';

const ACCENT = '#3B82F6';

function endsLabel(lengthKey: string, keepAt: string | null): string | null {
  if (lengthKey === 'keep' && keepAt) {
    const secs = Math.max(0, Math.floor((Date.parse(keepAt) - Date.now()) / 1000));
    if (secs <= 0) return 'Ended';
    const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600);
    return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
  }
  const len = DEAL_LENGTHS.find((l) => l.key === lengthKey);
  if (!len || len.hours === null) return null;
  return len.hours < 48 ? `${len.hours}h left` : `${Math.round(len.hours / 24)}d left`;
}

/** Waits for the skill to load when editing, then shows the form filled in. */
export default function SkillBuilderScreen() {
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const { mySkills } = useSkills();
  const editing = editId ? mySkills.find((s) => s.id === editId) : undefined;
  if (editId && !editing) return <LoadingListing />;
  return <SkillForm key={editing?.id || 'new'} editing={editing} />;
}

function LoadingListing() {
  const { colors } = useTheme();
  const router = useRouter();
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 4000); return () => clearTimeout(t); }, []);
  return (
    <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {slow ? (
        <>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Couldn’t find this skill</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}><Text style={{ color: ACCENT, fontWeight: '700' }}>Go back</Text></TouchableOpacity>
        </>
      ) : <ActivityIndicator color={ACCENT} />}
    </View>
  );
}

function SkillForm({ editing }: { editing?: UserSkill }) {
  const router = useRouter();
  const editId = editing?.id;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { createSkill, updateSkill } = useSkills();
  const { requireListing, plan } = useSubscription();
  const isEdit = !!editing;

  useEffect(() => { if (!isEdit && plan.loaded) requireListing(); }, [plan.loaded, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  const [cover, setCover] = useState<PickedCover | null>(editing?.imageUrl ? { uri: editing.imageUrl, type: 'image' } : null);
  const [icon, setIcon] = useState(editing?.icon || '🛠️');
  const [showIcons, setShowIcons] = useState(false);
  const [title, setTitle] = useState(editing?.title || '');
  const [category, setCategory] = useState(editing?.category || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [price, setPrice] = useState(editing?.price ? String(editing.price) : '');
  const [regular, setRegular] = useState(editing && editing.originalPrice > editing.price ? String(editing.originalPrice) : '');
  const [spots, setSpots] = useState(Math.max(editing?.availableCount || 10, 1));
  // Editing keeps the current end time unless they pick a new length.
  const [length, setLength] = useState(editing ? (editing.expiresAt ? 'keep' : 'none') : '7d');
  const [keepAt] = useState<string | null>(editing?.expiresAt || null);
  const [tags, setTags] = useState<string[]>(editing?.tags?.filter((t) => t !== 'Skill') || []);
  const [saving, setSaving] = useState<null | 'upload' | 'save'>(null);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const dirty = useRef(false);


  const touch = <T,>(fn: (v: T) => void) => (v: T) => { dirty.current = true; fn(v); };

  const priceNum = parseMoney(price);
  const regularNum = parseMoney(regular);
  const off = regularNum > priceNum && priceNum > 0 ? Math.round((1 - priceNum / regularNum) * 100) : 0;
  const problems = {
    title: title.trim().length < 3 ? 'Name your skill (at least 3 characters).' : null,
    price: priceNum <= 0 ? 'Set a price.' : null,
    regular: regular && regularNum <= priceNum ? 'The regular price should be higher than the deal price, or leave it empty.' : null,
  };
  const ready = !problems.title && !problems.price && !problems.regular;
  const err = (k: keyof typeof problems) => (triedSubmit || k === 'regular' ? problems[k] : null);

  const lengthOptions = [
    ...(keepAt ? [{ key: 'keep', label: endsLabel('keep', keepAt) === 'Ended' ? 'Ended' : `Keep (${endsLabel('keep', keepAt)})` }] : []),
    ...DEAL_LENGTHS.map((l) => ({ key: l.key, label: l.label })),
  ];

  const chooseCover = async () => {
    const picked = await pickCover(false);
    if (picked) { dirty.current = true; setCover(picked); }
  };

  const goBack = useCallback(() => {
    if (!dirty.current || saving) { router.back(); return; }
    confirmDiscard(isEdit ? 'Your changes to this skill will be lost.' : 'This skill hasn’t been posted yet.', () => router.back());
  }, [router, saving, isEdit]);

  const submit = async () => {
    setTriedSubmit(true);
    if (!ready || saving) return;
    if (!isEdit && !(await requireListing())) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let imageUrl = '';
    try {
      setSaving('upload');
      imageUrl = (await uploadCover(cover, `skills/${user?.id || 'anon'}`)).imageUrl;
    } catch (e) {
      setSaving(null);
      Alert.alert('Cover didn’t upload', `${e instanceof Error ? e.message : 'Upload failed.'} Try again, or remove the cover to post without one.`);
      return;
    }
    setSaving('save');

    const len = DEAL_LENGTHS.find((l) => l.key === length);
    const expiresAt = length === 'keep' ? keepAt : len?.hours ? new Date(Date.now() + len.hours * 3600_000).toISOString() : null;
    const common = {
      title: title.trim(),
      description: description.trim(),
      icon,
      price: priceNum,
      originalPrice: regularNum > priceNum ? regularNum : priceNum,
      imageUrl,
      category: category || 'other',
      tags,
      availableCount: spots,
      expiresAt,
    };

    if (isEdit && editId) {
      updateSkill(editId, common);
    } else {
      const res = await createSkill({
        ...common,
        creator: { name: user?.fullName || user?.username || 'You', avatar: user?.avatar || '', rating: 5.0, reviews: 0 },
        creatorId: user?.id || '',
        providerLink: undefined,
        deliveryNotes: undefined,
        resourcesNeeded: undefined,
        expiresIn: expiresAt ? Math.floor((Date.parse(expiresAt) - Date.now()) / 1000) : undefined,
      });
      if (!res.success) {
        setSaving(null);
        Alert.alert('Can’t post right now', res.error || 'Please try again.');
        return;
      }
    }
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    dirty.current = false;
    setSaving(null);
    router.back();
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={goBack} style={[styles.headerBtn, { backgroundColor: colors.surfaceHighlight }]} accessibilityLabel="Back" testID="builder-back">
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{isEdit ? 'Edit skill deal' : 'New skill deal'}</Text>
          <Text style={[styles.headerSub, { color: colors.textTertiary }]}>Offer one service at a deal price</Text>
        </View>
        <View style={[styles.kindIcon, { backgroundColor: `${ACCENT}1F` }]}><Zap size={18} color={ACCENT} /></View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 170 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <CoverPicker uri={cover?.uri || null} onPick={chooseCover} onRemove={() => { dirty.current = true; setCover(null); }}
          accent={ACCENT} colors={colors} label="Add a cover photo" sub="Show your work. Without one we use your icon." />

        <Section n={1} title="Your skill" colors={colors}>
          <View style={styles.titleRow}>
            <TouchableOpacity onPress={() => setShowIcons((v) => !v)} style={[styles.iconBtn, { borderColor: showIcons ? ACCENT : colors.border, backgroundColor: colors.background }]}
              accessibilityLabel="Choose an icon" testID="skill-icon">
              <Text style={{ fontSize: 26 }}>{icon}</Text>
              <ChevronDown size={12} color={colors.textTertiary} style={styles.iconCaret} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Field colors={colors} value={title} onChangeText={touch(setTitle)} maxLength={60} placeholder="e.g. Haircut at your place"
                error={err('title')} testID="skill-title" style={{ height: 54 }} />
            </View>
          </View>
          {showIcons ? (
            <View style={[styles.emojiGrid, { borderColor: colors.border, backgroundColor: colors.background }]}>
              {SKILL_EMOJIS.map((e) => (
                <TouchableOpacity key={e} onPress={() => { dirty.current = true; setIcon(e); setShowIcons(false); }}
                  style={[styles.emoji, icon === e && { backgroundColor: `${ACCENT}22` }]}>
                  <Text style={{ fontSize: 24 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <Text style={[styles.label, { color: colors.textSecondary }]}>Category</Text>
          <CategoryGrid value={category} onChange={(k) => { dirty.current = true; setCategory(k); if (icon === '🛠️') setIcon(categoryMeta(k).icon); }} accent={ACCENT} colors={colors} />
          <View style={{ height: 14 }} />
          <Field label="What you offer" colors={colors} value={description} onChangeText={touch(setDescription)} maxLength={300} counter={{ value: description.length, max: 300 }}
            placeholder="What’s included, how long it takes, what people need to have ready" multiline testID="skill-description" />
        </Section>

        <Section n={2} title="Deal price" hint="Add a regular price to show the discount." colors={colors}>
          <View style={styles.priceRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Deal price</Text>
              <View style={[styles.moneyBox, { borderColor: err('price') ? colors.error : colors.border, backgroundColor: colors.background }]}>
                <Text style={[styles.moneySign, { color: colors.text }]}>$</Text>
                <TextInput value={price} onChangeText={(v) => { dirty.current = true; setPrice(cleanMoneyInput(v)); }} placeholder="0" placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad" style={[styles.moneyInput, { color: colors.text }]} testID="skill-price" />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Regular price</Text>
              <View style={[styles.moneyBox, { borderColor: problems.regular ? colors.error : colors.border, backgroundColor: colors.background }]}>
                <Text style={[styles.moneySign, { color: colors.textTertiary, fontSize: 20 }]}>$</Text>
                <TextInput value={regular} onChangeText={(v) => { dirty.current = true; setRegular(cleanMoneyInput(v)); }} placeholder="Optional" placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad" style={[styles.moneyInput, { color: colors.textSecondary, fontSize: 20, textDecorationLine: regularNum > priceNum && priceNum > 0 ? 'line-through' : 'none' }]} testID="skill-regular" />
              </View>
            </View>
          </View>
          {err('price') ? <Text style={[styles.err, { color: colors.error }]}>{err('price')}</Text> : null}
          {problems.regular ? <Text style={[styles.err, { color: colors.error }]}>{problems.regular}</Text> : null}
          {off > 0 ? <View style={styles.offChip}><Text style={styles.offText}>{off}% off · people save {formatMoney(regularNum - priceNum)}</Text></View> : null}
        </Section>

        <Section n={3} title="Spots and timing" colors={colors}>
          <View style={styles.spotsRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.spotsTitle, { color: colors.text }]}>Spots</Text>
              <Text style={[styles.spotsHint, { color: colors.textTertiary }]}>How many people can grab this deal.</Text>
            </View>
            <Stepper value={spots} onChange={(v) => { dirty.current = true; setSpots(v); }} min={1} max={500} colors={colors} />
          </View>
          {editing && editing.grabCount > 0 ? (
            <Text style={[styles.spotsHint, { color: colors.textTertiary, marginTop: 8 }]}>{editing.grabCount} already grabbed · {Math.max(spots - editing.grabCount, 0)} left</Text>
          ) : null}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.spotsTitle, { color: colors.text, marginBottom: 4 }]}>Deal runs for</Text>
          <Text style={[styles.spotsHint, { color: colors.textTertiary, marginBottom: 10 }]}>It comes off Home when time runs out. A countdown shows on the card.</Text>
          <Pills options={lengthOptions} value={length} onChange={touch(setLength)} accent={ACCENT} colors={colors} />
        </Section>

        <Section n={4} title="Tags" hint="Up to 5. They help people find you." colors={colors}>
          <TagEditor tags={tags} onChange={touch(setTags)} ideas={TAG_IDEAS[category || 'other']} accent={ACCENT} colors={colors} />
        </Section>

        <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>How it looks on Home</Text>
        <SkillPreview title={title} icon={icon} price={priceNum} regular={regularNum} coverUri={cover?.uri || null} category={category} description={description}
          spots={spots} endsLabel={endsLabel(length, keepAt)} tags={tags} creatorName={user?.fullName || user?.username || 'You'} accent={ACCENT} colors={colors} />
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <ReadyList colors={colors} items={[
          { label: 'Title', done: !problems.title },
          { label: 'Price', done: !problems.price && !problems.regular },
          { label: 'Description', done: description.trim().length >= 10 },
          { label: 'Cover', done: !!cover },
        ]} />
        <View style={styles.bottomRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={[styles.bottomPrice, { color: colors.text }]}>{priceNum > 0 ? formatMoney(priceNum) : '—'}</Text>
              {off > 0 ? <Text style={[styles.bottomWas, { color: colors.textTertiary }]}>{formatMoney(regularNum)}</Text> : null}
            </View>
            <Text style={[styles.bottomMeta, { color: colors.textTertiary }]}>{spots} spot{spots === 1 ? '' : 's'} · {endsLabel(length, keepAt) || 'no end date'}</Text>
          </View>
          <TouchableOpacity onPress={submit} disabled={!!saving} activeOpacity={0.85} testID="skill-submit"
            style={[styles.postBtn, { backgroundColor: ready ? ACCENT : colors.surfaceHighlight }]}>
            {saving ? <ActivityIndicator color={ready ? '#FFF' : colors.text} /> : null}
            <Text style={[styles.postText, { color: ready ? '#FFF' : colors.textTertiary }]}>
              {saving === 'upload' ? 'Uploading cover…' : saving === 'save' ? 'Saving…' : isEdit ? 'Save changes' : 'Post deal'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerSub: { fontSize: 12, marginTop: 1 },
  kindIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, maxWidth: 640, width: '100%', alignSelf: 'center' },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  titleRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  iconBtn: { width: 54, height: 54, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  iconCaret: { position: 'absolute', right: 4, bottom: 4 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderRadius: 16, padding: 6, marginBottom: 14 },
  emoji: { width: '12.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  priceRow: { flexDirection: 'row', gap: 10 },
  moneyBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, height: 58 },
  moneySign: { fontSize: 24, fontWeight: '800', marginRight: 4 },
  moneyInput: { flex: 1, minWidth: 0, fontSize: 26, fontWeight: '800', padding: 0 },
  err: { fontSize: 12, marginTop: 6 },
  offChip: { alignSelf: 'flex-start', backgroundColor: 'rgba(16,185,129,0.14)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, marginTop: 10 },
  offText: { color: '#059669', fontWeight: '800', fontSize: 13 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  spotsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  spotsTitle: { fontSize: 15, fontWeight: '700' },
  spotsHint: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  previewLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 8, marginBottom: 10, marginLeft: 4 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bottomPrice: { fontSize: 20, fontWeight: '800' },
  bottomWas: { fontSize: 14, textDecorationLine: 'line-through' },
  bottomMeta: { fontSize: 12, marginTop: 1 },
  postBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, paddingVertical: 15, borderRadius: 16 },
  postText: { fontSize: 16, fontWeight: '800' },
});
