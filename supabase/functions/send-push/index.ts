import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { buildPushPayload } from "npm:@block65/webcrypto-web-push@1.0.2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PushKeys = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type SendPushRequest = {
  title: string;
  body: string;
  url?: string;
  subscriptions?: PushKeys[];
  user_ids?: string[];
};

type SendPushResult = {
  sent: number;
  failed: number;
  removed: number;
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

function isPushKeys(value: unknown): value is PushKeys {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.endpoint === "string" &&
    row.endpoint.length > 0 &&
    typeof row.p256dh === "string" &&
    row.p256dh.length > 0 &&
    typeof row.auth === "string" &&
    row.auth.length > 0
  );
}

function uniqueByEndpoint(rows: PushKeys[]): PushKeys[] {
  const map = new Map<string, PushKeys>();
  for (const row of rows) {
    map.set(row.endpoint, row);
  }
  return [...map.values()];
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
    const vapidPublicKey = requiredEnv("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = requiredEnv("VAPID_PRIVATE_KEY");
    const vapidSubject =
      Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@bon-appetit.local";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, { error: "Missing Authorization header" });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: isAdmin, error: adminError } = await userClient.rpc(
      "is_admin",
    );
    if (adminError) {
      return jsonResponse(401, { error: adminError.message });
    }
    if (isAdmin !== true) {
      return jsonResponse(403, { error: "Only ADMIN can send push notifications" });
    }

    const parsed: unknown = await req.json();
    if (typeof parsed !== "object" || parsed === null) {
      return jsonResponse(400, { error: "Invalid JSON body" });
    }

    const input = parsed as SendPushRequest;
    if (typeof input.title !== "string" || input.title.trim().length === 0) {
      return jsonResponse(400, { error: "title is required" });
    }
    if (typeof input.body !== "string" || input.body.trim().length === 0) {
      return jsonResponse(400, { error: "body is required" });
    }

    const fromBody = (input.subscriptions ?? []).filter(isPushKeys);
    const userIds = (input.user_ids ?? []).filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    );

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let fromDb: PushKeys[] = [];
    if (userIds.length > 0) {
      const { data, error } = await adminClient
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .in("user_id", userIds);
      if (error) {
        return jsonResponse(500, { error: error.message });
      }
      fromDb = (data ?? []).filter(isPushKeys);
    } else if (fromBody.length === 0) {
      const { data, error } = await adminClient
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth");
      if (error) {
        return jsonResponse(500, { error: error.message });
      }
      fromDb = (data ?? []).filter(isPushKeys);
    }

    const targets = uniqueByEndpoint([...fromBody, ...fromDb]);
    if (targets.length === 0) {
      return jsonResponse(200, { sent: 0, failed: 0, removed: 0 } satisfies SendPushResult);
    }

    const payload = JSON.stringify({
      title: input.title.trim(),
      body: input.body.trim(),
      url: typeof input.url === "string" ? input.url : "/",
    });

    const result: SendPushResult = { sent: 0, failed: 0, removed: 0 };
    const staleEndpoints: string[] = [];

    for (const target of targets) {
      try {
        const requestInit = await buildPushPayload(
          {
            data: payload,
            options: {
              ttl: 60 * 60,
              urgency: "normal",
            },
          },
          {
            endpoint: target.endpoint,
            expirationTime: null,
            keys: {
              p256dh: target.p256dh,
              auth: target.auth,
            },
          },
          {
            subject: vapidSubject,
            publicKey: vapidPublicKey,
            privateKey: vapidPrivateKey,
          },
        );

        const response = await fetch(target.endpoint, requestInit);
        if (response.ok || response.status === 201) {
          result.sent += 1;
          continue;
        }

        if (response.status === 404 || response.status === 410) {
          staleEndpoints.push(target.endpoint);
          result.removed += 1;
          continue;
        }

        result.failed += 1;
      } catch {
        result.failed += 1;
      }
    }

    if (staleEndpoints.length > 0) {
      await adminClient
        .from("push_subscriptions")
        .delete()
        .in("endpoint", staleEndpoints);
    }

    return jsonResponse(200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Push send failed";
    return jsonResponse(500, { error: message });
  }
});
