import { Link, Stack } from 'expo-router';
import { AlertCircle } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import Colors from '@/constants/colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!', headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.dark.background, Colors.dark.backgroundSecondary]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.iconContainer}>
          <AlertCircle size={64} color={Colors.dark.textTertiary} />
        </View>
        <Text style={styles.title}>Page Not Found</Text>
        <Text style={styles.text}>
          This screen does not exist in your universe.
        </Text>
        <Link href="/" asChild>
          <TouchableOpacity style={styles.button}>
            <LinearGradient
              colors={[Colors.dark.gradient1, Colors.dark.gradient2]}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.buttonText}>Go Home</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Colors.dark.background,
  },
  iconContainer: {
    marginBottom: 24,
    opacity: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  text: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
});
