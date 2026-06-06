import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, createWriteStream } from 'fs';
import { cp, mkdir, readdir, readFile, stat, writeFile } from 'fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'path';

type ZipEntry = {
  relativePath: string;
  data: Buffer;
  crc32: number;
  offset: number;
};

@Injectable()
export class StorageService {
  readonly root: string;
  readonly exportsRoot: string;
  readonly attachmentsRoot: string;

  constructor(configService: ConfigService) {
    this.root = resolve(process.cwd(), configService.get<string>('EXPORT_STORAGE_ROOT') ?? 'storage');
    this.exportsRoot = resolve(this.root, 'exports');
    this.attachmentsRoot = resolve(this.root, 'attachments');
  }

  async ensureRoots() {
    await mkdir(this.exportsRoot, { recursive: true });
    await mkdir(this.attachmentsRoot, { recursive: true });
  }

  async writeJson(filePath: string, value: unknown) {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  }

  async writeJsonl(filePath: string, rows: unknown[]) {
    await mkdir(dirname(filePath), { recursive: true });
    const content = rows.map((row) => JSON.stringify(row)).join('\n');
    await writeFile(filePath, content ? `${content}\n` : '', 'utf8');
  }

  async copyIfExists(sourcePath: string, targetPath: string) {
    await mkdir(dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, { force: true });
  }

  async saveDataUrlAttachment(input: {
    dataUrl: string;
    sessionCode: string;
    participantId: string | null;
    requestId: string;
    index: number;
  }) {
    const match = input.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    const mimeType = match[1];
    const ext = this.extensionForMime(mimeType);
    const participantDir = input.participantId ?? 'unknown-participant';
    const stamp = new Date().toISOString().replace(/[-:.]/g, '').replace('T', 'T').slice(0, 15);
    const imageRef = `img_${stamp}_${input.requestId}_${input.index}`;
    const relativePath = join(
      'sessions',
      input.sessionCode,
      'participants',
      participantDir,
      'attachments',
      'images',
      `${imageRef}.${ext}`,
    );
    const absolutePath = resolve(this.attachmentsRoot, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, Buffer.from(match[2], 'base64'));
    return {
      type: 'image',
      imageRef,
      relativePath: relativePath.split(sep).join('/'),
      absolutePath,
      mimeType,
      sizeBytes: Buffer.byteLength(match[2], 'base64'),
    };
  }

  async createZipFromDirectory(sourceDir: string, archivePath: string) {
    await mkdir(dirname(archivePath), { recursive: true });
    const files = await this.listFiles(sourceDir);
    const output = createWriteStream(archivePath);
    const entries: ZipEntry[] = [];
    let offset = 0;

    for (const filePath of files) {
      const data = await readFile(filePath);
      const relativePath = relative(sourceDir, filePath).split(sep).join('/');
      const crc32 = computeCrc32(data);
      const localHeader = this.buildLocalFileHeader(relativePath, data.length, crc32);
      output.write(localHeader);
      output.write(data);
      entries.push({ relativePath, data, crc32, offset });
      offset += localHeader.length + data.length;
    }

    const centralStart = offset;
    for (const entry of entries) {
      const header = this.buildCentralDirectoryHeader(entry.relativePath, entry.data.length, entry.crc32, entry.offset);
      output.write(header);
      offset += header.length;
    }
    const centralSize = offset - centralStart;
    output.write(this.buildEndOfCentralDirectory(entries.length, centralSize, centralStart));

    await new Promise<void>((resolvePromise, reject) => {
      output.on('finish', resolvePromise);
      output.on('error', reject);
      output.end();
    });
  }

  private async listFiles(root: string) {
    const result: string[] = [];
    const walk = async (dir: string) => {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          result.push(fullPath);
        }
      }
    };
    await walk(root);
    return result.sort();
  }

  private extensionForMime(mimeType: string) {
    if (mimeType === 'image/jpeg') return 'jpg';
    if (mimeType === 'image/webp') return 'webp';
    if (mimeType === 'image/gif') return 'gif';
    return 'png';
  }

  private buildLocalFileHeader(filename: string, size: number, crc32: number) {
    const name = Buffer.from(filename, 'utf8');
    const buffer = Buffer.alloc(30 + name.length);
    buffer.writeUInt32LE(0x04034b50, 0);
    buffer.writeUInt16LE(20, 4);
    buffer.writeUInt16LE(0x0800, 6);
    buffer.writeUInt16LE(0, 8);
    buffer.writeUInt16LE(0, 10);
    buffer.writeUInt16LE(0, 12);
    buffer.writeUInt32LE(crc32, 14);
    buffer.writeUInt32LE(size, 18);
    buffer.writeUInt32LE(size, 22);
    buffer.writeUInt16LE(name.length, 26);
    buffer.writeUInt16LE(0, 28);
    name.copy(buffer, 30);
    return buffer;
  }

  private buildCentralDirectoryHeader(filename: string, size: number, crc32: number, localOffset: number) {
    const name = Buffer.from(filename, 'utf8');
    const buffer = Buffer.alloc(46 + name.length);
    buffer.writeUInt32LE(0x02014b50, 0);
    buffer.writeUInt16LE(20, 4);
    buffer.writeUInt16LE(20, 6);
    buffer.writeUInt16LE(0x0800, 8);
    buffer.writeUInt16LE(0, 10);
    buffer.writeUInt16LE(0, 12);
    buffer.writeUInt16LE(0, 14);
    buffer.writeUInt32LE(crc32, 16);
    buffer.writeUInt32LE(size, 20);
    buffer.writeUInt32LE(size, 24);
    buffer.writeUInt16LE(name.length, 28);
    buffer.writeUInt16LE(0, 30);
    buffer.writeUInt16LE(0, 32);
    buffer.writeUInt16LE(0, 34);
    buffer.writeUInt16LE(0, 36);
    buffer.writeUInt32LE(0, 38);
    buffer.writeUInt32LE(localOffset, 42);
    name.copy(buffer, 46);
    return buffer;
  }

  private buildEndOfCentralDirectory(entryCount: number, centralSize: number, centralOffset: number) {
    const buffer = Buffer.alloc(22);
    buffer.writeUInt32LE(0x06054b50, 0);
    buffer.writeUInt16LE(0, 4);
    buffer.writeUInt16LE(0, 6);
    buffer.writeUInt16LE(entryCount, 8);
    buffer.writeUInt16LE(entryCount, 10);
    buffer.writeUInt32LE(centralSize, 12);
    buffer.writeUInt32LE(centralOffset, 16);
    buffer.writeUInt16LE(0, 20);
    return buffer;
  }
}

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function computeCrc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
