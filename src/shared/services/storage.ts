import { R2Provider, StorageManager } from '@/extensions/storage';
import { r2ConfigsFromSettings } from '@/extensions/storage/r2';
import { Configs, getAllConfigs } from '@/shared/models/config';

/**
 * get storage service with configs
 */
export function getStorageServiceWithConfigs(configs: Configs) {
  const storageManager = new StorageManager();

  // R2 is the only active storage for this project. Old OSS/S3 values are ignored.
  try {
    storageManager.addProvider(
      new R2Provider(r2ConfigsFromSettings(configs)),
      true
    );
  } catch {
    // Partial admin configuration must not break unrelated pages.
  }

  return storageManager;
}

/**
 * global storage service
 */
let storageService: StorageManager | null = null;

/**
 * get storage service instance
 */
export async function getStorageService(
  configs?: Configs
): Promise<StorageManager> {
  if (!configs) {
    configs = await getAllConfigs();
  }
  storageService = getStorageServiceWithConfigs(configs);

  return storageService;
}
