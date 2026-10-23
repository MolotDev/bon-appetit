import { getSupabaseClient, type BonAppetitClient } from "@/services/supabase";
import type {
  DeliveryReportRow,
  KitchenReportRow,
  TablesInsert,
  TablesUpdate,
} from "@/types/database";
import type { OrderWithItems, Profile, UserRole } from "@/types";

function assertOk<T>(
  data: T | null,
  error: { message: string } | null,
  context: string,
): T {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
  if (data === null) {
    throw new Error(`${context}: empty response`);
  }
  return data;
}

export async function getOwnProfile(
  client: BonAppetitClient = getSupabaseClient(),
): Promise<Profile> {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user) {
    throw new Error(authError?.message ?? "Not authenticated");
  }

  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return assertOk(data, error, "getOwnProfile");
}

export async function completePasswordChange(
  client: BonAppetitClient = getSupabaseClient(),
): Promise<void> {
  const { error } = await client.rpc("complete_password_change");
  if (error) {
    throw new Error(error.message);
  }
}

export async function checkAdminMenuDeadline(
  targetDate: string,
  client: BonAppetitClient = getSupabaseClient(),
): Promise<boolean> {
  const { data, error } = await client.rpc("check_admin_menu_deadline", {
    target_date: targetDate,
  });
  return assertOk(data, error, "check_admin_menu_deadline");
}

export async function checkUserOrderDeadline(
  targetDate: string,
  client: BonAppetitClient = getSupabaseClient(),
): Promise<boolean> {
  const { data, error } = await client.rpc("check_user_order_deadline", {
    target_date: targetDate,
  });
  return assertOk(data, error, "check_user_order_deadline");
}

export async function getKitchenReport(
  targetDate: string,
  client: BonAppetitClient = getSupabaseClient(),
): Promise<KitchenReportRow[]> {
  const { data, error } = await client.rpc("get_kitchen_report", {
    target_date: targetDate,
  });
  return assertOk(data, error, "get_kitchen_report");
}

export async function getDeliveryReport(
  targetDate: string,
  client: BonAppetitClient = getSupabaseClient(),
): Promise<DeliveryReportRow[]> {
  const { data, error } = await client.rpc("get_delivery_report", {
    target_date: targetDate,
  });
  return assertOk(data, error, "get_delivery_report");
}

export async function listLocations(
  client: BonAppetitClient = getSupabaseClient(),
) {
  const { data, error } = await client.from("locations").select("*").order("name");
  return assertOk(data, error, "listLocations");
}

export async function listActiveDishes(
  client: BonAppetitClient = getSupabaseClient(),
) {
  const { data, error } = await client
    .from("dishes")
    .select("*")
    .eq("is_active", true)
    .order("meal_type")
    .order("title");
  return assertOk(data, error, "listActiveDishes");
}

export async function listDishes(
  client: BonAppetitClient = getSupabaseClient(),
) {
  const { data, error } = await client
    .from("dishes")
    .select("*")
    .order("meal_type")
    .order("title");
  return assertOk(data, error, "listDishes");
}

export async function createDish(
  payload: TablesInsert<"dishes">,
  client: BonAppetitClient = getSupabaseClient(),
) {
  const { data, error } = await client.from("dishes").insert(payload).select().single();
  return assertOk(data, error, "createDish");
}

export async function updateDish(
  dishId: string,
  patch: TablesUpdate<"dishes">,
  client: BonAppetitClient = getSupabaseClient(),
) {
  const { data, error } = await client
    .from("dishes")
    .update(patch)
    .eq("id", dishId)
    .select()
    .single();
  return assertOk(data, error, "updateDish");
}

export async function insertDailyMenuRows(
  rows: TablesInsert<"daily_menu">[],
  client: BonAppetitClient = getSupabaseClient(),
) {
  if (rows.length === 0) {
    return [];
  }
  const { data, error } = await client.from("daily_menu").insert(rows).select();
  return assertOk(data, error, "insertDailyMenuRows");
}

export async function deleteDailyMenuRows(
  ids: string[],
  client: BonAppetitClient = getSupabaseClient(),
) {
  if (ids.length === 0) {
    return;
  }
  const { error } = await client.from("daily_menu").delete().in("id", ids);
  if (error) {
    throw new Error(`deleteDailyMenuRows: ${error.message}`);
  }
}

export async function listProfiles(
  client: BonAppetitClient = getSupabaseClient(),
) {
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .order("full_name");
  return assertOk(data, error, "listProfiles");
}

export async function updateProfile(
  profileId: string,
  patch: TablesUpdate<"profiles">,
  client: BonAppetitClient = getSupabaseClient(),
) {
  const { data, error } = await client
    .from("profiles")
    .update(patch)
    .eq("id", profileId)
    .select()
    .single();
  return assertOk(data, error, "updateProfile");
}

type AdminUsersAction = "create" | "reset_password" | "delete";

type AdminUsersPayload = {
  action: AdminUsersAction;
  username?: string;
  full_name?: string;
  role?: UserRole;
  default_location_id?: string | null;
  password?: string;
  user_id?: string;
};

type AdminUsersResult = {
  user_id: string;
  password?: string;
};

export async function invokeAdminUsers(
  payload: AdminUsersPayload,
  client: BonAppetitClient = getSupabaseClient(),
): Promise<AdminUsersResult> {
  const { data, error } = await client.functions.invoke<AdminUsersResult | { error?: string }>(
    "admin-users",
    { body: payload },
  );

  let code: string | undefined;
  if (error) {
    const response = "context" in error ? (error.context as Response | undefined) : undefined;
    if (response) {
      try {
        const body = (await response.clone().json()) as { error?: string };
        code = body.error;
      } catch {
        code = undefined;
      }
    }
    throw new Error(code ?? error.message);
  }
  if (!data) {
    throw new Error("admin-users: empty response");
  }
  if ("error" in data && data.error) {
    throw new Error(data.error);
  }
  if (!("user_id" in data) || typeof data.user_id !== "string") {
    throw new Error("admin-users: empty response");
  }
  return {
    user_id: data.user_id,
    password: "password" in data && typeof data.password === "string" ? data.password : undefined,
  };
}

export async function getDailyMenu(
  date: string,
  client: BonAppetitClient = getSupabaseClient(),
) {
  const { data, error } = await client
    .from("daily_menu")
    .select("*, dishes(*)")
    .eq("date", date)
    .order("meal_type");
  return assertOk(data, error, "getDailyMenu");
}

export async function getDailyMenusInRange(
  from: string,
  to: string,
  client: BonAppetitClient = getSupabaseClient(),
) {
  const { data, error } = await client
    .from("daily_menu")
    .select("*, dishes(*)")
    .gte("date", from)
    .lte("date", to)
    .order("date")
    .order("meal_type");
  return assertOk(data, error, "getDailyMenusInRange");
}

export async function getOwnOrderForDate(
  userId: string,
  date: string,
  client: BonAppetitClient = getSupabaseClient(),
): Promise<OrderWithItems | null> {
  const { data, error } = await client
    .from("orders")
    .select("*, order_items(*, daily_menu(*, dishes(*)))")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  if (error) {
    throw new Error(`getOwnOrderForDate: ${error.message}`);
  }
  return data as OrderWithItems | null;
}

export async function listOwnOrders(
  userId: string,
  client: BonAppetitClient = getSupabaseClient(),
): Promise<OrderWithItems[]> {
  const { data, error } = await client
    .from("orders")
    .select("*, order_items(*, daily_menu(*, dishes(*)))")
    .eq("user_id", userId)
    .order("date", { ascending: false });
  return assertOk(data as OrderWithItems[] | null, error, "listOwnOrders");
}

export async function createOrder(
  payload: TablesInsert<"orders">,
  client: BonAppetitClient = getSupabaseClient(),
) {
  const { data, error } = await client
    .from("orders")
    .insert(payload)
    .select()
    .single();
  return assertOk(data, error, "createOrder");
}

export async function updateOrder(
  orderId: string,
  patch: TablesUpdate<"orders">,
  client: BonAppetitClient = getSupabaseClient(),
) {
  const { data, error } = await client
    .from("orders")
    .update(patch)
    .eq("id", orderId)
    .select()
    .single();
  return assertOk(data, error, "updateOrder");
}

export async function replaceOrderItems(
  orderId: string,
  dailyMenuIds: string[],
  client: BonAppetitClient = getSupabaseClient(),
) {
  const { error: deleteError } = await client
    .from("order_items")
    .delete()
    .eq("order_id", orderId);
  if (deleteError) {
    throw new Error(`replaceOrderItems.delete: ${deleteError.message}`);
  }

  if (dailyMenuIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("order_items")
    .insert(
      dailyMenuIds.map((daily_menu_id) => ({
        order_id: orderId,
        daily_menu_id,
      })),
    )
    .select();
  return assertOk(data, error, "replaceOrderItems.insert");
}

export async function invokeSendPush(
  payload: {
    title: string;
    body: string;
    url?: string;
    user_ids?: string[];
  },
  client: BonAppetitClient = getSupabaseClient(),
) {
  const { data, error } = await client.functions.invoke<{
    sent?: number;
    failed?: number;
    removed?: number;
    error?: string;
  }>("send-push", { body: payload });
  if (error) {
    throw new Error(error.message);
  }
  if (data && "error" in data && data.error) {
    throw new Error(data.error);
  }
  return data;
}

export async function upsertPushSubscription(
  payload: TablesInsert<"push_subscriptions">,
  client: BonAppetitClient = getSupabaseClient(),
) {
  const { data, error } = await client
    .from("push_subscriptions")
    .upsert(payload, { onConflict: "endpoint" })
    .select()
    .single();
  return assertOk(data, error, "upsertPushSubscription");
}
