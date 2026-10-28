import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { OnboardingProvider, useOnboarding } from '@/contexts/OnboardingContext';
import { SocialProvider } from '@/contexts/SocialContext';
import { ConnectionsProvider } from '@/contexts/ConnectionsContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { TabBarProvider } from '@/contexts/TabBarContext';
import { CreatePostProvider } from '@/contexts/CreatePostContext';
import { MessagingProvider } from '@/contexts/MessagingContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { UserPostsProvider } from '@/contexts/UserPostsContext';

import { BundleProvider } from '@/contexts/BundleContext';
import { SkillProvider } from '@/contexts/SkillContext';
import { ServiceRequestProvider } from '@/contexts/ServiceRequestContext';
import { BookingsProvider } from '@/contexts/BookingsContext';
import { PlannerProvider } from '@/contexts/PlannerContext';
import { OrdersProvider } from '@/contexts/OrdersContext';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import { trpc, trpcClient } from '@/lib/trpc';
import { logger } from '@/lib/logger';
import {
  configureNotificationHandler,
  ensureNotificationChannel,
  registerForPushNotifications,
  onNotificationTap,
} from '@/lib/notifications';

const queryClient = new QueryClient();

function RootLayoutNav() {
  const segments = useSegments();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { completed: onboardingCompleted, isLoading: onboardingLoading } = useOnboarding();
  const { colors } = useTheme();
  const hasInitialized = React.useRef(false);
  const navigationTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLoading = authLoading || onboardingLoading;

  // ── Push notifications: configure handler once, register token on login ──
  useEffect(() => {
    configureNotificationHandler();
    ensureNotificationChannel();
  }, []);

  // Tapping a push notification opens the chat / Notifications screen.
  useEffect(() => {
    if (!isAuthenticated) return;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    onNotificationTap((path) => router.push(path as never)).then((fn) => {
      if (cancelled) fn(); else unsubscribe = fn;
    });
    return () => { cancelled = true; unsubscribe?.(); };
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    let cancelled = false;
    registerForPushNotifications(user.id).then((token) => {
      if (!cancelled && token) {
        logger.info('RootLayout', 'Push token registered');
      }
    });
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (isLoading) {
      logger.info('RootLayout', 'Still loading...', { authLoading, onboardingLoading });
      return;
    }

    const currentSegment = segments[0] ?? '';
    const inAuthGroup = currentSegment === 'welcome' as string;
    const inOnboardingGroup = currentSegment === 'onboarding' as string;
    const inTabs = currentSegment === '(tabs)';
    // The password-reset screen is opened from an email link while the user is
    // signed out; it must not be bounced to /welcome (or to /home once the
    // recovery session signs them in) before they can set a new password.
    const inPasswordReset = currentSegment === ('reset-password' as string);
    if (inPasswordReset) {
      hasInitialized.current = true;
      return;
    }

    logger.info('RootLayout', 'Navigation check', {
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
      
      logger.info('RootLayout', 'Navigating to', { targetRoute });
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
    <Stack.Screen name="reset-password" options={{ headerShown: false }} />
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen
      name="onboarding"
      options={{
        headerShown: false,
        animation: 'fade',
      }}
    />
    <Stack.Screen
      name="inbox"
      options={{ headerShown: false }}
    />
    <Stack.Screen name="notifications" options={{ headerShown: false }} />
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

class ProviderErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error) {
    logger.error('ProviderErrorBoundary', 'Caught', { error });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 }}>App Crashed</Text>
          <Text style={{ color: '#F87171', fontSize: 13, textAlign: 'center', marginBottom: 16 }}>{this.state.error}</Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: '' })}
            style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, backgroundColor: '#0095F6' }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  useEffect(() => {
    // Safety: force hide splash even if providers crash
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 3000);
    SplashScreen.hideAsync().catch(() => {});
    logger.info('Root', 'App mounted');
    return () => clearTimeout(timer);
  }, []);

  return (
    <ProviderErrorBoundary>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <SafeAreaProvider>
                <ThemeProvider>
                  <AuthProvider>
                    <OnboardingProvider>
                        <UserPostsProvider>
                        <SocialProvider>
                          <ConnectionsProvider>
                        <BundleProvider>
                          <SkillProvider>
                          <ServiceRequestProvider>
                                <MessagingProvider>
                                <NotificationsProvider>
                                  <BookingsProvider>
                                    <PlannerProvider>
                                      <OrdersProvider>
                                        <TabBarProvider>
                                          <CreatePostProvider>
                                            <AppErrorBoundary>
                                              <RootLayoutNavWithTheme />
                                            </AppErrorBoundary>
                                          </CreatePostProvider>
                                        </TabBarProvider>
                                      </OrdersProvider>
                                    </PlannerProvider>
                                  </BookingsProvider>
                                </NotificationsProvider>
                                </MessagingProvider>
                          </ServiceRequestProvider>
                          </SkillProvider>
                        </BundleProvider>
                          </ConnectionsProvider>
                        </SocialProvider>
                        </UserPostsProvider>
                    </OnboardingProvider>
                  </AuthProvider>
                </ThemeProvider>
              </SafeAreaProvider>
            </GestureHandlerRootView>
          </QueryClientProvider>
        </trpc.Provider>
      </ProviderErrorBoundary>
  );
}
