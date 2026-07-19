import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

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
  completed: true, // DEV MODE: skip onboarding
  personalization: defaultPersonalization,
  profile: defaultProfile,
};

export const [OnboardingProvider, useOnboarding] = createContextHook(() => {
  const [data, setData] = useState<OnboardingData>(defaultData);

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
        console.error('[Onboarding] Error parsing stored data:', error);
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
    const updated = { ...data, completed: true };
    setData(updated);
    saveMutation.mutate(updated);
  };

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
    console.log('[Onboarding] Toggled open to connect:', !currentProfile.isOpenToConnect);
  };

  return {
    ...data,
    profile: safeProfile,
    isLoading: query.isLoading,
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
