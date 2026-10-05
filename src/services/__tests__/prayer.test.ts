import { DAY_MS } from '@/domain/entitlements';
import { buildDemo } from '@/store/demo';
import { useStore } from '@/store/useStore';
import * as nano from '../../../modules/gemini-nano';
import * as firebase from '../firebase';
import { useOnDeviceAi } from '../onDeviceAi';
import { ensureTodayPrayer } from '../prayer';

jest.mock('../firebase', () => ({ callFunction: jest.fn(), currentUser: jest.fn() }));
jest.mock('../../../modules/gemini-nano', () => ({
  isNanoModuleLinked: jest.fn(() => true),
  checkNanoStatus: jest.fn(),
  downloadNano: jest.fn(),
  generateWithNano: jest.fn(),
}));

const mocked = {
  checkNanoStatus: nano.checkNanoStatus as jest.Mock,
  generateWithNano: nano.generateWithNano as jest.Mock,
  callFunction: firebase.callFunction as jest.Mock,
  currentUser: firebase.currentUser as jest.Mock,
};

const NANO_TEXT = `Steady Hands

Today I choose the person I am becoming. The loneliness is real, and I let it pass without obeying it.

When the night feels long, I call my brother instead of reaching backwards.

I show up for the gym today, even if only for two minutes.`;

const CLOUD = {
  title: 'Written in the cloud',
  text: 'Today I keep my promises.\n\nI call a friend when the night is long.',
  purposeLine: 'Grow quietly.',
  dontDoToday: ["Don't text her"],
  nudges: ['Shoes on', 'One page', 'Ten breaths'],
  theme: 'resist',
};

const endTrial = () => useStore.getState().setPlan({ tier: 'trial', trialEndsAt: Date.now() - DAY_MS, premiumUntil: null });
const usage = () => useStore.getState().usage;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  useStore.getState().resetAll();
  useStore.getState().loadDemo(buildDemo());
  useStore.getState().setPlan({ tier: 'trial', trialEndsAt: Date.now() + 5 * DAY_MS, premiumUntil: null });
  useStore.getState().updateSettings({ aiPrayer: true });
  useOnDeviceAi.setState({ status: 'unknown', error: null });
  mocked.checkNanoStatus.mockResolvedValue('available');
  mocked.generateWithNano.mockResolvedValue(NANO_TEXT);
  mocked.currentUser.mockReturnValue({ uid: 'u1' });
  mocked.callFunction.mockResolvedValue(CLOUD);
});

afterEach(() => {
  (console.warn as jest.Mock).mockRestore();
});

describe('ensureTodayPrayer routing', () => {
  it('free users get the on-phone composer and never touch Gemini Nano or the cloud', async () => {
    endTrial();
    const { prayer, fallbackReason } = await ensureTodayPrayer();
    expect(prayer.source).toBe('template');
    expect(fallbackReason).toBe('plan');
    expect(mocked.checkNanoStatus).not.toHaveBeenCalled();
    expect(mocked.generateWithNano).not.toHaveBeenCalled();
    expect(mocked.callFunction).not.toHaveBeenCalled();
  });

  it('free users can still re-compose for a new mood', async () => {
    endTrial();
    await ensureTodayPrayer();
    const { prayer } = await ensureTodayPrayer({ regenerate: true, mood: 'anxious' });
    expect(prayer.source).toBe('template');
    expect(prayer.mood).toBe('anxious');
    expect(prayer.regenerations).toBe(1);
  });

  it('trial/Premium on a Gemini Nano phone writes on the device, free of quota', async () => {
    const { prayer } = await ensureTodayPrayer();
    expect(prayer.source).toBe('on-device');
    expect(prayer.title).toBe('Steady Hands');
    expect(prayer.text.startsWith('Today I choose the person I am becoming.')).toBe(true);
    // Purpose, "not today" and nudges come from the deterministic composer.
    expect(prayer.purposeLine.length).toBeGreaterThan(0);
    expect(prayer.dontDoToday.length).toBeGreaterThan(0);
    expect(prayer.nudges).toHaveLength(3);
    expect(mocked.callFunction).not.toHaveBeenCalled();
    expect(usage().aiPrayersThisWeek).toBe(0);

    const [prompt, options] = mocked.generateWithNano.mock.calls[0];
    expect(prompt).toContain('Line 1: a title');
    expect(options).toEqual({ temperature: 0.7, topK: 16, maxOutputTokens: 400 });
  });

  it('on-device rewrites need no cloud rewrites left', async () => {
    useStore.getState().recordAiUse(true);
    useStore.getState().recordAiUse(true);
    expect(useStore.getState().aiAllowance(true).ok).toBe(false);
    const { prayer } = await ensureTodayPrayer({ regenerate: true });
    expect(prayer.source).toBe('on-device');
    expect(prayer.regenerations).toBe(1);
  });

  it('uses the cloud model on phones without Gemini Nano and counts the quota', async () => {
    mocked.checkNanoStatus.mockResolvedValue('unavailable');
    const { prayer } = await ensureTodayPrayer();
    expect(prayer.source).toBe('ai');
    expect(prayer.title).toBe('Written in the cloud');
    expect(mocked.generateWithNano).not.toHaveBeenCalled();
    expect(mocked.callFunction).toHaveBeenCalledWith('generateDailyPrayer', expect.objectContaining({ regenerate: false }));
    expect(usage().aiPrayersThisWeek).toBe(1);
  });

  it('falls back to the cloud when Gemini Nano fails or writes something unusable', async () => {
    mocked.generateWithNano.mockRejectedValueOnce(new Error('BUSY'));
    expect((await ensureTodayPrayer()).prayer.source).toBe('ai');

    mocked.generateWithNano.mockResolvedValueOnce("I'm sorry, as an AI I can't help with that.");
    expect((await ensureTodayPrayer({ regenerate: true })).prayer.source).toBe('ai');
  });

  it('falls back to the template when every AI engine fails', async () => {
    mocked.generateWithNano.mockRejectedValue(new Error('BUSY'));
    mocked.callFunction.mockRejectedValue(new Error('unavailable'));
    const { prayer, fallbackReason } = await ensureTodayPrayer();
    expect(prayer.source).toBe('template');
    expect(fallbackReason).toBe('error');
  });

  it('rejects malformed cloud output', async () => {
    mocked.checkNanoStatus.mockResolvedValue('unavailable');
    mocked.callFunction.mockResolvedValue({ title: 'x' });
    const { prayer, fallbackReason } = await ensureTodayPrayer();
    expect(prayer.source).toBe('template');
    expect(fallbackReason).toBe('error');
    expect(usage().aiPrayersThisWeek).toBe(0);
  });

  it('explains why the template was used', async () => {
    mocked.checkNanoStatus.mockResolvedValue('unavailable');
    mocked.currentUser.mockReturnValue(null);
    expect((await ensureTodayPrayer()).fallbackReason).toBe('not-signed-in');

    useOnDeviceAi.setState({ status: 'unknown' });
    useStore.getState().updateSettings({ aiPrayer: false });
    const off = await ensureTodayPrayer({ regenerate: true });
    expect(off.prayer.source).toBe('template');
    expect(off.fallbackReason).toBe('disabled');
  });

  it('a slow status check never blocks the prayer', async () => {
    jest.useFakeTimers();
    try {
      mocked.checkNanoStatus.mockReturnValue(new Promise(() => {}));
      const pending = ensureTodayPrayer();
      await jest.advanceTimersByTimeAsync(3_100);
      const { prayer } = await pending;
      expect(prayer.source).toBe('ai');
      // The timeout is not remembered: the next prayer asks AICore again.
      expect(useOnDeviceAi.getState().status).toBe('unknown');
    } finally {
      jest.useRealTimers();
    }
  });

  it('concurrent first calls share one generation', async () => {
    const [a, b] = await Promise.all([ensureTodayPrayer(), ensureTodayPrayer()]);
    expect(a.prayer).toBe(b.prayer);
    expect(mocked.generateWithNano).toHaveBeenCalledTimes(1);
    // Once saved, it is returned without generating again.
    await ensureTodayPrayer();
    expect(mocked.generateWithNano).toHaveBeenCalledTimes(1);
  });
});
