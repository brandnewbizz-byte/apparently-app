import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, Plus, Trash2, MapPin, CalendarDays, Package, Lock } from 'lucide-react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useBundles, type BundleItem, type UserBundle } from '@/contexts/BundleContext';
import { Section, Field, CategoryGrid, Pills, Stepper, CoverPicker, TagEditor, ReadyList } from '@/components/builder/BuilderKit';
import { BundlePreview } from '@/components/builder/ListingPreview';
import { pickCover, uploadCover, confirmDiscard, type PickedCover } from '@/lib/coverMedia';
import { TAG_IDEAS, WHEN_IDEAS, cleanMoneyInput, parseMoney, formatMoney } from '@/lib/listingCategories';
import { isVideoUrl } from '@/lib/media';

const ACCENT = '#8B5CF6';
const MAX_SERVICES = 10;

interface ServiceDraft { id: string; name: string; details: string; price: string }
const newRow = (): ServiceDraft => ({ id: `svc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: '', details: '', price: '' });

/** Waits for the bundle to load when editing, then shows the form filled in. */
export default function BundleBuilderScreen() {
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const { myBundles } = useBundles();
  const editing = editId ? myBundles.find((b) => b.id === editId) : undefined;
  if (editId && !editing) return <LoadingListing />;
  return <BundleForm key={editing?.id || 'new'} editing={editing} />;
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Couldn’t find this bundle</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}><Text style={{ color: ACCENT, fontWeight: '700' }}>Go back</Text></TouchableOpacity>
        </>
      ) : <ActivityIndicator color={ACCENT} />}
    </View>
  );
}

function BundleForm({ editing }: { editing?: UserBundle }) {
  const router = useRouter();
  const editId = editing?.id;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { createBundle, updateBundle } = useBundles();
  const { requireListing, plan } = useSubscription();
  const isEdit = !!editing;

  // Posting a new bundle needs a plan with a free listing slot (editing doesn't).
  useEffect(() => { if (!isEdit && plan.loaded) requireListing(); }, [plan.loaded, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  const [cover, setCover] = useState<PickedCover | null>(() => {
    const media = editing?.videoUrl || editing?.imageUrl;
    return media ? { uri: media, type: editing?.videoUrl || isVideoUrl(media) ? 'video' : 'image' } : null;
  });
  const [title, setTitle] = useState(editing?.title || '');
  const [category, setCategory] = useState(editing?.category || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [services, setServices] = useState<ServiceDraft[]>(() => (editing?.items?.length
    ? editing.items.map((i) => ({ ...newRow(), name: i.name || '', details: i.description || '', price: i.price ? String(i.price) : '' }))
    : [newRow()]));
  const [price, setPrice] = useState(editing?.price ? String(editing.price) : '');
  const [spots, setSpots] = useState(Math.max(editing?.availableCount || 1, 1));
  const [location, setLocation] = useState(editing?.location || '');
  const [when, setWhen] = useState(editing?.dateRange || '');
  const [tags, setTags] = useState<string[]>(editing?.tags?.filter((t) => t !== 'Bundle') || []);
  const [notes, setNotes] = useState(editing?.plannerNotes || '');
  const [saving, setSaving] = useState<null | 'upload' | 'save'>(null);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const dirty = useRef(false);

  // Fill the form when editing (once the bundle is loaded).

  const touch = <T,>(fn: (v: T) => void) => (v: T) => { dirty.current = true; fn(v); };

  const itemsTotal = useMemo(() => services.reduce((sum, s) => sum + parseMoney(s.price), 0), [services]);
  const priceNum = parseMoney(price);
  const named = services.filter((s) => s.name.trim());
  const save = itemsTotal > priceNum && priceNum > 0 ? Math.round((1 - priceNum / itemsTotal) * 100) : 0;

  const problems = {
    title: title.trim().length < 3 ? 'Give it a title (at least 3 characters).' : null,
    price: priceNum <= 0 ? 'Set a price.' : null,
    services: named.length === 0 ? 'Add at least one thing that’s included.' : null,
  };
  const ready = !problems.title && !problems.price && !problems.services;

  const setService = (id: string, patch: Partial<ServiceDraft>) => {
    dirty.current = true;
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const chooseCover = async () => {
    const picked = await pickCover(true);
    if (picked) { dirty.current = true; setCover(picked); }
  };

  const goBack = useCallback(() => {
    if (!dirty.current || saving) { router.back(); return; }
    confirmDiscard(isEdit ? 'Your changes to this bundle will be lost.' : 'This bundle hasn’t been posted yet.', () => router.back());
  }, [router, saving, isEdit]);

  const submit = async () => {
    setTriedSubmit(true);
    if (!ready || saving) return;
    if (!isEdit && !(await requireListing())) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let media: { imageUrl: string; videoUrl?: string };
    try {
      setSaving('upload');
      media = await uploadCover(cover, `bundles/${user?.id || 'anon'}`);
    } catch (e) {
      setSaving(null);
      Alert.alert('Cover didn’t upload', `${e instanceof Error ? e.message : 'Upload failed.'} Try again, or remove the cover to post without one.`);
      return;
    }
    setSaving('save');

    const items: BundleItem[] = named.map((s, i) => ({
      id: `item-${Date.now()}-${i}`,
      name: s.name.trim(),
      description: s.details.trim() || undefined,
      category: 'service',
      provider: 'You',
      providerAvatar: '',
      providerLink: undefined,
      price: parseMoney(s.price),
      icon: '📦',
    }));
    const desc = description.trim() || named.map((s) => s.name.trim()).join(', ');
    const common = {
      title: title.trim(),
      description: desc,
      price: priceNum,
      items,
      imageUrl: media.imageUrl,
      videoUrl: media.videoUrl,
      mediaType: (media.videoUrl ? 'video' : 'image') as 'video' | 'image',
      category: category || 'other',
      location: location.trim(),
      dateRange: when.trim(),
      tags,
      availableCount: spots,
      plannerNotes: notes.trim() || undefined,
    };

    if (isEdit && editId) {
      updateBundle(editId, common);
    } else {
      const res = createBundle({
        ...common,
        creator: { name: user?.fullName || user?.username || 'You', avatar: user?.avatar || '', rating: 5.0, reviews: 0 },
        creatorId: user?.id || '',
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

  const err = (k: keyof typeof problems) => (triedSubmit ? problems[k] : null);

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={goBack} style={[styles.headerBtn, { backgroundColor: colors.surfaceHighlight }]} accessibilityLabel="Back" testID="builder-back">
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{isEdit ? 'Edit bundle' : 'New bundle'}</Text>
          <Text style={[styles.headerSub, { color: colors.textTertiary }]}>Several services, one price</Text>
        </View>
        <View style={[styles.kindIcon, { backgroundColor: `${ACCENT}1F` }]}><Package size={18} color={ACCENT} /></View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 170 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <CoverPicker uri={cover?.uri || null} isVideo={cover?.type === 'video'} onPick={chooseCover} onRemove={() => { dirty.current = true; setCover(null); }}
          accent={ACCENT} colors={colors} label="Add a cover photo or video" sub="Bundles with a cover get far more grabs. Videos up to 60 seconds." />

        <Section n={1} title="The basics" colors={colors}>
          <Field label="Title" colors={colors} value={title} onChangeText={touch(setTitle)} maxLength={80} counter={{ value: title.length, max: 80 }}
            placeholder="e.g. Spa day for two" error={err('title')} testID="bundle-title" />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Category</Text>
          <CategoryGrid value={category} onChange={touch(setCategory)} accent={ACCENT} colors={colors} />
          <View style={{ height: 14 }} />
          <Field label="Description" colors={colors} value={description} onChangeText={touch(setDescription)} maxLength={300} counter={{ value: description.length, max: 300 }}
            placeholder="What will people get? Who is it for?" multiline testID="bundle-description" />
        </Section>

        <Section n={2} title="What’s included" hint="List each service. Prices are optional and show buyers the value." colors={colors}
          right={<Text style={[styles.count, { color: colors.textTertiary }]}>{named.length}/{MAX_SERVICES}</Text>}>
          {services.map((s, idx) => (
            <View key={s.id} style={[styles.serviceRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <View style={[styles.serviceNum, { backgroundColor: `${ACCENT}1A` }]}><Text style={{ color: ACCENT, fontWeight: '800', fontSize: 12 }}>{idx + 1}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <TextInput value={s.name} onChangeText={(v) => setService(s.id, { name: v })} placeholder="Service name" placeholderTextColor={colors.textTertiary}
                  style={[styles.serviceName, { color: colors.text }]} maxLength={60} testID={`service-name-${idx}`} />
                <TextInput value={s.details} onChangeText={(v) => setService(s.id, { details: v })} placeholder="Details (optional)" placeholderTextColor={colors.textTertiary}
                  style={[styles.serviceDetails, { color: colors.textSecondary }]} maxLength={140} multiline />
              </View>
              <View style={[styles.servicePrice, { borderColor: colors.border }]}>
                <Text style={{ color: colors.textTertiary, fontWeight: '700' }}>$</Text>
                <TextInput value={s.price} onChangeText={(v) => setService(s.id, { price: cleanMoneyInput(v) })} placeholder="0" placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad" style={[styles.servicePriceInput, { color: colors.text }]} />
              </View>
              <TouchableOpacity onPress={() => { dirty.current = true; setServices((p) => (p.length <= 1 ? [newRow()] : p.filter((x) => x.id !== s.id))); }}
                hitSlop={8} style={styles.removeBtn} accessibilityLabel="Remove service">
                <Trash2 size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ))}
          {err('services') ? <Text style={[styles.err, { color: colors.error }]}>{err('services')}</Text> : null}
          {services.length < MAX_SERVICES ? (
            <TouchableOpacity style={[styles.addRow, { borderColor: ACCENT }]} onPress={() => { dirty.current = true; setServices((p) => [...p, newRow()]); }} testID="add-service">
              <Plus size={16} color={ACCENT} />
              <Text style={{ color: ACCENT, fontWeight: '700' }}>Add a service</Text>
            </TouchableOpacity>
          ) : null}
        </Section>

        <Section n={3} title="Price and spots" colors={colors}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Bundle price</Text>
          <View style={[styles.moneyBox, { borderColor: err('price') ? colors.error : colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.moneySign, { color: colors.text }]}>$</Text>
            <TextInput value={price} onChangeText={(v) => { dirty.current = true; setPrice(cleanMoneyInput(v)); }} placeholder="0" placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad" style={[styles.moneyInput, { color: colors.text }]} testID="bundle-price" />
          </View>
          {err('price') ? <Text style={[styles.err, { color: colors.error }]}>{err('price')}</Text> : null}
          {itemsTotal > 0 ? (
            <View style={styles.valueRow}>
              <Text style={[styles.valueText, { color: colors.textSecondary }]}>Items add up to {formatMoney(itemsTotal)}.</Text>
              {save > 0 ? <View style={styles.saveChip}><Text style={styles.saveChipText}>Buyers save {save}%</Text></View>
                : priceNum !== itemsTotal ? (
                  <TouchableOpacity onPress={() => { dirty.current = true; setPrice(String(itemsTotal)); }}><Text style={{ color: ACCENT, fontWeight: '700' }}>Use {formatMoney(itemsTotal)}</Text></TouchableOpacity>
                ) : null}
            </View>
          ) : null}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.spotsRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.spotsTitle, { color: colors.text }]}>Spots</Text>
              <Text style={[styles.spotsHint, { color: colors.textTertiary }]}>How many people can grab it. It closes when full.</Text>
            </View>
            <Stepper value={spots} onChange={(v) => { dirty.current = true; setSpots(v); }} min={1} max={500} colors={colors} />
          </View>
          {editing && editing.grabCount > 0 ? (
            <Text style={[styles.spotsHint, { color: colors.textTertiary, marginTop: 8 }]}>{editing.grabCount} already grabbed · {Math.max(spots - editing.grabCount, 0)} left</Text>
          ) : null}
        </Section>

        <Section n={4} title="When and where" hint="Optional, but it helps people decide." colors={colors}>
          <View style={[styles.iconField, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <MapPin size={18} color={colors.textTertiary} />
            <TextInput value={location} onChangeText={touch(setLocation)} placeholder="City, neighborhood or “Online”" placeholderTextColor={colors.textTertiary}
              style={[styles.iconFieldInput, { color: colors.text }]} maxLength={60} />
          </View>
          <View style={[styles.iconField, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <CalendarDays size={18} color={colors.textTertiary} />
            <TextInput value={when} onChangeText={touch(setWhen)} placeholder="When (e.g. Weekends, Nov 1–3)" placeholderTextColor={colors.textTertiary}
              style={[styles.iconFieldInput, { color: colors.text }]} maxLength={40} />
          </View>
          <Pills options={WHEN_IDEAS.map((w) => ({ key: w, label: w }))} value={when} onChange={touch(setWhen)} accent={ACCENT} colors={colors} />
        </Section>

        <Section n={5} title="Tags" hint="Up to 5. They help people find your bundle." colors={colors}>
          <TagEditor tags={tags} onChange={touch(setTags)} ideas={TAG_IDEAS[category || 'other']} accent={ACCENT} colors={colors} />
        </Section>

        <Section title="Private notes" hint="Only you can see these: contacts, links, prep." colors={colors} right={<Lock size={16} color={colors.textTertiary} />}>
          <Field colors={colors} value={notes} onChangeText={touch(setNotes)} placeholder="Notes for yourself" multiline maxLength={500} />
        </Section>

        <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>How it looks on Home</Text>
        <BundlePreview title={title} price={priceNum} value={itemsTotal} coverUri={cover?.uri || null} isVideo={cover?.type === 'video'} category={category}
          location={location} when={when} items={services.map((s) => ({ name: s.name, price: parseMoney(s.price) }))} spots={spots} tags={tags}
          creatorName={user?.fullName || user?.username || 'You'} accent={ACCENT} colors={colors} />
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <ReadyList colors={colors} items={[
          { label: 'Title', done: !problems.title },
          { label: 'What’s included', done: !problems.services },
          { label: 'Price', done: !problems.price },
          { label: 'Cover', done: !!cover },
        ]} />
        <View style={styles.bottomRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bottomPrice, { color: colors.text }]}>{priceNum > 0 ? formatMoney(priceNum) : '—'}</Text>
            <Text style={[styles.bottomMeta, { color: colors.textTertiary }]}>{named.length} service{named.length === 1 ? '' : 's'} · {spots} spot{spots === 1 ? '' : 's'}</Text>
          </View>
          <TouchableOpacity onPress={submit} disabled={!!saving} activeOpacity={0.85} testID="bundle-submit"
            style={[styles.postBtn, { backgroundColor: ready ? ACCENT : colors.surfaceHighlight }]}>
            {saving ? <ActivityIndicator color={ready ? '#FFF' : colors.text} /> : null}
            <Text style={[styles.postText, { color: ready ? '#FFF' : colors.textTertiary }]}>
              {saving === 'upload' ? 'Uploading cover…' : saving === 'save' ? 'Saving…' : isEdit ? 'Save changes' : 'Post bundle'}
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
  count: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  serviceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 16, padding: 10, marginBottom: 8 },
  serviceNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  serviceName: { fontSize: 16, fontWeight: '600', paddingVertical: 6 },
  serviceDetails: { fontSize: 14, paddingVertical: 2, minHeight: 22 },
  servicePrice: { flexDirection: 'row', alignItems: 'center', gap: 2, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, height: 38, width: 78, marginTop: 2 },
  servicePriceInput: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '700', padding: 0 },
  removeBtn: { paddingTop: 11 },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 12, marginTop: 4 },
  err: { fontSize: 12, marginTop: 4, marginBottom: 6 },
  moneyBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, height: 62 },
  moneySign: { fontSize: 26, fontWeight: '800', marginRight: 4 },
  moneyInput: { flex: 1, minWidth: 0, fontSize: 28, fontWeight: '800', padding: 0 },
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  valueText: { fontSize: 14 },
  saveChip: { backgroundColor: 'rgba(16,185,129,0.14)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  saveChipText: { color: '#059669', fontWeight: '800', fontSize: 12 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  spotsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  spotsTitle: { fontSize: 15, fontWeight: '700' },
  spotsHint: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  iconField: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, marginBottom: 10 },
  iconFieldInput: { flex: 1, minWidth: 0, fontSize: 16, paddingVertical: 13 },
  previewLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 8, marginBottom: 10, marginLeft: 4 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bottomPrice: { fontSize: 20, fontWeight: '800' },
  bottomMeta: { fontSize: 12, marginTop: 1 },
  postBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, paddingVertical: 15, borderRadius: 16 },
  postText: { fontSize: 16, fontWeight: '800' },
});
