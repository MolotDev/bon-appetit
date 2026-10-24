/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);

try {
  const navigationHandler = createHandlerBoundToURL("/index.html");
  registerRoute(new NavigationRoute(navigationHandler));
} catch {
  // index.html is not in the precache during some dev SW reloads
}

type PushPayload = {
  title?: string;
  body?: string;
  url?: string;
};

self.addEventListener("push", (event: PushEvent) => {
  const fallbackTitle = "Bon Appetit";
  let payload: PushPayload = {};

  if (event.data) {
    try {
      payload = event.data.json() as PushPayload;
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title?.trim() || fallbackTitle;
  const body = payload.body?.trim() || "";
  const url = payload.url?.trim() || "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data as { url?: string } | undefined)?.url ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          const focused = client as WindowClient;
          if (focused.url.includes(self.location.origin)) {
            return focused.focus().then((opened) => opened.navigate(targetUrl));
          }
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
