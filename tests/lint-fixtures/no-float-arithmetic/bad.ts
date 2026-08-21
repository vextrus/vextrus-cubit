// B-07 fixture: money in binary floats. cubit/no-float-arithmetic must fire.
export function retentionOf(contractValue: number): number {
  const rate = 0.05;
  return contractValue * rate;
}

export function parseAmount(raw: string): number {
  return parseFloat(raw);
}
