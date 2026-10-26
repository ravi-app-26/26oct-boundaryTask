// The public API of the inventory module.
// Task 2: everything another module needs goes through here, and nothing else.
export type { ReserveResult } from "./service.ts";
export { reserve, onHand, hasSku } from "./service.ts";