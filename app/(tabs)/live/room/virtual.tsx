import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import VirtualRoomCanvas from '@/components/live/virtual/VirtualRoomCanvas';
import ObjectInfoPanel from '@/components/live/virtual/ObjectInfoPanel';
import ObjectToolbar from '@/components/live/virtual/ObjectToolbar';
import { useVirtualRoom } from '@/contexts/VirtualRoomContext';

const { width: SW, height: SH } = Dimensions.get('window');

export default function VirtualRoomScreen() {
  const {
    environment,
    setEnvironment,
    selectedObject,
    selectObject,
    objects,
  } = useVirtualRoom();

  const [showToolbar, setShowToolbar] = useState(!environment);
  const [showInfo, setShowInfo] = useState(false);

  // Show info panel when object is selected
  React.useEffect(() => {
    if (selectedObject) {
      setShowInfo(true);
    }
  }, [selectedObject]);

  // Show toolbar on first load if no environment set
  const handleCloseInfo = useCallback(() => {
    setShowInfo(false);
    selectObject(null);
  }, [selectObject]);

  // Canvas center (for placing new objects)
  const canvasCenterX = (SW * 3) / 2;
  const canvasCenterY = (SH * 3) / 2;

  // If no environment set, show environment picker inside the toolbar
  // The toolbar doubles as the environment picker on first visit

  return (
    <View style={styles.container}>
      {/* ── Virtual Canvas ── */}
      <VirtualRoomCanvas />

      {/* ── FAB: Add Object ── */}
      <View style={styles.fab}>
        <Text
          style={styles.fabText}
          onPress={() => setShowToolbar(true)}
        >
          ＋
        </Text>
      </View>

      {/* ── Object Count Badge ── */}
      <View style={styles.objCount}>
        <Text style={styles.objCountText}>
          {objects.length} object{objects.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* ── Object Info Panel ── */}
      <ObjectInfoPanel
        object={selectedObject}
        visible={showInfo}
        onClose={handleCloseInfo}
      />

      {/* ── Object Toolbar / Environment Picker ── */}
      <ObjectToolbar
        visible={showToolbar}
        onClose={() => setShowToolbar(false)}
        canvasCenterX={canvasCenterX}
        canvasCenterY={canvasCenterY}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F0',
  },
  fab: {
    position: 'absolute',
    bottom: 84,
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 10,
  },
  fabText: {
    fontSize: 28,
    color: '#FFF',
    lineHeight: 30,
    fontWeight: '300',
  },
  objCount: {
    position: 'absolute',
    bottom: 18,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  objCountText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
