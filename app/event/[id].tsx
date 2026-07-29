// app/event/[id].tsx — Event Detail Page
// Full-featured event page with hero, info, ticket booking

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image as RNImage,
  StatusBar,
  Dimensions,
  Platform,
  Share,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  X, Calendar, MapPin, Clock, Tag, Share2,
  Ticket, ChevronLeft, Heart, Info,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { EXTERNAL_EVENTS, ExternalEvent } from '@/lib/externalEvents';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 360;

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [event, setEvent] = useState<ExternalEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const { data, error } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('id', id)
          .single();
        if (data && !error) {
          setEvent(data);
          setLoading(false);
          return;
        }
      } catch {}
      // Fallback to EXTERNAL_EVENTS hardcoded data
      const fallback = EXTERNAL_EVENTS.find((e) => e.id === id) || null;
      setEvent(fallback);
      setLoading(false);
    };
    fetchEvent();
  }, [id]);

  const [ticketCount, setTicketCount] = useState(1);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `${event?.title} — ${event?.date} at ${event?.venue}\n${event?.price}\n\n${event?.description}`,
        url: event?.image,
      });
    } catch {}
  }, [event]);

  const handleBuyTickets = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (event?.ticketUrl) {
      Linking.openURL(event.ticketUrl).catch(() => {
        Alert.alert('Browser Error', 'Could not open the ticket page. Please try again.');
      });
    } else {
      Alert.alert(
        'Get Tickets',
        `${ticketCount} × ${event?.title}\nTotal: ${event?.price === 'FREE' ? 'FREE' : `$${(parseFloat(event?.price?.replace('$', '') || '0') * ticketCount).toFixed(2)}`}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm Booking',
            onPress: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Booked! 🎉', `You're going to ${event?.title}!\nCheck your email for details.`);
            },
          },
        ],
      );
    }
  }, [event, ticketCount]);

  if (!event) {
    return (
      <View style={[styles.container, { backgroundColor: '#000' }]}>
        <StatusBar barStyle="light-content" />
        <View style={[styles.notFound, { paddingTop: insets.top }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ChevronLeft size={26} color="#FFF" />
          </TouchableOpacity>
          <Info size={48} color="#666" />
          <Text style={styles.notFoundText}>Event not found</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => router.back()}>
            <Text style={styles.browseBtnText}>Browse Events</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const numericPrice = event.price !== 'FREE' ? parseFloat(event.price.replace('$', '')) || 0 : 0;
  const totalPrice = numericPrice * ticketCount;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Hero Image ── */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.heroContainer}>
          <RNImage source={{ uri: event.image }} style={styles.heroImage} resizeMode="cover" />
          {/* Gradient overlay */}
          <View style={styles.heroOverlay}>
            <View style={[styles.heroGradient, { paddingTop: insets.top + 12 }]}>
              {/* Top nav */}
              <View style={styles.heroNav}>
                <TouchableOpacity style={styles.heroNavBtn} onPress={() => router.back()}>
                  <ChevronLeft size={26} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.heroNavRight}>
                  <TouchableOpacity style={styles.heroNavBtn} onPress={handleShare}>
                    <Share2 size={20} color="#FFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.heroNavBtn}
                    onPress={() => {
                      setIsBookmarked(!isBookmarked);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Heart size={20} color={isBookmarked ? '#EF4444' : '#FFF'} fill={isBookmarked ? '#EF4444' : 'none'} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Hero content — at bottom of hero */}
              <View style={styles.heroContent}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{event.category}</Text>
                </View>
                <Text style={styles.heroTitle}>{event.title}</Text>
                <Text style={styles.heroVenue}>{event.venue}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Info Section ── */}
        <View style={[styles.infoSection, { backgroundColor: '#0d0d0d' }]}>
          {/* Quick info pills */}
          <View style={styles.quickInfo}>
            <View style={styles.quickInfoPill}>
              <Calendar size={16} color="#FF6B35" />
              <View>
                <Text style={styles.quickInfoLabel}>Date</Text>
                <Text style={styles.quickInfoValue}>{event.date}</Text>
              </View>
            </View>
            {event.time && (
              <View style={styles.quickInfoPill}>
                <Clock size={16} color="#FF6B35" />
                <View>
                  <Text style={styles.quickInfoLabel}>Time</Text>
                  <Text style={styles.quickInfoValue}>{event.time}</Text>
                </View>
              </View>
            )}
            <View style={styles.quickInfoPill}>
              <MapPin size={16} color="#FF6B35" />
              <View>
                <Text style={styles.quickInfoLabel}>Location</Text>
                <Text style={styles.quickInfoValue} numberOfLines={1}>{event.venue}</Text>
              </View>
            </View>
            <View style={styles.quickInfoPill}>
              <Ticket size={16} color="#FF6B35" />
              <View>
                <Text style={styles.quickInfoLabel}>Price</Text>
                <Text style={[styles.quickInfoValue, event.is_free && { color: '#10B981' }]}>
                  {event.is_free ? 'FREE' : event.price}
                </Text>
              </View>
            </View>
          </View>

          {/* ── About ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About This Event</Text>
            <Text style={styles.description} numberOfLines={showMore ? undefined : 4}>
              {event.description}
            </Text>
            {event.description && event.description.length > 200 && (
              <TouchableOpacity onPress={() => setShowMore(!showMore)}>
                <Text style={styles.showMoreText}>{showMore ? 'Show less' : 'Read more'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Organizer ── */}
          {event.organizer && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Organizer</Text>
              <View style={styles.organizerRow}>
                <View style={styles.organizerAvatar}>
                  <Text style={styles.organizerAvatarText}>
                    {event.organizer.charAt(0)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.organizerName}>{event.organizer}</Text>
                  <Text style={styles.organizerSub}>Event Organizer</Text>
                </View>
                <TouchableOpacity style={styles.followBtn}>
                  <Text style={styles.followBtnText}>Follow</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Tags ── */}
          {event.tags && event.tags.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tags</Text>
              <View style={styles.tagRow}>
                {event.tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Tag size={12} color="#FF6B35" />
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={{ height: 160 }} />
        </View>
      </ScrollView>

      {/* ── Sticky Bottom Bar — Ticket booking ── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        {!event.is_free && (
          <View style={styles.ticketPicker}>
            <TouchableOpacity
              style={styles.ticketPickerBtn}
              onPress={() => setTicketCount(Math.max(1, ticketCount - 1))}
            >
              <Text style={styles.ticketPickerBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.ticketCount}>{ticketCount}</Text>
            <TouchableOpacity
              style={styles.ticketPickerBtn}
              onPress={() => setTicketCount(ticketCount + 1)}
            >
              <Text style={styles.ticketPickerBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity
          style={[styles.buyBtn, event.is_free && styles.buyBtnFree]}
          onPress={handleBuyTickets}
        >
          <Ticket size={20} color="#FFF" />
          <Text style={styles.buyBtnText}>
            {event.is_free
              ? 'RSVP — Free'
              : `Get Tickets — $${totalPrice.toFixed(2)}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ──
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { flex: 1 },

  // ── Hero ──
  heroContainer: { width: SCREEN_WIDTH, height: HERO_HEIGHT, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroGradient: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  heroNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroNavRight: { flexDirection: 'row', gap: 8 },

  heroContent: { gap: 8 },
  categoryBadge: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  categoryBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  heroTitle: { color: '#FFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.5, lineHeight: 32 },
  heroVenue: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '500' },

  // ── Info section ──
  infoSection: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    paddingTop: 24,
    paddingHorizontal: 20,
    minHeight: 600,
  },

  // ── Quick info pills ──
  quickInfo: { gap: 10, marginBottom: 20 },
  quickInfoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  quickInfoLabel: { color: '#888', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  quickInfoValue: { color: '#FFF', fontSize: 14, fontWeight: '600', marginTop: 1 },

  // ── Sections ──
  section: { marginTop: 24 },
  sectionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  description: {
    color: '#BBB',
    fontSize: 15,
    lineHeight: 24,
  },
  showMoreText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },

  // ── Organizer ──
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1a1a1a',
    padding: 14,
    borderRadius: 14,
  },
  organizerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  organizerAvatarText: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  organizerName: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  organizerSub: { color: '#888', fontSize: 12, marginTop: 1 },
  followBtn: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  followBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  // ── Tags ──
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tagText: { color: '#CCC', fontSize: 13, fontWeight: '500' },

  // ── Not found ──
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  notFoundText: { color: '#666', fontSize: 17, fontWeight: '600' },
  browseBtn: { backgroundColor: '#FF6B35', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
  browseBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 32,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Bottom bar ──
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0d0d0d',
    borderTopWidth: 1,
    borderTopColor: '#222',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  ticketPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    paddingHorizontal: 4,
  },
  ticketPickerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketPickerBtnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  ticketCount: { color: '#FFF', fontSize: 17, fontWeight: '700', width: 32, textAlign: 'center' },
  buyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF6B35',
    paddingVertical: 14,
    borderRadius: 14,
  },
  buyBtnFree: { backgroundColor: '#10B981' },
  buyBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
