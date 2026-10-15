/**
 * Service Worker Registration for PWA support
 */
export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          // Check for SW updates periodically
          registration.onupdatefound = () => {
            const installingWorker = registration.installing
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New content is available and will be used when all tabs are closed
                  console.log('[PWA] Nova versão disponível da Defesa Civil.')
                }
              }
            }
          }
        })
        .catch((error) => {
          console.warn('[PWA] Falha ao registrar Service Worker:', error)
        })
    })
  }
}
