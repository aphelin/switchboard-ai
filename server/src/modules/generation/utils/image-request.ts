/** Aspect ratios the Gemini image API accepts (the extreme panoramas are left out). */
export const GEMINI_ASPECT_RATIOS = [
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '21:9',
] as const;

export type AspectRatio = (typeof GEMINI_ASPECT_RATIOS)[number];

const logRatio = (ratio: AspectRatio): number => {
  const [width, height] = ratio.split(':').map(Number);
  return Math.log(width / height);
};

/** Gemini image models take an aspect ratio, not pixel sizes: pick the closest one. */
export function closestAspectRatio(
  width?: number,
  height?: number,
): AspectRatio | undefined {
  if (!width || !height) return undefined;
  const target = Math.log(width / height);
  const distance = (ratio: AspectRatio) => Math.abs(logRatio(ratio) - target);
  return GEMINI_ASPECT_RATIOS.reduce((best, ratio) =>
    distance(ratio) < distance(best) ? ratio : best,
  );
}

/** Gemini has no negative-prompt parameter, but follows plain-language exclusions. */
export function withNegativePrompt(
  prompt: string,
  negativePrompt?: string,
): string {
  const avoid = negativePrompt?.trim();
  return avoid ? `${prompt}\n\nAvoid: ${avoid}` : prompt;
}
