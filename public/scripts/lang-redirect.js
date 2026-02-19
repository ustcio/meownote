// Language redirect script - runs on every page load
(function() {
  try {
    // Skip if already on a language-prefixed path
    const path = window.location.pathname;
    const langMatch = path.match(/^\/(en|zh)(\/|$)/);
    
    // If URL already has language prefix, store it and exit
    if (langMatch) {
      const urlLang = langMatch[1];
      try {
        localStorage.setItem('preferred-lang', urlLang);
      } catch (e) {
        // localStorage might be disabled in private mode
        console.warn('Failed to save language preference:', e);
      }
      document.documentElement.setAttribute('lang', urlLang);
      return;
    }
    
    // Check for stored language preference
    let storedLang = null;
    try {
      storedLang = localStorage.getItem('preferred-lang');
    } catch (e) {
      // localStorage might be disabled
      console.warn('Failed to read language preference:', e);
    }
    
    // If no stored preference, default to 'en' and exit
    if (!storedLang || storedLang === 'en') {
      document.documentElement.setAttribute('lang', 'en');
      return;
    }
    
    // If stored language is not 'en', redirect to language-prefixed URL
    if (storedLang === 'zh') {
      const newPath = `/zh${path === '/' ? '' : path}`;
      // Prevent redirect loops
      if (path !== newPath) {
        // Use requestAnimationFrame to ensure DOM is ready before redirect
        // This prevents page flash
        requestAnimationFrame(() => {
          window.location.replace(newPath);
        });
      }
    }
  } catch (error) {
    // Global error boundary - don't break the page
    console.error('Language redirect script failed:', error);
    // Default to English on error
    document.documentElement.setAttribute('lang', 'en');
  }
})();
