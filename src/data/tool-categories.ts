// 工具箱分类和工具列表
export interface ToolCategory {
  id: string;
  name: string;
  icon: string;
  tools: Tool[];
}

export interface Tool {
  id: string;
  name: string;
  desc: string;
  path: string;
  status: 'done' | 'todo'; // done = 已实现, todo = 待实现
}

export const toolCategories: ToolCategory[] = [
  {
    id: 'daily',
    name: '日常应用',
    icon: '📱',
    tools: [
      { id: 'hot-list', name: '即时热榜', desc: '实时查看各大平台热搜榜', path: '/kit/hot-list', status: 'todo' },
      { id: 'news', name: '每日早报', desc: '每日新闻早报资讯', path: '/kit/news', status: 'todo' },
      { id: 'gold', name: '今日黄金价格', desc: '实时查看黄金价格行情', path: '/kit/gold', status: 'done' },
      { id: 'box-office', name: '电影票房榜', desc: '实时查看中国电影票房排行', path: '/kit/box-office', status: 'todo' },
      { id: 'oil-price', name: '全国油价查询', desc: '查询全国最新油价信息', path: '/kit/oil-price', status: 'todo' },
      { id: 'weather', name: '天气预报', desc: '查看天气预报', path: '/kit/weather', status: 'todo' },
      { id: 'calendar', name: '万年历查询', desc: '公历、农历、节气信息', path: '/kit/calendar', status: 'todo' },
      { id: 'world-time', name: '世界时间', desc: '全球主要城市时间查询', path: '/kit/world-time', status: 'todo' },
      { id: 'phone-numbers', name: '常用号码查询', desc: '查询各类服务电话号码', path: '/kit/phone-numbers', status: 'todo' },
      { id: 'lottery', name: '彩票开奖查询', desc: '查询彩票开奖结果', path: '/kit/lottery', status: 'todo' },
      { id: 'university', name: '高校查询', desc: '查询全国高校信息', path: '/kit/university', status: 'todo' },
      { id: 'emoji', name: 'Emoji符号大全', desc: '查看各种Emoji表情符号', path: '/kit/emoji', status: 'todo' },
      { id: 'special-chars', name: '特殊符号大全', desc: '查看特殊符号', path: '/kit/special-chars', status: 'todo' },
      { id: 'country-codes', name: '国际电话区号', desc: '查询各国和地区的国际电话区号', path: '/kit/country-codes', status: 'todo' },
      { id: 'ascii-table', name: 'ASCII对照表', desc: '查看ASCII字符编码对照表', path: '/kit/ascii-table', status: 'todo' },
      { id: 'capitals', name: '世界各国首都', desc: '查询世界各国首都信息', path: '/kit/capitals', status: 'todo' },
      { id: 'country-codes-iso', name: '国家简码信息表', desc: '查询全球国家ISO代码信息', path: '/kit/country-codes-iso', status: 'todo' },
    ]
  },
  {
    id: 'query',
    name: '查询应用',
    icon: '🔍',
    tools: [
      { id: 'company', name: '企业查询', desc: '查询企业工商信息', path: '/kit/company', status: 'todo' },
      { id: 'location', name: '归属地查询', desc: '查询手机号、IP地址归属地', path: '/kit/location', status: 'todo' },
      { id: 'zipcode', name: '邮编查询', desc: '查询全国邮政编码', path: '/kit/zipcode', status: 'todo' },
      { id: 'latlng', name: '经纬度查询', desc: '根据经纬度查询地理位置', path: '/kit/latlng', status: 'todo' },
      { id: 'ip-lookup', name: '全球IP查询', desc: '查询IP地址归属地信息', path: '/kit/ip-lookup', status: 'todo' },
      { id: 'trademark', name: '商标查询', desc: '查询商标注册信息', path: '/kit/trademark', status: 'todo' },
      { id: 'website-lookup', name: '网站综合查询', desc: '查询网站备案、WHOIS等信息', path: '/kit/website-lookup', status: 'todo' },
      { id: 'license-plate', name: '车牌号码归属地', desc: '查询全国车牌简称及归属地', path: '/kit/license-plate', status: 'todo' },
    ]
  },
  {
    id: 'text',
    name: '文字应用',
    icon: '📝',
    tools: [
      { id: 'text', name: '文本工具', desc: '字数统计、大小写转换、去重、排版', path: '/kit/text', status: 'done' },
      { id: 'markdown-editor', name: 'Markdown编辑器', desc: '在线编辑Markdown', path: '/kit/markdown-editor', status: 'todo' },
      { id: 'text-diff', name: '文本对比', desc: '对比文本差异', path: '/kit/text-diff', status: 'todo' },
      { id: 'text-replace', name: '文本替换', desc: '正则表达式文本替换', path: '/kit/text-replace', status: 'todo' },
      { id: 'word-count', name: '字数统计', desc: '统计文本字数', path: '/kit/word-count', status: 'todo' },
      { id: 'url-extract', name: '文本提取网址', desc: '提取文本中URL', path: '/kit/url-extract', status: 'todo' },
      { id: 'invisible-chars', name: '魔法文案', desc: '不可见字符规避检测', path: '/kit/invisible-chars', status: 'todo' },
      { id: 'english-text', name: '英文文本转换', desc: '英文文本格式转换', path: '/kit/english-text', status: 'todo' },
      { id: 'text-blank-lines', name: '文本去空换行', desc: '文本空行换行处理', path: '/kit/text-blank-lines', status: 'todo' },
      { id: 'unicode', name: 'Unicode互转', desc: '字符与Unicode编码互转', path: '/kit/unicode', status: 'todo' },
      { id: 'punctuation', name: '中英文符号转换', desc: '中英文标点符号互转', path: '/kit/punctuation', status: 'todo' },
      { id: 'naming-convention', name: '驼峰/下划线命名', desc: '编程命名格式转换', path: '/kit/naming-convention', status: 'todo' },
      { id: 'text-dedup', name: '文本去重', desc: '文本行去重', path: '/kit/text-dedup', status: 'todo' },
      { id: 'link-extract', name: '链接批量提取', desc: '批量提取文本链接', path: '/kit/link-extract', status: 'todo' },
      { id: 'number-extract', name: '数字号码提取', desc: '批量提取数字号码', path: '/kit/number-extract', status: 'todo' },
      { id: 'text-to-list', name: '文本转列表', desc: '文本转列表格式', path: '/kit/text-to-list', status: 'todo' },
      { id: 'ip-extract', name: 'IP地址批量提取', desc: '批量提取IP地址', path: '/kit/ip-extract', status: 'todo' },
      { id: 'text-prefix-suffix', name: '文本行前缀/后缀', desc: '文本行前缀后缀添加', path: '/kit/text-prefix-suffix', status: 'todo' },
      { id: 'regex', name: '正则表达式测试', desc: '正则表达式测试工具', path: '/kit/regex', status: 'done' },
      { id: 'word-frequency', name: '词频统计', desc: '文本词频统计', path: '/kit/word-frequency', status: 'todo' },
      { id: 'datetime-format', name: '时间日期格式化', desc: '时间日期格式转换', path: '/kit/datetime-format', status: 'todo' },
      { id: 'keyword-filter', name: '关键词筛选过滤', desc: '关键词筛选过滤', path: '/kit/keyword-filter', status: 'todo' },
    ]
  },
  {
    id: 'json',
    name: 'JSON/数据',
    icon: '📊',
    tools: [
      { id: 'json', name: 'JSON解析', desc: 'JSON格式化与验证', path: '/kit/json', status: 'done' },
      { id: 'json-field-extract', name: 'JSON字段提取', desc: 'JSON数据字段提取', path: '/kit/json-field-extract', status: 'todo' },
      { id: 'cookie-to-json', name: 'Cookie转JSON', desc: 'Cookie转JSON格式', path: '/kit/cookie-to-json', status: 'todo' },
      { id: 'json-merge', name: 'JSON数据合并', desc: 'JSON数据合并格式化', path: '/kit/json-merge', status: 'todo' },
      { id: 'json-to-excel', name: 'JSON转Excel', desc: 'JSON数据转Excel文件', path: '/kit/json-to-excel', status: 'todo' },
      { id: 'excel-to-json', name: 'Excel转JSON', desc: 'Excel文件转JSON数据', path: '/kit/excel-to-json', status: 'todo' },
      { id: 'table-to-csv', name: '表格转CSV', desc: '将Excel表格转换为CSV文件', path: '/kit/table-to-csv', status: 'todo' },
    ]
  },
  {
    id: 'encrypt',
    name: '加密应用',
    icon: '🔐',
    tools: [
      { id: 'password', name: '随机密码生成', desc: '生成随机密码', path: '/kit/password', status: 'done' },
      { id: 'md5', name: 'MD5摘要', desc: '计算文本MD5摘要', path: '/kit/md5', status: 'todo' },
      { id: 'base64', name: 'Base64编码', desc: '文本与Base64互转', path: '/kit/base64', status: 'done' },
      { id: 'url-encode', name: 'URL编码', desc: '对URL进行编码', path: '/kit/url', status: 'done' },
      { id: 'rc4', name: 'RC4互转', desc: 'RC4加密和解密', path: '/kit/rc4', status: 'todo' },
      { id: 'rsa', name: 'RSA密钥对生成', desc: 'RSA密钥对生成器', path: '/kit/rsa', status: 'todo' },
      { id: 'sha', name: 'SHA加密', desc: 'SHA哈希加密工具', path: '/kit/sha', status: 'todo' },
      { id: 'aes', name: 'AES加密', desc: 'AES加密解密工具', path: '/kit/aes', status: 'todo' },
    ]
  },
  {
    id: 'image',
    name: '图片应用',
    icon: '🖼️',
    tools: [
      { id: 'image', name: '图片工具', desc: '图片压缩、格式转换、尺寸调整', path: '/kit/image', status: 'done' },
      { id: 'qrcode', name: '二维码生成', desc: '生成二维码', path: '/kit/qrcode', status: 'done' },
      { id: 'qrcode-parse', name: '二维码解析', desc: '解析二维码', path: '/kit/qrcode-parse', status: 'todo' },
      { id: 'qrcode-fix', name: '二维码修复', desc: '修复破损二维码', path: '/kit/qrcode-fix', status: 'todo' },
      { id: 'barcode', name: '条形码生成', desc: '生成条形码', path: '/kit/barcode', status: 'todo' },
      { id: 'image-compress', name: '图片压缩', desc: '压缩图片文件大小', path: '/kit/image-compress', status: 'todo' },
      { id: 'image-resize', name: '修改图片尺寸', desc: '自定义图片尺寸', path: '/kit/image-resize', status: 'todo' },
      { id: 'image-stitch', name: '图片拼接', desc: '图片拼接合成', path: '/kit/image-stitch', status: 'todo' },
      { id: 'image-format', name: '图片格式转换', desc: '支持多种图片格式互转', path: '/kit/image-format', status: 'todo' },
      { id: 'image-to-gif', name: '图片合成GIF', desc: '将多张图片合成为GIF动图', path: '/kit/image-to-gif', status: 'todo' },
      { id: 'gif-split', name: 'GIF图片帧拆分', desc: '将GIF动图拆分为单独的图片帧', path: '/kit/gif-split', status: 'todo' },
      { id: 'gif-edit', name: 'GIF图片帧修改', desc: '修改GIF动图效果', path: '/kit/gif-edit', status: 'todo' },
      { id: 'image-round', name: '图片圆角', desc: '为图片添加圆角效果', path: '/kit/image-round', status: 'todo' },
      { id: 'image-multi-size', name: '多尺寸图片批量生成', desc: '批量生成多尺寸图片', path: '/kit/image-multi-size', status: 'todo' },
      { id: 'icon-maker', name: '图标制作', desc: '制作各种尺寸图标文件', path: '/kit/icon-maker', status: 'todo' },
      { id: 'image-pixelate', name: '图片像素化马赛克', desc: '图片像素化马赛克效果', path: '/kit/image-pixelate', status: 'todo' },
      { id: 'image-crop', name: '图片裁剪', desc: '裁剪图片为指定尺寸', path: '/kit/image-crop', status: 'todo' },
      { id: 'base64-to-image', name: 'Base64转图片', desc: 'Base64编码转图片文件', path: '/kit/base64-to-image', status: 'todo' },
      { id: 'image-to-base64', name: '图片转Base64', desc: '图片文件转Base64编码', path: '/kit/image-to-base64', status: 'todo' },
      { id: 'color-preview', name: '颜色预览', desc: '颜色预览和格式转换', path: '/kit/color', status: 'done' },
      { id: 'image-cut', name: '图片水平/垂直切割', desc: '图片按指定方式均等切割', path: '/kit/image-cut', status: 'todo' },
      { id: 'image-watermark', name: '图片水印平铺', desc: '为图片添加平铺水印', path: '/kit/image-watermark', status: 'todo' },
      { id: 'image-bg-color', name: 'PNG图片背景色', desc: 'PNG图片添加背景色', path: '/kit/image-bg-color', status: 'todo' },
      { id: 'image-color-picker', name: '图片取色', desc: '图片颜色提取', path: '/kit/image-color-picker', status: 'todo' },
      { id: 'image-invert', name: '图像反相/反色', desc: '图像反相反色处理', path: '/kit/image-invert', status: 'todo' },
      { id: 'svg-preview', name: 'SVG图片预览', desc: 'SVG代码实时预览', path: '/kit/svg-preview', status: 'todo' },
      { id: 'solid-image', name: '纯色图片生成', desc: '生成纯色背景图片', path: '/kit/solid-image', status: 'todo' },
      { id: 'image-grayscale', name: '图像黑白化', desc: '彩色图片转黑白效果', path: '/kit/image-grayscale', status: 'todo' },
      { id: 'image-remove-bg', name: '单色图像抠图', desc: '单色背景图像快速抠图', path: '/kit/image-remove-bg', status: 'todo' },
      { id: 'image-remove-bg-ai', name: '去除图片背景', desc: '智能去除图片背景', path: '/kit/image-remove-bg-ai', status: 'todo' },
      { id: 'image-remove-watermark', name: '图片去水印', desc: '智能去除图片水印', path: '/kit/image-remove-watermark', status: 'todo' },
      { id: 'image-correct', name: '文档矫正增强', desc: '智能文档图片矫正', path: '/kit/image-correct', status: 'todo' },
      { id: 'image-remove-moire', name: '图片去摩尔纹', desc: '图片摩尔纹去除', path: '/kit/image-remove-moire', status: 'todo' },
      { id: 'face-enhance', name: '人脸清晰化', desc: '人脸清晰度提升', path: '/kit/face-enhance', status: 'todo' },
      { id: 'image-to-link', name: '图片转链接', desc: '图片转链接', path: '/kit/image-to-link', status: 'todo' },
    ]
  },
  {
    id: 'document',
    name: '文档应用',
    icon: '📄',
    tools: [
      { id: 'pdf-merge', name: 'PDF合并', desc: '合并多个PDF文件', path: '/kit/pdf-merge', status: 'todo' },
      { id: 'pdf-to-doc', name: 'PDF转文档', desc: 'PDF转换为Word或TXT', path: '/kit/pdf-to-doc', status: 'todo' },
      { id: 'pdf-encrypt', name: 'PDF加密', desc: '为PDF设置密码保护', path: '/kit/pdf-encrypt', status: 'todo' },
      { id: 'pdf-decrypt', name: 'PDF解密', desc: '移除PDF密码保护', path: '/kit/pdf-decrypt', status: 'todo' },
      { id: 'pdf-compress', name: 'PDF压缩', desc: '压缩PDF，支持画质与分辨率设置', path: '/kit/pdf-compress', status: 'todo' },
      { id: 'image-to-pdf', name: '图片转PDF', desc: '图片转换为PDF', path: '/kit/image-to-pdf', status: 'todo' },
      { id: 'pdf-to-image', name: 'PDF转图片', desc: 'PDF转换为图片', path: '/kit/pdf-to-image', status: 'todo' },
      { id: 'doc-to-image', name: '文档转图片', desc: '文档转换为图片', path: '/kit/doc-to-image', status: 'todo' },
      { id: 'word-to-md', name: 'Word转Markdown', desc: 'Word转换为Markdown', path: '/kit/word-to-md', status: 'todo' },
      { id: 'md-to-file', name: 'Markdown转文件', desc: 'Markdown转换为其他格式', path: '/kit/md-to-file', status: 'todo' },
      { id: 'doc-to-pdf', name: '文档转PDF', desc: '文档转换为PDF', path: '/kit/doc-to-pdf', status: 'todo' },
      { id: 'rich-editor', name: '富文本编辑器', desc: '在线富文本编辑器', path: '/kit/rich-editor', status: 'todo' },
    ]
  },
  {
    id: 'audio',
    name: '音频应用',
    icon: '🎵',
    tools: [
      { id: 'audio-convert', name: '音频格式转换', desc: '支持多种音频格式互转', path: '/kit/audio-convert', status: 'todo' },
      { id: 'audio-cut', name: '音频裁剪', desc: '裁剪音频片段', path: '/kit/audio-cut', status: 'todo' },
      { id: 'audio-compress', name: '音频压缩', desc: '压缩音频文件大小', path: '/kit/audio-compress', status: 'todo' },
      { id: 'audio-volume', name: '音频音量修改', desc: '调整音频音量', path: '/kit/audio-volume', status: 'todo' },
      { id: 'audio-speed', name: '音频调速', desc: '调节音频播放速度', path: '/kit/audio-speed', status: 'todo' },
      { id: 'audio-merge', name: '音频拼接', desc: '合并多段音频', path: '/kit/audio-merge', status: 'todo' },
    ]
  },
  {
    id: 'video',
    name: '视频应用',
    icon: '🎬',
    tools: [
      { id: 'screen-record', name: '录屏', desc: '录制屏幕内容', path: '/kit/screen-record', status: 'todo' },
      { id: 'video-convert', name: '视频格式转换', desc: '支持多种视频格式互转', path: '/kit/video-convert', status: 'todo' },
      { id: 'video-compress', name: '视频压缩', desc: '压缩视频文件大小', path: '/kit/video-compress', status: 'todo' },
      { id: 'video-extract-audio', name: '视频提取音频', desc: '提取视频中的音频', path: '/kit/video-extract-audio', status: 'todo' },
      { id: 'video-speed', name: '视频变速', desc: '调节视频播放速度', path: '/kit/video-speed', status: 'todo' },
      { id: 'video-merge', name: '视频拼接', desc: '合并多段视频', path: '/kit/video-merge', status: 'todo' },
      { id: 'video-cut', name: '视频裁剪', desc: '裁剪视频片段', path: '/kit/video-cut', status: 'todo' },
      { id: 'video-volume', name: '视频音量修改', desc: '调整视频音量', path: '/kit/video-volume', status: 'todo' },
      { id: 'video-to-gif', name: '视频转GIF', desc: '将视频转换为GIF动图', path: '/kit/video-to-gif', status: 'todo' },
    ]
  },
  {
    id: 'converter',
    name: '单位转换',
    icon: '🔄',
    tools: [
      { id: 'currency', name: '汇率转换', desc: '货币汇率转换', path: '/kit/currency', status: 'todo' },
      { id: 'time-convert', name: '时间转换', desc: '时间戳与日期互转', path: '/kit/timestamp', status: 'done' },
      { id: 'area', name: '面积转换', desc: '面积单位转换', path: '/kit/area', status: 'todo' },
      { id: 'volume', name: '体积转换', desc: '体积单位转换', path: '/kit/volume', status: 'todo' },
      { id: 'energy', name: '功热转换', desc: '功热单位转换', path: '/kit/energy', status: 'todo' },
      { id: 'speed', name: '速度转换', desc: '速度单位转换', path: '/kit/speed', status: 'todo' },
      { id: 'temperature', name: '温度转换', desc: '温度单位转换', path: '/kit/temperature', status: 'todo' },
      { id: 'base-convert', name: '进制转换', desc: '2-16进制任意转换', path: '/kit/base-convert', status: 'todo' },
    ]
  },
  {
    id: 'programming',
    name: '编程应用',
    icon: '💻',
    tools: [
      { id: 'url-encode-decode', name: 'URL编码解码', desc: 'URL编码解码工具', path: '/kit/url', status: 'done' },
      { id: 'xml-format', name: 'XML美化/压缩', desc: 'XML代码美化压缩', path: '/kit/xml-format', status: 'todo' },
      { id: 'sql-format', name: 'SQL美化/压缩', desc: 'SQL代码美化压缩', path: '/kit/sql-format', status: 'todo' },
      { id: 'file-base64', name: '文件Base64互转', desc: '文件与Base64编码互转', path: '/kit/file-base64', status: 'todo' },
      { id: 'dir-tree', name: '目录树转换', desc: '目录树结构与目录列表互转', path: '/kit/dir-tree', status: 'todo' },
      { id: 'mac-generator', name: 'MAC随机生成', desc: '生成随机MAC地址', path: '/kit/mac-generator', status: 'todo' },
      { id: 'ua-generator', name: '浏览器UA查询', desc: '查询浏览器UserAgent信息', path: '/kit/ua-generator', status: 'todo' },
      { id: 'ua-generator-adv', name: 'UserAgent生成器', desc: '生成浏览器设备UserAgent', path: '/kit/ua-generator-adv', status: 'todo' },
      { id: 'binary-text', name: '二进制转文本', desc: '二进制等格式互转', path: '/kit/binary-text', status: 'todo' },
      { id: 'css-to-js', name: 'CSS转JS', desc: 'CSS转JavaScript对象', path: '/kit/css-to-js', status: 'todo' },
      { id: 'html-run', name: 'HTML运行', desc: '在线编辑和预览HTML代码', path: '/kit/html-run', status: 'todo' },
      { id: 'html-remove-tags', name: 'HTML标签去除', desc: 'HTML指定标签移除', path: '/kit/html-remove-tags', status: 'todo' },
      { id: 'html-strip', name: 'HTML运行去除标签', desc: 'HTML代码中所有标签的移除和文本提取', path: '/kit/html-strip', status: 'todo' },
      { id: 'scss-to-css', name: 'SCSS转CSS', desc: 'SCSS/Sass转CSS', path: '/kit/scss-to-css', status: 'todo' },
      { id: 'browser-fingerprint', name: '浏览器指纹检测', desc: '检测浏览器指纹信息', path: '/kit/browser-fingerprint', status: 'todo' },
      { id: 'meta-generator', name: '网页META生成器', desc: '生成网页META标签', path: '/kit/meta-generator', status: 'todo' },
      { id: 'link-to-hyperlink', name: '链接列表转超链接', desc: '链接列表转超链接格式', path: '/kit/link-to-hyperlink', status: 'todo' },
      { id: 'crontab', name: 'Crontab表达式', desc: 'Crontab表达式解析', path: '/kit/crontab', status: 'todo' },
      { id: 'uuid', name: 'UUID生成器', desc: '生成和验证UUID', path: '/kit/uuid', status: 'todo' },
      { id: 'regex-library', name: '正则表达式大全', desc: '常用正则表达式大全', path: '/kit/regex-library', status: 'todo' },
    ]
  },
  {
    id: 'life',
    name: '生活应用',
    icon: '🏠',
    tools: [
      { id: 'id-card', name: '身份证查询', desc: '身份证号码验证', path: '/kit/id-card', status: 'todo' },
      { id: 'due-date', name: '预产期计算器', desc: '预产期计算', path: '/kit/due-date', status: 'todo' },
      { id: 'bmi', name: 'BMI身体质量指数', desc: 'BMI身体质量指数计算', path: '/kit/bmi', status: 'todo' },
      { id: 'period', name: '女性生理期', desc: '生理期计算', path: '/kit/period', status: 'todo' },
      { id: 'relative', name: '亲戚称呼换算', desc: '亲戚称呼关系计算', path: '/kit/relative', status: 'todo' },
      { id: 'random-number', name: '随机数生成', desc: '生成随机数', path: '/kit/random-number', status: 'todo' },
      { id: 'morse', name: '电报码翻译', desc: '摩尔斯电报码转换', path: '/kit/morse', status: 'todo' },
      { id: 'credit-card', name: '信用卡利率计算', desc: '信用卡利率计算', path: '/kit/credit-card', status: 'todo' },
      { id: 'dynasty', name: '历史朝代年份', desc: '历史朝代年份查询', path: '/kit/dynasty', status: 'todo' },
      { id: 'heavenly-stems', name: '日期天干地支', desc: '日期天干地支计算器', path: '/kit/heavenly-stems', status: 'todo' },
    ]
  },
  {
    id: 'academic',
    name: '学术工具',
    icon: '🎓',
    tools: [
      { id: 'academic', name: '学术工具集', desc: 'DOI引用、BibTeX、期刊查询等', path: '/kit/academic', status: 'done' },
    ]
  },
];

// 获取所有工具列表
export const allTools = toolCategories.flatMap(cat => cat.tools);

// 根据 ID 查找工具
export function findToolById(id: string): Tool | undefined {
  return allTools.find(t => t.id === id);
}

// 根据分类 ID 查找分类
export function findCategoryById(id: string): ToolCategory | undefined {
  return toolCategories.find(c => c.id === id);
}
