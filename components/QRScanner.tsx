/**
 * QRScanner — scan someone's Apparently code and open their profile in the app.
 * (Phone camera apps open the same code in the browser; this keeps it in-app.)
 */
import React, { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import { CameraView, useCameraPermissions, cameraNativeAvailable } from '@/lib/safe-camera';

const PROFILE = /\/user\/([0-9a-f-]{36})/i;
const ROOM = /\/live\/room\/([0-9a-z-]+)/i;

/** The in-app screen a scanned code points to, or null if it isn't one of ours. */
export function pathFromCode(data: string): string | null {
  const text = (data || '').trim();
  const p = text.match(PROFILE);
  if (p) return `/user/${p[1]}`;
  const r = text.match(ROOM);
  if (r) return `/(tabs)/live/room/${r[1]}`;
  return null;
}

export default function QRScanner({ visible, onClose, onOpen }: {
  visible: boolean;
  onClose: () => void;
  /** Called with the in-app path to open (e.g. "/user/<id>"). */
  onOpen: (path: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [notOurs, setNotOurs] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (!visible) return;
    handled.current = false;
    setNotOurs(false);
    if (!permission?.granted) requestPermission().catch(() => {});
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScan = ({ data }: { data: string }) => {
    if (handled.current) return;
    const path = pathFromCode(data);
    if (!path) { setNotOurs(true); return; }
    handled.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onOpen(path);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        {cameraNativeAvailable && permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onScan}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            <Text style={styles.msg}>
              {cameraNativeAvailable ? 'Allow camera access to scan codes.' : 'The camera isn’t available on this device.'}
            </Text>
            {cameraNativeAvailable ? (
              <TouchableOpacity onPress={() => requestPermission()} style={styles.btn}>
                <Text style={styles.btnText}>Allow camera</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* Frame + hint (siblings on top of the camera, never children of it) */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
          <View style={styles.frame} />
          <Text style={styles.hint}>{notOurs ? 'That’s not an Apparently code' : 'Point at an Apparently profile code'}</Text>
        </View>

        <TouchableOpacity onPress={onClose} style={[styles.close, { top: insets.top + 12 }]} accessibilityLabel="Close scanner" hitSlop={12}>
          <X size={26} color="#FFF" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  frame: { width: 240, height: 240, borderRadius: 24, borderWidth: 3, borderColor: '#FFFFFF' },
  hint: { color: '#FFF', fontSize: 15, fontWeight: '700', marginTop: 18, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6 },
  msg: { color: '#FFF', fontSize: 15, textAlign: 'center', paddingHorizontal: 30 },
  btn: { marginTop: 16, backgroundColor: '#7B61FF', paddingHorizontal: 20, paddingVertical: 11, borderRadius: 14 },
  btnText: { color: '#FFF', fontWeight: '800' },
  close: { position: 'absolute', left: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
});
