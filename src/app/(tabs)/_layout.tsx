import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/TabBar';
import { useStore } from '@/store/useStore';

export default function TabsLayout() {
  const onboarded = useStore((s) => s.settings.onboarded);
  if (!onboarded) return <Redirect href="/onboarding" />;
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="habits" />
      <Tabs.Screen name="lessons" />
      <Tabs.Screen name="goals" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}
