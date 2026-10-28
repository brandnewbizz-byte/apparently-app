import React, { useState, useCallback } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

export type LocationType = 'home' | 'hotel' | 'airbnb' | 'coffee' | 'coworking';
export type TransportType = 'none' | 'chauffeur';
export type PaymentType = 'cash' | 'crypto' | 'card' | 'swap';
export type HelpType = 'va' | 'delivery' | 'errands' | 'other';

export interface ChauffeurDetails {
  pickupAddress: string;
  pickupZip: string;
  dropoffAddress: string;
  dropoffZip: string;
  pickupTime: string;
  roundTrip: boolean;
  notes: string;
}

export interface VADetails {
  hours: number;
  skills: string[];
  tasks: string;
  budget: string;
  deadline: string;
}

export interface CustomBlock {
  title: string;
  description: string;
  category: string;
  category_label: string;
  category_color: string;
  start_time: string;
  duration_minutes: number;
  location: string;
  priority: 'low' | 'medium' | 'high';
}

export interface ImportedJob {
  id: string;
  type: string;
  title: string | null;
  description: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  pickup_time: string | null;
  hours: string | null;
}

export interface PlanDetails {
  location_type: LocationType;
  transport: TransportType;
  chauffeur?: ChauffeurDetails;
  assistance: HelpType[];
  va_details?: VADetails;
  payment: PaymentType;
  custom_block?: CustomBlock;
  imported_job?: ImportedJob;
  notes?: string;
  selected_jobs?: string[];
  custom_blocks?: CustomBlock[];
  errands_details?: { description: string; location: string };
  delivery_details?: { pickupAddress: string; dropoffAddress: string; items: string };
  other_details?: { description: string };
}

export interface Plan {
  id: string;
  user_id: string;
  date: string;
  date_label?: string;
  location_type?: string;
  custom_location?: string;
  transport?: string;
  pickup_zip?: string;
  pickup_city?: string;
  pickup_state?: string;
  dropoff_zip?: string;
  dropoff_city?: string;
  dropoff_state?: string;
  plan?: PlanDetails;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at?: string;
}

export interface CreatePlanInput {
  date: string;
  date_label?: string;
  location_type: LocationType;
  custom_location?: string;
  transport: TransportType;
  pickup_zip?: string;
  pickup_city?: string;
  pickup_state?: string;
  dropoff_zip?: string;
  dropoff_city?: string;
  dropoff_state?: string;
  plan_details: PlanDetails;
  status?: 'pending' | 'active' | 'completed' | 'cancelled';
}

interface PlannerState {
  plans: Plan[];
  isLoading: boolean;
  createPlan: (input: CreatePlanInput) => Promise<Plan | null>;
  updatePlan: (id: string, updates: Partial<CreatePlanInput>) => Promise<Plan | null>;
  deletePlan: (id: string) => Promise<void>;
  getPlansByDate: (date: string) => Plan[];
  getPlanById: (id: string) => Plan | undefined;
  /** Mark a plan pending / active / completed / cancelled. */
  setPlanStatus: (id: string, status: Plan['status']) => Promise<boolean>;
  refetch: () => Promise<void>;
}

function mapRow(row: any): Plan {
  return {
    id: String(row.id),
    user_id: row.user_id,
    date: row.date,
    date_label: row.date_label ?? undefined,
    location_type: row.location_type ?? undefined,
    custom_location: row.custom_location ?? undefined,
    transport: row.transport ?? undefined,
    pickup_zip: row.pickup_zip ?? undefined,
    pickup_city: row.pickup_city ?? undefined,
    pickup_state: row.pickup_state ?? undefined,
    dropoff_zip: row.dropoff_zip ?? undefined,
    dropoff_city: row.dropoff_city ?? undefined,
    dropoff_state: row.dropoff_state ?? undefined,
    plan: row.plan ?? undefined,
    status: row.status || 'pending',
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  };
}

export const [PlannerProvider, usePlanner] = createContextHook<PlannerState>(() => {
  const queryClient = useQueryClient();
  const [plans, setPlans] = useState<Plan[]>([]);
  const { session, isLoading: authLoading } = useAuth();

  const plansQuery = useQuery({
    queryKey: ['plans', session?.user?.id],
    enabled: !!session?.user && !authLoading,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const userId = session?.user?.id;
      if (!userId) return [] as Plan[];
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true });
      if (error) {
        logger.warn('Planner', 'Fetch plans failed', { message: error.message });
        throw error;
      }
      return (data ?? []).map(mapRow);
    },
    staleTime: 1000 * 30,
  });

  React.useEffect(() => {
    if (plansQuery.data) setPlans(plansQuery.data);
  }, [plansQuery.data]);

  // Never show the previous account's plans after signing out / switching.
  React.useEffect(() => {
    if (!session?.user) setPlans([]);
  }, [session?.user]);

  const { mutateAsync: createPlanMutation } = useMutation({
    mutationFn: async (input: CreatePlanInput) => {
      const userId = session?.user?.id;
      if (!userId) throw new Error('You need to be signed in to save plans.');
      const payload = {
        user_id: userId,
        date: input.date,
        date_label: input.date_label || null,
        location_type: input.location_type,
        custom_location: input.custom_location || null,
        transport: input.transport,
        pickup_zip: input.pickup_zip || null,
        pickup_city: input.pickup_city || null,
        pickup_state: input.pickup_state || null,
        dropoff_zip: input.dropoff_zip || null,
        dropoff_city: input.dropoff_city || null,
        dropoff_state: input.dropoff_state || null,
        plan: input.plan_details,
        status: input.status || 'pending',
      };
      const { data, error } = await supabase.from('plans').insert(payload).select('*').single();
      if (error || !data) {
        logger.error('Planner', 'Create plan failed', { message: error?.message });
        throw error || new Error('Plan was not saved');
      }
      const created = mapRow(data);
      setPlans((prev) => [...prev, created]);
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });

  const { mutateAsync: updatePlanMutation } = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreatePlanInput> }) => {
      logger.info('Planner', 'Updating plan', { id, updates });

      const payload: any = { updated_at: new Date().toISOString() };
      if (updates.date !== undefined) payload.date = updates.date;
      if (updates.date_label !== undefined) payload.date_label = updates.date_label;
      if (updates.location_type !== undefined) payload.location_type = updates.location_type;
      if (updates.custom_location !== undefined) payload.custom_location = updates.custom_location;
      if (updates.transport !== undefined) payload.transport = updates.transport;
      if (updates.pickup_zip !== undefined) payload.pickup_zip = updates.pickup_zip;
      if (updates.dropoff_zip !== undefined) payload.dropoff_zip = updates.dropoff_zip;
      if (updates.plan_details !== undefined) payload.plan = updates.plan_details;
      if (updates.status !== undefined) payload.status = updates.status;

      const { data, error } = await supabase
        .from('plans')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        logger.error('Planner', 'Update error', { message: error.message });
        throw error;
      }

      const updated = mapRow(data);
      setPlans((prev) => prev.map((p) => (p.id === id ? updated : p)));
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });

  const { mutateAsync: deletePlanMutation } = useMutation({
    mutationFn: async (id: string) => {
      logger.info('Planner', 'Deleting plan', { id });

      const { error } = await supabase
        .from('plans')
        .delete()
        .eq('id', id);

      if (error) {
        logger.error('Planner', 'Delete error', { message: error.message });
        throw error;
      }
      setPlans((prev) => prev.filter((p) => p.id !== id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });

  const createPlan = useCallback(async (input: CreatePlanInput): Promise<Plan | null> => {
    try {
      const result = await createPlanMutation(input);
      return result;
    } catch (e) {
      logger.error('Planner', 'createPlan failed', { e });
      return null;
    }
  }, [createPlanMutation]);

  const updatePlan = useCallback(async (id: string, updates: Partial<CreatePlanInput>): Promise<Plan | null> => {
    try {
      const result = await updatePlanMutation({ id, updates });
      return result;
    } catch (e) {
      logger.error('Planner', 'updatePlan failed', { e });
      return null;
    }
  }, [updatePlanMutation]);

  const deletePlan = useCallback(async (id: string): Promise<void> => {
    await deletePlanMutation(id);
  }, [deletePlanMutation]);

  const setPlanStatus = useCallback(async (id: string, status: Plan['status']): Promise<boolean> => {
    // Optimistic so the check-off feels instant; rolled back on failure.
    const before = plans.find((p) => p.id === id);
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    const res = await updatePlan(id, { status });
    if (!res && before) setPlans((prev) => prev.map((p) => (p.id === id ? before : p)));
    return !!res;
  }, [plans, updatePlan]);

  const getPlansByDate = useCallback((date: string) => {
    return plans.filter(p => p.date === date);
  }, [plans]);

  const getPlanById = useCallback((id: string) => {
    return plans.find(p => p.id === id);
  }, [plans]);

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['plans'] });
  }, [queryClient]);

  return {
    plans,
    isLoading: plansQuery.isLoading,
    createPlan,
    updatePlan,
    deletePlan,
    getPlansByDate,
    getPlanById,
    setPlanStatus,
    refetch,
  };
});
