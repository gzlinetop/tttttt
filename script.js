// script.js (añade/actualiza estas secciones al inicio o donde registras el SW)
// Nota: reemplaza 'VAPID_PUBLIC_KEY_BASE64URL' por tu clave pública VAPID (base64url) y
// '/subscribe' por tu endpoint servidor que recibe la suscripción.

async function registerServiceWorkerAndFeatures() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('SW registrado', reg);

    // -------- Background Sync (simple) --------
    // Si quieres encolar una petición desde la página:
    // navigator.serviceWorker.ready.then(reg => reg.active.postMessage({ type:'enqueue', payload:{ url:'/api/send', options:{method:'POST', body: JSON.stringify({x:1}), headers:{'Content-Type':'application/json'} } } }));

    // -------- Periodic Background Sync (si está disponible) --------
    if ('periodicSync' in reg) {
      try {
        // Solicitar permiso 'periodic-background-sync'
        const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
        if (status.state === 'granted') {
          // registra con intervalo mínimo en segundos (ej: 24h = 86400)
          await reg.periodicSync.register('daily-sync', { minInterval: 24 * 60 * 60 });
          console.log('Periodic sync registrada: daily-sync');
        } else {
          console.log('Sin permiso para periodic-background-sync:', status.state);
        }
      } catch (e) {
        console.warn('No se pudo registrar periodic sync', e);
      }
    }

    // -------- Push notifications (solicitar permiso y suscribirse) --------
    // NOTA: requiere servidor con clave VAPID y endpoint para recibir la suscripción.
    const wantPush = true; // cambia según quieras auto-suscribir
    if (wantPush && 'PushManager' in window) {
      // pedir permiso de notificaciones
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        // Reemplaza con tu clave pública VAPID en base64url
        const VAPID_PUBLIC_KEY = 'VAPID_PUBLIC_KEY_BASE64URL';
        try {
          const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
          });
          // enviar la suscripción a tu servidor para que guarde y envíe push
          await fetch('/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription)
          });
          console.log('Suscripción push registrada en servidor');
        } catch (e) {
          console.warn('No se pudo suscribir a push:', e);
        }
      } else {
        console.log('Permiso de notificaciones:', perm);
      }
    }
  } catch (err) {
    console.error('Registro SW falló', err);
  }
}

// Helper: convierte clave VAPID base64url a Uint8Array
function urlBase64ToUint8Array(base64String) {
  // base64url -> base64
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Ejecutar registro al cargar
window.addEventListener('load', () => {
  registerServiceWorkerAndFeatures().catch(e => console.error(e));
});
