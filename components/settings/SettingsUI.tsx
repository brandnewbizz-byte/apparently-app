/**
 * Building blocks for the Settings pages, laid out the way the big apps do it:
 * a titled page, grouped lists with small grey headings, rows with an icon, a
 * label, an optional value and a chevron, and switches for on/off settings.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export const tap = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };
export const DANGER = '#EF4444';

/** A full Settings page: back button, title, scrolling content. */
export function SettingsPage({ title, children, right, testID }: { title: string; children: React.ReactNode; right?: React.ReactNode; testID?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const back = () => { tap(); if (router.canGoBack()) router.back(); else router.replace('/profile' as never); };
  return (
    <View style={[s.page, { backgroundColor: colors.backgroundSecondary }]} testID={testID}>
      <View style={[s.header, { paddingTop: insets.top + 6, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={back} style={s.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Back">
          <ChevronLeft size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        <View style={s.headerBtn}>{right}</View>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** A group of rows with an optional heading above and a note below. */
export function Group({ title, footer, children }: { title?: string; footer?: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  if (!rows.length) return null;
  return (
    <View style={s.group}>
      {title ? <Text style={[s.groupTitle, { color: colors.textSecondary }]}>{title}</Text> : null}
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {rows.map((child, i) => (
          <View key={i}>
            {i > 0 ? <View style={[s.divider, { backgroundColor: colors.border }]} /> : null}
            {child}
          </View>
        ))}
      </View>
      {footer ? <Text style={[s.groupFooter, { color: colors.textTertiary }]}>{footer}</Text> : null}
    </View>
  );
}

/** One settings row. Tappable when it has `onPress`; shows a chevron unless `right` is given. */
export function Item({ icon, iconBg, label, value, sub, onPress, danger, right, testID, center }: {
  icon?: React.ReactNode; iconBg?: string; label: string; value?: string; sub?: string; onPress?: () => void;
  danger?: boolean; right?: React.ReactNode; testID?: string; center?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[s.row, center && { justifyContent: 'center' }]}
      onPress={onPress ? () => { tap(); onPress(); } : undefined}
      disabled={!onPress}
      activeOpacity={0.6}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      testID={testID}
    >
      {icon ? <View style={[s.icon, { backgroundColor: iconBg || colors.surfaceHighlight }]}>{icon}</View> : null}
      <View style={center ? undefined : { flex: 1, minWidth: 0 }}>
        <Text style={[s.label, { color: danger ? DANGER : colors.text }, center && { textAlign: 'center' }]} numberOfLines={1}>{label}</Text>
        {sub ? <Text style={[s.sub, { color: colors.textTertiary }]} numberOfLines={2}>{sub}</Text> : null}
      </View>
      {!center && value ? <Text style={[s.value, { color: colors.textTertiary }]} numberOfLines={1}>{value}</Text> : null}
      {!center && (right ?? (onPress ? <ChevronRight size={18} color={colors.textTertiary} /> : null))}
    </TouchableOpacity>
  );
}

/** A row with an on/off switch. */
export function ToggleItem({ icon, iconBg, label, sub, value, onChange, testID }: {
  icon?: React.ReactNode; iconBg?: string; label: string; sub?: string; value: boolean; onChange: (v: boolean) => void; testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Item
      icon={icon}
      iconBg={iconBg}
      label={label}
      sub={sub}
      testID={testID}
      right={
        <Switch
          value={value}
          onValueChange={(v) => { tap(); onChange(v); }}
          trackColor={{ false: colors.border, true: '#34C759' }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={colors.border}
          accessibilityLabel={label}
        />
      }
    />
  );
}


const s = StyleSheet.create({
  page: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  headerBtn: { width: 44, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  group: { paddingHorizontal: 16, marginTop: 24 },
  groupTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  groupFooter: { fontSize: 12, lineHeight: 17, marginTop: 8, marginHorizontal: 4 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 58 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, minHeight: 52 },
  icon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 16, fontWeight: '500' },
  sub: { fontSize: 13, marginTop: 2, lineHeight: 17 },
  value: { fontSize: 15, maxWidth: '45%' },
});
