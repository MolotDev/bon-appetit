import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const AUTH_EMAIL_DOMAIN = "bon-appetit.local";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type UserRole = "ADMIN" | "USER";

type AdminUsersRequest = {
  action?: string;
  username?: string;
  full_name?: string;
  role?: string;
  default_location_id?: string | null;
  password?: string;
  user_id?: string;
};

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function usernameToEmail(username: string): string {
  return `${username}@${AUTH_EMAIL_DOMAIN}`;
}

function isRole(value: string): value is UserRole {
  return value === "ADMIN" || value === "USER";
}

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function isValidUsername(value: string): boolean {
  return /^[a-z0-9._-]{3,32}$/.test(value);
}

function isValidPassword(value: string): boolean {
  return value.length >= 8 && value.length <= 64;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const anonKey = requiredEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, { error: "Missing Authorization header" });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: isAdmin, error: adminError } = await userClient.rpc("is_admin");
    if (adminError) {
      return jsonResponse(401, { error: adminError.message });
    }
    if (isAdmin !== true) {
      return jsonResponse(403, { error: "Only ADMIN can manage users" });
    }

    const {
      data: { user: actor },
    } = await userClient.auth.getUser();
    if (!actor) {
      return jsonResponse(401, { error: "Not authenticated" });
    }

    const parsed: unknown = await req.json();
    if (typeof parsed !== "object" || parsed === null) {
      return jsonResponse(400, { error: "Invalid JSON body" });
    }
    const input = parsed as AdminUsersRequest;
    const action = input.action;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (action === "create") {
      const username = normalizeUsername(input.username ?? "");
      const fullName = (input.full_name ?? "").trim();
      const role = input.role ?? "USER";
      const password = input.password ?? "";
      const defaultLocationId =
        typeof input.default_location_id === "string" && input.default_location_id.length > 0
          ? input.default_location_id
          : null;

      if (!isValidUsername(username)) {
        return jsonResponse(400, { error: "USERNAME_INVALID" });
      }
      if (fullName.length < 2) {
        return jsonResponse(400, { error: "FULL_NAME_INVALID" });
      }
      if (!isRole(role)) {
        return jsonResponse(400, { error: "ROLE_INVALID" });
      }
      if (!isValidPassword(password)) {
        return jsonResponse(400, { error: "PASSWORD_INVALID" });
      }

      const { data: existing } = await adminClient
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (existing) {
        return jsonResponse(409, { error: "USERNAME_EXISTS" });
      }

      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email: usernameToEmail(username),
        password,
        email_confirm: true,
        user_metadata: { username, full_name: fullName },
      });
      if (createError || !created.user) {
        return jsonResponse(400, { error: createError?.message ?? "User create failed" });
      }

      const { error: profileError } = await adminClient.from("profiles").insert({
        id: created.user.id,
        username,
        full_name: fullName,
        role,
        default_location_id: defaultLocationId,
        is_blocked: false,
        must_change_password: true,
      });
      if (profileError) {
        await adminClient.auth.admin.deleteUser(created.user.id);
        return jsonResponse(400, { error: profileError.message });
      }

      return jsonResponse(200, { user_id: created.user.id, password });
    }

    if (action === "reset_password") {
      const userId = input.user_id ?? "";
      const password = input.password ?? "";
      if (userId.length === 0) {
        return jsonResponse(400, { error: "USER_ID_REQUIRED" });
      }
      if (!isValidPassword(password)) {
        return jsonResponse(400, { error: "PASSWORD_INVALID" });
      }

      const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(userId, {
        password,
      });
      if (updateAuthError) {
        return jsonResponse(400, { error: updateAuthError.message });
      }

      const { error: profileError } = await adminClient
        .from("profiles")
        .update({ must_change_password: true })
        .eq("id", userId);
      if (profileError) {
        return jsonResponse(400, { error: profileError.message });
      }

      return jsonResponse(200, { user_id: userId, password });
    }

    if (action === "delete") {
      const userId = input.user_id ?? "";
      if (userId.length === 0) {
        return jsonResponse(400, { error: "USER_ID_REQUIRED" });
      }
      if (userId === actor.id) {
        return jsonResponse(400, { error: "CANNOT_DELETE_SELF" });
      }

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteError) {
        return jsonResponse(400, { error: deleteError.message });
      }
      return jsonResponse(200, { user_id: userId });
    }

    return jsonResponse(400, { error: "UNKNOWN_ACTION" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin users action failed";
    return jsonResponse(500, { error: message });
  }
});
