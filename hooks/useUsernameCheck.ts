import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usernameProblem } from '@/constants/app';

export type UsernameState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'same' | 'error';

/**
 * Live "is this username free?" check while someone types.
 * Usernames are stored lowercase, so an exact match on the lowercase value
 * is a case-insensitive check.
 */
export function useUsernameCheck(value: string, current?: string | null, myId?: string | null) {
  const [state, setState] = useState<UsernameState>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const u = value.trim().toLowerCase();
    if (!u) { setState('idle'); setMessage(''); return; }
    if (current && u === current.toLowerCase()) { setState('same'); setMessage(''); return; }
    const problem = usernameProblem(u);
    if (problem) { setState('invalid'); setMessage(problem); return; }
    setState('checking');
    setMessage('Checking…');
    let alive = true;
    const t = setTimeout(async () => {
      const { data, error } = await supabase.from('profiles').select('id').eq('username', u).limit(1);
      if (!alive) return;
      if (error) { setState('error'); setMessage("Couldn't check right now."); return; }
      const takenBy = (data || [])[0]?.id;
      if (takenBy && takenBy !== myId) { setState('taken'); setMessage(`@${u} is taken.`); }
      else { setState('available'); setMessage(`@${u} is available.`); }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [value, current, myId]);

  return { state, message, ok: state === 'available' || state === 'same' };
}
