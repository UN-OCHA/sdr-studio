// Internal cache for colors to avoid re-hashing
const colorCache: Record<string, { solid: string, light: string }> = {};

export function getProceduralColor(label: string, labelsArray?: string[]) {
  if (colorCache[label]) return colorCache[label];

  const index = labelsArray ? labelsArray.indexOf(label) : -1;
  let hue;

  if (index !== -1) {
    hue = (index * 137.508) % 360;
  } else {
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
      hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }
    hue = Math.abs(hash * 137.508) % 360;
  }

  const color = {
    solid: `hsl(${hue}, 80%, 35%)`,
    light: `hsla(${hue}, 80%, 35%, 0.15)`,
  };
  colorCache[label] = color;
  return color;
}
