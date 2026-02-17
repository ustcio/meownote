// Language redirect script - runs on every page load
(function() {
  // Skip if already on a language-prefixed path
  const path = window.location.pathname;
  const langMatch = path.match(/^\/(en|zh)(\/|$)/);
  
  // If URL already has language prefix, store it and exit
  if (langMatch) {
    const urlLang = langMatch[1];
    localStorage.setItem('preferred-lang', urlLang);
    document.documentElement.setAttribute('lang', urlLang);
    return;
  }
  
  // Check for stored language preference
  const storedLang = localStorage.getItem('preferred-lang');
  
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
      window.location.replace(newPath);
    }
  }
})();
