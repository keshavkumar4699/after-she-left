import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { handleResult } from '@/components/Upsell';
import type { TimeOfDay } from '@/domain/types';
import { currentPosition, requestLocationPermissions } from '@/services/geofence';
import { CIRCUMSTANCE_ICONS } from '@/store/defaults';
import { useMistakes } from '@/store/hooks';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/theme/ThemeProvider';
import { SWATCHES } from '@/theme/tokens';
import {
  Banner,
  Button,
  Card,
  Chip,
  Dialog,
  FormSection,
  Icon,
  ListItem,
  PressableScale,
  Screen,
  SwatchPicker,
  Switch,
  Text,
  TextField,
  TimeField,
  WeekdayPicker,
  toast,
  type IconName,
} from '@/ui';

const RADII = [100, 200, 300, 500, 1000];
const COOLDOWNS = [60, 120, 240, 480];

export default function CircumstanceEditor() {
  const { colors, radius } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const existing = useStore((s) => (isNew ? undefined : s.circumstances[id]));
  const addCircumstance = useStore((s) => s.addCircumstance);
  const updateCircumstance = useStore((s) => s.updateCircumstance);
  const deleteCircumstance = useStore((s) => s.deleteCircumstance);
  const mistakes = useMistakes();

  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState<string>(existing?.icon ?? CIRCUMSTANCE_ICONS[0]);
  const [color, setColor] = useState(existing?.color ?? SWATCHES[1]);
  const [scheduleOn, setScheduleOn] = useState(!!existing?.schedule);
  const [weekdays, setWeekdays] = useState<number[]>(existing?.schedule?.weekdays ?? []);
  const [time, setTime] = useState<TimeOfDay | null>(existing?.schedule?.time ?? { hour: 22, minute: 0 });
  const [locationOn, setLocationOn] = useState(!!existing?.location);
  const [coords, setCoords] = useState(existing?.location ? { latitude: existing.location.latitude, longitude: existing.location.longitude } : null);
  const [label, setLabel] = useState(existing?.location?.label ?? '');
  const [radiusM, setRadiusM] = useState(existing?.location?.radiusM ?? 200);
  const [onEnter, setOnEnter] = useState(existing?.location?.notifyOnEnter ?? true);
  const [onExit, setOnExit] = useState(existing?.location?.notifyOnExit ?? false);
  const [cooldown, setCooldown] = useState(existing?.cooldownMin ?? 120);
  const [disclosure, setDisclosure] = useState(false);
  const [locating, setLocating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const linked = mistakes.filter((m) => !isNew && m.circumstanceIds.includes(id));

  const captureLocation = async () => {
    setLocating(true);
    try {
      const pos = await currentPosition();
      if (pos) {
        setCoords(pos);
        toast('Location saved', { icon: 'map-marker-check-outline' });
      } else toast('Could not get your location. Check location permission.', { icon: 'map-marker-off-outline' });
    } finally {
      setLocating(false);
    }
  };

  const save = () => {
    if (name.trim().length < 2) {
      setError('Give it a name you will recognise.');
      return;
    }
    const data = {
      name: name.trim(),
      icon,
      color,
      schedule: scheduleOn && time ? { weekdays, time } : null,
      location:
        locationOn && coords
          ? { ...coords, radiusM, label: label.trim(), notifyOnEnter: onEnter, notifyOnExit: onExit }
          : null,
      cooldownMin: cooldown,
    };
    const result = isNew ? addCircumstance(data) : updateCircumstance(id, data);
    if (!handleResult(result)) return;
    toast(isNew ? 'Circumstance added' : 'Saved', { icon: 'check' });
    router.back();
  };

  return (
    <Screen
      back
      title={isNew ? 'New circumstance' : 'Edit circumstance'}
      headerCompact
      footer={<Button label="Save" icon="check" fullWidth onPress={save} />}>
      <FormSection title="What is the moment?" description="A situation, a time of day, a place, or a feeling.">
        <TextField label="Name" placeholder="e.g. Late night alone" value={name} onChangeText={setName} error={error} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CIRCUMSTANCE_ICONS.map((i) => (
            <PressableScale
              key={i}
              onPress={() => setIcon(i)}
              accessibilityRole="radio"
              accessibilityState={{ checked: icon === i }}
              accessibilityLabel={i.replace(/-/g, ' ')}
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: icon === i ? colors.primarySoft : colors.surfaceSunken,
                borderWidth: 1,
                borderColor: icon === i ? colors.primary : colors.border,
              }}>
              <Icon name={i as IconName} size={22} color={icon === i ? colors.primaryStrong : colors.textMuted} />
            </PressableScale>
          ))}
        </View>
        <SwatchPicker colors={SWATCHES} value={color} onChange={setColor} />
      </FormSection>

      <FormSection title="Remind me at a time">
        <ListItem
          icon="clock-outline"
          title="Scheduled reminder"
          subtitle="e.g. every night at 10:30 PM, or Friday evenings"
          trailing={<Switch value={scheduleOn} onChange={setScheduleOn} label="Scheduled reminder" />}
          chevron={false}
        />
        {scheduleOn ? (
          <Card variant="sunken">
            <View style={{ gap: 12 }}>
              <Text variant="label" tone="muted">
                Days (none selected = every day)
              </Text>
              <WeekdayPicker value={weekdays} onChange={setWeekdays} />
              <TimeField label="Time" value={time} onChange={setTime} />
            </View>
          </Card>
        ) : null}
      </FormSection>

      <FormSection title="Remind me at a place">
        <ListItem
          icon="map-marker-radius-outline"
          title="Location reminder"
          subtitle="When you arrive at or leave a place"
          trailing={
            <Switch
              value={locationOn}
              onChange={(v) => {
                if (v && Platform.OS !== 'web') setDisclosure(true);
                else setLocationOn(v);
              }}
              label="Location reminder"
            />
          }
          chevron={false}
        />
        {locationOn ? (
          <Card variant="sunken">
            <View style={{ gap: 12 }}>
              {coords ? (
                <Banner
                  tone="primary"
                  icon="map-marker-check-outline"
                  title="Place saved"
                  message={`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`}
                />
              ) : null}
              <Button label={coords ? 'Use my current location again' : 'Use my current location'} icon="crosshairs-gps" variant="tonal" loading={locating} onPress={captureLocation} />
              <TextField label="Place name" placeholder="e.g. The mall, Her street" value={label} onChangeText={setLabel} />
              <Text variant="label" tone="muted">
                Radius
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {RADII.map((r) => (
                  <Chip key={r} label={r >= 1000 ? `${r / 1000} km` : `${r} m`} selected={radiusM === r} onPress={() => setRadiusM(r)} />
                ))}
              </View>
              <ListItem title="When I arrive" chevron={false} trailing={<Switch value={onEnter} onChange={setOnEnter} label="When I arrive" />} />
              <ListItem title="When I leave" chevron={false} trailing={<Switch value={onExit} onChange={setOnExit} label="When I leave" />} />
            </View>
          </Card>
        ) : null}
      </FormSection>

      {scheduleOn || locationOn ? (
        <FormSection title="Not too often" description="Minimum time between two reminders for this place.">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {COOLDOWNS.map((m) => (
              <Chip key={m} label={`${m / 60} h`} selected={cooldown === m} onPress={() => setCooldown(m)} />
            ))}
          </View>
        </FormSection>
      ) : null}

      {!isNew ? (
        <FormSection title="Linked lessons">
          {linked.length ? (
            linked.map((m) => <ListItem key={m.id} icon="lightbulb-outline" title={m.title} onPress={() => router.push(`/mistake/${m.id}`)} />)
          ) : (
            <Text variant="body" tone="muted">
              No lessons linked yet. Link them when you record a mistake.
            </Text>
          )}
          <Button label="Delete circumstance" icon="delete-outline" variant="danger" onPress={() => setConfirmDelete(true)} />
        </FormSection>
      ) : null}

      <Dialog
        visible={disclosure}
        onClose={() => setDisclosure(false)}
        icon="map-marker-radius-outline"
        tone="primary"
        title="Allow location in the background?"
        message="After She Left uses your location only to show a lesson when you arrive at or leave the places you choose, even when the app is closed. Your location never leaves your phone."
        confirmLabel="Continue"
        cancelLabel="Not now"
        onConfirm={async () => {
          const perms = await requestLocationPermissions();
          if (!perms.foreground) {
            toast('Location permission is needed for place reminders.', { icon: 'map-marker-off-outline' });
            return;
          }
          if (!perms.background) toast('Allow “All the time” in settings so reminders work when the app is closed.', { icon: 'information-outline' });
          setLocationOn(true);
          if (!coords) captureLocation();
        }}
      />
      <Dialog
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        icon="delete-outline"
        tone="danger"
        title="Delete this circumstance?"
        message="Its reminders stop and it is unlinked from your lessons."
        confirmLabel="Delete"
        destructive
        cancelLabel="Cancel"
        onConfirm={() => {
          deleteCircumstance(id);
          router.back();
        }}
      />
    </Screen>
  );
}
