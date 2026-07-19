import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';

import {
  CalendarEvent,
  Bill,
  Relationship,
  IncomeSource,
  ContactInteraction,
  ContactMeeting,
  ContactFollowUp,
  WellnessSuggestion,
} from '@/mocks/lifeCrmData';
import { DatabaseService } from '@/lib/database';
import * as localApi from '@/lib/api';

interface LifeCrmData {
  calendarEvents: CalendarEvent[];
  bills: Bill[];
  relationships: Relationship[];
  incomeSources: IncomeSource[];
  wellnessSuggestions: WellnessSuggestion[];
}

const STORAGE_KEY = 'apparently_life_crm';

const defaultData: LifeCrmData = {
  calendarEvents: [],
  bills: [],
  relationships: [],
  incomeSources: [],
  wellnessSuggestions: [],
};

const mapDbEventToEvent = (e: any): CalendarEvent => ({
  id: e.id,
  title: e.title,
  type: e.type,
  date: e.date,
  time: e.time,
  duration: e.duration,
  location: e.location,
  attendees: e.attendees,
  priority: e.priority,
  isCompleted: e.is_completed,
  incomeAmount: e.income_amount,
  incomeSource: e.income_source,
  paymentStatus: e.payment_status,
});

const mapDbBillToBill = (b: any): Bill => ({
  id: b.id,
  name: b.name,
  amount: b.amount,
  dueDate: b.due_date,
  category: b.category,
  isPaid: b.is_paid,
  isRecurring: b.is_recurring,
  frequency: b.frequency,
});

const mapDbRelationshipToRelationship = (r: any, interactions: any[], meetings: any[], followUps: any[]): Relationship => ({
  id: r.id,
  name: r.name,
  avatar: r.avatar,
  category: r.category,
  lastInteraction: r.last_interaction,
  lastInteractionDate: r.last_interaction_date,
  interactionScore: r.interaction_score,
  notes: r.notes,
  upcomingBirthday: r.upcoming_birthday,
  tags: r.tags || [],
  phone: r.phone,
  email: r.email,
  company: r.company,
  role: r.role,
  interactions: interactions.map(i => ({
    id: i.id,
    type: i.type,
    date: i.date,
    time: i.time,
    duration: i.duration,
    notes: i.notes,
    outcome: i.outcome,
  })),
  meetings: meetings.map(m => ({
    id: m.id,
    title: m.title,
    date: m.date,
    time: m.time,
    location: m.location,
    agenda: m.agenda,
    status: m.status,
    linkedContactId: r.id,
    reminderSent: m.reminder_sent,
    expectedIncome: m.expected_income,
    incomeType: m.income_type,
    incomeStatus: m.income_status,
  })),
  followUps: followUps.map(f => ({
    id: f.id,
    title: f.title,
    dueDate: f.due_date,
    priority: f.priority,
    status: f.status,
    linkedContactId: r.id,
    notes: f.notes,
  })),
  needsAttention: r.needs_attention,
  attentionReason: r.attention_reason,
});

export const [LifeCrmProvider, useLifeCrm] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [data, setData] = useState<LifeCrmData>(defaultData);

  const eventsQuery = useQuery({
    queryKey: ['supabaseCalendarEvents'],
    queryFn: async ({ signal }) => {
      try {
        const userId = await DatabaseService.getCurrentUserId();
        if (userId) {
          const dbEvents = await DatabaseService.fetchCalendarEvents(userId, { signal });
          if (dbEvents && dbEvents.length > 0) {
            console.log('[LifeCRM] Fetched events from Supabase:', dbEvents.length);
            return dbEvents.map(mapDbEventToEvent);
          }
        }
        return null;
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          console.log('[LifeCRM] Events fetch aborted (navigation)');
          return null;
        }
        console.log('[LifeCRM] Supabase events fetch failed, trying local API...');
      }

      // Fall back to local API
      try {
        const localEvents = await localApi.getCalendarEvents(localApi.DEFAULT_USER_ID);
        if (localEvents && localEvents.length > 0) {
          console.log('[LifeCRM] Fetched events from local API:', localEvents.length);
          return localEvents.map((e: any) => ({
            id: e.id,
            title: e.title,
            type: e.type,
            date: e.date,
            time: e.time,
            duration: e.duration,
            location: e.location,
            attendees: typeof e.attendees === 'string' ? JSON.parse(e.attendees) : (e.attendees || []),
            priority: e.priority,
            isCompleted: !!e.is_completed,
            incomeAmount: e.income_amount,
            incomeSource: e.income_source,
            paymentStatus: e.payment_status,
          })) as CalendarEvent[];
        }
      } catch (e2) {
        console.log('[LifeCRM] Local API events also unavailable');
      }
      return null;
    },
    staleTime: 1000 * 60 * 5,
  });

  const billsQuery = useQuery({
    queryKey: ['supabaseBills'],
    queryFn: async ({ signal }) => {
      try {
        const userId = await DatabaseService.getCurrentUserId();
        if (userId) {
          const dbBills = await DatabaseService.fetchBills(userId, { signal });
          if (dbBills && dbBills.length > 0) {
            console.log('[LifeCRM] Fetched bills from Supabase:', dbBills.length);
            return dbBills.map(mapDbBillToBill);
          }
        }
        return null;
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          console.log('[LifeCRM] Bills fetch aborted (navigation)');
          return null;
        }
        console.log('[LifeCRM] Supabase bills fetch failed, trying local API...');
      }

      // Fall back to local API
      try {
        const localBills = await localApi.getBills(localApi.DEFAULT_USER_ID);
        if (localBills && localBills.length > 0) {
          console.log('[LifeCRM] Fetched bills from local API:', localBills.length);
          return localBills.map((b: any) => ({
            id: b.id,
            name: b.name,
            amount: b.amount,
            dueDate: b.due_date,
            category: b.category,
            isPaid: !!b.is_paid,
            isRecurring: !!b.is_recurring,
            frequency: b.frequency,
          })) as Bill[];
        }
      } catch (e2) {
        console.log('[LifeCRM] Local API bills also unavailable');
      }
      return null;
    },
    staleTime: 1000 * 60 * 5,
  });

  const relationshipsQuery = useQuery({
    queryKey: ['supabaseRelationships'],
    queryFn: async ({ signal }) => {
      try {
        const userId = await DatabaseService.getCurrentUserId();
        if (userId) {
          const dbRelationships = await DatabaseService.fetchRelationships(userId, { signal });
          if (dbRelationships && dbRelationships.length > 0) {
            console.log('[LifeCRM] Fetched relationships from Supabase:', dbRelationships.length);
            
            const relationshipsWithData = await Promise.all(
              dbRelationships.map(async (r) => {
                const [interactions, meetings, followUps] = await Promise.all([
                  DatabaseService.fetchContactInteractions(r.id, { signal }),
                  DatabaseService.fetchContactMeetings(r.id, { signal }),
                  DatabaseService.fetchContactFollowUps(r.id, { signal }),
                ]);
                return mapDbRelationshipToRelationship(r, interactions, meetings, followUps);
              })
            );
            
            return relationshipsWithData;
          }
        }
        return null;
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          console.log('[LifeCRM] Relationships fetch aborted (navigation)');
          return null;
        }
        console.error('[LifeCRM] Error fetching relationships from Supabase:', error);
        return null;
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const query = useQuery({
    queryKey: ['lifeCrm'],
    queryFn: async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored && stored !== 'undefined' && stored !== 'null') {
          try {
            const parsed = JSON.parse(stored);
            return {
              ...defaultData,
              ...parsed,
            };
          } catch (parseError) {
            console.error('[LifeCRM] JSON parse error, clearing corrupted data:', parseError);
            await AsyncStorage.removeItem(STORAGE_KEY);
            return defaultData;
          }
        }
        return defaultData;
      } catch (error) {
        console.error('[LifeCRM] Error loading stored data:', error);
        return defaultData;
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newData: LifeCrmData) => {
      console.log('[LifeCRM] Saving data to storage, triggering income recalculation');
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      return newData;
    },
    onSuccess: () => {
      console.log('[LifeCRM] Data saved, invalidating queries to refresh UI');
      queryClient.invalidateQueries({ queryKey: ['lifeCrm'] });
    },
  });

  useEffect(() => {
    if (query.data) {
      let mergedData = { ...query.data };
      
      if (eventsQuery.data) {
        mergedData.calendarEvents = eventsQuery.data;
      }
      if (billsQuery.data) {
        mergedData.bills = billsQuery.data;
      }
      if (relationshipsQuery.data) {
        mergedData.relationships = relationshipsQuery.data;
      }
      
      setData(mergedData);
    }
  }, [query.data, eventsQuery.data, billsQuery.data, relationshipsQuery.data]);

  const todaysEvents = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return data.calendarEvents.filter((e) => e.date === today);
  }, [data.calendarEvents]);

  const upcomingBills = useMemo(() => {
    const today = new Date();
    return data.bills
      .filter((b) => !b.isPaid && new Date(b.dueDate) >= today)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);
  }, [data.bills]);

  const totalDueSoon = useMemo(() => {
    const today = new Date();
    const sevenDaysLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return data.bills
      .filter(
        (b) =>
          !b.isPaid &&
          new Date(b.dueDate) >= today &&
          new Date(b.dueDate) <= sevenDaysLater
      )
      .reduce((sum, b) => sum + b.amount, 0);
  }, [data.bills]);

  const relationshipAlerts = useMemo(() => {
    return data.relationships.filter((r) => r.interactionScore < 50);
  }, [data.relationships]);

  const getDateRange = (period: 'today' | 'week' | 'month') => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    const endDate = new Date(today);

    if (period === 'today') {
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'week') {
      const dayOfWeek = today.getDay();
      startDate.setDate(today.getDate() - dayOfWeek);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'month') {
      startDate.setDate(1);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);
      endDate.setHours(23, 59, 59, 999);
    }

    return { startDate, endDate };
  };

  const calculateIncomeFromMeetings = useMemo(() => {
    return (period: 'today' | 'week' | 'month') => {
      const { startDate, endDate } = getDateRange(period);
      let total = 0;

      data.relationships.forEach((r) => {
        r.meetings.forEach((m) => {
          if (!m.expectedIncome || m.incomeStatus === 'cancelled') return;
          if (m.incomeStatus !== 'planned' && m.incomeStatus !== 'closed_paid') return;
          
          const meetingDate = new Date(m.date);
          if (meetingDate >= startDate && meetingDate <= endDate) {
            total += m.expectedIncome;
          }
        });
      });

      return total;
    };
  }, [data.relationships]);

  const calculateIncomeFromEvents = useMemo(() => {
    return (period: 'today' | 'week' | 'month') => {
      const { startDate, endDate } = getDateRange(period);
      let total = 0;

      data.calendarEvents.forEach((e) => {
        if (!e.incomeAmount) return;
        if (e.paymentStatus !== 'expected' && e.paymentStatus !== 'received') return;
        
        const eventDate = new Date(e.date);
        if (eventDate >= startDate && eventDate <= endDate) {
          total += e.incomeAmount;
        }
      });

      return total;
    };
  }, [data.calendarEvents]);

  const estimatedIncomeToday = useMemo(() => {
    const meetingIncome = calculateIncomeFromMeetings('today');
    const eventIncome = calculateIncomeFromEvents('today');
    return meetingIncome + eventIncome;
  }, [calculateIncomeFromMeetings, calculateIncomeFromEvents]);

  const estimatedIncomeThisWeek = useMemo(() => {
    const meetingIncome = calculateIncomeFromMeetings('week');
    const eventIncome = calculateIncomeFromEvents('week');
    return meetingIncome + eventIncome;
  }, [calculateIncomeFromMeetings, calculateIncomeFromEvents]);

  const estimatedIncomeThisMonth = useMemo(() => {
    const meetingIncome = calculateIncomeFromMeetings('month');
    const eventIncome = calculateIncomeFromEvents('month');
    return meetingIncome + eventIncome;
  }, [calculateIncomeFromMeetings, calculateIncomeFromEvents]);

  const estimatedDailyEarnings = useMemo(() => {
    const sourceIncome = data.incomeSources
      .filter((source) => source.frequency === 'daily')
      .reduce((sum, source) => {
        const weightedAmount = source.estimatedAmount * (source.confidence / 100);
        return sum + weightedAmount;
      }, 0);
    
    return sourceIncome + estimatedIncomeToday;
  }, [data.incomeSources, estimatedIncomeToday]);

  const incomeBreakdown = useMemo(() => {
    const breakdown = {
      today: {
        meetings: calculateIncomeFromMeetings('today'),
        events: calculateIncomeFromEvents('today'),
        total: estimatedIncomeToday,
      },
      week: {
        meetings: calculateIncomeFromMeetings('week'),
        events: calculateIncomeFromEvents('week'),
        total: estimatedIncomeThisWeek,
      },
      month: {
        meetings: calculateIncomeFromMeetings('month'),
        events: calculateIncomeFromEvents('month'),
        total: estimatedIncomeThisMonth,
      },
    };
    console.log('[LifeCRM] Income breakdown calculated:', breakdown);
    return breakdown;
  }, [calculateIncomeFromMeetings, calculateIncomeFromEvents, estimatedIncomeToday, estimatedIncomeThisWeek, estimatedIncomeThisMonth]);

  const addCalendarEvent = async (event: CalendarEvent) => {
    const updated = { ...data, calendarEvents: [...data.calendarEvents, event] };
    setData(updated);
    saveMutation.mutate(updated);
    
    const userId = await DatabaseService.getCurrentUserId();
    if (userId) {
      await DatabaseService.createCalendarEvent({
        user_id: userId,
        title: event.title,
        type: event.type,
        date: event.date,
        time: event.time,
        duration: event.duration,
        location: event.location,
        attendees: event.attendees,
        priority: event.priority,
        is_completed: event.isCompleted,
        income_amount: event.incomeAmount,
        income_source: event.incomeSource,
        payment_status: event.paymentStatus,
      });
      queryClient.invalidateQueries({ queryKey: ['supabaseCalendarEvents'] });
    }
    
    console.log('[LifeCRM] Added new event:', event.title, 'with income:', event.incomeAmount);
  };

  const addBill = async (bill: Omit<Bill, 'id'>) => {
    const newBill: Bill = {
      ...bill,
      id: `bill-${Date.now()}`,
    };
    const updated = { ...data, bills: [...data.bills, newBill] };
    setData(updated);
    saveMutation.mutate(updated);
    
    const userId = await DatabaseService.getCurrentUserId();
    if (userId) {
      await DatabaseService.createBill({
        user_id: userId,
        name: bill.name,
        amount: bill.amount,
        due_date: bill.dueDate,
        category: bill.category,
        is_paid: bill.isPaid,
        is_recurring: bill.isRecurring,
        frequency: bill.frequency,
      });
      queryClient.invalidateQueries({ queryKey: ['supabaseBills'] });
    }
    
    console.log('[LifeCRM] Added new bill:', newBill.name);
  };

  const toggleEventComplete = async (eventId: string) => {
    const event = data.calendarEvents.find(e => e.id === eventId);
    const updated = {
      ...data,
      calendarEvents: data.calendarEvents.map((e) =>
        e.id === eventId ? { ...e, isCompleted: !e.isCompleted } : e
      ),
    };
    setData(updated);
    saveMutation.mutate(updated);
    
    if (event) {
      await DatabaseService.updateCalendarEvent(eventId, { is_completed: !event.isCompleted });
    }
  };

  const markBillPaid = async (billId: string) => {
    const updated = {
      ...data,
      bills: data.bills.map((b) => (b.id === billId ? { ...b, isPaid: true } : b)),
    };
    setData(updated);
    saveMutation.mutate(updated);
    
    await DatabaseService.updateBill(billId, { is_paid: true });
  };

  const updateRelationship = (relationshipId: string, updates: Partial<Relationship>) => {
    const updated = {
      ...data,
      relationships: data.relationships.map((r) =>
        r.id === relationshipId ? { ...r, ...updates } : r
      ),
    };
    setData(updated);
    saveMutation.mutate(updated);
    console.log('[LifeCRM] Updated relationship:', relationshipId);
  };

  const updateCalendarEvent = async (eventId: string, updates: Partial<CalendarEvent>) => {
    const updated = {
      ...data,
      calendarEvents: data.calendarEvents.map((e) =>
        e.id === eventId ? { ...e, ...updates } : e
      ),
    };
    setData(updated);
    saveMutation.mutate(updated);
    
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    if (updates.time !== undefined) dbUpdates.time = updates.time;
    if (updates.duration !== undefined) dbUpdates.duration = updates.duration;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.isCompleted !== undefined) dbUpdates.is_completed = updates.isCompleted;
    if (updates.incomeAmount !== undefined) dbUpdates.income_amount = updates.incomeAmount;
    if (updates.incomeSource !== undefined) dbUpdates.income_source = updates.incomeSource;
    if (updates.paymentStatus !== undefined) dbUpdates.payment_status = updates.paymentStatus;
    
    await DatabaseService.updateCalendarEvent(eventId, dbUpdates);
    console.log('[LifeCRM] Updated event:', eventId, 'with updates:', updates);
  };

  const deleteCalendarEvent = async (eventId: string) => {
    const updated = {
      ...data,
      calendarEvents: data.calendarEvents.filter((e) => e.id !== eventId),
    };
    setData(updated);
    saveMutation.mutate(updated);
    
    await DatabaseService.deleteCalendarEvent(eventId);
    console.log('[LifeCRM] Deleted event:', eventId);
  };

  const updateBill = async (billId: string, updates: Partial<Bill>) => {
    const updated = {
      ...data,
      bills: data.bills.map((b) => (b.id === billId ? { ...b, ...updates } : b)),
    };
    setData(updated);
    saveMutation.mutate(updated);
    
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.isPaid !== undefined) dbUpdates.is_paid = updates.isPaid;
    if (updates.isRecurring !== undefined) dbUpdates.is_recurring = updates.isRecurring;
    if (updates.frequency !== undefined) dbUpdates.frequency = updates.frequency;
    
    await DatabaseService.updateBill(billId, dbUpdates);
    console.log('[LifeCRM] Updated bill:', billId);
  };

  const deleteBill = async (billId: string) => {
    const updated = {
      ...data,
      bills: data.bills.filter((b) => b.id !== billId),
    };
    setData(updated);
    saveMutation.mutate(updated);
    
    await DatabaseService.deleteBill(billId);
    console.log('[LifeCRM] Deleted bill:', billId);
  };

  const addContact = async (contact: Omit<Relationship, 'id' | 'interactions' | 'meetings' | 'followUps' | 'interactionScore' | 'needsAttention'>) => {
    const newContact: Relationship = {
      ...contact,
      id: Date.now().toString(),
      interactions: [],
      meetings: [],
      followUps: [],
      interactionScore: 100,
      needsAttention: false,
    };
    const updated = { ...data, relationships: [...data.relationships, newContact] };
    setData(updated);
    saveMutation.mutate(updated);
    
    const userId = await DatabaseService.getCurrentUserId();
    if (userId) {
      await DatabaseService.createRelationship({
        user_id: userId,
        name: contact.name,
        avatar: contact.avatar,
        category: contact.category,
        last_interaction: contact.lastInteraction,
        last_interaction_date: contact.lastInteractionDate,
        interaction_score: 100,
        notes: contact.notes,
        upcoming_birthday: contact.upcomingBirthday,
        tags: contact.tags,
        phone: contact.phone,
        email: contact.email,
        company: contact.company,
        role: contact.role,
        needs_attention: false,
        attention_reason: undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['supabaseRelationships'] });
    }
    
    console.log('[LifeCRM] Added new contact:', newContact.name);
  };

  const updateContact = async (contactId: string, updates: Partial<Relationship>) => {
    const updated = {
      ...data,
      relationships: data.relationships.map((r) =>
        r.id === contactId ? { ...r, ...updates } : r
      ),
    };
    setData(updated);
    saveMutation.mutate(updated);
    
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.company !== undefined) dbUpdates.company = updates.company;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    
    await DatabaseService.updateRelationship(contactId, dbUpdates);
    console.log('[LifeCRM] Updated contact:', contactId);
  };

  const deleteContact = async (contactId: string) => {
    const updated = {
      ...data,
      relationships: data.relationships.filter((r) => r.id !== contactId),
    };
    setData(updated);
    saveMutation.mutate(updated);
    
    await DatabaseService.deleteRelationship(contactId);
    console.log('[LifeCRM] Deleted contact:', contactId);
  };

  const addInteraction = async (contactId: string, interaction: Omit<ContactInteraction, 'id'>, autoCompleteReminders = true) => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const newInteraction: ContactInteraction = {
      ...interaction,
      id: `i-${Date.now()}`,
      time: interaction.time || currentTime,
    };
    const updated = {
      ...data,
      relationships: data.relationships.map((r) => {
        if (r.id === contactId) {
          const daysSinceInteraction = Math.floor(
            (Date.now() - new Date(interaction.date).getTime()) / (1000 * 60 * 60 * 24)
          );
          const newScore = Math.min(100, r.interactionScore + 15);
          
          const updatedFollowUps = autoCompleteReminders 
            ? r.followUps.map((f) => {
                if (f.status !== 'completed') {
                  return { ...f, status: 'completed' as const };
                }
                return f;
              })
            : r.followUps;
          
          if (autoCompleteReminders && r.followUps.some(f => f.status !== 'completed')) {
            console.log('[LifeCRM] Auto-completed reminders for contact:', r.name);
          }
          
          return {
            ...r,
            interactions: [newInteraction, ...r.interactions],
            lastInteraction: daysSinceInteraction === 0 ? 'Today' : daysSinceInteraction === 1 ? 'Yesterday' : `${daysSinceInteraction} days ago`,
            lastInteractionDate: interaction.date,
            interactionScore: newScore,
            needsAttention: newScore < 50,
            followUps: updatedFollowUps,
          };
        }
        return r;
      }),
    };
    setData(updated);
    saveMutation.mutate(updated);
    
    await DatabaseService.createContactInteraction({
      relationship_id: contactId,
      type: interaction.type,
      date: interaction.date,
      time: interaction.time || currentTime,
      duration: interaction.duration,
      notes: interaction.notes,
      outcome: interaction.outcome,
    });
    
    console.log('[LifeCRM] Added interaction for contact:', contactId, 'at', currentTime);
  };

  const addMeeting = async (contactId: string, meeting: Omit<ContactMeeting, 'id' | 'linkedContactId'>) => {
    const newMeeting: ContactMeeting = {
      ...meeting,
      id: `m-${Date.now()}`,
      linkedContactId: contactId,
    };
    const updated = {
      ...data,
      relationships: data.relationships.map((r) =>
        r.id === contactId
          ? { ...r, meetings: [...r.meetings, newMeeting] }
          : r
      ),
    };
    setData(updated);
    saveMutation.mutate(updated);
    
    await DatabaseService.createContactMeeting({
      relationship_id: contactId,
      title: meeting.title,
      date: meeting.date,
      time: meeting.time,
      location: meeting.location,
      agenda: meeting.agenda,
      status: meeting.status,
      reminder_sent: meeting.reminderSent,
      expected_income: meeting.expectedIncome,
      income_type: meeting.incomeType,
      income_status: meeting.incomeStatus,
    });
    
    console.log('[LifeCRM] Added meeting for contact:', contactId, meeting.title, 'with income:', meeting.expectedIncome);
  };

  const updateMeeting = async (contactId: string, meetingId: string, updates: Partial<ContactMeeting>) => {
    const updated = {
      ...data,
      relationships: data.relationships.map((r) =>
        r.id === contactId
          ? {
              ...r,
              meetings: r.meetings.map((m) =>
                m.id === meetingId ? { ...m, ...updates } : m
              ),
            }
          : r
      ),
    };
    setData(updated);
    saveMutation.mutate(updated);
    
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    if (updates.time !== undefined) dbUpdates.time = updates.time;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.agenda !== undefined) dbUpdates.agenda = updates.agenda;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.expectedIncome !== undefined) dbUpdates.expected_income = updates.expectedIncome;
    if (updates.incomeType !== undefined) dbUpdates.income_type = updates.incomeType;
    if (updates.incomeStatus !== undefined) dbUpdates.income_status = updates.incomeStatus;
    
    await DatabaseService.updateContactMeeting(meetingId, dbUpdates);
    console.log('[LifeCRM] Updated meeting:', meetingId, 'with updates:', updates);
  };

  const deleteMeeting = async (contactId: string, meetingId: string) => {
    const updated = {
      ...data,
      relationships: data.relationships.map((r) =>
        r.id === contactId
          ? {
              ...r,
              meetings: r.meetings.filter((m) => m.id !== meetingId),
            }
          : r
      ),
    };
    setData(updated);
    saveMutation.mutate(updated);
    
    await DatabaseService.deleteContactMeeting(meetingId);
    console.log('[LifeCRM] Deleted meeting:', meetingId);
  };

  const deleteFollowUp = async (contactId: string, followUpId: string) => {
    const updated = {
      ...data,
      relationships: data.relationships.map((r) =>
        r.id === contactId
          ? {
              ...r,
              followUps: r.followUps.filter((f) => f.id !== followUpId),
            }
          : r
      ),
    };
    setData(updated);
    saveMutation.mutate(updated);
    
    await DatabaseService.deleteContactFollowUp(followUpId);
    console.log('[LifeCRM] Deleted follow-up:', followUpId);
  };

  const addFollowUp = async (contactId: string, followUp: Omit<ContactFollowUp, 'id' | 'linkedContactId'>) => {
    const newFollowUp: ContactFollowUp = {
      ...followUp,
      id: `f-${Date.now()}`,
      linkedContactId: contactId,
    };
    const updated = {
      ...data,
      relationships: data.relationships.map((r) =>
        r.id === contactId
          ? { ...r, followUps: [...r.followUps, newFollowUp] }
          : r
      ),
    };
    setData(updated);
    saveMutation.mutate(updated);
    
    await DatabaseService.createContactFollowUp({
      relationship_id: contactId,
      title: followUp.title,
      due_date: followUp.dueDate,
      priority: followUp.priority,
      status: followUp.status,
      notes: followUp.notes,
    });
    
    console.log('[LifeCRM] Added follow-up for contact:', contactId, followUp.title);
  };

  const completeFollowUp = async (contactId: string, followUpId: string) => {
    const updated = {
      ...data,
      relationships: data.relationships.map((r) =>
        r.id === contactId
          ? {
              ...r,
              followUps: r.followUps.map((f) =>
                f.id === followUpId ? { ...f, status: 'completed' as const } : f
              ),
            }
          : r
      ),
    };
    setData(updated);
    saveMutation.mutate(updated);
    
    await DatabaseService.updateContactFollowUp(followUpId, { status: 'completed' });
  };

  const contactsNeedingAttention = useMemo(() => {
    return data.relationships.filter((r) => r.needsAttention || r.interactionScore < 50);
  }, [data.relationships]);

  const upcomingMeetings = useMemo(() => {
    const today = new Date();
    const allMeetings: (ContactMeeting & { contactName: string; contactAvatar: string })[] = [];
    data.relationships.forEach((r) => {
      r.meetings
        .filter((m) => m.status === 'scheduled' && new Date(m.date) >= today)
        .forEach((m) => {
          allMeetings.push({ ...m, contactName: r.name, contactAvatar: r.avatar });
        });
    });
    return allMeetings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data.relationships]);

  const pendingFollowUps = useMemo(() => {
    const allFollowUps: (ContactFollowUp & { contactName: string; contactAvatar: string })[] = [];
    data.relationships.forEach((r) => {
      r.followUps
        .filter((f) => f.status !== 'completed')
        .forEach((f) => {
          allFollowUps.push({ ...f, contactName: r.name, contactAvatar: r.avatar });
        });
    });
    return allFollowUps.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [data.relationships]);

  const getContactById = (id: string) => {
    return data.relationships.find((r) => r.id === id);
  };

  const dismissSuggestion = (suggestionId: string) => {
    const updated = {
      ...data,
      wellnessSuggestions: data.wellnessSuggestions.map((s) =>
        s.id === suggestionId ? { ...s, isDismissed: true } : s
      ),
    };
    setData(updated);
    saveMutation.mutate(updated);
    console.log('[LifeCRM] Dismissed suggestion:', suggestionId);
  };

  const handleSuggestionAction = (suggestion: WellnessSuggestion, action: 'paid' | 'completed' | 'disregard') => {
    console.log('[LifeCRM] Suggestion action:', suggestion.title, action);
    
    if (action === 'disregard') {
      dismissSuggestion(suggestion.id);
      return;
    }

    if (suggestion.linkType === 'bill' && suggestion.linkedId) {
      if (action === 'paid') {
        markBillPaid(suggestion.linkedId);
        dismissSuggestion(suggestion.id);
        console.log('[LifeCRM] Marked bill as paid from suggestion:', suggestion.linkedId);
      }
    } else if (suggestion.linkType === 'event' && suggestion.linkedId) {
      if (action === 'completed') {
        toggleEventComplete(suggestion.linkedId);
        dismissSuggestion(suggestion.id);
        console.log('[LifeCRM] Marked event as completed from suggestion:', suggestion.linkedId);
      }
    }
  };

  const activeSuggestions = useMemo(() => {
    return data.wellnessSuggestions.filter((s) => !s.isDismissed);
  }, [data.wellnessSuggestions]);

  return {
    ...data,
    isLoading: query.isLoading || eventsQuery.isLoading || billsQuery.isLoading || relationshipsQuery.isLoading,
    todaysEvents,
    upcomingBills,
    totalDueSoon,
    relationshipAlerts,
    estimatedDailyEarnings,
    estimatedIncomeToday,
    estimatedIncomeThisWeek,
    estimatedIncomeThisMonth,
    incomeBreakdown,
    contactsNeedingAttention,
    upcomingMeetings,
    pendingFollowUps,
    activeSuggestions,
    addCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    addBill,
    updateBill,
    deleteBill,
    toggleEventComplete,
    markBillPaid,
    updateRelationship,
    addContact,
    updateContact,
    deleteContact,
    addInteraction,
    addMeeting,
    updateMeeting,
    addFollowUp,
    completeFollowUp,
    getContactById,
    dismissSuggestion,
    handleSuggestionAction,
    deleteMeeting,
    deleteFollowUp,
  };
});
