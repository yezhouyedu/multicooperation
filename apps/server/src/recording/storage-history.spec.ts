import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { StorageService } from './storage.service';

describe('saved historical image scope', () => {
  it('restores the original image only for its participant and rejects traversal/external paths', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mc-history-test-'));
    try {
      const service = new StorageService(new ConfigService({ STORAGE_ROOT: directory }));
      const saved = await service.saveDataUrlAttachment({ dataUrl: 'data:image/png;base64,aGVsbG8=', sessionCode: 'TEST', participantId: 'a', requestId: 'r1', index: 0 });
      expect(await service.readSavedImage(saved!, 'TEST', 'a')).toBe('data:image/png;base64,aGVsbG8=');
      expect(await service.readSavedImage(saved!, 'TEST', 'b')).toBeNull();
      expect(await service.readSavedImage({ relativePath: '../../private.txt', mimeType: 'image/png' }, 'TEST', 'a')).toBeNull();
      expect(await service.readSavedImage({ relativePath: 'https://example.com/private.png', mimeType: 'image/png' }, 'TEST', 'a')).toBeNull();
    } finally {
      // Only the unique temp directory created by this test is removed.
      await rm(directory, { recursive: true, force: true });
    }
  });
});
