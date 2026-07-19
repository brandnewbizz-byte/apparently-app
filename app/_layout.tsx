import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { OnboardingProvider, useOnboarding } from '@/contexts/OnboardingContext';
import { LifeCrmProvider } from '@/contexts/LifeCrmContext';
import { SocialProvider } from '@/contexts/SocialContext';
import { ConnectionsProvider } from '@/contexts/ConnectionsContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { TabBarProvider } from '@/contexts/TabBarContext';
import { MessagingProvider } from '@/contexts/MessagingContext';

import { SwapProvider } from '@/contexts/SwapContext';
import { BookingsProvider } from '@/contexts/BookingsContext';
import { PlannerProvider } from '@/contexts/PlannerContext';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import { trpc, trpcClient } from '@/lib/trpc';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const segments = useSegments();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { completed: onboardingCompleted, isLoading: onboardingLoading } = useOnboarding();
  const { colors } = useTheme();
  const hasInitialized = React.useRef(false);
  const navigationTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLoading = authLoading || onboardingLoading;

  useEffect(() => {
    if (isLoading) {
      console.log('[RootLayout] Still loading...', { authLoading, onboardingLoading });
      return;
    }

    const currentSegment = segments[0] ?? '';
    const inAuthGroup = currentSegment === 'welcome' as string;
    const inOnboardingGroup = currentSegment === 'onboarding' as string;
    const inTabs = currentSegment === '(tabs)';

    console.log('[RootLayout] Navigation check:', {
      isAuthenticated,
      onboardingCompleted,
      currentSegment,
      hasInitialized: hasInitialized.current,
    });

    let targetRoute: string | null = null;

    if (!isAuthenticated) {
      if (!inAuthGroup) {
        targetRoute = '/welcome';
      }
    } else if (isAuthenticated && !onboardingCompleted) {
      if (!inOnboardingGroup) {
        targetRoute = '/onboarding';
      }
    } else if (isAuthenticated && onboardingCompleted) {
      if (inOnboardingGroup || inAuthGroup || (!currentSegment && !inTabs)) {
        targetRoute = '/(tabs)/(home)';
      }
    }

    if (targetRoute) {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
      
      console.log('[RootLayout] Navigating to:', targetRoute);
      navigationTimeoutRef.current = setTimeout(() => {
        router.replace(targetRoute as never);
        hasInitialized.current = true;
      }, hasInitialized.current ? 100 : 0);
    } else {
      hasInitialized.current = true;
    }

    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, [isAuthenticated, onboardingCompleted, segments, isLoading, router, authLoading, onboardingLoading]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        fullScreenGestureEnabled: true,
      }}
    >
    <Stack.Screen name="welcome" options={{ headerShown: false }} />
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen
      name="onboarding"
      options={{
        headerShown: false,
        animation: 'fade',
      }}
    />
    <Stack.Screen
      name="create-content"
      options={{
        headerShown: false,
        presentation: 'fullScreenModal',
        animation: 'slide_from_bottom',
      }}
    />
    </Stack>
  );
}

function RootLayoutNavWithTheme() {
  const { isDark, colors } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.safeArea, { backgroundColor: colors.background }]} testID="app-safe-area">
        <KeyboardAvoidingView
          style={styles.safeAreaInner}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          testID="global-keyboard-avoiding-view"
        >
          <RootLayoutNav />
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  safeAreaInner: {
    flex: 1,
    justifyContent: 'flex-start' as const,
  },
});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    console.log('Cleanup done: Twilio/Gmail/live removed');

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        console.log('[Supabase] Connected. Session:', session ? 'Active' : 'None');
      })
      .catch((e: unknown) => {
        console.log('[Supabase] getSession failed:', e);
      });
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <ThemeProvider>
              <AuthProvider>
                <OnboardingProvider>
                  <LifeCrmProvider>
                    <SocialProvider>
                      <ConnectionsProvider>
                            <MessagingProvider>
                              <SwapProvider>
                                <BookingsProvider>
                                  <PlannerProvider>
                                    <TabBarProvider>
                                      <AppErrorBoundary>
                                        <RootLayoutNavWithTheme />
                                      </AppErrorBoundary>
                                    </TabBarProvider>
                                  </PlannerProvider>
                                </BookingsProvider>
                              </SwapProvider>
                            </MessagingProvider>
                      </ConnectionsProvider>
                    </SocialProvider>
                  </LifeCrmProvider>
                </OnboardingProvider>
              </AuthProvider>
            </ThemeProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
