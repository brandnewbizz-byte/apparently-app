import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useMemo } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = '@app_theme_mode';

export const lightTheme = {
  background: "#FFFFFF",
  backgroundSecondary: "#FAFAFA",
  backgroundTertiary: "#F5F5F5",
  surface: "#FFFFFF",
  surfaceHighlight: "#F0F0F0",
  text: "#262626",
  textSecondary: "#737373",
  textTertiary: "#8E8E8E",
  accent: "#0095F6",
  accentSecondary: "#0084D6",
  accentGlow: "rgba(0, 149, 246, 0.1)",
  gradient1: "#F58529",
  gradient2: "#DD2A7B",
  gradient3: "#8134AF",
  live: "#ED4956",
  liveGlow: "rgba(237, 73, 86, 0.2)",
  success: "#00A86B",
  warning: "#FFB300",
  error: "#ED4956",
  border: "#DBDBDB",
  borderLight: "#EFEFEF",
  cardBackground: "rgba(255, 255, 255, 0.95)",
  overlay: "rgba(0, 0, 0, 0.5)",
  tabBar: "#FFFFFF",
  tabIconDefault: "#8E8E8E",
  tabIconSelected: "#262626",
};

export const darkTheme = {
  background: "#000000",
  backgroundSecondary: "#121212",
  backgroundTertiary: "#1C1C1C",
  surface: "#1C1C1C",
  surfaceHighlight: "#2A2A2A",
  text: "#FAFAFA",
  textSecondary: "#A8A8A8",
  textTertiary: "#737373",
  accent: "#0095F6",
  accentSecondary: "#0084D6",
  accentGlow: "rgba(0, 149, 246, 0.15)",
  gradient1: "#F58529",
  gradient2: "#DD2A7B",
  gradient3: "#8134AF",
  live: "#ED4956",
  liveGlow: "rgba(237, 73, 86, 0.25)",
  success: "#00A86B",
  warning: "#FFB300",
  error: "#ED4956",
  border: "#363636",
  borderLight: "#262626",
  cardBackground: "rgba(28, 28, 28, 0.95)",
  overlay: "rgba(0, 0, 0, 0.7)",
  tabBar: "#000000",
  tabIconDefault: "#737373",
  tabIconSelected: "#FAFAFA",
};

export type ThemeColors = typeof lightTheme;

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
          setThemeMode(savedTheme as ThemeMode);
          console.log('[Theme] Loaded saved theme:', savedTheme);
        }
      } catch (error) {
        console.log('[Theme] Error loading theme:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadTheme();
  }, []);

  const setTheme = async (mode: ThemeMode) => {
    try {
      setThemeMode(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      console.log('[Theme] Theme saved:', mode);
    } catch (error) {
      console.log('[Theme] Error saving theme:', error);
    }
  };

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, systemColorScheme]);

  const colors = useMemo(() => {
    return isDark ? darkTheme : lightTheme;
  }, [isDark]);

  const toggleTheme = () => {
    const newMode = isDark ? 'light' : 'dark';
    setTheme(newMode);
  };

  return {
    themeMode,
    setTheme,
    toggleTheme,
    isDark,
    colors,
    isLoading,
  };
});
