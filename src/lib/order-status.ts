/**
 * The order lifecycle, in one place.
 *
 * This used to be a pair of constants inside `public/app/js/state.js`, which
 * meant the browser and the database each had their own idea of what the
 * stages were. Both the placement route and the status route import from here
 * so a stage cannot be added to one and forgotten in the other.
 */

export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "RESTAURANT_ACCEPTED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "RIDER_ASSIGNED",
  "RIDER_HEADING_TO_STORE",
  "RIDER_AT_STORE",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "RIDER_NEARBY",
  "DELIVERED",
  "REJECTED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type Actor = "customer" | "vendor" | "rider" | "admin";

/** Human-readable line shown on the order timeline. */
export const STATUS_NOTES: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment confirmation",
  PAID: "Payment successful! Sent to restaurant",
  RESTAURANT_ACCEPTED: "Restaurant accepted your order",
  PREPARING: "Preparing Food",
  READY_FOR_PICKUP: "Ready for Pickup",
  RIDER_ASSIGNED: "Rider has accepted your delivery",
  RIDER_HEADING_TO_STORE: "Rider heading to the store",
  RIDER_AT_STORE: "Rider has arrived at the store",
  PICKED_UP: "Order picked up",
  OUT_FOR_DELIVERY: "Rider is on the way to your address",
  RIDER_NEARBY: "Rider is nearby",
  DELIVERED: "Your order has been delivered",
  REJECTED: "Cancelled by the restaurant",
  CANCELLED: "Order cancelled",
};

/**
 * Which statuses a stage may be reached from, and who is allowed to move it.
 *
 * Enforcing this server-side is the point: previously any customer could call
 * `advanceOrderStatus` on their own copy of the order and mark their own food
 * as delivered, which also credited the vendor's wallet.
 */
export const TRANSITIONS: Record<string, { from: string[]; actors: Actor[] }> = {
  PAID: { from: ["PENDING_PAYMENT"], actors: ["customer", "admin"] },
  RESTAURANT_ACCEPTED: { from: ["PAID"], actors: ["vendor", "admin"] },
  PREPARING: { from: ["RESTAURANT_ACCEPTED"], actors: ["vendor", "admin"] },
  READY_FOR_PICKUP: { from: ["PREPARING"], actors: ["vendor", "admin"] },
  RIDER_ASSIGNED: { from: ["READY_FOR_PICKUP"], actors: ["rider", "admin"] },
  RIDER_HEADING_TO_STORE: { from: ["RIDER_ASSIGNED"], actors: ["rider", "admin"] },
  RIDER_AT_STORE: { from: ["RIDER_HEADING_TO_STORE"], actors: ["rider", "admin"] },
  PICKED_UP: { from: ["RIDER_AT_STORE"], actors: ["rider", "admin"] },
  OUT_FOR_DELIVERY: { from: ["PICKED_UP"], actors: ["rider", "admin"] },
  RIDER_NEARBY: { from: ["OUT_FOR_DELIVERY"], actors: ["rider", "admin"] },
  DELIVERED: { from: ["RIDER_NEARBY", "PICKED_UP"], actors: ["rider", "admin"] },
  REJECTED: {
    from: ["PAID", "RESTAURANT_ACCEPTED", "PREPARING", "READY_FOR_PICKUP"],
    actors: ["vendor", "admin"],
  },
  CANCELLED: {
    from: ["PENDING_PAYMENT", "PAID", "RESTAURANT_ACCEPTED", "PREPARING", "READY_FOR_PICKUP"],
    actors: ["customer", "vendor", "admin"],
  },
};

/** Stages an order can no longer leave. */
export const TERMINAL_STATUSES = new Set(["DELIVERED", "REJECTED", "CANCELLED"]);

export function canTransition(from: string, to: string, actor: Actor): boolean {
  if (TERMINAL_STATUSES.has(from)) return false;

  const rule = TRANSITIONS[to];
  if (!rule) return false;
  if (!rule.actors.includes(actor)) return false;
  return rule.from.includes(from);
}
