export type {
  Database,
  DeliveryReportRow,
  KitchenReportRow,
  MealType,
  OrderStatus,
  Tables,
  TablesInsert,
  TablesUpdate,
  UserRole,
} from "./database";

import type { Tables } from "./database";

export type Location = Tables<"locations">;
export type Profile = Tables<"profiles">;
export type Dish = Tables<"dishes">;
export type DailyMenu = Tables<"daily_menu">;
export type Order = Tables<"orders">;
export type OrderItem = Tables<"order_items">;
export type PushSubscriptionRow = Tables<"push_subscriptions">;
export type { MenuRow, OrderItemWithMenu, OrderWithItems } from "./order";
export { MEAL_TYPES, dishFromRelation } from "./order";
