import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Calendar,
  ChevronRight,
  ChevronLeft,
  Check,
  Home,
  Building2,
  Coffee,
  Car,
  CreditCard,
  Coins,
  Repeat,
  Users,
  Package,
  HelpCircle,
  Sparkles,
  Clock,
  MapPin,
  FileText,
  DollarSign,
  Briefcase,
  X,
  Phone,
  Mail,
  MessageSquare,
  Search,
  Settings,
  Zap,
  Plus,
  Trash2,
  Send,
  AlertCircle,
} from 'lucide-react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { usePlanner, type LocationType, type TransportType, type PaymentType, type HelpType, type ChauffeurDetails } from '@/contexts/PlannerContext';
import { supabase } from '@/lib/supabase';

const VA_TASKS = [
  { id: 'calls', label: 'Calls / Follow-ups', icon: Phone },
  { id: 'scheduling', label: 'Scheduling / Calendar', icon: Calendar },
  { id: 'content', label: 'Content Posting', icon: MessageSquare },
  { id: 'research', label: 'Research / Data Entry', icon: Search },
  { id: 'support', label: 'Customer Support', icon: Users },
  { id: 'admin', label: 'Admin / Email', icon: Mail },
  { id: 'other', label: 'Other', icon: Settings },
] as const;

const VA_TOOLS = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'google', label: 'Google Docs/Sheets', icon: FileText },
  { id: 'social', label: 'Instagram/Telegram', icon: MessageSquare },
  { id: 'crm', label: 'CRM', icon: Briefcase },
  { id: 'phone', label: 'Phone', icon: Phone },
] as const;

const HOUR_OPTIONS = ['1h', '2h', '4h', '8h', 'Custom'] as const;

interface AvailableJob {
  id: string;
  title: string;
  type: string;
  description: string;
  budget?: string;
  location?: string;
  user_id: string;
  created_at: string;
}

interface CustomBlock {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  notes: string;
  color: string;
}

const BLOCK_COLORS = [
  '#0EA5E9', '#8B5CF6', '#F59E0B', '#10B981', '#EC4899', '#6366F1',
] as const;

type Step = 'basics' | 'services' | 'details' | 'payment' | 'review';

interface PlanForm {
  date: string;
  locationType: LocationType;
  transport: TransportType;
  chauffeur: ChauffeurDetails;
  assistance: HelpType[];
  vaDetails: {
    tasks: string[];
    hours: number;
    customHours: string;
    tools: string[];
    notes: string;
    budget: string;
    deadline: string;
  };
  errandsDetails: {
    description: string;
    location: string;
  };
  deliveryDetails: {
    pickupAddress: string;
    dropoffAddress: string;
    items: string;
  };
  otherDetails: {
    description: string;
  };
  payment: PaymentType;
  selectedJobs: AvailableJob[];
  customBlocks: CustomBlock[];
}

const formatDate = (date: Date): string => date.toISOString().split('T')[0];

const getDateLabel = (dateStr: string): string => {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (dateStr === formatDate(today)) return 'Today';
  if (dateStr === formatDate(tomorrow)) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatTime = (time: string): string => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
};

export default function PlanDayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { refetch: refetchPlans } = usePlanner();

  const [currentStep, setCurrentStep] = useState<Step>('basics');
  const [isSaving, setIsSaving] = useState(false);
  const [activeServiceTab, setActiveServiceTab] = useState<HelpType | 'chauffeur' | 'jobs' | 'custom' | null>(null);
  const [availableJobs, setAvailableJobs] = useState<AvailableJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [newBlock, setNewBlock] = useState<Omit<CustomBlock, 'id'>>({
    title: '',
    startTime: '09:00',
    endTime: '10:00',
    notes: '',
    color: BLOCK_COLORS[0],
  });

  const toastAnim = useRef(new Animated.Value(0)).current;
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const [form, setForm] = useState<PlanForm>({
    date: formatDate(new Date()),
    locationType: 'home',
    transport: 'none',
    chauffeur: {
      pickupAddress: '',
      pickupZip: '',
      dropoffAddress: '',
      dropoffZip: '',
      pickupTime: '09:00',
      roundTrip: false,
      notes: '',
    },
    assistance: [],
    vaDetails: {
      tasks: [],
      hours: 2,
      customHours: '',
      tools: [],
      notes: '',
      budget: '',
      deadline: formatDate(new Date()),
    },
    errandsDetails: {
      description: '',
      location: '',
    },
    deliveryDetails: {
      pickupAddress: '',
      dropoffAddress: '',
      items: '',
    },
    otherDetails: {
      description: '',
    },
    payment: 'cash',
    selectedJobs: [],
    customBlocks: [],
  });

  const fetchAvailableJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[PlanDay] Fetching pending job_requests...');
      
      const { data, error } = await supabase
        .from('job_requests')
        .select('*')
        .eq('status', 'pending')
        .neq('user_id', user?.id || '')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('[PlanDay] Error fetching jobs:', error);
      } else {
        console.log('[PlanDay] Fetched pending gigs:', data?.length || 0);
        setAvailableJobs(data || []);
      }
    } catch (e) {
      console.error('[PlanDay] Fetch jobs error:', e);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailableJobs();

    // Realtime subscription for job_requests changes
    const channel = supabase
      .channel('job_requests_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_requests' },
        (payload) => {
          console.log('[PlanDay] Realtime job_requests change:', payload.eventType);
          fetchAvailableJobs();
        }
      )
      .subscribe((status) => {
        console.log('[PlanDay] Realtime subscription status:', status);
      });

    return () => {
      console.log('[PlanDay] Unsubscribing from job_requests channel');
      supabase.removeChannel(channel);
    };
  }, [fetchAvailableJobs]);

  const filteredJobs = useMemo(() => {
    if (!jobSearchQuery.trim()) return availableJobs;
    const q = jobSearchQuery.toLowerCase();
    return availableJobs.filter(job =>
      job.title?.toLowerCase().includes(q) ||
      job.type?.toLowerCase().includes(q) ||
      job.description?.toLowerCase().includes(q)
    );
  }, [availableJobs, jobSearchQuery]);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [showTimePicker, setShowTimePicker] = useState(false);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToastMessage(''));
  }, [toastAnim]);

  const haptic = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const toggleJobSelection = useCallback((job: AvailableJob) => {
    haptic();
    setForm(prev => {
      const isSelected = prev.selectedJobs.some(j => j.id === job.id);
      if (isSelected) {
        return { ...prev, selectedJobs: prev.selectedJobs.filter(j => j.id !== job.id) };
      }
      return { ...prev, selectedJobs: [...prev.selectedJobs, job] };
    });
  }, [haptic]);

  const addCustomBlock = useCallback(() => {
    if (!newBlock.title.trim()) {
      showToast('Please enter a block title', 'error');
      return;
    }
    haptic();
    const block: CustomBlock = {
      ...newBlock,
      id: Date.now().toString(),
    };
    setForm(prev => ({ ...prev, customBlocks: [...prev.customBlocks, block] }));
    setNewBlock({
      title: '',
      startTime: '09:00',
      endTime: '10:00',
      notes: '',
      color: BLOCK_COLORS[0],
    });
    setShowAddBlock(false);
    showToast('Block added!', 'success');
  }, [newBlock, haptic, showToast]);

  const removeCustomBlock = useCallback((blockId: string) => {
    haptic();
    setForm(prev => ({
      ...prev,
      customBlocks: prev.customBlocks.filter(b => b.id !== blockId),
    }));
  }, [haptic]);

  const steps = useMemo<Step[]>(() => {
    const hasServices = form.assistance.length > 0 || form.transport === 'chauffeur' || form.selectedJobs.length > 0 || form.customBlocks.length > 0;
    if (hasServices) {
      return ['basics', 'services', 'details', 'payment', 'review'];
    }
    return ['basics', 'services', 'payment', 'review'];
  }, [form.assistance, form.transport, form.selectedJobs, form.customBlocks]);

  const stepIndex = steps.indexOf(currentStep);
  const progress = (stepIndex + 1) / steps.length;

  const getStepTitle = (step: Step): string => {
    const titles: Record<Step, string> = {
      basics: 'Plan Your Day',
      services: 'Select Services',
      details: 'Service Details',
      payment: 'Payment',
      review: 'Review',
    };
    return titles[step];
  };

  const goNext = useCallback(() => {
    haptic();
    const idx = steps.indexOf(currentStep);
    if (idx < steps.length - 1) {
      const nextStep = steps[idx + 1];
      if (nextStep === 'details') {
        const services: (HelpType | 'chauffeur' | 'jobs' | 'custom')[] = [];
        if (form.transport === 'chauffeur') services.push('chauffeur');
        form.assistance.forEach(a => services.push(a));
        if (form.selectedJobs.length > 0) services.push('jobs');
        if (form.customBlocks.length > 0) services.push('custom');
        if (services.length > 0) {
          setActiveServiceTab(services[0]);
        }
      }
      setCurrentStep(nextStep);
    }
  }, [currentStep, haptic, steps, form]);

  const goBack = useCallback(() => {
    haptic();
    const idx = steps.indexOf(currentStep);
    if (idx > 0) {
      setCurrentStep(steps[idx - 1]);
    } else {
      router.back();
    }
  }, [currentStep, haptic, router, steps]);

  const toggleAssistance = useCallback((type: HelpType) => {
    haptic();
    setForm(prev => {
      const isSelected = prev.assistance.includes(type);
      const newAssistance = isSelected
        ? prev.assistance.filter(t => t !== type)
        : [...prev.assistance, type];
      return { ...prev, assistance: newAssistance };
    });
  }, [haptic]);

  const toggleVATask = useCallback((taskId: string) => {
    haptic();
    setForm(prev => ({
      ...prev,
      vaDetails: {
        ...prev.vaDetails,
        tasks: prev.vaDetails.tasks.includes(taskId)
          ? prev.vaDetails.tasks.filter(t => t !== taskId)
          : [...prev.vaDetails.tasks, taskId],
      },
    }));
  }, [haptic]);

  const toggleVATool = useCallback((toolId: string) => {
    haptic();
    setForm(prev => ({
      ...prev,
      vaDetails: {
        ...prev.vaDetails,
        tools: prev.vaDetails.tools.includes(toolId)
          ? prev.vaDetails.tools.filter(t => t !== toolId)
          : [...prev.vaDetails.tools, toolId],
      },
    }));
  }, [haptic]);

  const selectHours = useCallback((option: string) => {
    haptic();
    if (option === 'Custom') {
      setForm(prev => ({ ...prev, vaDetails: { ...prev.vaDetails, hours: 0 } }));
    } else {
      const hours = parseInt(option, 10);
      setForm(prev => ({ ...prev, vaDetails: { ...prev.vaDetails, hours, customHours: '' } }));
    }
  }, [haptic]);

  const handlePostGig = useCallback(async () => {
    if (isSaving) return;
    haptic();
    setIsSaving(true);

    console.log('[PlanDay] Starting Post Gig...');
    console.log('[PlanDay] Form data:', JSON.stringify(form, null, 2));

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('[PlanDay] User error:', userError);
        showToast('Please log in to post a gig', 'error');
        setIsSaving(false);
        return;
      }

      console.log('[PlanDay] User ID:', user.id);

      const planDetails = {
        location_type: form.locationType,
        transport: form.transport,
        chauffeur: form.transport === 'chauffeur' ? form.chauffeur : undefined,
        assistance: form.assistance,
        va_details: form.assistance.includes('va') ? {
          hours: form.vaDetails.hours || parseInt(form.vaDetails.customHours, 10) || 2,
          skills: form.vaDetails.tools,
          tasks: form.vaDetails.notes,
          budget: form.vaDetails.budget,
          deadline: form.vaDetails.deadline,
        } : undefined,
        payment: form.payment,
        selected_jobs: form.selectedJobs.map(j => j.id),
        custom_blocks: form.customBlocks,
      };

      const planPayload = {
        user_id: user.id,
        date: form.date,
        date_label: getDateLabel(form.date),
        location_type: form.locationType,
        transport: form.transport,
        pickup_zip: form.chauffeur.pickupZip || null,
        dropoff_zip: form.chauffeur.dropoffZip || null,
        status: 'pending',
      };

      console.log('[PlanDay] Creating plan first...');
      console.log('[PlanDay] Plan payload:', JSON.stringify(planPayload, null, 2));

      const { data: createdPlan, error: planError } = await supabase
        .from('plans')
        .insert(planPayload)
        .select()
        .single();

      if (planError || !createdPlan) {
        console.error('[PlanDay] Plan insert error:', planError?.message, planError);
        showToast('Failed to create plan: ' + (planError?.message || 'Unknown error'), 'error');
        setIsSaving(false);
        return;
      }

      const planId = createdPlan.id;
      console.log('[PlanDay] Plan created with ID:', planId);

      const jobRequests: any[] = [];

      if (form.transport === 'chauffeur') {
        const chauffeurJob = {
          user_id: user.id,
          plan_id: planId,
          type: 'chauffeur',
          status: 'pending',
          title: `Chauffeur - ${getDateLabel(form.date)}`,
          description: form.chauffeur.notes || 'Chauffeur service request',
          pickup_zip: form.chauffeur.pickupZip,
          pickup_location: form.chauffeur.pickupAddress,
          dropoff_zip: form.chauffeur.dropoffZip,
          dropoff_location: form.chauffeur.dropoffAddress,
          pickup_time: form.chauffeur.pickupTime,
          return_time: form.chauffeur.roundTrip ? form.chauffeur.pickupTime : null,
          payment_method: form.payment,
          notes: form.chauffeur.notes,
          tasks: {
            date: form.date,
            round_trip: form.chauffeur.roundTrip,
          },
        };
        console.log('[PlanDay] Chauffeur job:', JSON.stringify(chauffeurJob, null, 2));
        jobRequests.push(chauffeurJob);
      }

      if (form.assistance.includes('va')) {
        const actualHours = form.vaDetails.hours || parseInt(form.vaDetails.customHours, 10) || 2;
        const vaJob = {
          user_id: user.id,
          plan_id: planId,
          type: 'va',
          status: 'pending',
          title: `Virtual Assistant - ${actualHours}hrs`,
          description: form.vaDetails.notes || 'Virtual assistant request',
          hours: String(actualHours),
          payment_method: form.payment,
          tools: form.vaDetails.tools,
          notes: form.vaDetails.budget ? `Budget: ${form.vaDetails.budget}` : null,
          tasks: {
            date: form.date,
            task_types: form.vaDetails.tasks,
            deadline: form.vaDetails.deadline,
            budget: form.vaDetails.budget,
          },
        };
        console.log('[PlanDay] VA job:', JSON.stringify(vaJob, null, 2));
        jobRequests.push(vaJob);
      }

      if (form.assistance.includes('errands')) {
        const errandsJob = {
          user_id: user.id,
          plan_id: planId,
          type: 'errands',
          status: 'pending',
          title: `Errands - ${getDateLabel(form.date)}`,
          description: form.errandsDetails.description || 'Errands request',
          payment_method: form.payment,
          tasks: { 
            date: form.date,
            location: form.errandsDetails.location,
          },
        };
        console.log('[PlanDay] Errands job with plan_id:', planId);
        jobRequests.push(errandsJob);
      }

      if (form.assistance.includes('delivery')) {
        const deliveryJob = {
          user_id: user.id,
          plan_id: planId,
          type: 'driver',
          status: 'pending',
          title: `Delivery - ${getDateLabel(form.date)}`,
          description: form.deliveryDetails.items || 'Delivery request',
          pickup_location: form.deliveryDetails.pickupAddress,
          dropoff_location: form.deliveryDetails.dropoffAddress,
          payment_method: form.payment,
          tasks: { date: form.date },
        };
        console.log('[PlanDay] Delivery job with plan_id:', planId);
        jobRequests.push(deliveryJob);
      }

      if (form.assistance.includes('other')) {
        const otherJob = {
          user_id: user.id,
          plan_id: planId,
          type: 'other',
          status: 'pending',
          title: `Assistance - ${getDateLabel(form.date)}`,
          description: form.otherDetails.description || 'Custom request',
          payment_method: form.payment,
          tasks: { date: form.date },
        };
        console.log('[PlanDay] Other job with plan_id:', planId);
        jobRequests.push(otherJob);
      }

      if (jobRequests.length > 0) {
        console.log('[PlanDay] Inserting', jobRequests.length, 'job requests with plan_id:', planId);
        
        const { data: insertedJobs, error: insertError } = await supabase
          .from('job_requests')
          .insert(jobRequests)
          .select();

        if (insertError) {
          console.error('[PlanDay] Job insert error:', insertError.message, insertError);
          showToast('Failed to post jobs: ' + insertError.message, 'error');
          setIsSaving(false);
          return;
        }

        console.log('[PlanDay] Inserted jobs:', insertedJobs);
        insertedJobs?.forEach((job: any) => {
          console.log('[PlanDay] Job inserted - ID:', job.id, 'plan_id:', job.plan_id);
        });
      }

      console.log('[PlanDay] Plan ID:', planId, 'All job requests inserted with plan_id:', planId);

      refetchPlans();

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      showToast('Plan saved successfully!', 'success');
      console.log('[PlanDay] Success! Redirecting...');
      
      setTimeout(() => router.replace('/(tabs)/planner' as any), 500);
    } catch (e: any) {
      console.error('[PlanDay] Post gig error:', e);
      showToast('Error posting gig: ' + (e.message || 'Unknown error'), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [form, isSaving, haptic, router, showToast, refetchPlans]);

  const renderBasicsStep = () => {
    const isToday = form.date === formatDate(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = form.date === formatDate(tomorrow);

    const locations: { type: LocationType; icon: any; label: string }[] = [
      { type: 'home', icon: Home, label: 'Home' },
      { type: 'hotel', icon: Building2, label: 'Hotel / Airbnb' },
      { type: 'coffee', icon: Coffee, label: 'Coffee / Coworking' },
      { type: 'coworking', icon: MapPin, label: 'Custom Location' },
    ];

    return (
      <View style={styles.stepContent}>
        <View style={styles.sectionCard}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>WHEN</Text>
          <View style={styles.dateChipsRow}>
            <TouchableOpacity
              style={[styles.dateChip, isToday && { backgroundColor: colors.accent }]}
              onPress={() => {
                haptic();
                setForm(prev => ({ ...prev, date: formatDate(new Date()) }));
              }}
            >
              <Text style={[styles.dateChipText, { color: isToday ? '#FFF' : colors.text }]}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateChip, isTomorrow && { backgroundColor: colors.accent }]}
              onPress={() => {
                haptic();
                const d = new Date();
                d.setDate(d.getDate() + 1);
                setForm(prev => ({ ...prev, date: formatDate(d) }));
              }}
            >
              <Text style={[styles.dateChipText, { color: isTomorrow ? '#FFF' : colors.text }]}>Tomorrow</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateChip, !isToday && !isTomorrow && { backgroundColor: colors.accent }]}
              onPress={() => setShowDatePicker(!showDatePicker)}
            >
              <Calendar size={16} color={!isToday && !isTomorrow ? '#FFF' : colors.textSecondary} />
              <Text style={[styles.dateChipText, { color: !isToday && !isTomorrow ? '#FFF' : colors.text }]}>
                {!isToday && !isTomorrow ? getDateLabel(form.date) : 'Pick'}
              </Text>
            </TouchableOpacity>
          </View>
          {showDatePicker && renderCalendarPicker()}
        </View>

        <View style={styles.sectionCard}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>WHERE</Text>
          <View style={styles.locationGrid}>
            {locations.map(({ type, icon: Icon, label }) => {
              const isSelected = form.locationType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.locationCard,
                    { backgroundColor: colors.surface, borderColor: isSelected ? colors.accent : colors.border },
                    isSelected && { borderWidth: 2 },
                  ]}
                  onPress={() => {
                    haptic();
                    setForm(prev => ({ ...prev, locationType: type }));
                  }}
                >
                  <View style={[styles.locationIconWrap, { backgroundColor: isSelected ? colors.accent + '20' : colors.background }]}>
                    <Icon size={22} color={isSelected ? colors.accent : colors.textSecondary} />
                  </View>
                  <Text style={[styles.locationLabel, { color: colors.text }]}>{label}</Text>
                  {isSelected && (
                    <View style={[styles.selectedBadge, { backgroundColor: colors.accent }]}>
                      <Check size={12} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const renderCalendarPicker = () => (
    <View style={[styles.calendarPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity
          onPress={() => {
            haptic();
            if (pickerMonth === 0) {
              setPickerMonth(11);
              setPickerYear(pickerYear - 1);
            } else {
              setPickerMonth(pickerMonth - 1);
            }
          }}
        >
          <ChevronLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.calendarTitle, { color: colors.text }]}>
          {new Date(pickerYear, pickerMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
        <TouchableOpacity
          onPress={() => {
            haptic();
            if (pickerMonth === 11) {
              setPickerMonth(0);
              setPickerYear(pickerYear + 1);
            } else {
              setPickerMonth(pickerMonth + 1);
            }
          }}
        >
          <ChevronRight size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.weekdays}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Text key={i} style={[styles.weekday, { color: colors.textTertiary }]}>{d}</Text>
        ))}
      </View>
      <View style={styles.daysGrid}>
        {(() => {
          const firstDay = new Date(pickerYear, pickerMonth, 1).getDay();
          const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
          const todayStr = formatDate(new Date());
          const cells = [];

          for (let i = 0; i < firstDay; i++) {
            cells.push(<View key={`e-${i}`} style={styles.dayCell} />);
          }

          for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${pickerYear}-${String(pickerMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSelected = form.date === dateStr;
            const isPast = new Date(dateStr) < new Date(todayStr);

            cells.push(
              <TouchableOpacity
                key={day}
                style={[styles.dayCell, isSelected && { backgroundColor: colors.accent, borderRadius: 8 }]}
                onPress={() => {
                  if (!isPast) {
                    haptic();
                    setForm(prev => ({ ...prev, date: dateStr }));
                    setShowDatePicker(false);
                  }
                }}
                disabled={isPast}
              >
                <Text style={[
                  styles.dayText,
                  { color: isPast ? colors.textTertiary : colors.text },
                  isSelected && { color: '#FFF', fontWeight: '700' as const },
                ]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          }
          return cells;
        })()}
      </View>
    </View>
  );

  const renderServicesStep = () => {
    const transportOptions = [
      { type: 'none' as const, label: 'No Transport', sub: "I'm all set", icon: X },
      { type: 'chauffeur' as const, label: 'Chauffeur', sub: 'One-way pickup', icon: Car },
      { type: 'round_trip' as const, label: 'Round Trip', sub: 'Pickup & return', icon: Repeat },
    ];

    const assistanceOptions: { type: HelpType; icon: any; label: string; sub: string; color: string }[] = [
      { type: 'va', icon: Users, label: 'Virtual Assistant', sub: 'Admin, calls, scheduling', color: '#8B5CF6' },
      { type: 'errands', icon: Package, label: 'Errands', sub: 'Shopping, pickups, tasks', color: '#F59E0B' },
      { type: 'delivery', icon: Car, label: 'Delivery', sub: 'Drop-off packages', color: '#EC4899' },
      { type: 'other', icon: HelpCircle, label: 'Other', sub: 'Custom request', color: '#6B7280' },
    ];

    return (
      <View style={styles.stepContent}>
        <View style={styles.sectionCard}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>TRANSPORTATION</Text>
          <View style={styles.transportGrid}>
            {transportOptions.map(({ type, label, sub, icon: Icon }) => {
              const isSelected = type === 'round_trip'
                ? form.transport === 'chauffeur' && form.chauffeur.roundTrip
                : type === 'chauffeur'
                  ? form.transport === 'chauffeur' && !form.chauffeur.roundTrip
                  : form.transport === 'none';

              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.transportCard,
                    { backgroundColor: colors.surface, borderColor: isSelected ? colors.accent : colors.border },
                    isSelected && { borderWidth: 2 },
                  ]}
                  onPress={() => {
                    haptic();
                    if (type === 'none') {
                      setForm(prev => ({ ...prev, transport: 'none', chauffeur: { ...prev.chauffeur, roundTrip: false } }));
                    } else if (type === 'chauffeur') {
                      setForm(prev => ({ ...prev, transport: 'chauffeur', chauffeur: { ...prev.chauffeur, roundTrip: false } }));
                    } else if (type === 'round_trip') {
                      setForm(prev => ({ ...prev, transport: 'chauffeur', chauffeur: { ...prev.chauffeur, roundTrip: true } }));
                    }
                  }}
                >
                  <View style={[styles.transportIconWrap, { backgroundColor: isSelected ? colors.accent + '20' : colors.background }]}>
                    <Icon size={20} color={isSelected ? colors.accent : colors.textSecondary} />
                  </View>
                  <Text style={[styles.transportLabel, { color: colors.text }]}>{label}</Text>
                  <Text style={[styles.transportSub, { color: colors.textSecondary }]}>{sub}</Text>
                  {isSelected && (
                    <View style={[styles.selectedBadge, { backgroundColor: colors.accent }]}>
                      <Check size={12} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>NEED HELP TODAY?</Text>
          <Text style={[styles.sectionHint, { color: colors.textTertiary }]}>Tap to add services</Text>
          <View style={styles.assistanceGrid}>
            {assistanceOptions.map(({ type, icon: Icon, label, sub, color }) => {
              const isSelected = form.assistance.includes(type);
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.assistanceCard,
                    { backgroundColor: colors.surface, borderColor: isSelected ? color : colors.border },
                    isSelected && { borderWidth: 2 },
                  ]}
                  onPress={() => toggleAssistance(type)}
                >
                  <View style={[styles.assistanceIconWrap, { backgroundColor: color + '20' }]}>
                    <Icon size={22} color={color} />
                  </View>
                  <Text style={[styles.assistanceLabel, { color: colors.text }]}>{label}</Text>
                  <Text style={[styles.assistanceSub, { color: colors.textSecondary }]}>{sub}</Text>
                  {isSelected && (
                    <View style={[styles.selectedBadge, { backgroundColor: color }]}>
                      <Check size={12} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>BROWSE AVAILABLE JOBS</Text>
          <Text style={[styles.sectionHint, { color: colors.textTertiary }]}>Send proposals to jobs posted by others</Text>
          
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Search size={18} color={colors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search jobs..."
              placeholderTextColor={colors.textTertiary}
              value={jobSearchQuery}
              onChangeText={setJobSearchQuery}
            />
          </View>

          {loadingJobs ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading jobs...</Text>
            </View>
          ) : filteredJobs.length === 0 ? (
            <View style={[styles.emptyJobsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <AlertCircle size={24} color={colors.textTertiary} />
              <Text style={[styles.emptyJobsText, { color: colors.textSecondary }]}>No jobs available</Text>
            </View>
          ) : (
            <View style={styles.jobsList}>
              {filteredJobs.slice(0, 5).map(job => {
                const isSelected = form.selectedJobs.some(j => j.id === job.id);
                return (
                  <TouchableOpacity
                    key={job.id}
                    style={[
                      styles.jobCard,
                      { backgroundColor: colors.surface, borderColor: isSelected ? colors.accent : colors.border },
                      isSelected && { borderWidth: 2 },
                    ]}
                    onPress={() => toggleJobSelection(job)}
                  >
                    <View style={[styles.jobIconWrap, { backgroundColor: '#10B98120' }]}>
                      <Briefcase size={18} color="#10B981" />
                    </View>
                    <View style={styles.jobContent}>
                      <Text style={[styles.jobTitle, { color: colors.text }]} numberOfLines={1}>{job.title}</Text>
                      <Text style={[styles.jobType, { color: colors.accent }]}>{job.type}</Text>
                      <Text style={[styles.jobDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                        {job.description}
                      </Text>
                    </View>
                    {isSelected ? (
                      <View style={[styles.jobSelectedBadge, { backgroundColor: colors.accent }]}>
                        <Check size={14} color="#FFF" />
                      </View>
                    ) : (
                      <View style={[styles.jobSelectBtn, { borderColor: colors.accent }]}>
                        <Send size={14} color={colors.accent} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              {form.selectedJobs.length > 0 && (
                <View style={[styles.selectedJobsBadge, { backgroundColor: colors.accent + '20' }]}>
                  <Text style={[styles.selectedJobsText, { color: colors.accent }]}>
                    {form.selectedJobs.length} job{form.selectedJobs.length > 1 ? 's' : ''} selected for proposals
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>CUSTOM BLOCKS</Text>
          <Text style={[styles.sectionHint, { color: colors.textTertiary }]}>Add your own time blocks to the day</Text>

          {form.customBlocks.map(block => (
            <View
              key={block.id}
              style={[styles.customBlockItem, { backgroundColor: colors.surface, borderColor: block.color, borderLeftWidth: 4 }]}
            >
              <View style={styles.customBlockContent}>
                <Text style={[styles.customBlockTitle, { color: colors.text }]}>{block.title}</Text>
                <Text style={[styles.customBlockTime, { color: colors.textSecondary }]}>
                  {formatTime(block.startTime)} - {formatTime(block.endTime)}
                </Text>
                {block.notes ? (
                  <Text style={[styles.customBlockNotes, { color: colors.textTertiary }]} numberOfLines={1}>
                    {block.notes}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => removeCustomBlock(block.id)} style={styles.removeBlockBtn}>
                <Trash2 size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}

          {!showAddBlock ? (
            <TouchableOpacity
              style={[styles.addBlockBtn, { borderColor: colors.accent }]}
              onPress={() => {
                haptic();
                setShowAddBlock(true);
              }}
            >
              <Plus size={20} color={colors.accent} />
              <Text style={[styles.addBlockText, { color: colors.accent }]}>Add Custom Block</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.addBlockForm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Block Title</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g., Deep Work, Gym, Meeting"
                  placeholderTextColor={colors.textTertiary}
                  value={newBlock.title}
                  onChangeText={t => setNewBlock(prev => ({ ...prev, title: t }))}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Start</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    placeholder="09:00"
                    placeholderTextColor={colors.textTertiary}
                    value={newBlock.startTime}
                    onChangeText={t => setNewBlock(prev => ({ ...prev, startTime: t }))}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>End</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    placeholder="10:00"
                    placeholderTextColor={colors.textTertiary}
                    value={newBlock.endTime}
                    onChangeText={t => setNewBlock(prev => ({ ...prev, endTime: t }))}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Color</Text>
                <View style={styles.colorRow}>
                  {BLOCK_COLORS.map(color => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        newBlock.color === color && styles.colorOptionSelected,
                      ]}
                      onPress={() => {
                        haptic();
                        setNewBlock(prev => ({ ...prev, color }));
                      }}
                    >
                      {newBlock.color === color && <Check size={14} color="#FFF" />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Notes (optional)</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder="Any notes..."
                  placeholderTextColor={colors.textTertiary}
                  value={newBlock.notes}
                  onChangeText={t => setNewBlock(prev => ({ ...prev, notes: t }))}
                />
              </View>

              <View style={styles.addBlockActions}>
                <TouchableOpacity
                  style={[styles.cancelBlockBtn, { borderColor: colors.border }]}
                  onPress={() => setShowAddBlock(false)}
                >
                  <Text style={[styles.cancelBlockText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBlockBtn, { backgroundColor: colors.accent }]}
                  onPress={addCustomBlock}
                >
                  <Text style={styles.saveBlockText}>Add Block</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderDetailsStep = () => {
    const services: { key: HelpType | 'chauffeur' | 'jobs' | 'custom'; label: string; icon: any; color: string }[] = [];
    if (form.transport === 'chauffeur') {
      services.push({ key: 'chauffeur', label: 'Chauffeur', icon: Car, color: '#0EA5E9' });
    }
    if (form.assistance.includes('va')) {
      services.push({ key: 'va', label: 'Virtual Assistant', icon: Users, color: '#8B5CF6' });
    }
    if (form.assistance.includes('errands')) {
      services.push({ key: 'errands', label: 'Errands', icon: Package, color: '#F59E0B' });
    }
    if (form.assistance.includes('delivery')) {
      services.push({ key: 'delivery', label: 'Delivery', icon: Car, color: '#EC4899' });
    }
    if (form.assistance.includes('other')) {
      services.push({ key: 'other', label: 'Other', icon: HelpCircle, color: '#6B7280' });
    }
    if (form.selectedJobs.length > 0) {
      services.push({ key: 'jobs', label: `Jobs (${form.selectedJobs.length})`, icon: Briefcase, color: '#10B981' });
    }
    if (form.customBlocks.length > 0) {
      services.push({ key: 'custom', label: `Blocks (${form.customBlocks.length})`, icon: Clock, color: '#6366F1' });
    }

    if (!activeServiceTab && services.length > 0) {
      setActiveServiceTab(services[0].key);
    }

    return (
      <View style={styles.stepContent}>
        <View style={styles.serviceTabs}>
          {services.map(({ key, label, icon: Icon, color }) => {
            const isActive = activeServiceTab === key;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.serviceTab,
                  { backgroundColor: isActive ? color : colors.surface, borderColor: color },
                ]}
                onPress={() => {
                  haptic();
                  setActiveServiceTab(key);
                }}
              >
                <Icon size={16} color={isActive ? '#FFF' : color} />
                <Text style={[styles.serviceTabText, { color: isActive ? '#FFF' : color }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.detailsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {activeServiceTab === 'chauffeur' && renderChauffeurForm()}
          {activeServiceTab === 'va' && renderVAForm()}
          {activeServiceTab === 'errands' && renderErrandsForm()}
          {activeServiceTab === 'delivery' && renderDeliveryForm()}
          {activeServiceTab === 'other' && renderOtherForm()}
          {activeServiceTab === 'jobs' && renderJobsDetail()}
          {activeServiceTab === 'custom' && renderCustomBlocksDetail()}
        </View>
      </View>
    );
  };

  const renderChauffeurForm = () => (
    <View style={styles.formContent}>
      <Text style={[styles.formTitle, { color: colors.text }]}>
        <Car size={18} color="#0EA5E9" /> Chauffeur Details
      </Text>

      <View style={styles.formGroup}>
        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Pickup Address</Text>
        <TextInput
          style={[styles.formInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="Street, City, State"
          placeholderTextColor={colors.textTertiary}
          value={form.chauffeur.pickupAddress}
          onChangeText={t => setForm(prev => ({ ...prev, chauffeur: { ...prev.chauffeur, pickupAddress: t } }))}
        />
      </View>

      <View style={styles.formRow}>
        <View style={[styles.formGroup, { flex: 1 }]}>
          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Pickup ZIP</Text>
          <TextInput
            style={[styles.formInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder="07106"
            placeholderTextColor={colors.textTertiary}
            value={form.chauffeur.pickupZip}
            onChangeText={t => setForm(prev => ({ ...prev, chauffeur: { ...prev.chauffeur, pickupZip: t.replace(/[^0-9]/g, '').slice(0, 5) } }))}
            keyboardType="numeric"
            maxLength={5}
          />
        </View>
        <View style={[styles.formGroup, { flex: 1 }]}>
          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Pickup Time</Text>
          <TouchableOpacity
            style={[styles.formInput, styles.timeButton, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={() => setShowTimePicker(!showTimePicker)}
          >
            <Text style={{ color: colors.text }}>{formatTime(form.chauffeur.pickupTime)}</Text>
            <Clock size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {showTimePicker && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScroll}>
          {Array.from({ length: 17 }, (_, i) => i + 6).flatMap(h => [0, 30].map(m => {
            const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            const isSelected = form.chauffeur.pickupTime === time;
            return (
              <TouchableOpacity
                key={time}
                style={[styles.timeChip, { backgroundColor: isSelected ? colors.accent : colors.background, borderColor: colors.border }]}
                onPress={() => {
                  haptic();
                  setForm(prev => ({ ...prev, chauffeur: { ...prev.chauffeur, pickupTime: time } }));
                  setShowTimePicker(false);
                }}
              >
                <Text style={{ color: isSelected ? '#FFF' : colors.text, fontSize: 13 }}>{formatTime(time)}</Text>
              </TouchableOpacity>
            );
          }))}
        </ScrollView>
      )}

      <View style={styles.formGroup}>
        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Dropoff Address</Text>
        <TextInput
          style={[styles.formInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="Street, City, State"
          placeholderTextColor={colors.textTertiary}
          value={form.chauffeur.dropoffAddress}
          onChangeText={t => setForm(prev => ({ ...prev, chauffeur: { ...prev.chauffeur, dropoffAddress: t } }))}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Dropoff ZIP</Text>
        <TextInput
          style={[styles.formInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border, width: 120 }]}
          placeholder="07052"
          placeholderTextColor={colors.textTertiary}
          value={form.chauffeur.dropoffZip}
          onChangeText={t => setForm(prev => ({ ...prev, chauffeur: { ...prev.chauffeur, dropoffZip: t.replace(/[^0-9]/g, '').slice(0, 5) } }))}
          keyboardType="numeric"
          maxLength={5}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Notes (optional)</Text>
        <TextInput
          style={[styles.formInput, styles.formTextArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="Any special instructions..."
          placeholderTextColor={colors.textTertiary}
          value={form.chauffeur.notes}
          onChangeText={t => setForm(prev => ({ ...prev, chauffeur: { ...prev.chauffeur, notes: t } }))}
          multiline
          numberOfLines={2}
        />
      </View>
    </View>
  );

  const renderVAForm = () => (
    <View style={styles.formContent}>
      <Text style={[styles.formTitle, { color: colors.text }]}>
        <Users size={18} color="#8B5CF6" /> Virtual Assistant
      </Text>

      <View style={styles.formGroup}>
        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>What tasks do you need?</Text>
        <View style={styles.chipGrid}>
          {VA_TASKS.map(({ id, label }) => {
            const isSelected = form.vaDetails.tasks.includes(id);
            return (
              <TouchableOpacity
                key={id}
                style={[
                  styles.selectChip,
                  { backgroundColor: isSelected ? '#8B5CF6' : colors.background, borderColor: isSelected ? '#8B5CF6' : colors.border },
                ]}
                onPress={() => toggleVATask(id)}
              >
                <Text style={[styles.chipText, { color: isSelected ? '#FFF' : colors.text }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Estimated time needed</Text>
        <View style={styles.hoursRow}>
          {HOUR_OPTIONS.map(option => {
            const isCustom = option === 'Custom';
            const hours = isCustom ? 0 : parseInt(option, 10);
            const isSelected = isCustom ? form.vaDetails.hours === 0 : form.vaDetails.hours === hours;
            return (
              <TouchableOpacity
                key={option}
                style={[
                  styles.hourChip,
                  { backgroundColor: isSelected ? '#8B5CF6' : colors.background, borderColor: isSelected ? '#8B5CF6' : colors.border },
                ]}
                onPress={() => selectHours(option)}
              >
                <Text style={[styles.hourText, { color: isSelected ? '#FFF' : colors.text }]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {form.vaDetails.hours === 0 && (
          <TextInput
            style={[styles.formInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border, marginTop: 8, width: 100 }]}
            placeholder="Hours"
            placeholderTextColor={colors.textTertiary}
            value={form.vaDetails.customHours}
            onChangeText={t => setForm(prev => ({ ...prev, vaDetails: { ...prev.vaDetails, customHours: t.replace(/[^0-9]/g, '') } }))}
            keyboardType="numeric"
          />
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Tools/Access needed</Text>
        <View style={styles.chipGrid}>
          {VA_TOOLS.map(({ id, label, icon: Icon }) => {
            const isSelected = form.vaDetails.tools.includes(id);
            return (
              <TouchableOpacity
                key={id}
                style={[
                  styles.toolChip,
                  { backgroundColor: isSelected ? '#8B5CF620' : colors.background, borderColor: isSelected ? '#8B5CF6' : colors.border },
                ]}
                onPress={() => toggleVATool(id)}
              >
                <Icon size={14} color={isSelected ? '#8B5CF6' : colors.textSecondary} />
                <Text style={[styles.toolChipText, { color: isSelected ? '#8B5CF6' : colors.text }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Notes (what success looks like)</Text>
        <TextInput
          style={[styles.formInput, styles.formTextArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="Describe what you need accomplished..."
          placeholderTextColor={colors.textTertiary}
          value={form.vaDetails.notes}
          onChangeText={t => setForm(prev => ({ ...prev, vaDetails: { ...prev.vaDetails, notes: t } }))}
          multiline
          numberOfLines={3}
        />
      </View>
    </View>
  );

  const renderErrandsForm = () => (
    <View style={styles.formContent}>
      <Text style={[styles.formTitle, { color: colors.text }]}>
        <Package size={18} color="#F59E0B" /> Errands Details
      </Text>

      <View style={styles.formGroup}>
        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>What errands do you need?</Text>
        <TextInput
          style={[styles.formInput, styles.formTextArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., Pick up dry cleaning, grocery shopping..."
          placeholderTextColor={colors.textTertiary}
          value={form.errandsDetails.description}
          onChangeText={t => setForm(prev => ({ ...prev, errandsDetails: { ...prev.errandsDetails, description: t } }))}
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Location / Area</Text>
        <TextInput
          style={[styles.formInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., Downtown, Midtown..."
          placeholderTextColor={colors.textTertiary}
          value={form.errandsDetails.location}
          onChangeText={t => setForm(prev => ({ ...prev, errandsDetails: { ...prev.errandsDetails, location: t } }))}
        />
      </View>
    </View>
  );

  const renderDeliveryForm = () => (
    <View style={styles.formContent}>
      <Text style={[styles.formTitle, { color: colors.text }]}>
        <Car size={18} color="#EC4899" /> Delivery Details
      </Text>

      <View style={styles.formGroup}>
        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Pickup Address</Text>
        <TextInput
          style={[styles.formInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="Where to pick up from"
          placeholderTextColor={colors.textTertiary}
          value={form.deliveryDetails.pickupAddress}
          onChangeText={t => setForm(prev => ({ ...prev, deliveryDetails: { ...prev.deliveryDetails, pickupAddress: t } }))}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Dropoff Address</Text>
        <TextInput
          style={[styles.formInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="Where to deliver"
          placeholderTextColor={colors.textTertiary}
          value={form.deliveryDetails.dropoffAddress}
          onChangeText={t => setForm(prev => ({ ...prev, deliveryDetails: { ...prev.deliveryDetails, dropoffAddress: t } }))}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Items / Notes</Text>
        <TextInput
          style={[styles.formInput, styles.formTextArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="What needs to be delivered..."
          placeholderTextColor={colors.textTertiary}
          value={form.deliveryDetails.items}
          onChangeText={t => setForm(prev => ({ ...prev, deliveryDetails: { ...prev.deliveryDetails, items: t } }))}
          multiline
          numberOfLines={2}
        />
      </View>
    </View>
  );

  const renderOtherForm = () => (
    <View style={styles.formContent}>
      <Text style={[styles.formTitle, { color: colors.text }]}>
        <HelpCircle size={18} color="#6B7280" /> Custom Request
      </Text>

      <View style={styles.formGroup}>
        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Describe what you need</Text>
        <TextInput
          style={[styles.formInput, styles.formTextArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder="Tell us about your request..."
          placeholderTextColor={colors.textTertiary}
          value={form.otherDetails.description}
          onChangeText={t => setForm(prev => ({ ...prev, otherDetails: { ...prev.otherDetails, description: t } }))}
          multiline
          numberOfLines={4}
        />
      </View>
    </View>
  );

  const renderJobsDetail = () => (
    <View style={styles.formContent}>
      <Text style={[styles.formTitle, { color: colors.text }]}>
        <Briefcase size={18} color="#10B981" /> Selected Jobs for Proposals
      </Text>
      <Text style={[styles.formHint, { color: colors.textSecondary }]}>
        You will send proposals to these jobs when you submit your plan
      </Text>

      {form.selectedJobs.map(job => (
        <View
          key={job.id}
          style={[styles.selectedJobDetail, { backgroundColor: colors.background, borderColor: colors.border }]}
        >
          <View style={styles.selectedJobHeader}>
            <Text style={[styles.selectedJobTitle, { color: colors.text }]}>{job.title}</Text>
            <TouchableOpacity onPress={() => toggleJobSelection(job)}>
              <Trash2 size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
          <Text style={[styles.selectedJobType, { color: colors.accent }]}>{job.type}</Text>
          <Text style={[styles.selectedJobDesc, { color: colors.textSecondary }]}>{job.description}</Text>
        </View>
      ))}
    </View>
  );

  const renderCustomBlocksDetail = () => (
    <View style={styles.formContent}>
      <Text style={[styles.formTitle, { color: colors.text }]}>
        <Clock size={18} color="#6366F1" /> Your Custom Blocks
      </Text>
      <Text style={[styles.formHint, { color: colors.textSecondary }]}>
        These blocks will be added to your day plan
      </Text>

      {form.customBlocks.map(block => (
        <View
          key={block.id}
          style={[styles.blockDetailItem, { backgroundColor: colors.background, borderColor: block.color, borderLeftWidth: 4 }]}
        >
          <View style={styles.blockDetailHeader}>
            <Text style={[styles.blockDetailTitle, { color: colors.text }]}>{block.title}</Text>
            <TouchableOpacity onPress={() => removeCustomBlock(block.id)}>
              <Trash2 size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
          <Text style={[styles.blockDetailTime, { color: colors.textSecondary }]}>
            {formatTime(block.startTime)} - {formatTime(block.endTime)}
          </Text>
          {block.notes ? (
            <Text style={[styles.blockDetailNotes, { color: colors.textTertiary }]}>{block.notes}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );

  const renderPaymentStep = () => {
    const options: { type: PaymentType; icon: any; label: string; sub: string }[] = [
      { type: 'swap', icon: Repeat, label: 'Swap Services', sub: 'Trade skills & services' },
      { type: 'cash', icon: DollarSign, label: 'Cash', sub: 'Physical currency' },
      { type: 'card', icon: CreditCard, label: 'Card', sub: 'Credit/debit payment' },
      { type: 'crypto', icon: Coins, label: 'Crypto', sub: 'Cryptocurrency' },
    ];

    return (
      <View style={styles.stepContent}>
        <View style={styles.sectionCard}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PAYMENT METHOD</Text>
          <View style={styles.paymentGrid}>
            {options.map(({ type, icon: Icon, label, sub }) => {
              const isSelected = form.payment === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.paymentCard,
                    { backgroundColor: colors.surface, borderColor: isSelected ? colors.accent : colors.border },
                    isSelected && { borderWidth: 2 },
                  ]}
                  onPress={() => {
                    haptic();
                    setForm(prev => ({ ...prev, payment: type }));
                  }}
                >
                  <View style={[styles.paymentIconWrap, { backgroundColor: isSelected ? colors.accent + '20' : colors.background }]}>
                    <Icon size={24} color={isSelected ? colors.accent : colors.textSecondary} />
                  </View>
                  <Text style={[styles.paymentLabel, { color: colors.text }]}>{label}</Text>
                  <Text style={[styles.paymentSub, { color: colors.textSecondary }]}>{sub}</Text>
                  {isSelected && (
                    <View style={[styles.selectedBadge, { backgroundColor: colors.accent }]}>
                      <Check size={12} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const renderReviewStep = () => {
    const locationLabels: Record<string, string> = {
      home: 'Home',
      hotel: 'Hotel / Airbnb',
      coffee: 'Coffee / Coworking',
      coworking: 'Custom Location',
    };

    const hasRequests = form.assistance.length > 0 || form.transport === 'chauffeur';
    const actualHours = form.vaDetails.hours || parseInt(form.vaDetails.customHours, 10) || 2;

    return (
      <View style={styles.stepContent}>
        <View style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.reviewRow}>
            <Calendar size={18} color={colors.accent} />
            <View style={styles.reviewTextWrap}>
              <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>Date</Text>
              <Text style={[styles.reviewValue, { color: colors.text }]}>{getDateLabel(form.date)}</Text>
            </View>
          </View>

          <View style={[styles.reviewDivider, { backgroundColor: colors.border }]} />

          <View style={styles.reviewRow}>
            <MapPin size={18} color={colors.accent} />
            <View style={styles.reviewTextWrap}>
              <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>Location</Text>
              <Text style={[styles.reviewValue, { color: colors.text }]}>{locationLabels[form.locationType]}</Text>
            </View>
          </View>

          <View style={[styles.reviewDivider, { backgroundColor: colors.border }]} />

          <View style={styles.reviewRow}>
            <DollarSign size={18} color={colors.accent} />
            <View style={styles.reviewTextWrap}>
              <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>Payment</Text>
              <Text style={[styles.reviewValue, { color: colors.text, textTransform: 'capitalize' as const }]}>{form.payment}</Text>
            </View>
          </View>
        </View>

        {hasRequests && (
          <View style={styles.servicesSection}>
            <View style={styles.servicesSectionHeader}>
              <View style={[styles.servicesHeaderIcon, { backgroundColor: '#10B981' }]}>
                <Zap size={16} color="#FFF" />
              </View>
              <Text style={[styles.servicesSectionTitle, { color: colors.text }]}>Service Requests</Text>
            </View>

            {form.transport === 'chauffeur' && (
              <View style={[styles.serviceItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.serviceItemIcon, { backgroundColor: '#0EA5E920' }]}>
                  <Car size={18} color="#0EA5E9" />
                </View>
                <View style={styles.serviceItemContent}>
                  <Text style={[styles.serviceItemTitle, { color: colors.text }]}>Chauffeur</Text>
                  <Text style={[styles.serviceItemDetail, { color: colors.textSecondary }]}>
                    {form.chauffeur.roundTrip ? 'Round Trip' : 'One Way'} • {formatTime(form.chauffeur.pickupTime)}
                  </Text>
                  {form.chauffeur.pickupAddress && (
                    <Text style={[styles.serviceItemRoute, { color: colors.textTertiary }]} numberOfLines={1}>
                      {form.chauffeur.pickupAddress} → {form.chauffeur.dropoffAddress}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {form.assistance.includes('va') && (
              <View style={[styles.serviceItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.serviceItemIcon, { backgroundColor: '#8B5CF620' }]}>
                  <Users size={18} color="#8B5CF6" />
                </View>
                <View style={styles.serviceItemContent}>
                  <Text style={[styles.serviceItemTitle, { color: colors.text }]}>Virtual Assistant</Text>
                  <Text style={[styles.serviceItemDetail, { color: colors.textSecondary }]}>
                    {actualHours}hrs • {form.vaDetails.tasks.length > 0
                      ? form.vaDetails.tasks.map(t => VA_TASKS.find(vt => vt.id === t)?.label || t).slice(0, 2).join(', ')
                      : 'General tasks'}
                  </Text>
                </View>
              </View>
            )}

            {form.assistance.includes('errands') && (
              <View style={[styles.serviceItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.serviceItemIcon, { backgroundColor: '#F59E0B20' }]}>
                  <Package size={18} color="#F59E0B" />
                </View>
                <View style={styles.serviceItemContent}>
                  <Text style={[styles.serviceItemTitle, { color: colors.text }]}>Errands</Text>
                  <Text style={[styles.serviceItemDetail, { color: colors.textSecondary }]} numberOfLines={1}>
                    {form.errandsDetails.description || 'General errands'}
                  </Text>
                </View>
              </View>
            )}

            {form.assistance.includes('delivery') && (
              <View style={[styles.serviceItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.serviceItemIcon, { backgroundColor: '#EC489920' }]}>
                  <Car size={18} color="#EC4899" />
                </View>
                <View style={styles.serviceItemContent}>
                  <Text style={[styles.serviceItemTitle, { color: colors.text }]}>Delivery</Text>
                  <Text style={[styles.serviceItemDetail, { color: colors.textSecondary }]} numberOfLines={1}>
                    {form.deliveryDetails.items || 'Delivery request'}
                  </Text>
                </View>
              </View>
            )}

            {form.assistance.includes('other') && (
              <View style={[styles.serviceItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.serviceItemIcon, { backgroundColor: '#6B728020' }]}>
                  <HelpCircle size={18} color="#6B7280" />
                </View>
                <View style={styles.serviceItemContent}>
                  <Text style={[styles.serviceItemTitle, { color: colors.text }]}>Custom Request</Text>
                  <Text style={[styles.serviceItemDetail, { color: colors.textSecondary }]} numberOfLines={1}>
                    {form.otherDetails.description || 'Custom assistance'}
                  </Text>
                </View>
              </View>
            )}

            {form.selectedJobs.length > 0 && (
              <View style={styles.reviewSubSection}>
                <View style={styles.reviewSubHeader}>
                  <Send size={16} color="#10B981" />
                  <Text style={[styles.reviewSubTitle, { color: colors.text }]}>Job Proposals ({form.selectedJobs.length})</Text>
                </View>
                {form.selectedJobs.map(job => (
                  <View key={job.id} style={[styles.serviceItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[styles.serviceItemIcon, { backgroundColor: '#10B98120' }]}>
                      <Briefcase size={18} color="#10B981" />
                    </View>
                    <View style={styles.serviceItemContent}>
                      <Text style={[styles.serviceItemTitle, { color: colors.text }]}>{job.title}</Text>
                      <Text style={[styles.serviceItemDetail, { color: colors.textSecondary }]} numberOfLines={1}>
                        {job.type} • {job.description}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {form.customBlocks.length > 0 && (
              <View style={styles.reviewSubSection}>
                <View style={styles.reviewSubHeader}>
                  <Clock size={16} color="#6366F1" />
                  <Text style={[styles.reviewSubTitle, { color: colors.text }]}>Custom Blocks ({form.customBlocks.length})</Text>
                </View>
                {form.customBlocks.map(block => (
                  <View
                    key={block.id}
                    style={[styles.serviceItem, { backgroundColor: colors.surface, borderColor: block.color, borderLeftWidth: 3 }]}
                  >
                    <View style={[styles.serviceItemIcon, { backgroundColor: block.color + '20' }]}>
                      <Clock size={18} color={block.color} />
                    </View>
                    <View style={styles.serviceItemContent}>
                      <Text style={[styles.serviceItemTitle, { color: colors.text }]}>{block.title}</Text>
                      <Text style={[styles.serviceItemDetail, { color: colors.textSecondary }]}>
                        {formatTime(block.startTime)} - {formatTime(block.endTime)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {!hasRequests && (
          <View style={[styles.noServicesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.noServicesText, { color: colors.textSecondary }]}>
              No service requests selected. Your day plan will be saved.
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'basics': return renderBasicsStep();
      case 'services': return renderServicesStep();
      case 'details': return renderDetailsStep();
      case 'payment': return renderPaymentStep();
      case 'review': return renderReviewStep();
      default: return null;
    }
  };

  const canContinue = useMemo(() => {
    if (currentStep === 'services') {
      return true;
    }
    return true;
  }, [currentStep]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: getStepTitle(currentStep),
          headerLeft: () => (
            <TouchableOpacity onPress={goBack} style={{ padding: 8 }}>
              <ChevronLeft size={24} color={colors.text} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
              <X size={22} color={colors.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View style={[styles.progressFill, { backgroundColor: colors.accent, width: `${progress * 100}%` }]} />
        </View>
        <Text style={[styles.stepIndicator, { color: colors.textSecondary }]}>
          Step {stepIndex + 1} of {steps.length}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 180 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderStep()}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, paddingBottom: insets.bottom + 80 }]}>
        {currentStep === 'review' ? (
          <TouchableOpacity
            style={[styles.primaryBtn, { opacity: isSaving ? 0.7 : 1 }]}
            onPress={handlePostGig}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.btnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Sparkles size={20} color="#FFF" />
                  <Text style={styles.btnText}>Post Plan</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryBtn, { opacity: canContinue ? 1 : 0.5 }]}
            onPress={goNext}
            activeOpacity={0.8}
            disabled={!canContinue}
          >
            <LinearGradient
              colors={['#0EA5E9', '#0284C7']}
              style={styles.btnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.btnText}>Continue</Text>
              <ChevronRight size={20} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {toastMessage !== '' && (
        <Animated.View
          style={[
            styles.toast,
            {
              backgroundColor: toastType === 'error' ? '#EF4444' : '#10B981',
              opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            },
          ]}
        >
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  stepIndicator: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  stepContent: {
    flex: 1,
  },
  sectionCard: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 1,
    marginBottom: 12,
  },
  sectionHint: {
    fontSize: 13,
    marginBottom: 12,
    marginTop: -8,
  },
  dateChipsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    gap: 6,
  },
  dateChipText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  locationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  locationCard: {
    width: '47%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    position: 'relative',
  },
  locationIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transportGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  transportCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    position: 'relative',
  },
  transportIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  transportLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  transportSub: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  assistanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  assistanceCard: {
    width: '47%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    position: 'relative',
  },
  assistanceIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  assistanceLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  assistanceSub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  serviceTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  serviceTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 6,
  },
  serviceTabText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  detailsCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  formContent: {
    padding: 18,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    marginBottom: 18,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  formTextArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeScroll: {
    marginBottom: 12,
    marginTop: 4,
  },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  hoursRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hourChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  hourText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  toolChipText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  paymentCard: {
    width: '47%',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    position: 'relative',
  },
  paymentIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  paymentLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  paymentSub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  calendarPicker: {
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  weekdays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 14,
  },
  reviewCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  reviewTextWrap: {
    flex: 1,
  },
  reviewLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  reviewValue: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  reviewDivider: {
    height: 1,
  },
  servicesSection: {
    marginTop: 24,
  },
  servicesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  servicesHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servicesSectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  serviceItem: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  serviceItemIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceItemContent: {
    flex: 1,
  },
  serviceItemTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  serviceItemDetail: {
    fontSize: 13,
  },
  serviceItemRoute: {
    fontSize: 12,
    marginTop: 4,
  },
  noServicesCard: {
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 20,
    alignItems: 'center',
  },
  noServicesText: {
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  primaryBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  btnText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  toast: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  toastText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFF',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  loadingWrap: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyJobsCard: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  emptyJobsText: {
    fontSize: 14,
  },
  jobsList: {
    gap: 10,
  },
  jobCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  jobIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobContent: {
    flex: 1,
  },
  jobTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  jobType: {
    fontSize: 12,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  jobDesc: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  jobSelectedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobSelectBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedJobsBadge: {
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  selectedJobsText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  customBlockItem: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    alignItems: 'center',
  },
  customBlockContent: {
    flex: 1,
  },
  customBlockTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  customBlockTime: {
    fontSize: 13,
    marginTop: 2,
  },
  customBlockNotes: {
    fontSize: 12,
    marginTop: 4,
  },
  removeBlockBtn: {
    padding: 8,
  },
  addBlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 8,
  },
  addBlockText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  addBlockForm: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: '#FFF',
  },
  addBlockActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBlockBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBlockText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  saveBlockBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBlockText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFF',
  },
  formHint: {
    fontSize: 13,
    marginBottom: 16,
  },
  selectedJobDetail: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  selectedJobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedJobTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    flex: 1,
  },
  selectedJobType: {
    fontSize: 12,
    fontWeight: '500' as const,
    marginTop: 4,
  },
  selectedJobDesc: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  blockDetailItem: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  blockDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  blockDetailTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    flex: 1,
  },
  blockDetailTime: {
    fontSize: 13,
    marginTop: 4,
  },
  blockDetailNotes: {
    fontSize: 12,
    marginTop: 6,
  },
  reviewSubSection: {
    marginTop: 16,
  },
  reviewSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  reviewSubTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
});
