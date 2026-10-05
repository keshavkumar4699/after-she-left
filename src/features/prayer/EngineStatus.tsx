import { useEffect, useState } from 'react';

import { currentUser } from '@/services/firebase';
import { refreshNanoStatus, startNanoDownload, useOnDeviceAi } from '@/services/onDeviceAi';
import { Button, ListItem } from '@/ui';

/**
 * Settings → Daily prayer: where today's AI prayer is written (trial/Premium only).
 * Gemini Nano on the phone when it is ready; otherwise the cloud.
 */
export function PrayerEngineStatus() {
  const { status, error } = useOnDeviceAi();
  const [starting, setStarting] = useState(false);
  const signedIn = !!currentUser();
  const cloud = signedIn ? 'Until then, prayers are written in the cloud.' : 'Until then, prayers are composed on your phone.';

  useEffect(() => {
    if (status === 'unknown') refreshNanoStatus();
  }, [status]);

  if (status === 'unknown') {
    return <ListItem icon="cellphone-cog" title="Checking this phone…" chevron={false} />;
  }

  if (status === 'available') {
    return (
      <ListItem
        icon="cellphone-lock"
        title="On this phone (Gemini Nano)"
        subtitle="Private: nothing leaves your phone"
        chevron={false}
      />
    );
  }
  if (status === 'downloading') {
    return <ListItem icon="progress-download" title="Getting Gemini Nano ready…" subtitle={cloud} chevron={false} />;
  }
  if (status === 'downloadable') {
    return (
      <ListItem
        icon="cellphone-arrow-down"
        title="This phone can write prayers privately"
        subtitle={error ? `Download failed: ${error}` : 'Download Gemini Nano (Wi-Fi recommended)'}
        chevron={false}
        trailing={
          <Button
            label={error ? 'Retry' : 'Download'}
            size="sm"
            variant="tonal"
            loading={starting}
            onPress={() => {
              setStarting(true);
              startNanoDownload().finally(() => setStarting(false));
            }}
          />
        }
      />
    );
  }
  return (
    <ListItem
      icon="cloud-outline"
      title="In the cloud"
      subtitle={
        signedIn
          ? "This phone can't run Gemini Nano. Only a short summary is sent."
          : "This phone can't run Gemini Nano. Sign in to get AI prayers."
      }
      chevron={false}
    />
  );
}
