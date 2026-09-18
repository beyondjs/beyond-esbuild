import { format } from './format';
import { Counter } from './counter';
import { greeting } from '@fixture/shared/message';

const counter = new Counter();
export const answer = 42;
export const runs = counter.next();
export function main() { return format(greeting()); }
