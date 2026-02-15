export const languages = {
  en: 'English',
  zh: '中文',
} as const;

export const defaultLang = 'en';

export type Lang = keyof typeof languages;

export const ui = {
  en: {
    'nav.home': 'Home',
    'nav.research': 'Research',
    'nav.chatbot': 'ChatBot',
    'nav.kit': 'Kit',
    'nav.about': 'About',
    'hero.title': 'Build the future with',
    'hero.gradient': 'AGI.',
    'hero.subtitle': 'Powerful AI tools and intelligent assistants for developers and creators.',
    'hero.cta.primary': 'Get Started',
    'hero.cta.secondary': 'Learn More',
    'stats.visitors': 'Visitors',
    'stats.online': 'Online Now',
    'footer.rights': 'All rights reserved.',
    'footer.privacy': 'Privacy Policy',
    'footer.terms': 'Terms of Service',
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'chatbot.title': 'AI Assistant',
    'chatbot.placeholder': 'Type your message...',
    'chatbot.send': 'Send',
    'kit.title': 'Super Kit',
    'kit.subtitle': 'Professional tools for your workflow',
    'kit.category.finance': 'Finance',
    'kit.category.network': 'Network',
    'kit.category.security': 'Security',
    'kit.category.converter': 'Converter',
    'research.title': 'AI Timeline',
    'research.subtitle': 'Key moments in artificial intelligence history',
    'about.title': 'About',
    'about.subtitle': 'Building the future of AI',
    'auth.login': 'Login',
    'auth.signup': 'Sign Up',
    'auth.logout': 'Logout',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.username': 'Username',
    'auth.confirmPassword': 'Confirm Password',
    'auth.noAccount': "Don't have an account?",
    'auth.hasAccount': 'Already have an account?',
    'auth.loginSuccess': 'Login successful!',
    'auth.signupSuccess': 'Registration successful!',
    'auth.loginError': 'Login failed',
    'auth.signupError': 'Registration failed',
  },
  zh: {
    'nav.home': '首页',
    'nav.research': '研究',
    'nav.chatbot': '聊天机器人',
    'nav.kit': '工具箱',
    'nav.about': '关于',
    'hero.title': '构建未来，从',
    'hero.gradient': 'AGI 开始',
    'hero.subtitle': '为开发者和创作者打造的强大AI工具和智能助手。',
    'hero.cta.primary': '开始使用',
    'hero.cta.secondary': '了解更多',
    'stats.visitors': '访问者',
    'stats.online': '当前在线',
    'footer.rights': '保留所有权利。',
    'footer.privacy': '隐私政策',
    'footer.terms': '服务条款',
    'theme.light': '浅色',
    'theme.dark': '深色',
    'chatbot.title': 'AI 助手',
    'chatbot.placeholder': '输入您的消息...',
    'chatbot.send': '发送',
    'kit.title': '超级工具箱',
    'kit.subtitle': '专业工具助力您的工作流程',
    'kit.category.finance': '金融',
    'kit.category.network': '网络',
    'kit.category.security': '安全',
    'kit.category.converter': '转换',
    'research.title': 'AI 大事记',
    'research.subtitle': '人工智能发展史上的重要时刻',
    'about.title': '关于',
    'about.subtitle': '构建AI的未来',
    'auth.login': '登录',
    'auth.signup': '注册',
    'auth.logout': '退出登录',
    'auth.email': '邮箱',
    'auth.password': '密码',
    'auth.username': '用户名',
    'auth.confirmPassword': '确认密码',
    'auth.noAccount': '还没有账号？',
    'auth.hasAccount': '已有账号？',
    'auth.loginSuccess': '登录成功！',
    'auth.signupSuccess': '注册成功！',
    'auth.loginError': '登录失败',
    'auth.signupError': '注册失败',
  },
} as const;

export function getLangFromUrl(url: URL): Lang {
  const [, lang] = url.pathname.split('/');
  if (lang in ui) return lang as Lang;
  return defaultLang;
}

export function useTranslations(lang: Lang) {
  return function t(key: keyof typeof ui[typeof defaultLang]): string {
    return ui[lang][key] || ui[defaultLang][key];
  };
}
