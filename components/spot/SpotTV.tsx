/**
 * SpotTV — a little TV in a Spot room playing a YouTube video for everyone.
 *
 * The video's state (playing or paused, and where) lives on the room item
 * (SpotItem.video) and is shared live. Anyone can press play / pause / jump
 * back or forward; every phone then seeks to the same spot and plays or
 * pauses, so the whole room watches together.
 *
 * Phones show the YouTube player in a WebView; the web app uses an iframe.
 * YouTube's own buttons are hidden so everyone uses the shared controls.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from 'lucide-react-native';
import { spotVideoPosition, type SpotVideo } from '@/lib/spot';

const ORIGIN = 'https://apparentlyappdashboard.nationalcompliancehub.com';
/** Re-sync if a phone drifts more than this many seconds from the room. */
const DRIFT = 2.5;

let WebView: any = null;
if (Platform.OS !== 'web') {
  try { WebView = require('react-native-webview').WebView; } catch { WebView = null; }
}

function playerHtml(videoId: string) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#p{position:absolute;inset:0;width:100%;height:100%}</style></head>
<body><div id="p"></div>
<script src="https://www.youtube.com/iframe_api"></script>
<script>
var player,ready=false,queue=[];
function post(m){try{window.ReactNativeWebView.postMessage(JSON.stringify(m))}catch(e){}}
function onYouTubeIframeAPIReady(){
  player=new YT.Player('p',{videoId:'${videoId}',playerVars:{playsinline:1,controls:0,rel:0,modestbranding:1,disablekb:1,fs:0,origin:'${ORIGIN}'},
    events:{onReady:function(){ready=true;post({t:'ready'});queue.forEach(function(f){f()});queue=[];},
            onStateChange:function(e){post({t:'state',s:e.data,time:player.getCurrentTime()})},
            onError:function(e){post({t:'error',code:e.data})}}});
}
window.cmd=function(name,a){var f=function(){try{
  if(name==='sync'){var d=Math.abs(player.getCurrentTime()-a.pos);if(d>${DRIFT}||a.force)player.seekTo(a.pos,true);a.playing?player.playVideo():player.pauseVideo();}
  else if(name==='mute'){a?player.mute():player.unMute();}
  else if(name==='time'){post({t:'time',time:player.getCurrentTime()})}
}catch(e){}};ready?f():queue.push(f)};
setInterval(function(){if(ready)post({t:'time',time:player.getCurrentTime()})},2000);
</script></body></html>`;
}

export default function SpotTV({ video, width, height, myId, onChange }: {
  video: SpotVideo;
  width: number;
  height: number;
  myId: string;
  onChange: (next: SpotVideo) => void;
}) {
  const webRef = useRef<any>(null);
  const frameRef = useRef<any>(null);
  const [muted, setMuted] = useState(Platform.OS === 'web'); // browsers only autoplay muted
  const [failed, setFailed] = useState<string | null>(null);
  const lastTime = useRef(0);
  const webReady = useRef(false);
  const videoRef = useRef(video);
  videoRef.current = video;

  // Web: the YouTube iframe tells us when it's ready and where it is.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onMsg = (e: MessageEvent) => {
      if (!String(e.origin).includes('youtube')) return;
      if (frameRef.current && e.source !== frameRef.current.contentWindow) return;
      let d: any;
      try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
      if (d?.event === 'onReady' || (d?.event === 'initialDelivery' && !webReady.current)) {
        webReady.current = true;
        const v = videoRef.current;
        setTimeout(() => send('sync', { pos: spotVideoPosition(v), playing: v.playing, force: true }), 100);
      }
      const t = d?.info?.currentTime;
      if (typeof t === 'number') lastTime.current = t;
      if (d?.event === 'onError') setFailed('This video can’t be played here.');
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const html = useMemo(() => playerHtml(video.id), [video.id]);

  // ── Send a command to the player ─────────────────────────────────────────
  const send = (name: string, arg?: any) => {
    if (Platform.OS === 'web') {
      const win = frameRef.current?.contentWindow;
      if (!win) return;
      const call = (func: string, args: any[] = []) => win.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
      if (name === 'sync') {
        // Only jump when it's actually out of step (the player reports its time).
        if (arg.force || webReady.current === false || Math.abs(lastTime.current - arg.pos) > DRIFT) call('seekTo', [arg.pos, true]);
        call(arg.playing ? 'playVideo' : 'pauseVideo');
      } else if (name === 'mute') call(arg ? 'mute' : 'unMute');
      return;
    }
    webRef.current?.injectJavaScript(`window.cmd && window.cmd(${JSON.stringify(name)}, ${JSON.stringify(arg ?? null)}); true;`);
  };

  // Follow the room: whenever the shared state changes, jump there.
  const sync = (force = false) => send('sync', { pos: spotVideoPosition(video), playing: video.playing, force });
  useEffect(() => { sync(true); }, [video.playing, video.pos, video.at]); // eslint-disable-line react-hooks/exhaustive-deps
  // Keep drifting phones in step while it plays.
  useEffect(() => {
    if (!video.playing) return;
    const t = setInterval(() => sync(false), 8000);
    return () => clearInterval(t);
  }, [video.playing, video.pos, video.at]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shared controls ──────────────────────────────────────────────────────
  const now = () => spotVideoPosition(video);
  const share = (patch: Partial<SpotVideo>) => onChange({ ...video, pos: now(), at: Date.now(), by: myId, ...patch });
  const togglePlay = () => share({ playing: !video.playing });
  const jump = (sec: number) => share({ pos: Math.max(0, now() + sec) });
  const toggleMute = () => { const m = !muted; setMuted(m); send('mute', m); };

  const onMessage = (e: any) => {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (m.t === 'ready') { send('mute', muted); sync(true); }
      if (m.t === 'time') lastTime.current = m.time;
      if (m.t === 'error') setFailed(m.code === 101 || m.code === 150 ? 'This video can’t be played outside YouTube.' : 'This video couldn’t be played.');
    } catch { /* ignore */ }
  };

  const playerH = height - CONTROLS_H;
  const webSrc = `https://www.youtube.com/embed/${video.id}?enablejsapi=1&playsinline=1&controls=0&rel=0&modestbranding=1&mute=1&origin=${encodeURIComponent(typeof window !== 'undefined' && (window as any).location ? (window as any).location.origin : ORIGIN)}`;

  return (
    <View style={[styles.tv, { width, height }]}>
      <View style={{ width: '100%', height: playerH, backgroundColor: '#000' }} pointerEvents="none">
        {failed ? (
          <View style={styles.fail}><Text style={styles.failText}>{failed}</Text></View>
        ) : Platform.OS === 'web' ? (
          React.createElement('iframe', {
            ref: frameRef,
            src: webSrc,
            style: { width: '100%', height: '100%', border: 0 },
            allow: 'autoplay; encrypted-media; picture-in-picture',
            onLoad: () => {
              // Ask the player to report its state (and when it's ready).
              const win = frameRef.current?.contentWindow;
              const listen = () => win?.postMessage(JSON.stringify({ event: 'listening', id: video.id, channel: 'widget' }), '*');
              listen();
              setTimeout(listen, 800);
              setTimeout(() => { if (!webReady.current) { webReady.current = true; sync(true); } }, 2500);
            },
            title: 'Shared video',
          })
        ) : WebView ? (
          <WebView
            ref={webRef}
            source={{ html, baseUrl: ORIGIN }}
            originWhitelist={['*']}
            onMessage={onMessage}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            scrollEnabled={false}
            style={{ backgroundColor: '#000' }}
          />
        ) : (
          <View style={styles.fail}><Text style={styles.failText}>Update the app to watch videos here.</Text></View>
        )}
      </View>
      <View style={styles.controls}>
        <TouchableOpacity onPress={() => jump(-10)} style={styles.ctl} accessibilityLabel="Back 10 seconds for everyone"><RotateCcw size={16} color="#FFF" /></TouchableOpacity>
        <TouchableOpacity onPress={togglePlay} style={[styles.ctl, styles.play]} accessibilityLabel={video.playing ? 'Pause for everyone' : 'Play for everyone'}>
          {video.playing ? <Pause size={18} color="#111" fill="#111" /> : <Play size={18} color="#111" fill="#111" />}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => jump(10)} style={styles.ctl} accessibilityLabel="Forward 10 seconds for everyone"><RotateCw size={16} color="#FFF" /></TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={toggleMute} style={styles.ctl} accessibilityLabel={muted ? 'Sound on' : 'Sound off'}>
          {muted ? <VolumeX size={16} color="#FFF" /> : <Volume2 size={16} color="#FFF" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const CONTROLS_H = 40;

const styles = StyleSheet.create({
  tv: {
    backgroundColor: '#111', borderRadius: 12, overflow: 'hidden', borderWidth: 3, borderColor: '#1F2937',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 8,
  },
  controls: { height: CONTROLS_H, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, backgroundColor: '#111' },
  ctl: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  play: { backgroundColor: '#FFF', width: 34, height: 34, borderRadius: 17 },
  fail: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
  failText: { color: '#FFF', fontSize: 12, textAlign: 'center' },
});
