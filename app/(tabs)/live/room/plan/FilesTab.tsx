import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
  Alert, ActivityIndicator, Platform, ActionSheetIOS,
  Modal, SafeAreaView, StatusBar, Dimensions, Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import {
  Upload, Image as ImageIcon, FileText, File, Trash2,
  ExternalLink, Camera, Paperclip, HardDrive, X, Download,
} from 'lucide-react-native';
import { usePlan, FileRef } from '@/contexts/PlanContext';
import { useTheme } from '@/contexts/ThemeContext';

const { width: SCREEN_W } = Dimensions.get('window');

const FILE_TYPE_ICONS: Record<string, { icon: any; color: string; label: string }> = {
  image: { icon: ImageIcon, color: '#3B82F6', label: 'Image' },
  video: { icon: File, color: '#EF4444', label: 'Video' },
  pdf: { icon: FileText, color: '#F59E0B', label: 'PDF' },
  document: { icon: FileText, color: '#10B981', label: 'Doc' },
  spreadsheet: { icon: File, color: '#10B981', label: 'Sheet' },
  link: { icon: ExternalLink, color: '#8B5CF6', label: 'Link' },
  design: { icon: ImageIcon, color: '#A855F7', label: 'Design' },
  voice: { icon: File, color: '#EC4899', label: 'Audio' },
  supplier: { icon: File, color: '#6B7280', label: 'Supplier' },
  other: { icon: File, color: '#6B7280', label: 'File' },
};

const IMAGE_TYPES = new Set(['image', 'design']);

function isImageFile(file: FileRef): boolean {
  if (IMAGE_TYPES.has(file.type)) return true;
  const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp'].includes(ext);
}

function fmtBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
}

export default function FilesTab() {
  const { plan, addFile, deleteFile, uploadFile, storageUsedBytes, storageLimit } = usePlan();
  const theme = useTheme();
  const isLight = theme.colors.background === '#FFFFFF';

  const colors = {
    text: theme.colors.text,
    textSecondary: theme.colors.textSecondary,
    textTertiary: theme.colors.textTertiary,
    border: theme.colors.border,
    surface: theme.colors.surface || theme.colors.backgroundSecondary,
    formBg: isLight ? '#F5F5F5' : '#1F2937',
  };

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [viewerFile, setViewerFile] = useState<FileRef | null>(null);
  const [viewerImageLoadError, setViewerImageLoadError] = useState(false);

  const files = plan?.files || [];
  const usedPct = storageLimit > 0 ? Math.min(storageUsedBytes / storageLimit, 1) : 0;

  // ── Upload flow ──
  const showUploadOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose Photo', 'Choose Document'], cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) takePhoto();
          else if (idx === 2) pickImage();
          else if (idx === 3) pickDocument();
        }
      );
    } else {
      Alert.alert('Upload File', undefined, [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose Photo', onPress: pickImage },
        { text: 'Choose Document', onPress: pickDocument },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Camera access required to take a photo.'); return; }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8, base64: false });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        await doUpload(asset.uri, asset.fileName || 'photo.jpg', asset.mimeType || 'image/jpeg', 'image', asset.fileSize || 0);
      }
    } catch (e) { Alert.alert('Error', 'Failed to open camera.'); }
  };

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Photo library access required.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, base64: false });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        await doUpload(asset.uri, asset.fileName || 'image.jpg', asset.mimeType || 'image/jpeg', 'image', asset.fileSize || 0);
      }
    } catch (e) { Alert.alert('Error', 'Failed to pick image.'); }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const ext = (asset.name || '').split('.').pop()?.toLowerCase() || '';
        const type = ['jpg','jpeg','png','gif','webp','heic'].includes(ext) ? 'image'
          : ext === 'pdf' ? 'pdf'
          : ['doc','docx'].includes(ext) ? 'document'
          : ['xls','xlsx','csv'].includes(ext) ? 'spreadsheet'
          : 'other';
        await doUpload(asset.uri, asset.name, asset.mimeType || 'application/octet-stream', type, asset.size || 0);
      }
    } catch (e) { Alert.alert('Error', 'Failed to pick document.'); }
  };

  const doUpload = async (uri: string, name: string, mimeType: string, fileType: string, size: number) => {
    if (size > 0 && storageUsedBytes + size > storageLimit) {
      Alert.alert('Storage Full', `Upload would exceed the 5 GB limit. (${fmtBytes(storageUsedBytes)} used)`);
      return;
    }
    setUploading(true);
    setUploadProgress(`Uploading ${name}...`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const ok = await uploadFile(uri, name, mimeType, fileType);
    setUploading(false);
    setUploadProgress('');
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDelete = (file: FileRef) => {
    Alert.alert('Remove File', `Delete "${file.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); deleteFile(file.id); } },
    ]);
  };

  // ── Open file ──
  const openFile = async (file: FileRef) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isImageFile(file)) {
      setViewerImageLoadError(false);
      setViewerFile(file);
    } else if (file.url && (file.url.startsWith('http://') || file.url.startsWith('https://'))) {
      try {
        await WebBrowser.openBrowserAsync(file.url, {
          toolbarColor: isLight ? '#FFFFFF' : '#111827',
          controlsColor: '#8B5CF6',
        });
      } catch {
        Alert.alert('Cannot Open', 'Unable to open this file.');
      }
    } else {
      Alert.alert('Preview', `${file.name}\n\nType: ${file.type}\n${file.sizeBytes ? 'Size: ' + fmtBytes(file.sizeBytes) : 'Size unknown'}\n\nFull preview coming soon.`, [{ text: 'OK' }]);
    }
  };

  const closeViewer = () => {
    setViewerFile(null);
    setViewerImageLoadError(false);
  };

  return (
    <View style={styles.container}>
      {/* ── Upload Button ── */}
      <TouchableOpacity
        style={[styles.uploadBtn, uploading && { opacity: 0.6 }]}
        onPress={showUploadOptions}
        disabled={uploading}
        activeOpacity={0.8}
      >
        {uploading ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Upload size={18} color="#FFF" />
        )}
        <Text style={styles.uploadBtnText}>
          {uploading ? uploadProgress : 'Upload File'}
        </Text>
      </TouchableOpacity>

      {/* ── Storage Bar ── */}
      <View style={[styles.storageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.storageHeader}>
          <HardDrive size={14} color={colors.textTertiary} />
          <Text style={[styles.storageLabel, { color: colors.textSecondary }]}>Room Storage</Text>
          <Text style={[styles.storageValue, { color: colors.text }]}>
            {fmtBytes(storageUsedBytes)} / {fmtBytes(storageLimit)}
          </Text>
        </View>
        <View style={[styles.storageBar, { backgroundColor: isLight ? '#E5E5E5' : '#1F2937' }]}>
          <View style={[styles.storageFill, { width: `${usedPct * 100}%`, backgroundColor: usedPct > 0.9 ? '#EF4444' : usedPct > 0.7 ? '#F59E0B' : '#8B5CF6' }]} />
        </View>
        {usedPct > 0.7 && (
          <Text style={[styles.storageWarn, { color: usedPct > 0.9 ? '#EF4444' : '#F59E0B' }]}>
            {usedPct > 0.9 ? 'Storage almost full' : 'Storage running low'}
          </Text>
        )}
      </View>

      {/* ── File List ── */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {files.length === 0 && !uploading ? (
          <View style={styles.empty}>
            <Paperclip size={40} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.textTertiary }]}>No files uploaded</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              Tap "Upload File" to add images, documents, and more.{'\n'}5 GB total storage per room.
            </Text>
          </View>
        ) : (
          files.map(file => {
            const meta = FILE_TYPE_ICONS[file.type] || FILE_TYPE_ICONS.other;
            const Icon = meta.icon;
            const showPreview = isImageFile(file) && file.url && file.url.length > 0;
            return (
              <TouchableOpacity
                key={file.id}
                style={[styles.fileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => openFile(file)}
                activeOpacity={0.7}
              >
                {/* Thumbnail / Icon */}
                {showPreview ? (
                  <Image
                    source={{ uri: file.url }}
                    style={styles.fileThumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.fileIcon, { backgroundColor: meta.color + '20' }]}>
                    <Icon size={22} color={meta.color} />
                  </View>
                )}
                <View style={styles.fileInfo}>
                  <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>{file.name}</Text>
                  <View style={styles.fileMeta}>
                    <Text style={[styles.fileTypeLabel, { color: meta.color }]}>{meta.label}</Text>
                    {file.sizeBytes > 0 && (
                      <Text style={[styles.fileSize, { color: colors.textTertiary }]}> · {fmtBytes(file.sizeBytes)}</Text>
                    )}
                  </View>
                  <Text style={[styles.fileDate, { color: colors.textTertiary }]} numberOfLines={1}>
                    {new Date(file.uploadedAt).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity style={styles.fileDelete} onPress={() => handleDelete(file)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Trash2 size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ── Full-Screen Image Viewer Modal ── */}
      <Modal
        visible={viewerFile !== null}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={closeViewer}
      >
        {viewerFile && (
          <SafeAreaView style={[styles.viewerRoot, { backgroundColor: '#000' }]}>
            <StatusBar barStyle="light-content" />
            {/* Header */}
            <View style={styles.viewerHeader}>
              <TouchableOpacity onPress={closeViewer} style={styles.viewerClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <X size={24} color="#FFF" />
              </TouchableOpacity>
              <View style={styles.viewerTitleBox}>
                <Text style={styles.viewerTitle} numberOfLines={1}>{viewerFile.name}</Text>
                <Text style={styles.viewerSub}>
                  {FILE_TYPE_ICONS[viewerFile.type]?.label || 'File'}
                  {viewerFile.sizeBytes > 0 ? ` · ${fmtBytes(viewerFile.sizeBytes)}` : ''}
                </Text>
              </View>
              <View style={{ width: 40 }} />
            </View>
            {/* Image Content */}
            <ScrollView
              style={styles.viewerScroll}
              contentContainerStyle={styles.viewerScrollContent}
              maximumZoomScale={5}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              bouncesZoom
            >
              {viewerImageLoadError ? (
                <View style={styles.viewerError}>
                  <ImageIcon size={48} color="#666" />
                  <Text style={styles.viewerErrorText}>Unable to load preview</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: viewerFile.url }}
                  style={styles.viewerImage}
                  resizeMode="contain"
                  onError={() => setViewerImageLoadError(true)}
                />
              )}
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, gap: 10 },
  // Upload button
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#8B5CF6', paddingVertical: 14, borderRadius: 14,
    shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  uploadBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  // Storage card
  storageCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  storageHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  storageLabel: { fontSize: 12, fontWeight: '600', flex: 1 },
  storageValue: { fontSize: 12, fontWeight: '700' },
  storageBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  storageFill: { height: 6, borderRadius: 3 },
  storageWarn: { fontSize: 10, fontWeight: '600' },
  // File list
  list: { flex: 1 },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySub: { fontSize: 13, textAlign: 'center', paddingHorizontal: 30, lineHeight: 20 },
  fileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1,
  },
  fileThumb: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: '#E5E5E5',
  },
  fileIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  fileInfo: { flex: 1, gap: 3 },
  fileName: { fontSize: 14, fontWeight: '600' },
  fileMeta: { flexDirection: 'row', alignItems: 'center' },
  fileTypeLabel: { fontSize: 11, fontWeight: '600' },
  fileSize: { fontSize: 11, fontWeight: '500' },
  fileDate: { fontSize: 11, fontWeight: '500' },
  fileDelete: { padding: 8 },
  // Image viewer modal
  viewerRoot: { flex: 1 },
  viewerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  viewerClose: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  viewerTitleBox: { flex: 1, alignItems: 'center', paddingHorizontal: 12 },
  viewerTitle: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  viewerSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '500', marginTop: 2 },
  viewerScroll: { flex: 1 },
  viewerScrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: SCREEN_W, height: SCREEN_W },
  viewerError: { alignItems: 'center', gap: 12 },
  viewerErrorText: { color: '#999', fontSize: 14, fontWeight: '500' },
});
