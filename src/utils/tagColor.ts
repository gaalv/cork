/**
 * Derive a stable hue (0-359) from a tag name using djb2.
 * Used for per-tag pill tinting so categories are visually distinct
 * without breaking light/dark themes.
 */
export function tagHue(tag: string): number {
  let hash = 5381;
  for (let i = 0; i < tag.length; i += 1) {
    hash = (hash * 33) ^ tag.charCodeAt(i);
  }
  return Math.abs(hash) % 360;
}

export type TagSwatch = {
  background: string;
  foreground: string;
  border: string;
};

export function tagSwatch(tag: string): TagSwatch {
  const hue = tagHue(tag);
  return {
    background: `hsl(${hue} 70% 92% / 0.85)`,
    foreground: `hsl(${hue} 65% 28%)`,
    border: `hsl(${hue} 50% 75% / 0.6)`,
  };
}
