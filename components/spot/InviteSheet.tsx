import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Link2, Search, X } from 'lucide-react-native';
import { findPeople, sendRoomInvites, type SpotPerson, type SpotRoom } from '@/lib/spot';

// Who I've already invited to each room this session.
const sentByRoom = new Map<string, Set<string>>();

interface Props {
  visible: boolean;
  room: SpotRoom | null;
  me: { id: string; name: string; avatar?: string | null } | null;
  hereIds: string[];
  onClose: () => void;
  onShareLink: () => void;
}

export default function InviteSheet({ visible, room, me, hereIds, onClose, onShareLink }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<SpotPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Record<string, SpotPerson>>({});
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const sent = (room && sentByRoom.get(room.id)) || new Set<string>();

  useEffect(() => {
    if (!visible || !me) return;
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      findPeople(me.id, query)
        .then((list) => { if (alive) setPeople(list); })
        .catch(() => { if (alive) setPeople([]); })
        .finally(() => { if (alive) setLoading(false); });
    }, query ? 250 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [visible, query, me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!visible) { setPicked({}); setQuery(''); setNote(null); } }, [visible]);

  const toggle = (p: SpotPerson) => setPicked((prev) => {
    const n = { ...prev };
    if (n[p.id]) delete n[p.id]; else n[p.id] = p;
    return n;
  });

  const count = Object.keys(picked).length;
  const send = async () => {
    if (!room || !me || !count) return;
    setSending(true);
    try {
      const list = Object.values(picked);
      await sendRoomInvites(room, me, list);
      const set = sentByRoom.get(room.id) || new Set<string>();
      list.forEach((p) => set.add(p.id));
      sentByRoom.set(room.id, set);
      setPicked({});
      setNote(`Invite${list.length > 1 ? 's' : ''} sent! They'll get a request to join.`);
    } catch {
      setNote('Could not send invites. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  const renderPerson = ({ item: p }: { item: SpotPerson }) => {
    const here = hereIds.includes(p.id);
    const wasSent = sent.has(p.id);
    const on = !!picked[p.id];
    const disabled = here || wasSent;
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => !disabled && toggle(p)}
        disabled={disabled}
        accessibilityLabel={`Invite ${p.name}`}
        accessibilityState={{ selected: on, disabled }}
      >
        {p.avatar ? <Image source={{ uri: p.avatar }} style={styles.avatar} /> : (
          <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.initial}>{p.name.charAt(0).toUpperCase()}</Text></View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
          {p.username ? <Text style={styles.handle} numberOfLines={1}>@{p.username}</Text> : null}
        </View>
        {here ? <Text style={styles.tag}>In the room</Text>
          : wasSent ? <Text style={styles.tag}>Invited</Text>
          : <View style={[styles.check, on && styles.checkOn]}>{on ? <Check size={14} color="#FFF" strokeWidth={3} /> : null}</View>}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 14 }]}>
          <View style={styles.grabber} />
          <View style={styles.head}>
            <Text style={styles.title}>Invite people</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close invites" hitSlop={10}><X size={22} color="#111" /></TouchableOpacity>
          </View>
          <Text style={styles.sub}>They'll get a request to join “{room?.name || 'your room'}”.</Text>

          <View style={styles.search}>
            <Search size={16} color="#9CA3AF" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name or @username"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search people"
            />
          </View>

          {loading ? <ActivityIndicator style={{ marginVertical: 24 }} /> : (
            <FlatList
              data={people}
              keyExtractor={(p) => p.id}
              renderItem={renderPerson}
              style={{ maxHeight: 340 }}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={(
                <Text style={styles.empty}>{query ? 'No one found.' : 'Search for friends by name, or share the link below.'}</Text>
              )}
            />
          )}

          {note ? <Text style={styles.note}>{note}</Text> : null}

          <TouchableOpacity onPress={send} disabled={!count || sending} style={[styles.primary, (!count || sending) && { opacity: 0.4 }]} accessibilityLabel="Send invites">
            {sending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>{count ? `Send ${count} invite${count > 1 ? 's' : ''}` : 'Pick people to invite'}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={onShareLink} style={styles.link} accessibilityLabel="Share room link">
            <Link2 size={16} color="#6D28D9" />
            <Text style={styles.linkText}>Share a link instead</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 8 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#E5E7EB', marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 19, fontWeight: '800', color: '#111' },
  sub: { color: '#6B7280', marginTop: 4, marginBottom: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, height: 42, marginBottom: 6 },
  input: { flex: 1, fontSize: 15, color: '#111' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E5E7EB' },
  avatarFallback: { backgroundColor: '#8B5CF6', alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#FFF', fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700', color: '#111' },
  handle: { fontSize: 13, color: '#6B7280' },
  tag: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  empty: { color: '#6B7280', textAlign: 'center', marginVertical: 24 },
  note: { color: '#059669', fontWeight: '600', textAlign: 'center', marginTop: 8 },
  primary: { height: 50, borderRadius: 16, backgroundColor: '#8B5CF6', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  primaryText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  link: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  linkText: { color: '#6D28D9', fontWeight: '700' },
});
