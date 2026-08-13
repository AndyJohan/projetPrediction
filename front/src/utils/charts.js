export const chartSizes = { width: 620, height: 220, padding: 24 };

export function buildLinePath(points, width, height, padding) {
  const values = points.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const span = maxValue - minValue || 1;
  const step = (width - padding * 2) / (points.length - 1);

  const coords = points.map((point, index) => {
    const x = padding + index * step;
    const normalized = (point.value - minValue) / span;
    const y = height - padding - normalized * (height - padding * 2);
    return { x, y };
  });

  const line = coords
    .map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x} ${coord.y}`)
    .join(' ');

  const area = `${line} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;

  return { line, area };
}

export function buildDonutGradient(slices) {
  let current = 0;
  const parts = slices.map((slice) => {
    const start = current;
    current += slice.value;
    return `${slice.color} ${start}% ${current}%`;
  });

  return `conic-gradient(${parts.join(', ')})`;
}
