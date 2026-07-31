import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Image,
  Alert,
  Platform,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useBundles } from '@/contexts/BundleContext';
import { useSkills } from '@/contexts/SkillContext';
import { useSocial } from '@/contexts/SocialContext';
import UserProfileContent from '@/components/UserProfileContent';
import { Camera, X } from 'lucide-react-native';

// ═══════════════════════════════════════════════════════════════════════════
// Edit Profile Modal — only shown for own profile
// ═══════════════════════════════════════════════════════════════════════════

function EditProfileModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { user, updateAvatar, refreshProfile } = useAuth();
  const [name, setName] = useState(user?.fullName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');
  const [mediaPerm, requestMediaPerm] = ImagePicker.useMediaLibraryPermissions();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(user?.fullName || '');
      setBio(user?.bio || '');
      setAvatarUrl(user?.avatar || '');
    }
  }, [visible, user]);

  const handlePickPhoto = async () => {
    const { status } = mediaPerm || {};
    if (status !== 'granted') {
      const result = await requestMediaPerm();
      if (!result.granted) {
        Alert.alert('Permission Required', 'We need access to your photos to change your avatar.');
        return;
      }
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        setAvatarUrl(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Could not open photo library.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (avatarUrl && avatarUrl !== user?.avatar) {
        const result = await updateAvatar(avatarUrl);
        if (!result.success) {
          Alert.alert('Error', result.error || 'Failed to update avatar.');
          setSaving(false);
          return;
        }
      }
      if (user?.id) {
        const profileUpdates: any = {};
        const userUpdates: any = {};
        if (name.trim() && name !== user?.fullName) {
          profileUpdates.full_name = name.trim();
          userUpdates.name = name.trim();
        }
        if (bio.trim() !== (user?.bio || '')) profileUpdates.bio = bio.trim();
        if (Object.keys(profileUpdates).length > 0) {
          const { error: saveErr } = await supabase
            .from('profiles')
            .upsert({ id: user.id, ...profileUpdates, updated_at: new Date().toISOString() });
          if (saveErr) {
            Alert.alert('Error', saveErr.message);
            setSaving(false);
            return;
          }
          if (Object.keys(userUpdates).length > 0) {
            await supabase.from('users').upsert({ id: user.id, ...userUpdates }, { onConflict: 'id' });
          }
          await refreshProfile();
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (e: any) {
      console.log('[EditProfile] Exception:', e);
      Alert.alert('Error', e.message || 'Something went wrong while saving.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={editStyles.modal}>
        <View style={editStyles.header}>
          <TouchableOpacity onPress={onClose}>
            <X size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={editStyles.title}>Edit Profile</Text>
          <TouchableOpacity style={editStyles.saveBtn} onPress={handleSave}>
            <Text style={editStyles.saveText}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={editStyles.body}>
          <View style={editStyles.avatarSection}>
            <View style={editStyles.avatarWrap}>
              <Image
                source={{
                  uri:
                    avatarUrl ||
                    'https://ui-avatars.com/api/?name=' +
                      encodeURIComponent(name || 'User') +
                      '&background=random&size=200',
                }}
                style={editStyles.avatar}
              />
              <TouchableOpacity style={editStyles.avatarBadge} onPress={handlePickPhoto}>
                <Camera size={12} color="#FFF" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={handlePickPhoto}>
              <Text style={editStyles.avatarHint}>Change photo</Text>
            </TouchableOpacity>
          </View>
          <View>
            <Text style={editStyles.label}>DISPLAY NAME</Text>
            <TextInput
              style={editStyles.input}
              value={name}
              onChangeText={setName}
              placeholderTextColor="#666"
            />
          </View>
          <View>
            <Text style={editStyles.label}>BIO</Text>
            <TextInput
              style={[editStyles.input, editStyles.bioInput]}
              value={bio}
              onChangeText={setBio}
              multiline
              textAlignVertical="top"
              placeholderTextColor="#666"
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROFILE SCREEN — Thin wrapper around UserProfileContent
// ═══════════════════════════════════════════════════════════════════════════

export default function ProfileScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { userId: paramUserId } = useLocalSearchParams<{ userId?: string }>();
  const { myBundles, deleteBundle } = useBundles();
  const { mySkills, deleteSkill } = useSkills();
  const { deletePost: clearSocialCache } = useSocial();

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [grabbedPlans, setGrabbedPlans] = useState<any[]>([]);

  // Determine if viewing own profile or another user's
  const currentUserId = auth?.user?.id;
  const targetUserId = paramUserId || currentUserId || '';
  const isOwnProfile = !paramUserId || paramUserId === currentUserId;

  // Fetch grabbed plans (only for own profile)
  useEffect(() => {
    if (!isOwnProfile || !currentUserId) return;
    let cancelled = false;
    const fetchPlans = async () => {
      try {
        const { data, error } = await supabase
          .from('job_requests')
          .select('*')
          .eq('user_id', currentUserId)
          .order('booked_at', { ascending: false })
          .limit(20);
        if (!cancelled && !error && data) {
          setGrabbedPlans(data);
        }
      } catch {}
    };
    fetchPlans();
    return () => {
      cancelled = true;
    };
  }, [isOwnProfile, currentUserId]);

  // Handlers
  const handleDeleteBundle = useCallback(
    async (bundle: any) => {
      Alert.alert('Delete Bundle', 'This action cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteBundle(bundle.id);
          },
        },
      ]);
    },
    [deleteBundle]
  );

  const handleDeleteSkill = useCallback(
    async (skill: any) => {
      Alert.alert('Delete Skill', 'This action cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSkill(skill.id);
          },
        },
      ]);
    },
    [deleteSkill]
  );

  const handlePostDeleted = useCallback(
    (postId: string) => {
      clearSocialCache(postId);
    },
    [clearSocialCache]
  );

  if (!currentUserId && !paramUserId) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#999' }}>Loading...</Text>
      </View>
    );
  }

  return (
    <>
      <UserProfileContent
        userId={targetUserId}
        isOwnProfile={isOwnProfile}
        myBundles={isOwnProfile ? myBundles : undefined}
        mySkills={isOwnProfile ? mySkills : undefined}
        grabbedPlans={isOwnProfile ? grabbedPlans : undefined}
        onEditProfile={isOwnProfile ? () => setEditModalVisible(true) : undefined}
        onSettings={isOwnProfile ? () => router.push('/(tabs)/profile/settings') : undefined}
        onCreateBundle={isOwnProfile ? () => router.push('/bundle-builder') : undefined}
        onCreateSkill={isOwnProfile ? () => router.push('/skill-builder') : undefined}
        onDeleteBundle={isOwnProfile ? handleDeleteBundle : undefined}
        onDeleteSkill={isOwnProfile ? handleDeleteSkill : undefined}
        onPostDeleted={isOwnProfile ? handlePostDeleted : undefined}
      />
      {isOwnProfile && (
        <EditProfileModal
          visible={editModalVisible}
          onClose={() => setEditModalVisible(false)}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Styles — Edit Profile Modal only
// ═══════════════════════════════════════════════════════════════════════════

const editStyles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: '#0D0D0D' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
  },
  saveText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  body: { padding: 20, gap: 20 },
  avatarSection: { alignItems: 'center' },
  avatarWrap: { position: 'relative', marginBottom: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0D0D0D',
  },
  avatarHint: { fontSize: 13, fontWeight: '600', color: '#3B82F6' },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFF',
    backgroundColor: '#1C1C1E',
  },
  bioInput: { minHeight: 80 },
});
