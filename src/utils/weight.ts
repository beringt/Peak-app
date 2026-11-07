/** Accept decimal comma as well as decimal point; never accept blank/nonfinite values. */
export function parseWeight(value: string): number | null {
  const weight = Number(value.trim().replace(",", "."));
  return Number.isFinite(weight) && weight > 0 && weight <= 500 ? weight : null;
}
