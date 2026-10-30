/** Appearance: light, dark, or follow the phone. */
import React from 'react';
import { Check, Sun, Moon, Smartphone } from 'lucide-react-native';
import { useTheme, type ThemeMode } from '@/contexts/ThemeContext';
import { SettingsPage, Group, Item } from '@/components/settings/SettingsUI';

const W = '#FFFFFF';

export default function AppearanceSettings() {
  const { colors, themeMode, setTheme, isDark } = useTheme();
  const options: { id: ThemeMode; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'light', label: 'Light', icon: <Sun size={18} color={W} />, color: '#F59E0B' },
    { id: 'dark', label: 'Dark', icon: <Moon size={18} color={W} />, color: '#334155' },
    { id: 'system', label: 'Automatic', icon: <Smartphone size={18} color={W} />, color: '#0EA5E9' },
  ];
  return (
    <SettingsPage title="Appearance">
      <Group title="Theme" footer={`Automatic matches your phone’s setting${themeMode === 'system' ? ` (now ${isDark ? 'dark' : 'light'})` : ''}.`}>
        {options.map((o) => (
          <Item
            key={o.id}
            icon={o.icon}
            iconBg={o.color}
            label={o.label}
            onPress={() => setTheme(o.id)}
            right={themeMode === o.id ? <Check size={20} color={colors.accent} /> : null}
            testID={`theme-${o.id}`}
          />
        ))}
      </Group>
    </SettingsPage>
  );
}
