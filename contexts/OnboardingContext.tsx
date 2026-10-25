import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface UserPersonalization {
  ageRange: string;
  profession: string;
  lifestyle: string;
  contentPreference: string;
  notificationPreference: string;
}

export type RateType = 'hourly' | 'session' | 'project' | 'custom';

export interface UserRate {
  type: RateType;
  amount: string;
  customLabel?: string;
}

interface UserProfile {
  displayName: string;
  bio: string;
  location: string;
  skills: string[];
  lookingFor: 'networking' | 'collaboration' | 'hiring' | 'opportunities' | '';
  isOpenToConnect: boolean;
  rate?: UserRate;
}

interface OnboardingData {
  interests: string[];
  goals: string[];
  priorities: string[];
  location: string;
  completed: boolean;
  /** Account that completed onboarding on this device. */
  ownerId?: string;
  personalization: UserPersonalization;
  profile: UserProfile;
}

const STORAGE_KEY = 'apparently_onboarding';

const defaultPersonalization: UserPersonalization = {
  ageRange: '',
  profession: '',
  lifestyle: '',
  contentPreference: '',
  notificationPreference: '',
};

const defaultProfile: UserProfile = {
  displayName: '',
  bio: '',
  location: '',
  skills: [],
  lookingFor: '',
  isOpenToConnect: false,
};

const defaultData: OnboardingData = {
  interests: [],
  goals: [],
  priorities: [],
  location: '',
  completed: false, // new users land on the welcome/onboarding screen first
  personalization: defaultPersonalization,
  profile: defaultProfile,
};

export const [OnboardingProvider, useOnboarding] = createContextHook(() => {
  const [data, setData] = useState<OnboardingData>(defaultData);
  const { session } = useAuth();
  const currentUserId = session?.user?.id ?? null;
  // Completion is stored on the account (auth user_metadata) so it follows the
  // user to a new phone, and a different account on this phone still gets
  // onboarded. The local flag only counts for the account that set it.
  const accountCompleted = session?.user?.user_metadata?.onboarding_completed === true;
  // True once stored data has been copied into `data`. Without this there is a
  // render where the query has finished but `data` is still the default
  // (completed: false), which flashed returning users through /onboarding.
  const [hydrated, setHydrated] = useState(false);

  const safeProfile: UserProfile = data.profile ?? defaultProfile;

  const query = useQuery({
    queryKey: ['onboarding'],
    queryFn: async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored && stored !== 'undefined') {
          const parsed = JSON.parse(stored) as Partial<OnboardingData>;
          return {
            ...defaultData,
            ...parsed,
            personalization: { ...defaultPersonalization, ...parsed.personalization },
            profile: { ...defaultProfile, ...parsed.profile },
          };
        }
        return defaultData;
      } catch (error) {
        logger.error('Onboarding', 'Error parsing stored data', { error });
        return defaultData;
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newData: OnboardingData) => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      return newData;
    },
  });

  useEffect(() => {
    if (query.data) {
      setData(query.data);
      setHydrated(true);
    }
  }, [query.data]);

  const updateInterests = (interests: string[]) => {
    const updated = { ...data, interests };
    setData(updated);
    saveMutation.mutate(updated);
  };

  const updateGoals = (goals: string[]) => {
    const updated = { ...data, goals };
    setData(updated);
    saveMutation.mutate(updated);
  };

  const updatePriorities = (priorities: string[]) => {
    const updated = { ...data, priorities };
    setData(updated);
    saveMutation.mutate(updated);
  };

  const updateLocation = (location: string) => {
    const updated = { ...data, location };
    setData(updated);
    saveMutation.mutate(updated);
  };

  const updatePersonalization = (personalization: Partial<UserPersonalization>) => {
    const updated = { 
      ...data, 
      personalization: { ...data.personalization, ...personalization } 
    };
    setData(updated);
    saveMutation.mutate(updated);
  };

  const completeOnboarding = () => {
    const updated = { ...data, completed: true, ownerId: currentUserId ?? undefined };
    setData(updated);
    saveMutation.mutate(updated);
    if (currentUserId) {
      supabase.auth
        .updateUser({
          data: {
            onboarding_completed: true,
            onboarding: {
              interests: updated.interests,
              goals: updated.goals,
              priorities: updated.priorities,
              location: updated.location,
              personalization: updated.personalization,
            },
          },
        })
        .then(({ error }) => {
          if (error) logger.warn('Onboarding', 'Saving onboarding to account failed', { message: error.message });
        });
    }
  };

  // Legacy installs: onboarding was completed before ownership was tracked —
  // credit it to the signed-in account once and record it server-side.
  const localCompletedForUser =
    data.completed && (!data.ownerId || data.ownerId === currentUserId);
  useEffect(() => {
    if (!hydrated || !currentUserId || accountCompleted) return;
    if (data.completed && !data.ownerId) {
      const stamped = { ...data, ownerId: currentUserId };
      setData(stamped);
      saveMutation.mutate(stamped);
      supabase.auth.updateUser({ data: { onboarding_completed: true } }).then(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, currentUserId, accountCompleted, data.completed, data.ownerId]);

  const resetOnboarding = () => {
    setData(defaultData);
    saveMutation.mutate(defaultData);
  };

  const updateProfile = (profile: Partial<UserProfile>) => {
    const currentProfile = data.profile ?? defaultProfile;
    const updated = {
      ...data,
      profile: { ...currentProfile, ...profile },
    };
    setData(updated);
    saveMutation.mutate(updated);
  };

  const toggleOpenToConnect = () => {
    const currentProfile = data.profile ?? defaultProfile;
    const updated = {
      ...data,
      profile: { ...currentProfile, isOpenToConnect: !currentProfile.isOpenToConnect },
    };
    setData(updated);
    saveMutation.mutate(updated);
    logger.info('Onboarding', 'Toggled open to connect', { isOpenToConnect: !currentProfile.isOpenToConnect });
  };

  return {
    ...data,
    completed: currentUserId ? accountCompleted || localCompletedForUser : data.completed,
    profile: safeProfile,
    isLoading: query.isLoading || !hydrated,
    updateInterests,
    updateGoals,
    updatePriorities,
    updateLocation,
    updatePersonalization,
    updateProfile,
    toggleOpenToConnect,
    completeOnboarding,
    resetOnboarding,
  };
});
