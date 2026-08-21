// Q-08 fixture: `any` deletes the type system one parameter at a time.
export function normalise(payload: any): any {
  return payload;
}

export const cache: Record<string, any> = {};
