import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useCreatePost } from '@/contexts/CreatePostContext';

// The "create post" route. The tab bar's centre button opens the composer
// directly; anything that lands on this address (a link, the web app) opens
// the same composer over the Feed instead of showing a blank page.
export default function CreateScreen() {
  const router = useRouter();
  const { openCreate } = useCreatePost();
  useEffect(() => {
    openCreate();
    router.replace('/(tabs)/feed' as any);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
