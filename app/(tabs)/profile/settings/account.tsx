/** Account: sign-in email, password, and deleting the account. */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Mail, Lock, Trash2, AtSign, CalendarDays } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { confirmAction, notify } from '@/lib/dialog';
import { SettingsPage, Group, Item, DANGER } from '@/components/settings/SettingsUI';

const W = '#FFFFFF';

export default function AccountSettings() {
  const { colors } = useTheme();
  const { user, session, signOut } = useAuth();
  const [open, setOpen] = useState<'email' | 'password' | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim());
  const pwProblem = !pw ? null : pw.length < 8 ? 'Use at least 8 characters.' : pw2 && pw2 !== pw ? 'Passwords don’t match.' : null;
  const pwOk = pw.length >= 8 && pw === pw2;

  const toggle = (k: 'email' | 'password') => { setOpen((o) => (o === k ? null : k)); setNote(null); };

  const changeEmail = async () => {
    if (!emailValid) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim().toLowerCase() });
    setBusy(false);
    if (error) { setNote({ ok: false, text: error.message }); return; }
    setNote({ ok: true, text: 'Check your new inbox for a confirmation link.' });
    setNewEmail(''); setOpen(null);
  };

  const changePassword = async () => {
    if (!pwOk) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setNote({ ok: false, text: error.message }); return; }
    setNote({ ok: true, text: 'Password updated.' });
    setPw(''); setPw2(''); setOpen(null);
  };

  // App Store / Play Store require that people can delete their account in the app.
  const deleteAccount = () => confirmAction(
    'Delete your account?',
    'This permanently deletes your profile, posts, messages, listings and bookings. It can’t be undone.',
    'Delete forever',
    async () => {
      setBusy(true);
      try {
        const { error } = await supabase.rpc('delete_my_account');
        if (error) { notify('Couldn’t delete your account', error.message); return; }
        await signOut();
      } catch (e: any) {
        notify('Couldn’t delete your account', e?.message || 'Please try again.');
      } finally {
        setBusy(false);
      }
    },
    true,
  );

  const input = [styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }];
  const joined = session?.user?.created_at;

  return (
    <SettingsPage title="Account">
      <Group title="Personal details" footer="Your email is private. It’s used to log in and for receipts.">
        <Item icon={<AtSign size={18} color={W} />} iconBg="#8B5CF6" label="Username" value={user?.username ? `@${user.username}` : undefined} />
        <Item icon={<Mail size={18} color={W} />} iconBg="#0EA5E9" label="Email" value={user?.email || 'Not set'} onPress={() => toggle('email')} testID="account-email" />
        {open === 'email' ? (
          <View style={styles.form}>
            <TextInput style={input} value={newEmail} onChangeText={setNewEmail} placeholder="New email address" placeholderTextColor={colors.textTertiary} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} accessibilityLabel="New email" />
            <TouchableOpacity style={[styles.btn, { backgroundColor: colors.accent, opacity: emailValid && !busy ? 1 : 0.45 }]} onPress={changeEmail} disabled={!emailValid || busy}>
              {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Send confirmation link</Text>}
            </TouchableOpacity>
          </View>
        ) : null}
        {joined ? <Item icon={<CalendarDays size={18} color={W} />} iconBg="#64748B" label="Member since" value={new Date(joined).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} /> : null}
      </Group>

      <Group title="Password and security">
        <Item icon={<Lock size={18} color={W} />} iconBg="#16A34A" label="Change password" onPress={() => toggle('password')} testID="account-password" />
        {open === 'password' ? (
          <View style={styles.form}>
            <TextInput style={input} value={pw} onChangeText={setPw} placeholder="New password (8+ characters)" placeholderTextColor={colors.textTertiary} secureTextEntry autoCapitalize="none" textContentType="newPassword" accessibilityLabel="New password" />
            <TextInput style={[input, { marginTop: 8 }]} value={pw2} onChangeText={setPw2} placeholder="Type it again" placeholderTextColor={colors.textTertiary} secureTextEntry autoCapitalize="none" textContentType="newPassword" accessibilityLabel="Confirm new password" />
            {pwProblem ? <Text style={[styles.helper, { color: DANGER }]}>{pwProblem}</Text> : null}
            <TouchableOpacity style={[styles.btn, { backgroundColor: colors.accent, opacity: pwOk && !busy ? 1 : 0.45 }]} onPress={changePassword} disabled={!pwOk || busy}>
              {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Update password</Text>}
            </TouchableOpacity>
          </View>
        ) : null}
      </Group>

      {note ? <Text style={[styles.note, { color: note.ok ? '#16A34A' : DANGER }]}>{note.text}</Text> : null}

      <Group title="Account ownership" footer="Deleting your account removes your profile, posts, messages, listings and bookings for good.">
        <Item icon={<Trash2 size={18} color={W} />} iconBg={DANGER} label="Delete account" onPress={deleteAccount} danger testID="delete-account" />
      </Group>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  form: { paddingHorizontal: 14, paddingBottom: 14 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 9, fontSize: 16 },
  helper: { fontSize: 12, marginTop: 6 },
  btn: { height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  btnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  note: { fontSize: 14, fontWeight: '600', marginHorizontal: 20, marginTop: 12 },
});
