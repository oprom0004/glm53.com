export type WanUiVersion = '2.5' | '2.6' | '2.7' | '3.0';
export type WanUiMode = 'text' | 'image' | 'reference';
export type WanUiResolution = '480P' | '720P' | '1080P';

export const WAN_GENERATOR_CONFIGS = {
  '2.5': {
    route: '/wan-2-5',
    maxDuration: 10,
    resolutions: ['720P', '1080P'],
    modes: ['text', 'image'],
  },
  '2.6': {
    route: '/wan-2-6',
    maxDuration: 15,
    resolutions: ['720P', '1080P'],
    modes: ['text', 'image'],
  },
  '2.7': {
    route: '/wan-2-7',
    maxDuration: 15,
    resolutions: ['720P', '1080P'],
    modes: ['text', 'image'],
  },
  '3.0': {
    route: '/wan-3',
    maxDuration: 30,
    resolutions: ['480P', '720P', '1080P'],
    modes: ['text', 'image', 'reference'],
  },
} as const satisfies Record<
  WanUiVersion,
  {
    route: string;
    maxDuration: number;
    resolutions: readonly WanUiResolution[];
    modes: readonly WanUiMode[];
  }
>;

const copy = {
  en: {
    eyebrow: 'AI video studio',
    title: (version: WanUiVersion) => `Wan ${version} AI Video Generator`,
    description: (version: WanUiVersion) =>
      `Create video with Wan ${version}. Choose your inputs and settings, then select Generate video to start.`,
    modes: {
      text: 'Text to Video',
      image: 'Image to Video',
      reference: 'Reference to Video',
    },
    model: 'Model',
    standard: 'Standard',
    standardHint: 'Best value',
    prime: 'Prime',
    primeHint: 'Faster generation',
    firstFrame: 'First frame',
    lastFrame: 'Last frame',
    referenceImages: 'Reference images',
    referenceVideos: 'Reference videos',
    referenceHelp:
      'Add reference images or videos. Use Image1, Image2 or Video1, Video2 in your prompt to refer to them in order.',
    videoUploadHelp:
      'MP4 or MOV · up to 5 clips · max 100 MB each · 1–15s each, 15s total · 240–4096 px per side · aspect ratio up to 8:1',
    uploadVideo: 'Choose reference videos',
    referenceVideoLimit: 'Choose up to 5 reference videos.',
    referenceVideoBilling:
      'Credits cover input video duration plus output duration. Their combined duration must not exceed 30 seconds.',
    sourcePreviews: 'Selected source media',
    generationCost: (credits: number) => `This generation: ${credits} credits`,
    balance: (credits: number) => `Balance: ${credits} credits`,
    chargeOnGenerate: 'Charged when you generate',
    signInForPrice: 'Sign in to see your generation cost.',
    addMediaForPrice: 'Add source media to see your generation cost.',
    checkingPrice: 'Calculating credits…',
    checkingVideoPrice:
      'Uploading and checking video duration to calculate credits…',
    retryPrice: 'Recalculate credits',
    remove: 'Remove',
    required: 'Required',
    optional: 'Optional',
    upload: 'Choose an image',
    uploadHelp:
      'JPG, PNG or WebP · max 10 MB · 240–8000 px per side · no transparency · aspect ratio up to 8:1',
    referenceLimit: 'Choose up to 10 reference images.',
    prompt: 'Prompt',
    promptPlaceholder:
      'Describe the subject, motion, environment, camera movement, lighting and style…',
    ratio: 'Aspect ratio',
    resolution: 'Resolution',
    duration: 'Duration',
    seconds: 'seconds',
    generate: 'Generate video',
    signingIn: 'Checking account…',
    quoting: 'Preparing generation…',
    uploading: 'Uploading source media…',
    submitting: 'Submitting generation…',
    polling: 'Generating video…',
    ready: 'Ready to create',
    unavailable: 'This option is not configured yet.',
    checkingAvailability: 'Checking available models…',
    availabilityFailed: 'Unable to check available models. Please try again.',
    retryAvailability: 'Check again',
    result: 'Output preview',
    download: 'Download video',
    resume: 'Continue checking',
    history: 'My Videos',
    fileInvalid: 'Choose a JPG, PNG or WebP image up to 10 MB.',
    promptRequired: 'Enter a prompt before generating.',
    promptLengthInvalid: (min: number, max: number) =>
      `Use ${min}–${max.toLocaleString('en-US')} characters for this prompt.`,
    imageRequired:
      'Add the required source image or reference video before generating.',
    errors: {
      invalid_reference_video:
        'Use a complete MP4 or MOV video, up to 100 MB, 1–15 seconds, 240–4096 px per side, and an aspect ratio up to 8:1. Try exporting a standard MP4 if the file is not supported.',
      reference_video_duration:
        'Reference videos must total at most 15 seconds. Input video duration plus output duration must not exceed 30 seconds; shorten your clips or output.',
      unauthenticated: 'Sign in to generate a video.',
      insufficient_credits: 'Not enough credits. Opening the pricing page…',
      price_changed:
        'Generation settings were updated. Please try generating again.',
      not_configured: 'Video generation is not configured yet.',
      storage_not_configured: 'Image and video storage is not configured yet.',
      pricing_not_configured: 'This resolution is not available yet.',
      unsupported_model: 'This model is not available yet.',
      invalid_image:
        'Use a non-transparent JPG, PNG or WebP, up to 10 MB, 240–8000 px per side, with an aspect ratio up to 8:1.',
      submission_unknown:
        'Submission status is uncertain. Your credits remain reserved; this task will not be submitted again.',
      storage_pending:
        'The video finished, but permanent saving is still being retried.',
      generation_failed:
        'Generation failed. Check your credit history for any credit return.',
      generation_rejected:
        'The request was rejected. Reserved credits were returned.',
      task_unavailable: 'The provider task is temporarily unavailable.',
      poll_timeout:
        'Automatic checks paused. You can continue checking safely.',
      request_failed: 'The request could not be completed. Try again.',
    },
  },
  zh: {
    eyebrow: 'AI 视频工作室',
    title: (version: WanUiVersion) => `Wan ${version} AI 视频生成器`,
    description: (version: WanUiVersion) =>
      `使用 Wan ${version} 创作视频。选择输入内容和参数，点击“生成视频”即可开始。`,
    modes: {
      text: '文生视频',
      image: '图生视频',
      reference: '参考素材生视频',
    },
    model: '模型',
    standard: '标准版',
    standardHint: '性价比优先',
    prime: '快速版',
    primeHint: '更快生成',
    firstFrame: '首帧图片',
    lastFrame: '尾帧图片',
    referenceImages: '参考图片',
    referenceVideos: '参考视频',
    referenceHelp:
      '添加参考图片或视频。在提示词中按顺序用 Image1、Image2 或 Video1、Video2 指定参考素材。',
    videoUploadHelp:
      'MP4 或 MOV · 最多 5 段 · 每段最大 100 MB、1–15 秒 · 合计不超过 15 秒 · 每边 240–4096 像素 · 长宽比不超过 8:1',
    uploadVideo: '选择参考视频',
    referenceVideoLimit: '最多选择 5 段参考视频。',
    referenceVideoBilling:
      '积分按输入视频时长与输出时长之和计算，两者合计不能超过 30 秒。',
    sourcePreviews: '已选输入素材',
    generationCost: (credits: number) => `本次生成：${credits} 积分`,
    balance: (credits: number) => `余额：${credits} 积分`,
    chargeOnGenerate: '点击生成后扣除',
    signInForPrice: '登录后查看本次生成所需积分。',
    addMediaForPrice: '添加输入素材后显示本次所需积分。',
    checkingPrice: '正在计算积分…',
    checkingVideoPrice: '正在上传并核验视频时长，计算所需积分…',
    retryPrice: '重新计算积分',
    remove: '移除',
    required: '必填',
    optional: '选填',
    upload: '选择图片',
    uploadHelp:
      'JPG、PNG 或 WebP · 最大 10 MB · 每边 240–8000 像素 · 不含透明区域 · 长宽比不超过 8:1',
    referenceLimit: '最多选择 10 张参考图片。',
    prompt: '提示词',
    promptPlaceholder: '描述主体、动作、环境、运镜、光线与风格…',
    ratio: '画面比例',
    resolution: '分辨率',
    duration: '时长',
    seconds: '秒',
    generate: '生成视频',
    signingIn: '正在检查账户…',
    quoting: '正在准备生成…',
    uploading: '正在上传输入素材…',
    submitting: '正在提交生成任务…',
    polling: '正在生成视频…',
    ready: '可以开始创建',
    unavailable: '此选项尚未完成配置。',
    checkingAvailability: '正在检查可用模型…',
    availabilityFailed: '暂时无法检查可用模型，请重试。',
    retryAvailability: '重新检查',
    result: '输出预览',
    download: '下载视频',
    resume: '继续查询',
    history: '我的视频',
    fileInvalid: '请选择不超过 10 MB 的 JPG、PNG 或 WebP 图片。',
    promptRequired: '请先填写提示词。',
    promptLengthInvalid: (min: number, max: number) =>
      `此提示词需要 ${min}–${max.toLocaleString('en-US')} 个字符。`,
    imageRequired: '请先添加必需的输入图片或参考视频。',
    errors: {
      invalid_reference_video:
        '请使用完整的 MP4 或 MOV 视频，最大 100 MB、1–15 秒、每边 240–4096 像素，长宽比不超过 8:1。不支持的文件请重新导出为标准 MP4。',
      reference_video_duration:
        '参考视频合计不能超过 15 秒；输入视频与输出视频合计不能超过 30 秒，请缩短素材或输出时长。',
      unauthenticated: '登录后即可生成视频。',
      insufficient_credits: '积分不足，正在前往定价页面…',
      price_changed: '生成配置已更新，请重新点击生成视频。',
      not_configured: '视频生成尚未完成配置。',
      storage_not_configured: '图片与视频存储尚未完成配置。',
      pricing_not_configured: '此分辨率暂不可用。',
      unsupported_model: '此模型暂不可用。',
      invalid_image:
        '请使用不含透明区域的 JPG、PNG 或 WebP，最大 10 MB，每边 240–8000 像素，长宽比不超过 8:1。',
      submission_unknown:
        '提交状态暂不确定，积分仍保持预留；系统不会重复提交该任务。',
      storage_pending: '视频已生成，正在重试永久保存。',
      generation_failed: '生成失败，请在积分明细中查看返还记录。',
      generation_rejected: '请求被拒绝，请在积分明细中查看返还记录。',
      task_unavailable: '供应商任务暂时不可用。',
      poll_timeout: '自动查询已暂停，你可以安全地继续查询。',
      request_failed: '请求未能完成，请重试。',
    },
  },
};

export function getWanGeneratorCopy(locale: string) {
  return locale === 'zh' ? copy.zh : copy.en;
}
