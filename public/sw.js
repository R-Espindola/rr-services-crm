self.addEventListener('push', (event) => {
  let message = {}
  try {
    message = event.data ? event.data.json() : {}
  } catch {
    message = { body: event.data ? event.data.text() : '' }
  }

  event.waitUntil(self.registration.showNotification(message.title || 'R&R Services', {
    body: message.body || 'A sua agenda foi atualizada.',
    icon: message.icon || '/rr-icon.svg',
    badge: message.badge || '/rr-icon.svg',
    data: { url: message.url || '/trabalhador/agenda' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const requestedUrl = event.notification.data && event.notification.data.url
  let targetUrl = new URL('/trabalhador/agenda', self.location.origin)
  if (typeof requestedUrl === 'string' && requestedUrl.startsWith('/')) {
    const candidateUrl = new URL(requestedUrl, self.location.origin)
    if (candidateUrl.origin === self.location.origin) targetUrl = candidateUrl
  }
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        return client.navigate(targetUrl.href).then(() => client.focus())
      }
    }
    return self.clients.openWindow(targetUrl.href)
  }))
})
