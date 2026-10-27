import type { Wan2Version } from './wan-models';

export const KIE_WAN2_MODELS = {
  '2.5': { text: 'wan/2-5-text-to-video', image: 'wan/2-5-image-to-video' },
  '2.6': { text: 'wan/2-6-text-to-video', image: 'wan/2-6-image-to-video' },
  '2.7': { text: 'wan/2-7-text-to-video', image: 'wan/2-7-image-to-video' },
} as const;

export function kieWan2Limits(version: Wan2Version, mode: string) {
  return {
    duration: {
      min: version === '2.7' ? 2 : 5,
      max: version === '2.5' ? 10 : 15,
      initial: 5,
      step: version === '2.7' ? 1 : 5,
    },
    maxPromptLength: version === '2.5' ? 800 : 5000,
    minPromptLength:
      version === '2.6' && mode === 'image'
        ? 2
        : version === '2.7' && mode === 'image'
          ? 0
          : 1,
    ratios:
      mode === 'text' && version !== '2.6'
        ? version === '2.5'
          ? ['16:9', '9:16', '1:1']
          : ['16:9', '9:16', '1:1', '4:3', '3:4']
        : ['adaptive'],
  };
}

export function assertKieWan2Options(input: {
  version: Wan2Version;
  mode: string;
  duration: number;
  resolution: string;
  ratio: string;
}) {
  const limits = kieWan2Limits(input.version, input.mode);
  if (
    !['text', 'image'].includes(input.mode) ||
    !['720P', '1080P'].includes(input.resolution)
  ) {
    throw new Error('unsupported_model');
  }
  if (
    !Number.isInteger(input.duration) ||
    input.duration < limits.duration.min ||
    input.duration > limits.duration.max ||
    (input.duration - limits.duration.min) % limits.duration.step !== 0 ||
    (input.ratio !== 'adaptive' && !limits.ratios.includes(input.ratio))
  ) {
    throw new Error('invalid_params');
  }
}

export function assertKieWan2Prompt(
  version: Wan2Version,
  mode: string,
  prompt: string
) {
  const limits = kieWan2Limits(version, mode);
  if (
    prompt.trim().length < limits.minPromptLength ||
    prompt.length > limits.maxPromptLength
  ) {
    throw new Error('invalid_params');
  }
}
