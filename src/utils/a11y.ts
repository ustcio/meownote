export function focusElement(element: HTMLElement | null): void {
  if (element) {
    element.focus({ preventScroll: false });
  }
}

export function focusFirstFocusable(container: HTMLElement): void {
  const focusable = getFocusableElements(container);
  if (focusable.length > 0) {
    focusable[0].focus();
  }
}

export function focusLastFocusable(container: HTMLElement): void {
  const focusable = getFocusableElements(container);
  if (focusable.length > 0) {
    focusable[focusable.length - 1].focus();
  }
}

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');
  
  return Array.from(container.querySelectorAll<HTMLElement>(selector))
    .filter(el => el.offsetParent !== null);
}

export function trapFocus(container: HTMLElement): () => void {
  const focusable = getFocusableElements(container);
  const firstFocusable = focusable[0];
  const lastFocusable = focusable[focusable.length - 1];
  
  const handler = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  };
  
  container.addEventListener('keydown', handler);
  
  return () => container.removeEventListener('keydown', handler);
}

export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcer = document.createElement('div');
  announcer.setAttribute('aria-live', priority);
  announcer.setAttribute('aria-atomic', 'true');
  announcer.className = 'sr-only';
  announcer.style.cssText = `
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  `;
  
  document.body.appendChild(announcer);
  
  setTimeout(() => {
    announcer.textContent = message;
  }, 100);
  
  setTimeout(() => {
    announcer.remove();
  }, 1000);
}

export function skipToContent(): void {
  const main = document.querySelector('main') || document.querySelector('#main-content');
  if (main) {
    (main as HTMLElement).focus();
    main.scrollIntoView({ behavior: 'smooth' });
  }
}

export function isKeyboardUser(): boolean {
  return document.body.classList.contains('using-keyboard');
}

export function setupKeyboardDetection(): void {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      document.body.classList.add('using-keyboard');
      document.body.classList.remove('using-mouse');
    }
  });
  
  document.addEventListener('mousedown', () => {
    document.body.classList.add('using-mouse');
    document.body.classList.remove('using-keyboard');
  });
}

export function getAccessibleName(element: HTMLElement): string {
  return (
    element.getAttribute('aria-label') ||
    element.getAttribute('aria-labelledby') 
      ? document.getElementById(element.getAttribute('aria-labelledby')!)?.textContent || ''
      : element.textContent?.trim() ||
    element.getAttribute('title') ||
    ''
  );
}

export function setAriaExpanded(element: HTMLElement, expanded: boolean): void {
  element.setAttribute('aria-expanded', String(expanded));
}

export function setAriaSelected(element: HTMLElement, selected: boolean): void {
  element.setAttribute('aria-selected', String(selected));
}

export function setAriaChecked(element: HTMLElement, checked: boolean | 'mixed'): void {
  element.setAttribute('aria-checked', String(checked));
}

export function generateAriaId(prefix: string = 'aria'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}
