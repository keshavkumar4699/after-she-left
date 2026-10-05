import * as nano from '../../../modules/gemini-nano';
import { getNanoStatus, prepareOnDeviceAi, startNanoDownload, useOnDeviceAi } from '../onDeviceAi';

jest.mock('../../../modules/gemini-nano', () => ({
  isNanoModuleLinked: jest.fn(() => true),
  checkNanoStatus: jest.fn(),
  downloadNano: jest.fn(),
  generateWithNano: jest.fn(),
}));

const mocked = {
  isNanoModuleLinked: nano.isNanoModuleLinked as jest.Mock,
  checkNanoStatus: nano.checkNanoStatus as jest.Mock,
  downloadNano: nano.downloadNano as jest.Mock,
};

beforeEach(() => {
  jest.clearAllMocks();
  mocked.isNanoModuleLinked.mockReturnValue(true);
  useOnDeviceAi.setState({ status: 'unknown', error: null });
});

describe('on-device AI preparation', () => {
  it('marks phones without the native module (web, iOS, Expo Go) as unavailable', async () => {
    mocked.isNanoModuleLinked.mockReturnValue(false);
    await prepareOnDeviceAi();
    expect(useOnDeviceAi.getState().status).toBe('unavailable');
    expect(mocked.checkNanoStatus).not.toHaveBeenCalled();
  });

  it('downloads the model in the background when the phone supports it', async () => {
    mocked.checkNanoStatus.mockResolvedValue('downloadable');
    let finish: (s: string) => void = () => {};
    mocked.downloadNano.mockReturnValue(new Promise((r) => (finish = r)));
    await prepareOnDeviceAi();
    expect(mocked.downloadNano).toHaveBeenCalledTimes(1);
    expect(useOnDeviceAi.getState().status).toBe('downloading');

    // A second caller joins the same download.
    const joined = startNanoDownload();
    expect(mocked.downloadNano).toHaveBeenCalledTimes(1);
    finish('available');
    await expect(joined).resolves.toBe('available');
    expect(useOnDeviceAi.getState().status).toBe('available');
    await expect(getNanoStatus()).resolves.toBe('available');
  });

  it('records a failed download so Settings can offer a retry', async () => {
    mocked.downloadNano.mockRejectedValue(new Error('NOT_ENOUGH_DISK_SPACE'));
    await expect(startNanoDownload()).resolves.toBe('downloadable');
    expect(useOnDeviceAi.getState()).toEqual({ status: 'downloadable', error: 'NOT_ENOUGH_DISK_SPACE' });
  });

  it('does nothing more on phones that cannot run Gemini Nano', async () => {
    mocked.checkNanoStatus.mockResolvedValue('unavailable');
    await prepareOnDeviceAi();
    expect(mocked.downloadNano).not.toHaveBeenCalled();
    expect(useOnDeviceAi.getState().status).toBe('unavailable');
  });
});
