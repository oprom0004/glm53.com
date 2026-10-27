// Public identifiers only. Credentials never belong in this module.
export const WAN2_MODELS = {
  '2.5': 'wan2.5-t2v-preview',
  '2.6': 'wan2.6-t2v',
  '2.7': 'wan2.7-t2v',
} as const;

export type Wan2Version = keyof typeof WAN2_MODELS;
export type WanVersion = Wan2Version | '3.0';
export type WanModel =
  | (typeof WAN2_MODELS)[Wan2Version]
  | 'wan3.0-video'
  | 'wan3.0-video-prime';

export const WAN_DURATION_LIMITS = {
  '2.5': { min: 2, max: 10, initial: 5 },
  '2.6': { min: 2, max: 15, initial: 5 },
  '2.7': { min: 2, max: 15, initial: 5 },
  '3.0': { min: 2, max: 30, initial: 5 },
} as const;

export function isWan2Model(model: string): model is WanModel {
  return Object.values(WAN2_MODELS).some((value) => value === model);
}

export function wanModelVersion(model: WanModel): WanVersion {
  return (
    (Object.keys(WAN2_MODELS) as Wan2Version[]).find(
      (version) => WAN2_MODELS[version] === model
    ) ?? '3.0'
  );
}

export function isValidWanDuration(version: WanVersion, duration: unknown) {
  const limits = WAN_DURATION_LIMITS[version];
  return (
    typeof duration === 'number' &&
    Number.isInteger(duration) &&
    duration >= limits.min &&
    duration <= limits.max
  );
}

export function wan2ModelKey(version: Wan2Version, mode: 'text' | 'image') {
  return `polaris_wan${version.replace('.', '')}_${mode}_model`;
}

