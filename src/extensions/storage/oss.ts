import OSS from 'ali-oss';

import type {
  StorageConfigs,
  StorageDownloadUploadOptions,
  StorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
} from '.';

export interface AliyunOssConfigs extends StorageConfigs {
  region: string;
  endpoint?: string;
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  uploadPath?: string;
  publicDomain?: string;
}

export interface AliyunOssClient {
  put(
    key: string,
    body: Buffer,
    options?: { mime?: string; headers?: Record<string, string> }
  ): Promise<{ res?: { status?: number } }>;
  head(key: string): Promise<{ res?: { status?: number } }>;
}

type AliyunOssClientFactory = (bucket: string) => Promise<AliyunOssClient>;
const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '');
const joinUrl = (base: string, path: string) =>
  `${base.replace(/\/+$/g, '')}/${path}`;

export class AliyunOssProvider implements StorageProvider {
  readonly name = 'aliyun_oss';
  configs: AliyunOssConfigs;
  private readonly clientFactory: AliyunOssClientFactory;

  constructor(
    configs: AliyunOssConfigs,
    clientFactory?: AliyunOssClientFactory
  ) {
    this.configs = configs;
    this.clientFactory =
      clientFactory ||
      (async (bucket) =>
        new OSS({
          region: this.configs.region,
          endpoint: this.configs.endpoint || undefined,
          accessKeyId: this.configs.accessKeyId,
          accessKeySecret: this.configs.accessKeySecret,
          bucket,
          secure: true,
          authorizationV4: true,
        }));
  }

  private getUploadPath() {
    return trimSlashes(this.configs.uploadPath || 'uploads');
  }

  private getObjectKey(key: string) {
    const cleanKey = trimSlashes(key);
    const uploadPath = this.getUploadPath();
    return uploadPath ? `${uploadPath}/${cleanKey}` : cleanKey;
  }

  private getPublicBaseUrl(bucket: string) {
    return (
      this.configs.publicDomain ||
      `https://${bucket}.${this.configs.region}.aliyuncs.com`
    );
  }

  getPublicUrl = (options: { key: string; bucket?: string }) => {
    const bucket = options.bucket || this.configs.bucket;
    return joinUrl(this.getPublicBaseUrl(bucket), this.getObjectKey(options.key));
  };

  exists = async (options: { key: string; bucket?: string }) => {
    try {
      const bucket = options.bucket || this.configs.bucket;
      if (!bucket) return false;
      const client = await this.clientFactory(bucket);
      await client.head(this.getObjectKey(options.key));
      return true;
    } catch {
      return false;
    }
  };

  async uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult> {
    const bucket = options.bucket || this.configs.bucket;
    if (!bucket) {
      return { success: false, error: 'Bucket is required', provider: this.name };
    }
    try {
      const key = trimSlashes(options.key);
      const objectKey = this.getObjectKey(key);
      const client = await this.clientFactory(bucket);
      await client.put(objectKey, Buffer.from(options.body), {
        mime: options.contentType || 'application/octet-stream',
        headers: { 'Content-Disposition': options.disposition || 'inline' },
      });
      return {
        success: true,
        location: `oss://${bucket}/${objectKey}`,
        bucket,
        uploadPath: this.getUploadPath(),
        key,
        filename: key.split('/').pop(),
        url: this.getPublicUrl({ key, bucket }),
        provider: this.name,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.name,
      };
    }
  }

  async downloadAndUpload(
    options: StorageDownloadUploadOptions
  ): Promise<StorageUploadResult> {
    try {
      const response = await fetch(options.url);
      if (!response.ok) {
        return {
          success: false,
          error: `HTTP error! status: ${response.status}`,
          provider: this.name,
        };
      }
      return this.uploadFile({
        body: new Uint8Array(await response.arrayBuffer()),
        key: options.key,
        bucket: options.bucket,
        contentType:
          options.contentType ||
          response.headers.get('content-type') ||
          'application/octet-stream',
        disposition: options.disposition,
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.name,
      };
    }
  }
}

export function createAliyunOssProvider(configs: AliyunOssConfigs) {
  return new AliyunOssProvider(configs);
}

