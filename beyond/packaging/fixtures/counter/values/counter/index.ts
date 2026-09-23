import { step } from './step';
export let count = 0;
export function increment() { count += step; return count; }
export default class Counter { label = 'counter'; }
