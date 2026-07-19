import { useRef, useCallback } from 'react';
import { Animated } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';

interface TabBarContextValue {
  tabBarTranslateY: Animated.Value;
  handleScroll: (currentY: number) => void;
  showTabBar: () => void;
  hideTabBar: () => void;
}

export const [TabBarProvider, useTabBar] = createContextHook<TabBarContextValue>(() => {
  const tabBarTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const isTabBarVisible = useRef(true);
  const scrollThreshold = 10;

  const showTabBar = useCallback(() => {
    if (!isTabBarVisible.current) {
      isTabBarVisible.current = true;
      Animated.spring(tabBarTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 12,
      }).start();
    }
  }, [tabBarTranslateY]);

  const hideTabBar = useCallback(() => {
    if (isTabBarVisible.current) {
      isTabBarVisible.current = false;
      Animated.spring(tabBarTranslateY, {
        toValue: 100,
        useNativeDriver: true,
        tension: 100,
        friction: 12,
      }).start();
    }
  }, [tabBarTranslateY]);

  const handleScroll = useCallback((currentY: number) => {
    const diff = currentY - lastScrollY.current;
    
    if (currentY <= 0) {
      showTabBar();
    } else if (diff > scrollThreshold) {
      hideTabBar();
    } else if (diff < -5) {
      showTabBar();
    }
    
    lastScrollY.current = currentY;
  }, [showTabBar, hideTabBar]);

  return {
    tabBarTranslateY,
    handleScroll,
    showTabBar,
    hideTabBar,
  };
});
