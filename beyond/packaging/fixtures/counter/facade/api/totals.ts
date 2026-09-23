import { increment } from '@fixture/values/counter';
export let total = 0;
export function bump() { total = increment(); return total; }
