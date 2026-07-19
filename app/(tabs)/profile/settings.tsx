import {
  ArrowLeft,
  User,
  Briefcase,
  Heart,
  Sparkles,
  Bell,
  ChevronRight,
  RefreshCw,
  Shield,
  HelpCircle,
  LogOut,

  MapPin,
  Target,
  Edit3,
  Save,
  X,
  Moon,
  Sun,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  Alert,
  TextInput,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/contexts/ThemeContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useAuth } from '@/contexts/AuthContext';

const AGE_RANGES = [
  { id: '18-24', label: '18-24' },
  { id: '25-34', label: '25-34' },
  { id: '35-44', label: '35-44' },
  { id: '45-54', label: '45-54' },
  { id: '55+', label: '55+' },
];

const PROFESSIONS = [
  { id: 'student', label: 'Student' },
  { id: 'entrepreneur', label: 'Entrepreneur' },
  { id: 'corporate', label: 'Corporate Professional' },
  { id: 'creative', label: 'Creative / Artist' },
  { id: 'freelance', label: 'Freelancer' },
  { id: 'tech', label: 'Tech / Engineering' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'educator', label: 'Educator' },
  { id: 'other', label: 'Other' },
];

const LIFESTYLES = [
  { id: 'busy', label: 'Always busy' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'relaxed', label: 'Relaxed pace' },
  { id: 'social', label: 'Very social' },
  { id: 'focused', label: 'Career-focused' },
];

const CONTENT_PREFERENCES = [
  { id: 'finance', label: 'Finance & Investments' },
  { id: 'productivity', label: 'Productivity Tips' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'wellness', label: 'Wellness & Self-care' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'all', label: 'Mix of everything' },
];

const NOTIFICATION_PREFERENCES = [
  { id: 'minimal', label: 'Minimal' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'frequent', label: 'Frequent' },
];

const LOOKING_FOR_OPTIONS = [
  { id: 'networking', label: 'Networking' },
  { id: 'collaboration', label: 'Collaboration' },
  { id: 'hiring', label: 'Hiring' },
  { id: 'opportunities', label: 'Opportunities' },
];

type SettingType = 'ageRange' | 'profession' | 'lifestyle' | 'contentPreference' | 'notificationPreference';
type ProfileEditType = 'displayName' | 'bio' | 'location' | 'skills' | 'lookingFor';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const { signOut } = useAuth();
  const { 
    personalization, 
    profile,
    interests,
    goals,
    location: savedLocation,
    updatePersonalization, 
    updateProfile,
    updateLocation,
    resetOnboarding 
  } = useOnboarding();
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSetting, setEditingSetting] = useState<SettingType | null>(null);
  const [tempValue, setTempValue] = useState('');
  
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfileField, setEditingProfileField] = useState<ProfileEditType | null>(null);
  const [tempProfileValue, setTempProfileValue] = useState('');
  const [tempSkills, setTempSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');

  const getOptions = (type: SettingType) => {
    switch (type) {
      case 'ageRange': return AGE_RANGES;
      case 'profession': return PROFESSIONS;
      case 'lifestyle': return LIFESTYLES;
      case 'contentPreference': return CONTENT_PREFERENCES;
      case 'notificationPreference': return NOTIFICATION_PREFERENCES;
      default: return [];
    }
  };

  const getTitle = (type: SettingType) => {
    switch (type) {
      case 'ageRange': return 'Age Range';
      case 'profession': return 'Profession';
      case 'lifestyle': return 'Lifestyle';
      case 'contentPreference': return 'Content Preference';
      case 'notificationPreference': return 'Notifications';
      default: return '';
    }
  };

  const getIcon = (type: SettingType) => {
    switch (type) {
      case 'ageRange': return <User size={20} color={colors.accent} />;
      case 'profession': return <Briefcase size={20} color={colors.accent} />;
      case 'lifestyle': return <Heart size={20} color={colors.accent} />;
      case 'contentPreference': return <Sparkles size={20} color={colors.accent} />;
      case 'notificationPreference': return <Bell size={20} color={colors.accent} />;
      default: return null;
    }
  };

  const getDisplayValue = (type: SettingType) => {
    const value = personalization[type];
    const options = getOptions(type);
    const option = options.find(o => o.id === value);
    return option?.label || 'Not set';
  };

  const handleEditSetting = (type: SettingType) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setEditingSetting(type);
    setTempValue(personalization[type] || '');
    setShowEditModal(true);
  };

  const handleSaveSetting = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (editingSetting && tempValue) {
      updatePersonalization({ [editingSetting]: tempValue });
    }
    setShowEditModal(false);
    setEditingSetting(null);
  };

  const handleEditProfile = (field: ProfileEditType) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setEditingProfileField(field);
    
    if (field === 'skills') {
      setTempSkills(profile?.skills || []);
    } else if (field === 'location') {
      setTempProfileValue(savedLocation || profile?.location || '');
    } else if (field === 'lookingFor') {
      setTempValue(profile?.lookingFor || '');
    } else {
      setTempProfileValue(profile?.[field] || '');
    }
    setShowProfileModal(true);
  };

  const handleSaveProfile = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    if (editingProfileField === 'skills') {
      updateProfile({ skills: tempSkills });
    } else if (editingProfileField === 'location') {
      updateProfile({ location: tempProfileValue });
      updateLocation(tempProfileValue);
    } else if (editingProfileField === 'lookingFor') {
      updateProfile({ lookingFor: tempValue as any });
    } else if (editingProfileField) {
      updateProfile({ [editingProfileField]: tempProfileValue });
    }
    
    setShowProfileModal(false);
    setEditingProfileField(null);
    setTempProfileValue('');
    setTempSkills([]);
    setNewSkill('');
  };

  const addSkill = () => {
    if (newSkill.trim() && !tempSkills.includes(newSkill.trim())) {
      setTempSkills([...tempSkills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const removeSkill = (skill: string) => {
    setTempSkills(tempSkills.filter(s => s !== skill));
  };

  const handleResetOnboarding = () => {
    Alert.alert(
      'Reset Preferences',
      'This will reset all your personalization settings. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
            resetOnboarding();
            router.push('/onboarding' as any);
          },
        },
      ]
    );
  };

  const handleToggleTheme = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    toggleTheme();
  };

  const getProfileFieldTitle = (field: ProfileEditType) => {
    switch (field) {
      case 'displayName': return 'Display Name';
      case 'bio': return 'Bio';
      case 'location': return 'Location';
      case 'skills': return 'Skills';
      case 'lookingFor': return 'Looking For';
      default: return '';
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600' as const,
      color: colors.text,
    },
    placeholder: {
      width: 40,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 32,
    },
    section: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700' as const,
      color: colors.text,
      marginBottom: 4,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
    },
    settingIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.accentGlow,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    settingContent: {
      flex: 1,
    },
    settingLabel: {
      fontSize: 15,
      fontWeight: '600' as const,
      color: colors.text,
    },
    settingValue: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    resetItem: {
      backgroundColor: 'rgba(255, 179, 0, 0.08)',
      borderColor: 'rgba(255, 179, 0, 0.2)',
    },
    logoutItem: {
      backgroundColor: 'rgba(255, 82, 82, 0.08)',
      borderColor: 'rgba(255, 82, 82, 0.2)',
    },
    versionText: {
      fontSize: 12,
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: 24,
    },
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    tag: {
      backgroundColor: colors.accent + '20',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.accent + '40',
    },
    tagText: {
      fontSize: 13,
      color: colors.accent,
      fontWeight: '500' as const,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      maxHeight: '70%',
    },
    modalHandle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700' as const,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 20,
    },
    optionsScrollView: {
      maxHeight: 300,
    },
    optionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.backgroundTertiary,
      marginBottom: 8,
      overflow: 'hidden',
    },
    optionItemSelected: {
      borderWidth: 1,
      borderColor: colors.accent,
    },
    optionText: {
      flex: 1,
      fontSize: 15,
      color: colors.textSecondary,
    },
    optionTextSelected: {
      color: colors.text,
      fontWeight: '500' as const,
    },
    radioButton: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioButtonSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.accent,
    },
    radioInner: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.text,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
      paddingBottom: 20,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.backgroundTertiary,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: colors.textSecondary,
    },
    saveButton: {
      flex: 1,
      borderRadius: 12,
      overflow: 'hidden',
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      gap: 8,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: '#FFFFFF',
    },
    saveButtonTextDisabled: {
      color: colors.textTertiary,
    },
    textInput: {
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bioInput: {
      height: 120,
      textAlignVertical: 'top',
    },
    skillsEditor: {
      gap: 16,
    },
    skillInputRow: {
      flexDirection: 'row',
      gap: 10,
    },
    skillInput: {
      flex: 1,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addSkillButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 20,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addSkillButtonText: {
      fontSize: 15,
      fontWeight: '600' as const,
      color: '#FFFFFF',
    },
    skillsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    skillChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.accent + '30',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 20,
    },
    skillChipText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '500' as const,
    },
    themeToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <Text style={styles.sectionSubtitle}>
            Customize how the app looks
          </Text>

          <View style={styles.settingItem}>
            <View style={styles.settingIcon}>
              {isDark ? (
                <Moon size={20} color={colors.accent} />
              ) : (
                <Sun size={20} color={colors.accent} />
              )}
            </View>
            <View style={[styles.settingContent, styles.themeToggleRow]}>
              <View>
                <Text style={styles.settingLabel}>Dark Mode</Text>
                <Text style={styles.settingValue}>
                  {isDark ? 'On' : 'Off'}
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={handleToggleTheme}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={isDark ? '#FFFFFF' : '#FFFFFF'}
                ios_backgroundColor={colors.border}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Profile</Text>
          <Text style={styles.sectionSubtitle}>
            Edit your public profile information
          </Text>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => handleEditProfile('displayName')}
          >
            <View style={styles.settingIcon}>
              <User size={20} color={colors.accent} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Display Name</Text>
              <Text style={styles.settingValue}>
                {profile?.displayName || 'Not set'}
              </Text>
            </View>
            <Edit3 size={18} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => handleEditProfile('bio')}
          >
            <View style={styles.settingIcon}>
              <Edit3 size={20} color={colors.accent} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Bio</Text>
              <Text style={styles.settingValue} numberOfLines={1}>
                {profile?.bio || 'Tell others about yourself'}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => handleEditProfile('location')}
          >
            <View style={styles.settingIcon}>
              <MapPin size={20} color={colors.accent} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Location</Text>
              <Text style={styles.settingValue}>
                {savedLocation || profile?.location || 'Not set'}
              </Text>
            </View>
            <Edit3 size={18} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => handleEditProfile('skills')}
          >
            <View style={styles.settingIcon}>
              <Sparkles size={20} color={colors.accent} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Skills</Text>
              <Text style={styles.settingValue} numberOfLines={1}>
                {profile?.skills?.length ? profile.skills.slice(0, 3).join(', ') : 'Add your skills'}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => handleEditProfile('lookingFor')}
          >
            <View style={styles.settingIcon}>
              <Target size={20} color={colors.accent} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Looking For</Text>
              <Text style={styles.settingValue}>
                {profile?.lookingFor ? profile.lookingFor.charAt(0).toUpperCase() + profile.lookingFor.slice(1) : 'Not set'}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {interests?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Interests</Text>
            <View style={styles.tagsContainer}>
              {interests.map((interest) => (
                <View key={interest} style={styles.tag}>
                  <Text style={styles.tagText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {goals?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Goals</Text>
            <View style={styles.tagsContainer}>
              {goals.map((goal) => (
                <View key={goal} style={styles.tag}>
                  <Text style={styles.tagText}>{goal}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personalization</Text>
          <Text style={styles.sectionSubtitle}>
            Update your preferences to tailor your experience
          </Text>

          {(['ageRange', 'profession', 'lifestyle', 'contentPreference', 'notificationPreference'] as SettingType[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={styles.settingItem}
              onPress={() => handleEditSetting(type)}
            >
              <View style={styles.settingIcon}>
                {getIcon(type)}
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>{getTitle(type)}</Text>
                <Text style={styles.settingValue}>{getDisplayValue(type)}</Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <Shield size={20} color={colors.accent} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Privacy & Security</Text>
              <Text style={styles.settingValue}>Manage your data</Text>
            </View>
            <ChevronRight size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <HelpCircle size={20} color={colors.accent} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Help & Support</Text>
              <Text style={styles.settingValue}>Get assistance</Text>
            </View>
            <ChevronRight size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity 
            style={[styles.settingItem, styles.resetItem]}
            onPress={handleResetOnboarding}
          >
            <View style={styles.settingIcon}>
              <RefreshCw size={20} color={colors.warning} />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: colors.warning }]}>
                Reset Onboarding
              </Text>
              <Text style={styles.settingValue}>
                Start fresh with new preferences
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.settingItem, styles.logoutItem]}
            onPress={() => {
              Alert.alert(
                'Log Out',
                'Are you sure you want to log out?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Log Out',
                    style: 'destructive',
                    onPress: async () => {
                      if (Platform.OS !== 'web') {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                      }
                      await signOut();
                    },
                  },
                ]
              );
            }}
          >
            <View style={styles.settingIcon}>
              <LogOut size={20} color={colors.error} />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: colors.error }]}>
                Log Out
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>Version 1.0.0</Text>
      </ScrollView>

      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowEditModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {editingSetting ? getTitle(editingSetting) : ''}
            </Text>

            <ScrollView style={styles.optionsScrollView}>
              {editingSetting && getOptions(editingSetting).map((option) => {
                const isSelected = tempValue === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.optionItem,
                      isSelected && styles.optionItemSelected,
                    ]}
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                      setTempValue(option.id);
                    }}
                  >
                    {isSelected && (
                      <LinearGradient
                        colors={[colors.gradient1 + '30', colors.gradient2 + '30']}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <Text style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected,
                    ]}>
                      {option.label}
                    </Text>
                    <View style={[
                      styles.radioButton,
                      isSelected && styles.radioButtonSelected,
                    ]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, !tempValue && styles.saveButtonDisabled]}
                onPress={handleSaveSetting}
                disabled={!tempValue}
              >
                <LinearGradient
                  colors={tempValue ? [colors.gradient1, colors.gradient2] : [colors.surface, colors.surface]}
                  style={styles.saveButtonGradient}
                >
                  <Text style={[styles.saveButtonText, !tempValue && styles.saveButtonTextDisabled]}>
                    Save
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showProfileModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowProfileModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {editingProfileField ? getProfileFieldTitle(editingProfileField) : ''}
            </Text>

            {editingProfileField === 'skills' ? (
              <View style={styles.skillsEditor}>
                <View style={styles.skillInputRow}>
                  <TextInput
                    style={styles.skillInput}
                    placeholder="Add a skill..."
                    placeholderTextColor={colors.textTertiary}
                    value={newSkill}
                    onChangeText={setNewSkill}
                    onSubmitEditing={addSkill}
                    returnKeyType="done"
                  />
                  <TouchableOpacity style={styles.addSkillButton} onPress={addSkill}>
                    <Text style={styles.addSkillButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.skillsContainer}>
                  {tempSkills.map((skill) => (
                    <View key={skill} style={styles.skillChip}>
                      <Text style={styles.skillChipText}>{skill}</Text>
                      <TouchableOpacity onPress={() => removeSkill(skill)}>
                        <X size={14} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            ) : editingProfileField === 'lookingFor' ? (
              <ScrollView style={styles.optionsScrollView}>
                {LOOKING_FOR_OPTIONS.map((option) => {
                  const isSelected = tempValue === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.optionItem,
                        isSelected && styles.optionItemSelected,
                      ]}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                        setTempValue(option.id);
                      }}
                    >
                      {isSelected && (
                        <LinearGradient
                          colors={[colors.gradient1 + '30', colors.gradient2 + '30']}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      <Text style={[
                        styles.optionText,
                        isSelected && styles.optionTextSelected,
                      ]}>
                        {option.label}
                      </Text>
                      <View style={[
                        styles.radioButton,
                        isSelected && styles.radioButtonSelected,
                      ]}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : editingProfileField === 'bio' ? (
              <TextInput
                style={[styles.textInput, styles.bioInput]}
                placeholder="Tell others about yourself..."
                placeholderTextColor={colors.textTertiary}
                value={tempProfileValue}
                onChangeText={setTempProfileValue}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            ) : (
              <TextInput
                style={styles.textInput}
                placeholder={`Enter your ${editingProfileField}`}
                placeholderTextColor={colors.textTertiary}
                value={tempProfileValue}
                onChangeText={setTempProfileValue}
                autoFocus
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowProfileModal(false);
                  setEditingProfileField(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveProfile}
              >
                <LinearGradient
                  colors={[colors.gradient1, colors.gradient2]}
                  style={styles.saveButtonGradient}
                >
                  <Save size={18} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}
