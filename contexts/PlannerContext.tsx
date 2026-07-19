import React, { useState, useCallback } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

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
}

interface PlannerState {
  plans: Plan[];
  isLoading: boolean;
  createPlan: (input: CreatePlanInput) => Promise<Plan | null>;
  updatePlan: (id: string, updates: Partial<CreatePlanInput>) => Promise<Plan | null>;
  deletePlan: (id: string) => Promise<void>;
  getPlansByDate: (date: string) => Plan[];
  getPlanById: (id: string) => Plan | undefined;
  refetch: () => void;
}

export const [PlannerProvider, usePlanner] = createContextHook<PlannerState>(() => {
  const queryClient = useQueryClient();
  const [plans, setPlans] = useState<Plan[]>([]);

  const plansQuery = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      console.log('[Planner] Fetching plans...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[Planner] No user logged in');
        return [] as Plan[];
      }

      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Planner] Error fetching plans:', error.message);
        return [] as Plan[];
      }

      console.log('[Planner] Fetched plans:', data?.length ?? 0);
      
      const mapped: Plan[] = (data ?? []).map((row: any) => ({
        id: String(row.id),
        user_id: row.user_id,
        date: row.date,
        date_label: row.date_label,
        location_type: row.location_type,
        custom_location: row.custom_location,
        transport: row.transport,
        pickup_zip: row.pickup_zip,
        pickup_city: row.pickup_city,
        pickup_state: row.pickup_state,
        dropoff_zip: row.dropoff_zip,
        dropoff_city: row.dropoff_city,
        dropoff_state: row.dropoff_state,
        plan: row.plan,
        status: row.status || 'pending',
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      return mapped;
    },
    staleTime: 1000 * 30,
  });

  React.useEffect(() => {
    if (plansQuery.data) {
      setPlans(plansQuery.data);
    }
  }, [plansQuery.data]);

  const { mutateAsync: createPlanMutation } = useMutation({
    mutationFn: async (input: CreatePlanInput) => {
      console.log('[Planner] Creating plan:', input);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not logged in');
      }

      const payload = {
        user_id: user.id,
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
        status: 'pending',
      };

      console.log('[Planner] Insert payload:', JSON.stringify(payload, null, 2));

      const { data, error } = await supabase
        .from('plans')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        console.error('[Planner] Create error:', error.message, error);
        throw error;
      }

      console.log('[Planner] Created plan:', data);
      return data as Plan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });

  const { mutateAsync: updatePlanMutation } = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreatePlanInput> }) => {
      console.log('[Planner] Updating plan:', id, updates);

      const payload: any = {};
      if (updates.date) payload.date = updates.date;
      if (updates.date_label) payload.date_label = updates.date_label;
      if (updates.location_type) payload.location_type = updates.location_type;
      if (updates.custom_location) payload.custom_location = updates.custom_location;
      if (updates.transport) payload.transport = updates.transport;
      if (updates.pickup_zip) payload.pickup_zip = updates.pickup_zip;
      if (updates.dropoff_zip) payload.dropoff_zip = updates.dropoff_zip;
      if (updates.plan_details) payload.plan = updates.plan_details;

      const { data, error } = await supabase
        .from('plans')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('[Planner] Update error:', error.message);
        throw error;
      }

      console.log('[Planner] Updated plan:', data);
      return data as Plan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });

  const { mutateAsync: deletePlanMutation } = useMutation({
    mutationFn: async (id: string) => {
      console.log('[Planner] Deleting plan:', id);

      const { error } = await supabase
        .from('plans')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[Planner] Delete error:', error.message);
        throw error;
      }
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
      console.error('[Planner] createPlan failed:', e);
      return null;
    }
  }, [createPlanMutation]);

  const updatePlan = useCallback(async (id: string, updates: Partial<CreatePlanInput>): Promise<Plan | null> => {
    try {
      const result = await updatePlanMutation({ id, updates });
      return result;
    } catch (e) {
      console.error('[Planner] updatePlan failed:', e);
      return null;
    }
  }, [updatePlanMutation]);

  const deletePlan = useCallback(async (id: string): Promise<void> => {
    await deletePlanMutation(id);
  }, [deletePlanMutation]);

  const getPlansByDate = useCallback((date: string) => {
    return plans.filter(p => p.date === date);
  }, [plans]);

  const getPlanById = useCallback((id: string) => {
    return plans.find(p => p.id === id);
  }, [plans]);

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['plans'] });
  }, [queryClient]);

  return {
    plans,
    isLoading: plansQuery.isLoading,
    createPlan,
    updatePlan,
    deletePlan,
    getPlansByDate,
    getPlanById,
    refetch,
  };
});
