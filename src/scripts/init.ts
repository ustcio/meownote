import { errorHandler } from '@/utils/error-handler';
import { performanceMonitor } from '@/utils/performance';
import { setupKeyboardDetection } from '@/utils/a11y';

export function initializeApp(): void {
  errorHandler.init();
  performanceMonitor.init();
  setupKeyboardDetection();
  
  setupAuthListener();
  setupServiceWorker();
  
  console.log('[App] Initialized successfully');
}

function setupAuthListener(): void {
  window.addEventListener('auth:unauthorized', () => {
    console.log('[Auth] Unauthorized - redirecting to login');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    
    if (window.location.pathname !== '/') {
      window.location.href = '/';
    }
  });
  
  window.addEventListener('auth:login', ((event: CustomEvent) => {
    console.log('[Auth] User logged in:', event.detail);
  }) as EventListener);
  
  window.addEventListener('auth:logout', () => {
    console.log('[Auth] User logged out');
  });
}

async function setupServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[SW] Registered:', registration.scope);
    } catch (error) {
      console.warn('[SW] Registration failed:', error);
    }
  }
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }
}
