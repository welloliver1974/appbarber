self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const { title = 'Notificação', body = '', url = '/' } = data
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      data: { url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(clients.openWindow(url))
})
