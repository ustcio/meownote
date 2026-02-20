export const languages = {
  zh: '中文',
} as const;

export const defaultLang = 'zh';

export type Lang = keyof typeof languages;

export const ui = {
  zh: {
    'nav.home': '首页',
    'nav.research': '研究',
    'nav.chatbot': '聊天机器人',
    'nav.kit': '工具箱',
    'nav.about': '关于',
    'nav.profile': '个人资料',
    'hero.title': '构建未来，从',
    'hero.gradient': 'USTC DEV',
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
    'chatbot.newChat': '新对话',
    'chatbot.chatHistory': '对话历史',
    'chatbot.today': '今天',
    'chatbot.last7Days': '过去 7 天',
    'chatbot.earlier': '更早',
    'chatbot.search': '搜索对话...',
    'chatbot.closeSidebar': '关闭侧边栏',
    'chatbot.searchHistory': '搜索对话历史',
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
    'aria.toggleMenu': '切换菜单',
    'aria.mainNav': '主导航',
    'aria.mobileNav': '移动端导航',
    'aria.selectModel': '选择模型',
    'aria.modelList': '模型列表',
    'aria.chatInput': '聊天输入框',
    'aria.sendMessage': '发送消息',
    'aria.stopGeneration': '停止生成',
    'aria.openMenu': '打开菜单',
    'aria.chatHistory': '对话历史',
    'aria.closeSidebar': '关闭侧边栏',
    'aria.searchHistory': '搜索对话历史',
    'aria.messagesList': '消息列表',
    'aria.chatArea': '对话区域',
    'chatbot.settings': '设置',
    'chatbot.clearChats': '清空对话',
    'chatbot.exportChat': '导出对话',
    'chatbot.welcomeTitle': '你好，我是 Meow',
    'chatbot.welcomeSubtitle': '你的智能 AI 助手，支持通义千问和豆包 2.0 系列模型',
    'chatbot.quickStart': '快速开始',
    'chatbot.writeCode': '编写代码',
    'chatbot.answerQuestion': '解答问题',
    'chatbot.writeDocument': '撰写文档',
    'chatbot.brainstorm': '头脑风暴',
    'chatbot.inputHint': 'AI 生成内容可能不准确，请核实重要信息',
    'chatbot.writeCodePrompt': '帮我写一段 Python 代码，实现快速排序算法',
    'chatbot.answerQuestionPrompt': '帮我解释一下量子计算的基本原理',
    'chatbot.writeDocumentPrompt': '帮我写一封商务邮件，主题是项目进度汇报',
    'chatbot.brainstormPrompt': '帮我想一些创意，关于如何提升团队效率',
    'chatbot.inputPlaceholder': '输入消息...（Shift+Enter 换行）',
  },
} as const;

export function getLangFromUrl(_url: URL): Lang {
  return 'zh';
}

export function useTranslations(_lang: Lang) {
  return function t(key: keyof typeof ui[typeof defaultLang]): string {
    return ui.zh[key] || '';
  };
}
