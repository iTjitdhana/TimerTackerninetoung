import { BadRequestException, Injectable } from "@nestjs/common";
import { existsSync } from "fs";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import * as path from "path";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_BYTES = 2 * 1024 * 1024;

@Injectable()
export class ProfileAvatarService {
  private readonly storageDir: string;

  constructor() {
    this.storageDir =
      process.env.AVATAR_STORAGE_DIR ??
      path.join(process.cwd(), "data", "avatars");
  }

  private safeFilename(employeeId: string): string {
    return employeeId.replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  private async ensureStorageDir(): Promise<void> {
    await mkdir(this.storageDir, { recursive: true });
  }

  hasAvatar(employeeId: string): boolean {
    return this.findExistingAvatar(employeeId) !== null;
  }

  private findExistingAvatar(
    employeeId: string,
  ): { filePath: string; mimeType: string } | null {
    const base = this.safeFilename(employeeId);
    for (const [mimeType, ext] of Object.entries(MIME_TO_EXT)) {
      const filePath = path.join(this.storageDir, `${base}.${ext}`);
      if (existsSync(filePath)) {
        return { filePath, mimeType };
      }
    }
    return null;
  }

  async getAvatarFile(
    employeeId: string,
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const found = this.findExistingAvatar(employeeId);
    if (!found) return null;
    const buffer = await readFile(found.filePath);
    return { buffer, mimeType: found.mimeType };
  }

  async saveAvatar(
    employeeId: string,
    imageData: string,
    contentType?: string,
  ): Promise<void> {
    const { buffer, mimeType } = this.parseImageData(imageData, contentType);
    if (!ALLOWED_MIME.has(mimeType)) {
      throw new BadRequestException("รองรับเฉพาะไฟล์ JPEG, PNG หรือ WebP");
    }
    if (buffer.length > MAX_BYTES) {
      throw new BadRequestException("ขนาดรูปต้องไม่เกิน 2 MB");
    }

    await this.ensureStorageDir();
    const base = this.safeFilename(employeeId);
    const ext = MIME_TO_EXT[mimeType];

    for (const otherExt of Object.values(MIME_TO_EXT)) {
      if (otherExt === ext) continue;
      await unlink(path.join(this.storageDir, `${base}.${otherExt}`)).catch(
        () => undefined,
      );
    }

    await writeFile(path.join(this.storageDir, `${base}.${ext}`), buffer);
  }

  private parseImageData(
    imageData: string,
    contentType?: string,
  ): { buffer: Buffer; mimeType: string } {
    const dataUrlMatch = imageData.match(
      /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s,
    );
    if (dataUrlMatch) {
      return {
        mimeType: dataUrlMatch[1],
        buffer: Buffer.from(dataUrlMatch[2], "base64"),
      };
    }

    if (!contentType || !ALLOWED_MIME.has(contentType)) {
      throw new BadRequestException("ระบุประเภทรูปภาพไม่ถูกต้อง");
    }

    return {
      mimeType: contentType,
      buffer: Buffer.from(imageData, "base64"),
    };
  }
}
