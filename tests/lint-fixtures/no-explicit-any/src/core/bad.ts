// Q-08: no `any` — neither as an annotation nor hidden inside a type argument or an assertion.
export function widen(value: any): any { // RECORDED REASON Q-08
  return value;
}

export const box: Array<any> = []; // RECORDED REASON Q-08

export const cast = widen(1) as any; // RECORDED REASON Q-08
