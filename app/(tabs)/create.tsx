import { Redirect } from 'expo-router';

// The "create post" address (links, the web app): go to the Feed and open
// the composer there, instead of showing a blank page.
export default function CreateScreen() {
  return <Redirect href={'/(tabs)/feed?compose=1' as any} />;
}
