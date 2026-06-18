// Service Worker para Notificações Persistentes e Background
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Escutar mensagens do app principal
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    event.waitUntil(
      self.registration.showNotification(title, {
        ...options,
        badge: '/favicon.ico',
        timestamp: Date.now(),
        // Configurações para forçar visibilidade e som do sistema
        priority: 2, // Max priority
        vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450, 110, 200, 110, 170],
        tag: 'menu-update-alert',
        renotify: true
      })
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  // Focar na aba existente ou abrir uma nova
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
            break;
          }
        }
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
