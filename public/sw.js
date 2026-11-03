self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "A little time for yourself 🌷", body: "Fancy doing something you love?", url: "/?view=ideas" };
  }

  const title = typeof data.title === "string" ? data.title : "A little time for yourself 🌷";
  const options = {
    body: typeof data.body === "string" ? data.body : "Fancy doing something you love?",
    icon: typeof data.icon === "string" ? data.icon : "/icon-192.png",
    badge: typeof data.badge === "string" ? data.badge : "/icon-192.png",
    tag: typeof data.tag === "string" ? data.tag : "hobbymaxxing-reminder",
    data: { url: typeof data.url === "string" ? data.url : "/?view=ideas" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? "/?view=ideas", self.location.origin);
  if (target.origin !== self.location.origin) target.href = new URL("/?view=ideas", self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && "focus" in client) {
        const focused = await client.focus();
        if (focused && "navigate" in focused) await focused.navigate(target.href);
        return;
      }
    }
    await self.clients.openWindow(target.href);
  })());
});
