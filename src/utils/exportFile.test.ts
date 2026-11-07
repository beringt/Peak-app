jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-file-system', () => ({ Paths: { cache: 'cache/' }, File: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportFile } from './exportFile';

const file = { uri: '', exists: true, create: jest.fn(), write: jest.fn(), delete: jest.fn() };

beforeEach(() => {
  file.exists = true;
  jest.mocked(File).mockImplementation((...uris) => {
    file.uri = String(uris[0]) + String(uris[1]);
    return file as unknown as File;
  });
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined);
  file.write.mockResolvedValue(undefined);
  file.delete.mockResolvedValue(undefined);
});
afterEach(() => jest.resetAllMocks());

test('writes JSON to cache, shares it and removes the temporary file', async () => {
  expect(await exportFile('{"version":1}')).toBe('share-closed');
  expect(File).toHaveBeenCalledWith(Paths.cache, expect.stringMatching(/^peak-export-\d+\.json$/));
  expect(file.create).toHaveBeenCalledTimes(1);
  expect(file.write).toHaveBeenCalledWith('{"version":1}');
  expect(Sharing.shareAsync).toHaveBeenCalledWith(file.uri, expect.objectContaining({ mimeType: 'application/json', UTI: 'public.json' }));
  expect(file.delete).toHaveBeenCalledTimes(1);
});

test('unavailable sharing fails without creating a file', async () => {
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);
  await expect(exportFile('{}')).rejects.toThrow('unavailable');
  expect(File).not.toHaveBeenCalled();
});

test.each(['write', 'share'])('cleans up when %s fails', async (failure) => {
  if (failure === 'write') file.write.mockRejectedValueOnce(new Error('write'));
  else jest.mocked(Sharing.shareAsync).mockRejectedValueOnce(new Error('share'));
  await expect(exportFile('{}')).rejects.toThrow(failure);
  expect(file.delete).toHaveBeenCalledTimes(1);
});

test('does not attempt to delete a file that was never created', async () => {
  file.exists = false;
  file.create.mockImplementationOnce(() => { throw new Error('create'); });
  await expect(exportFile('{}')).rejects.toThrow('create');
  expect(file.delete).not.toHaveBeenCalled();
});

test('cleanup failure is reported instead of claiming complete success', async () => {
  file.delete.mockRejectedValueOnce(new Error('cleanup'));
  await expect(exportFile('{}')).rejects.toThrow('cleanup');
});
