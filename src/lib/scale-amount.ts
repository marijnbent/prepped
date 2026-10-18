export function scaleAmount(amount: string, factor: number): string {
  if (factor === 1 || !Number.isFinite(factor) || factor <= 0) return amount;
  const format = (value: number) => {
    const scaled = String(Math.round(value * factor * 100) / 100);
    return amount.includes(",") ? scaled.replace(".", ",") : scaled;
  };
  const fraction = amount.trim().match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[3]);
    return denominator ? format(Number(fraction[1] || 0) + Number(fraction[2]) / denominator) : amount;
  }
  const numbers = amount.trim().match(/^(\d+(?:[.,]\d+)?)(?:\s*([-–])\s*(\d+(?:[.,]\d+)?))?$/);
  if (!numbers) return amount;
  const first = format(Number(numbers[1].replace(",", ".")));
  return numbers[3] ? `${first}${numbers[2]}${format(Number(numbers[3].replace(",", ".")))}` : first;
}
