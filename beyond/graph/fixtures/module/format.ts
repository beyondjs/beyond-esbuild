import { Decoration } from './nested/decoration';
export const format = (value: string) => new Decoration().apply(value);
