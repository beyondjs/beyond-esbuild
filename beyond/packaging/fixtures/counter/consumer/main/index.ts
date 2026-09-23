import * as api from '@fixture/facade/api';
import { count, Counter } from '@fixture/facade/api';
export { increment, bump } from '@fixture/facade/api';
export function observe() {
  return { count, star: api.count, total: api.total, aid: api.aid(), label: new Counter().label };
}
export function fail(): never {
  throw new Error('packaged boom');
}
