/**
 * VideoTrimmer — Instagram-style "trim & crop" for a video before posting.
 *
 *  • Plays the video; tap it to pause / play, speaker button for sound.
 *  • Drag the two handles on the timeline to choose the part to post
 *    (up to 60 seconds). Playback loops inside the chosen part.
 *  • Fill / Fit: fill the screen (edges cropped) or show the whole frame.
 *
 * Nothing is re-encoded: the choice travels with the video (lib/videoClip)
 * and every player in the app plays just that part, framed that way.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEventListener } from 'expo';
import { Maximize2, Minimize2, Pause, Play, Volume2, VolumeX } from 'lucide-react-native';
import { fmtSecs, parseClip, type VideoClip } from '@/lib/videoClip';

const MAX_SECS = 60;
const MIN_SECS = 1;
const HANDLE_W = 18;

export default function VideoTrimmer({ visible, uri, initial, onCancel, onDone }: {
  visible: boolean;
  uri: string;
  initial?: VideoClip;
  onCancel: () => void;
  onDone: (clip: VideoClip) => void;
}) {
  const insets = useSafeAreaInsets();
  const src = parseClip(uri).src || uri;
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(initial?.start || 0);
  const [end, setEnd] = useState(initial?.end || 0);
  const [fit, setFit] = useState<'cover' | 'contain'>(initial?.fit || 'cover');
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [pos, setPos] = useState(0);
  const [barW, setBarW] = useState(0);

  const player = useVideoPlayer(visible ? src : null, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.1;
    p.play();
  });

  // Duration arrives once the file is loaded.
  useEffect(() => {
    if (!visible) return;
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      const d = player?.duration || 0;
      if (d > 0 || tries > 50) {
        clearInterval(t);
        if (d > 0) {
          setDuration(d);
          setEnd((e) => (e > 0 && e <= d ? e : Math.min(d, (initial?.start || 0) + MAX_SECS)));
          if (initial?.start) { try { player.currentTime = initial.start; } catch {} }
        }
      }
    }, 100);
    return () => clearInterval(t);
  }, [visible, player]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try { player.muted = muted; } catch {}
  }, [player, muted]);

  // Loop inside the chosen part.
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    setPos(currentTime);
    if (end > 0 && currentTime >= end) {
      try { player.currentTime = start; } catch {}
    }
  });
  useEventListener(player, 'playToEnd', () => {
    try { player.currentTime = start; if (playing) player.play(); } catch {}
  });

  const togglePlay = () => {
    try {
      if (playing) player.pause();
      else { if (pos >= end - 0.05) player.currentTime = start; player.play(); }
    } catch {}
    setPlaying(!playing);
  };

  // ── Timeline handles ──
  const track = Math.max(1, barW - HANDLE_W * 2);
  const toX = (secs: number) => (duration > 0 ? (secs / duration) * track : 0);
  const toSecs = (x: number) => (duration > 0 ? Math.max(0, Math.min(duration, (x / track) * duration)) : 0);

  const state = useRef({ start, end, duration, track });
  state.current = { start, end, duration, track };
  const grabStart = useRef(0);

  const seek = (secs: number) => { try { player.currentTime = secs; } catch {} };

  const startPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { grabStart.current = state.current.start; try { player.pause(); } catch {} },
    onPanResponderMove: (_, g) => {
      const { end: e, duration: d, track: tr } = state.current;
      if (d <= 0) return;
      let s = grabStart.current + (g.dx / tr) * d;
      s = Math.max(0, Math.min(s, e - MIN_SECS));
      s = Math.max(s, e - MAX_SECS);
      setStart(s);
      seek(s);
    },
    onPanResponderRelease: () => { seek(state.current.start); try { player.play(); } catch {} setPlaying(true); },
  }), [player]);

  const endPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { grabStart.current = state.current.end; try { player.pause(); } catch {} },
    onPanResponderMove: (_, g) => {
      const { start: s, duration: d, track: tr } = state.current;
      if (d <= 0) return;
      let e = grabStart.current + (g.dx / tr) * d;
      e = Math.min(d, Math.max(e, s + MIN_SECS));
      e = Math.min(e, s + MAX_SECS);
      setEnd(e);
      seek(Math.max(s, e - 1.5));
    },
    onPanResponderRelease: () => { seek(state.current.start); try { player.play(); } catch {} setPlaying(true); },
  }), [player]);

  const onBar = (e: LayoutChangeEvent) => setBarW(e.nativeEvent.layout.width);
  const length = Math.max(0, end - start);
  const tooLong = duration > 0 && length > MAX_SECS + 0.05;

  const done = () => {
    const d = duration;
    const clip: VideoClip = { fit };
    if (start > 0.2) clip.start = start;
    if (end > 0 && d > 0 && end < d - 0.2) clip.end = end;
    onDone(clip);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onCancel}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} hitSlop={10}><Text style={styles.headerBtn}>Cancel</Text></TouchableOpacity>
          <Text style={styles.title}>Trim & crop</Text>
          <TouchableOpacity onPress={done} disabled={duration <= 0 || tooLong} hitSlop={10}>
            <Text style={[styles.headerBtn, styles.doneBtn, (duration <= 0 || tooLong) && { opacity: 0.4 }]}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Preview — tap to play / pause */}
        <Pressable style={styles.stage} onPress={togglePlay} accessibilityLabel={playing ? 'Pause' : 'Play'}>
          <View style={styles.frame}>
            {visible ? <VideoView player={player} style={StyleSheet.absoluteFill} contentFit={fit} nativeControls={false} /> : null}
          </View>
          {!playing && (
            <View style={styles.playBadge} pointerEvents="none"><Play size={34} color="#FFF" fill="#FFF" /></View>
          )}
        </Pressable>

        {/* Fit / sound */}
        <View style={styles.toolRow}>
          <TouchableOpacity style={styles.tool} onPress={() => setFit(fit === 'cover' ? 'contain' : 'cover')}>
            {fit === 'cover' ? <Minimize2 size={16} color="#FFF" /> : <Maximize2 size={16} color="#FFF" />}
            <Text style={styles.toolText}>{fit === 'cover' ? 'Fill screen' : 'Fit whole video'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tool} onPress={togglePlay}>
            {playing ? <Pause size={16} color="#FFF" /> : <Play size={16} color="#FFF" />}
            <Text style={styles.toolText}>{playing ? 'Pause' : 'Play'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tool} onPress={() => setMuted(!muted)}>
            {muted ? <VolumeX size={16} color="#FFF" /> : <Volume2 size={16} color="#FFF" />}
            <Text style={styles.toolText}>{muted ? 'Sound off' : 'Sound on'}</Text>
          </TouchableOpacity>
        </View>

        {/* Timeline */}
        <View style={[styles.timelineWrap, { paddingBottom: insets.bottom + 18 }]}>
          <View style={styles.timesRow}>
            <Text style={styles.time}>{fmtSecs(start)}</Text>
            <Text style={[styles.time, styles.length]}>{duration > 0 ? `${fmtSecs(length)} selected` : 'Loading…'}</Text>
            <Text style={styles.time}>{fmtSecs(end)}</Text>
          </View>
          <View style={styles.bar} onLayout={onBar}>
            <View style={styles.barTrack} />
            {duration > 0 && barW > 0 && (
              <>
                {/* chosen part */}
                <View style={[styles.selected, { left: HANDLE_W + toX(start), width: Math.max(2, toX(end) - toX(start)) }]} />
                {/* playhead */}
                <View style={[styles.playhead, { left: HANDLE_W + toX(Math.min(Math.max(pos, start), end)) - 1 }]} />
                <View {...startPan.panHandlers} hitSlop={{ top: 14, bottom: 14, left: 14, right: 6 }}
                  style={[styles.handle, { left: toX(start) }]} accessibilityLabel="Trim start">
                  <View style={styles.grip} />
                </View>
                <View {...endPan.panHandlers} hitSlop={{ top: 14, bottom: 14, left: 6, right: 14 }}
                  style={[styles.handle, { left: HANDLE_W + toX(end) }]} accessibilityLabel="Trim end">
                  <View style={styles.grip} />
                </View>
              </>
            )}
          </View>
          <Text style={styles.hint}>
            {tooLong ? `Videos can be up to ${MAX_SECS} seconds — drag the handles to shorten it.` : 'Drag the white handles to choose the part to post.'}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerBtn: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  doneBtn: { color: '#3B82F6', fontWeight: '800' },
  title: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '86%', aspectRatio: 9 / 16, maxHeight: '100%', backgroundColor: '#111', borderRadius: 14, overflow: 'hidden' },
  playBadge: { position: 'absolute', width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  toolRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 12 },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  toolText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  timelineWrap: { paddingHorizontal: 18 },
  timesRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  time: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  length: { color: '#FFF', fontWeight: '800' },
  bar: { height: 52, justifyContent: 'center' },
  barTrack: { position: 'absolute', left: HANDLE_W, right: HANDLE_W, height: 44, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.15)' },
  selected: { position: 'absolute', height: 44, backgroundColor: 'rgba(255,255,255,0.28)', borderTopWidth: 3, borderBottomWidth: 3, borderColor: '#FFF' },
  playhead: { position: 'absolute', width: 2, height: 52, backgroundColor: '#FACC15', borderRadius: 1 },
  handle: { position: 'absolute', width: HANDLE_W, height: 50, borderRadius: 6, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  grip: { width: 3, height: 18, borderRadius: 2, backgroundColor: '#111' },
  hint: { color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center', marginTop: 10 },
});
