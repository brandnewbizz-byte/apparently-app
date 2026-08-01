import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function VirtualRoomScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Virtual Room</Text>
      <Text style={styles.subtitle}>Tap + to add objects</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#262626',
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E8E',
    marginTop: 8,
  },
});
