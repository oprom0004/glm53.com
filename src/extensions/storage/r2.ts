import { normalizeProviderBaseUrl } from '@/shared/services/provider-endpoint';

import type {
  StorageConfigs,
  StorageDownloadUploadOptions,
  StorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
} from '.';

/**
 * R2 storage provider configs
 * @docs https://developers.cloudflare.com/r2/
 */
export interface R2Configs extends StorageConfigs {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  uploadPath?: string;
  region?: string;
  endpoint?: string;
  publicDomain?: string;
}

export function r2ConfigsFromSettings(
  values: Record<string, string>
): R2Configs {
  const configs: R2Configs = {
    accountId: values.r2_account_id?.trim() || '',
    accessKeyId: values.r2_access_key?.trim() || '',
    secretAccessKey: values.r2_secret_key?.trim() || '',
    bucket: values.r2_bucket_name?.trim() || '',
    endpoint: values.r2_endpoint?.trim(),
    publicDomain: values.r2_domain?.trim(),
    uploadPath: values.r2_upload_path?.trim(),
    region: 'auto',
  };
  if (
    !configs.accessKeyId ||
    !configs.secretAccessKey ||
    !configs.bucket ||
    !configs.publicDomain
  ) {
    throw new Error('storage_not_configured');
  }
  // Validate without making any external request.
  return new R2Provider(configs).configs;
}

/**
 * R2 storage provider implementation
 * @website https://www.cloudflare.com/products/r2/
 */
export class R2Provider implements StorageProvider {
  readonly name = 'r2';
  configs: R2Configs;

  constructor(configs: R2Configs) {
    const endpoint = normalizeProviderBaseUrl(
      configs.endpoint ||
        `https://${configs.accountId}.r2.cloudflarestorage.com`
    );
    const endpointUrl = new URL(endpoint);
    if (
      !/^[a-f0-9]{32}(?:\.(?:eu|fedramp))?\.r2\.cloudflarestorage\.com$/.test(
        endpointUrl.hostname
      ) ||
      endpointUrl.pathname !== '/' ||
      !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(configs.bucket)
    ) {
      throw new Error('invalid_r2_settings');
    }
    const uploadPath = (configs.uploadPath || 'uploads').replace(
      /^\/+|\/+$/g,
      ''
    );
    if (
      !uploadPath ||
      !/^[a-zA-Z0-9/_-]+$/.test(uploadPath) ||
      uploadPath.includes('//')
    ) {
      throw new Error('invalid_r2_settings');
    }
    this.configs = {
      ...configs,
      endpoint,
      uploadPath,
      publicDomain: configs.publicDomain
        ? normalizeProviderBaseUrl(configs.publicDomain)
        : undefined,
    };
    if (
      this.configs.publicDomain &&
      new URL(this.configs.publicDomain).hostname.endsWith(
        '.r2.cloudflarestorage.com'
      )
    ) {
      throw new Error('invalid_r2_settings');
    }
  }

  private getUploadPath() {
    let uploadPath = this.configs.uploadPath || 'uploads';
    if (uploadPath.startsWith('/')) {
      uploadPath = uploadPath.slice(1);
    }
    if (uploadPath.endsWith('/')) {
      uploadPath = uploadPath.slice(0, -1);
    }
    return uploadPath;
  }

  private getEndpoint() {
    return (
      this.configs.endpoint ||
      `https://${this.configs.accountId}.r2.cloudflarestorage.com`
    );
  }

  getPublicUrl = (options: { key: string; bucket?: string }) => {
    const uploadBucket = options.bucket || this.configs.bucket;
    const uploadPath = this.getUploadPath();
    const url = `${this.getEndpoint()}/${uploadBucket}/${uploadPath}/${options.key}`;
    return this.configs.publicDomain
      ? `${this.configs.publicDomain}/${uploadPath}/${options.key}`
      : url;
  };

  exists = async (options: { key: string; bucket?: string }) => {
    try {
      const uploadBucket = options.bucket || this.configs.bucket;
      if (!uploadBucket) return false;
      const uploadPath = this.getUploadPath();
      const url = `${this.getEndpoint()}/${uploadBucket}/${uploadPath}/${options.key}`;

      const { AwsClient } = await import('aws4fetch');
      const client = new AwsClient({
        accessKeyId: this.configs.accessKeyId,
        secretAccessKey: this.configs.secretAccessKey,
        region: this.configs.region || 'auto',
        service: 's3',
        retries: 2,
      });

      const response = await client.fetch(
        new Request(url, {
          method: 'HEAD',
          redirect: 'error',
          signal: AbortSignal.timeout(30_000),
        }),
        { redirect: 'error', signal: AbortSignal.timeout(30_000) }
      );

      return response.ok;
    } catch {
      return false;
    }
  };

  async uploadFile(
    options: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    try {
      const uploadBucket = options.bucket || this.configs.bucket;
      if (!uploadBucket) {
        return {
          success: false,
          error: 'Bucket is required',
          provider: this.name,
        };
      }

      const bodyArray =
        options.body instanceof Buffer
          ? new Uint8Array(options.body)
          : options.body;

      const uploadPath = this.getUploadPath();

      // R2 endpoint format: https://<accountId>.r2.cloudflarestorage.com
      // Use custom endpoint if provided, otherwise use default
      const url = `${this.getEndpoint()}/${uploadBucket}/${uploadPath}/${options.key}`;

      const { AwsClient } = await import('aws4fetch');

      // R2 uses "auto" as region for S3 API compatibility
      const client = new AwsClient({
        accessKeyId: this.configs.accessKeyId,
        secretAccessKey: this.configs.secretAccessKey,
        region: this.configs.region || 'auto',
        service: 's3',
        retries: 2,
      });

      const headers: Record<string, string> = {
        'Content-Type': options.contentType || 'application/octet-stream',
        'Content-Disposition': options.disposition || 'inline',
        'Content-Length': bodyArray.length.toString(),
      };

      const request = new Request(url, {
        method: 'PUT',
        redirect: 'error',
        signal: AbortSignal.timeout(60_000),
        headers,
        body: bodyArray as any,
      });

      const response = await client.fetch(request, {
        redirect: 'error',
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Upload failed: ${response.statusText}`,
          provider: this.name,
        };
      }

      const publicUrl =
        this.getPublicUrl({ key: options.key, bucket: uploadBucket }) || url;

      return {
        success: true,
        location: url,
        bucket: uploadBucket,
        uploadPath: uploadPath,
        key: options.key,
        filename: options.key.split('/').pop(),
        url: publicUrl,
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

      if (!response.body) {
        return {
          success: false,
          error: 'No body in response',
          provider: this.name,
        };
      }

      const arrayBuffer = await response.arrayBuffer();
      const body = new Uint8Array(arrayBuffer);

      return this.uploadFile({
        body,
        key: options.key,
        bucket: options.bucket,
        contentType: options.contentType,
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

/**
 * Create R2 provider with configs
 */
export function createR2Provider(configs: R2Configs): R2Provider {
  return new R2Provider(configs);
}
