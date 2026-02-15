export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(date: Date, lang: string = 'en'): string {
  const locale = lang === 'zh' ? 'zh-CN' : 'en-US';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatNumber(num: number, lang: string = 'en'): string {
  const locale = lang === 'zh' ? 'zh-CN' : 'en-US';
  return new Intl.NumberFormat(locale).format(num);
}
