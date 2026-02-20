export function scaleAmount(amount: string, factor: number): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount; // non-numeric like "a pinch"
  const scaled = num * factor;
  if (scaled === Math.floor(scaled)) return String(scaled);
  return (Math.round(scaled * 100) / 100).toString();
}
