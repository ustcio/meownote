import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pagesDir = path.join(__dirname, '../src/pages/kit');

const baseStyle = `
<style>
  .tool-page {
    min-height: 100vh;
    padding: calc(var(--header-total-height) + var(--space-6)) var(--space-4) var(--space-16);
    background: var(--bg-primary);
  }
  .tool-container { max-width: 900px; margin: 0 auto; }
  .tool-header { margin-bottom: var(--space-6); }
  .back-link {
    display: inline-flex; align-items: center; gap: var(--space-2);
    color: var(--text-secondary); text-decoration: none; font-size: var(--text-sm);
    margin-bottom: var(--space-4); transition: color var(--duration-fast) var(--ease-default);
  }
  .back-link:hover { color: var(--text-primary); }
  .tool-title { font-size: var(--text-2xl); font-weight: var(--font-bold); color: var(--text-primary); margin-bottom: var(--space-2); }
  .tool-description { font-size: var(--text-sm); color: var(--text-secondary); }
  .tool-main {
    background: var(--bg-secondary); border: 1px solid var(--border-primary);
    border-radius: var(--radius-xl); padding: var(--space-6); min-height: 400px;
  }
  .tool-content { display: flex; flex-direction: column; gap: var(--space-4); }
  .form-group { display: flex; flex-direction: column; gap: var(--space-2); }
  .form-label { font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--text-primary); }
  .form-input, .form-textarea, .form-select {
    padding: var(--space-3); background: var(--bg-primary); border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg); color: var(--text-primary); font-size: var(--text-sm); font-family: inherit;
  }
  .form-input:focus, .form-textarea:focus, .form-select:focus { outline: none; border-color: var(--color-primary); }
  .form-textarea { min-height: 120px; resize: vertical; font-family: var(--font-mono); }
  .form-select { cursor: pointer; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2);
    padding: var(--space-3) var(--space-4); border: none; border-radius: var(--radius-lg);
    font-size: var(--text-sm); font-weight: var(--font-medium); cursor: pointer;
    transition: all var(--duration-fast) var(--ease-default);
  }
  .btn-primary { background: var(--color-primary); color: #fffdf9; }
  .btn-primary:hover { box-shadow: 0 4px 12px rgba(217, 119, 87, 0.3); }
  .btn-secondary { background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-primary); }
  .btn-secondary:hover { background: var(--bg-hover); }
  .btn-group { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  .result-area {
    padding: var(--space-4); background: var(--bg-primary); border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg); font-family: var(--font-mono); font-size: var(--text-sm);
    white-space: pre-wrap; word-break: break-all; max-height: 400px; overflow-y: auto;
  }
  .checkbox-group { display: flex; flex-wrap: wrap; gap: var(--space-3); }
  .checkbox-group label { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); color: var(--text-secondary); cursor: pointer; }
  .stats-bar { display: flex; gap: var(--space-4); flex-wrap: wrap; margin-bottom: var(--space-4); }
  .stat-item { background: var(--bg-primary); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--text-sm); }
  .stat-item strong { color: var(--color-primary); }
  .search-bar { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); }
  .search-bar .form-input { flex: 1; }
  .data-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
  .data-table th, .data-table td { padding: var(--space-2) var(--space-3); text-align: left; border-bottom: 1px solid var(--border-primary); }
  .data-table th { background: var(--bg-tertiary); font-weight: var(--font-medium); position: sticky; top: 0; }
  .data-table tr:hover { background: var(--bg-hover); }
  .table-wrapper { max-height: 500px; overflow-y: auto; border: 1px solid var(--border-primary); border-radius: var(--radius-lg); }
  .emoji-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: var(--space-2); }
  .emoji-item { display: flex; flex-direction: column; align-items: center; padding: var(--space-2); border-radius: var(--radius-md); cursor: pointer; transition: background var(--duration-fast) var(--ease-default); }
  .emoji-item:hover { background: var(--bg-hover); }
  .emoji-item .emoji { font-size: 1.5rem; }
  .emoji-item .code { font-size: var(--text-xs); color: var(--text-tertiary); font-family: var(--font-mono); }
  .tag-list { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .tag { background: var(--bg-tertiary); border: 1px solid var(--border-primary); padding: var(--space-1) var(--space-3); border-radius: var(--radius-full); font-size: var(--text-xs); }
  @media (max-width: 768px) {
    .tool-main { padding: var(--space-4); }
    .btn-group { flex-direction: column; }
    .btn { width: 100%; }
  }
</style>`;

function generateToolPage(filename, title, desc, html, script) {
  const content = `---
import Layout from '@layouts/Layout.astro';

const toolName = '${title}';
const toolDesc = '${desc}';
---

<Layout title={toolName + ' - 工具箱 - Maxwell.Science'} description={toolDesc}>
  <section class="tool-page">
    <div class="tool-container">
      <header class="tool-header">
        <a href="/kit" class="back-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          返回工具箱
        </a>
        <h1 class="tool-title">{toolName}</h1>
        <p class="tool-description">{toolDesc}</p>
      </header>

      <main class="tool-main">
        <div class="tool-content" id="tool-content">${html}
        </div>
      </main>
    </div>
  </section>
</Layout>
${baseStyle}
<script>${script}
</script>
`;

  const filePath = path.join(pagesDir, filename);
  fs.writeFileSync(filePath, content);
  console.log('Generated: ' + filename);
}

// 1. 国家代码
generateToolPage('country-codes.astro', '国家代码查询', '查询各国国际电话区号、ISO代码等', `
  <div class="search-bar">
    <input type="text" id="search" class="form-input" placeholder="搜索国家名称、代码或区号...">
  </div>
  <div class="table-wrapper">
    <table class="data-table" id="data-table">
      <thead>
        <tr><th>国家</th><th>电话区号</th><th>ISO 2位</th><th>ISO 3位</th></tr>
      </thead>
      <tbody id="table-body"></tbody>
    </table>
  </div>`, `
  const countries = [
    ['中国','+86','CN','CHN'],['美国','+1','US','USA'],['英国','+44','GB','GBR'],
    ['日本','+81','JP','JPN'],['韩国','+82','KR','KOR'],['德国','+49','DE','DEU'],
    ['法国','+33','FR','FRA'],['俄罗斯','+7','RU','RUS'],['印度','+91','IN','IND'],
    ['澳大利亚','+61','AU','AUS'],['加拿大','+1','CA','CAN'],['巴西','+55','BR','BRA'],
    ['意大利','+39','IT','ITA'],['西班牙','+34','ES','ESP'],['墨西哥','+52','MX','MEX'],
    ['印度尼西亚','+62','ID','IDN'],['荷兰','+31','NL','NLD'],['瑞士','+41','CH','CHE'],
    ['沙特阿拉伯','+966','SA','SAU'],['土耳其','+90','TR','TUR'],['波兰','+48','PL','POL'],
    ['泰国','+66','TH','THA'],['瑞典','+46','SE','SWE'],['尼日利亚','+234','NG','NGA'],
    ['阿根廷','+54','AR','ARG'],['奥地利','+43','AT','AUT'],['挪威','+47','NO','NOR'],
    ['以色列','+972','IL','ISR'],['南非','+27','ZA','ZAF'],['新加坡','+65','SG','SGP'],
    ['马来西亚','+60','MY','MYS'],['越南','+84','VN','VNM'],['菲律宾','+63','PH','PHL'],
    ['埃及','+20','EG','EGY'],['巴基斯坦','+92','PK','PAK'],['孟加拉国','+880','BD','BGD'],
    ['乌克兰','+380','UA','UKR'],['哥伦比亚','+57','CO','COL'],['智利','+56','CL','CHL'],
    ['芬兰','+358','FI','FIN'],['丹麦','+45','DK','DNK'],['爱尔兰','+353','IE','IRL'],
    ['新西兰','+64','NZ','NZL'],['葡萄牙','+351','PT','PRT'],['希腊','+30','GR','GRC'],
    ['捷克','+420','CZ','CZE'],['罗马尼亚','+40','RO','ROU'],['匈牙利','+36','HU','HUN'],
    ['比利时','+32','BE','BEL'],['秘鲁','+51','PE','PER'],['阿联酋','+971','AE','ARE']
  ];

  function renderTable(data) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = data.map(c => '<tr><td>' + c[0] + '</td><td>' + c[1] + '</td><td>' + c[2] + '</td><td>' + c[3] + '</td></tr>').join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderTable(countries);
    document.getElementById('search').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = countries.filter(c => c.some(v => v.toLowerCase().includes(q)));
      renderTable(filtered);
    });
  });
`);

// 2. ISO国家代码
generateToolPage('country-codes-iso.astro', 'ISO国家代码', '完整的ISO 3166-1国家代码对照表', `
  <div class="search-bar">
    <input type="text" id="search" class="form-input" placeholder="搜索国家或代码...">
  </div>
  <div class="table-wrapper">
    <table class="data-table" id="data-table">
      <thead>
        <tr><th>国家(英文)</th><th>国家(中文)</th><th>Alpha-2</th><th>Alpha-3</th><th>数字</th></tr>
      </thead>
      <tbody id="table-body"></tbody>
    </table>
  </div>`, `
  const countries = [
    ['China','中国','CN','CHN','156'],['United States','美国','US','USA','840'],
    ['United Kingdom','英国','GB','GBR','826'],['Japan','日本','JP','JPN','392'],
    ['South Korea','韩国','KR','KOR','410'],['Germany','德国','DE','DEU','276'],
    ['France','法国','FR','FRA','250'],['Russia','俄罗斯','RU','RUS','643'],
    ['India','印度','IN','IND','356'],['Australia','澳大利亚','AU','AUS','036'],
    ['Canada','加拿大','CA','CAN','124'],['Brazil','巴西','BR','BRA','076'],
    ['Italy','意大利','IT','ITA','380'],['Spain','西班牙','ES','ESP','724'],
    ['Mexico','墨西哥','MX','MEX','484'],['Indonesia','印度尼西亚','ID','IDN','360'],
    ['Netherlands','荷兰','NL','NLD','528'],['Switzerland','瑞士','CH','CHE','756'],
    ['Saudi Arabia','沙特阿拉伯','SA','SAU','682'],['Turkey','土耳其','TR','TUR','792'],
    ['Poland','波兰','PL','POL','616'],['Thailand','泰国','TH','THA','764'],
    ['Sweden','瑞典','SE','SWE','752'],['Nigeria','尼日利亚','NG','NGA','566'],
    ['Argentina','阿根廷','AR','ARG','032'],['Austria','奥地利','AT','AUT','040'],
    ['Norway','挪威','NO','NOR','578'],['Israel','以色列','IL','ISR','376'],
    ['South Africa','南非','ZA','ZAF','710'],['Singapore','新加坡','SG','SGP','702'],
    ['Malaysia','马来西亚','MY','MYS','458'],['Vietnam','越南','VN','VNM','704'],
    ['Philippines','菲律宾','PH','PHL','608'],['Egypt','埃及','EG','EGY','818'],
    ['Pakistan','巴基斯坦','PK','PAK','586'],['Bangladesh','孟加拉国','BD','BGD','050'],
    ['Ukraine','乌克兰','UA','UKR','804'],['Colombia','哥伦比亚','CO','COL','170'],
    ['Chile','智利','CL','CHL','152'],['Finland','芬兰','FI','FIN','246'],
    ['Denmark','丹麦','DK','DNK','208'],['Ireland','爱尔兰','IE','IRL','372'],
    ['New Zealand','新西兰','NZ','NZL','554'],['Portugal','葡萄牙','PT','PRT','620'],
    ['Greece','希腊','GR','GRC','300'],['Czech Republic','捷克','CZ','CZE','203'],
    ['Romania','罗马尼亚','RO','ROU','642'],['Hungary','匈牙利','HU','HUN','348'],
    ['Belgium','比利时','BE','BEL','056'],['Peru','秘鲁','PE','PER','604'],
    ['United Arab Emirates','阿联酋','AE','ARE','784']
  ];

  function renderTable(data) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = data.map(c => '<tr><td>' + c[0] + '</td><td>' + c[1] + '</td><td>' + c[2] + '</td><td>' + c[3] + '</td><td>' + c[4] + '</td></tr>').join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderTable(countries);
    document.getElementById('search').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = countries.filter(c => c.some(v => v.toLowerCase().includes(q)));
      renderTable(filtered);
    });
  });
`);

// 3. 世界首都
generateToolPage('capitals.astro', '世界首都查询', '查询世界各国首都城市', `
  <div class="search-bar">
    <input type="text" id="search" class="form-input" placeholder="搜索国家或首都...">
  </div>
  <div class="table-wrapper">
    <table class="data-table" id="data-table">
      <thead>
        <tr><th>国家</th><th>首都</th><th>洲</th></tr>
      </thead>
      <tbody id="table-body"></tbody>
    </table>
  </div>`, `
  const data = [
    ['中国','北京','亚洲'],['美国','华盛顿','北美洲'],['英国','伦敦','欧洲'],
    ['日本','东京','亚洲'],['韩国','首尔','亚洲'],['德国','柏林','欧洲'],
    ['法国','巴黎','欧洲'],['俄罗斯','莫斯科','欧洲'],['印度','新德里','亚洲'],
    ['澳大利亚','堪培拉','大洋洲'],['加拿大','渥太华','北美洲'],['巴西','巴西利亚','南美洲'],
    ['意大利','罗马','欧洲'],['西班牙','马德里','欧洲'],['墨西哥','墨西哥城','北美洲'],
    ['印度尼西亚','雅加达','亚洲'],['荷兰','阿姆斯特丹','欧洲'],['瑞士','伯尔尼','欧洲'],
    ['沙特阿拉伯','利雅得','亚洲'],['土耳其','安卡拉','亚洲'],['波兰','华沙','欧洲'],
    ['泰国','曼谷','亚洲'],['瑞典','斯德哥尔摩','欧洲'],['尼日利亚','阿布贾','非洲'],
    ['阿根廷','布宜诺斯艾利斯','南美洲'],['奥地利','维也纳','欧洲'],['挪威','奥斯陆','欧洲'],
    ['以色列','耶路撒冷','亚洲'],['南非','比勒陀利亚','非洲'],['新加坡','新加坡','亚洲'],
    ['马来西亚','吉隆坡','亚洲'],['越南','河内','亚洲'],['菲律宾','马尼拉','亚洲'],
    ['埃及','开罗','非洲'],['巴基斯坦','伊斯兰堡','亚洲'],['孟加拉国','达卡','亚洲'],
    ['乌克兰','基辅','欧洲'],['哥伦比亚','波哥大','南美洲'],['智利','圣地亚哥','南美洲'],
    ['芬兰','赫尔辛基','欧洲'],['丹麦','哥本哈根','欧洲'],['爱尔兰','都柏林','欧洲'],
    ['新西兰','惠灵顿','大洋洲'],['葡萄牙','里斯本','欧洲'],['希腊','雅典','欧洲'],
    ['捷克','布拉格','欧洲'],['罗马尼亚','布加勒斯特','欧洲'],['匈牙利','布达佩斯','欧洲'],
    ['比利时','布鲁塞尔','欧洲'],['秘鲁','利马','南美洲'],['阿联酋','阿布扎比','亚洲']
  ];

  function renderTable(d) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = d.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>').join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderTable(data);
    document.getElementById('search').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = data.filter(r => r.some(v => v.toLowerCase().includes(q)));
      renderTable(filtered);
    });
  });
`);

// 4. ASCII表
generateToolPage('ascii-table.astro', 'ASCII码表', '完整的ASCII字符编码对照表', `
  <div class="search-bar">
    <input type="text" id="search" class="form-input" placeholder="搜索字符或编码...">
  </div>
  <div class="table-wrapper">
    <table class="data-table" id="data-table">
      <thead>
        <tr><th>十进制</th><th>十六进制</th><th>八进制</th><th>字符</th><th>描述</th></tr>
      </thead>
      <tbody id="table-body"></tbody>
    </table>
  </div>`, `
  const asciiData = [
    [0,'00','000','NUL','空字符'],[1,'01','001','SOH','标题开始'],[2,'02','002','STX','正文开始'],
    [3,'03','003','ETX','正文结束'],[4,'04','004','EOT','传输结束'],[5,'05','005','ENQ','请求'],
    [6,'06','006','ACK','确认'],[7,'07','007','BEL','响铃'],[8,'08','010','BS','退格'],
    [9,'09','011','HT','水平制表'],[10,'0A','012','LF','换行'],[11,'0B','013','VT','垂直制表'],
    [12,'0C','014','FF','换页'],[13,'0D','015','CR','回车'],[14,'0E','016','SO','移出'],
    [15,'0F','017','SI','移入'],[16,'10','020','DLE','数据链路转义'],[17,'11','021','DC1','设备控制1'],
    [18,'12','022','DC2','设备控制2'],[19,'13','023','DC3','设备控制3'],[20,'14','024','DC4','设备控制4'],
    [21,'15','025','NAK','否定确认'],[22,'16','026','SYN','同步'],[23,'17','027','ETB','传输块结束'],
    [24,'18','030','CAN','取消'],[25,'19','031','EM','介质结束'],[26,'1A','032','SUB','替换'],
    [27,'1B','033','ESC','转义'],[28,'1C','034','FS','文件分隔符'],[29,'1D','035','GS','组分隔符'],
    [30,'1E','036','RS','记录分隔符'],[31,'1F','037','US','单元分隔符'],
    [32,'20','040',' ','空格'],[33,'21','041','!','叹号'],[34,'22','042','"','双引号'],
    [35,'23','043','#','井号'],[36,'24','044','$','美元'],[37,'25','045','%','百分号'],
    [38,'26','046','&','与号'],[39,'27','047',"'",'单引号'],[40,'28','050','(','左括号'],
    [41,'29','051',')','右括号'],[42,'2A','052','*','星号'],[43,'2B','053','+','加号'],
    [44,'2C','054',',','逗号'],[45,'2D','055','-','减号'],[46,'2E','056','.','句号'],
    [47,'2F','057','/','斜杠'],[48,'30','060','0','数字0'],[49,'31','061','1','数字1'],
    [50,'32','062','2','数字2'],[51,'33','063','3','数字3'],[52,'34','064','4','数字4'],
    [53,'35','065','5','数字5'],[54,'36','066','6','数字6'],[55,'37','067','7','数字7'],
    [56,'38','070','8','数字8'],[57,'39','071','9','数字9'],[58,'3A','072',':','冒号'],
    [59,'3B','073',';','分号'],[60,'3C','074','<','小于号'],[61,'3D','075','=','等号'],
    [62,'3E','076','>','大于号'],[63,'3F','077','?','问号'],[64,'40','100','@','At符号'],
    [65,'41','101','A','大写A'],[66,'42','102','B','大写B'],[67,'43','103','C','大写C'],
    [68,'44','104','D','大写D'],[69,'45','105','E','大写E'],[70,'46','106','F','大写F'],
    [71,'47','107','G','大写G'],[72,'48','110','H','大写H'],[73,'49','111','I','大写I'],
    [74,'4A','112','J','大写J'],[75,'4B','113','K','大写K'],[76,'4C','114','L','大写L'],
    [77,'4D','115','M','大写M'],[78,'4E','116','N','大写N'],[79,'4F','117','O','大写O'],
    [80,'50','120','P','大写P'],[81,'51','121','Q','大写Q'],[82,'52','122','R','大写R'],
    [83,'53','123','S','大写S'],[84,'54','124','T','大写T'],[85,'55','125','U','大写U'],
    [86,'56','126','V','大写V'],[87,'57','127','W','大写W'],[88,'58','130','X','大写X'],
    [89,'59','131','Y','大写Y'],[90,'5A','132','Z','大写Z'],[91,'5B','133','[','左方括号'],
    [92,'5C','134','\\\\','反斜杠'],[93,'5D','135',']','右方括号'],[94,'5E','136','^','脱字符'],
    [95,'5F','137','_','下划线'],[96,'60','140','\`','反引号'],[97,'61','141','a','小写a'],
    [98,'62','142','b','小写b'],[99,'63','143','c','小写c'],[100,'64','144','d','小写d'],
    [101,'65','145','e','小写e'],[102,'66','146','f','小写f'],[103,'67','147','g','小写g'],
    [104,'68','150','h','小写h'],[105,'69','151','i','小写i'],[106,'6A','152','j','小写j'],
    [107,'6B','153','k','小写k'],[108,'6C','154','l','小写l'],[109,'6D','155','m','小写m'],
    [110,'6E','156','n','小写n'],[111,'6F','157','o','小写o'],[112,'70','160','p','小写p'],
    [113,'71','161','q','小写q'],[114,'72','162','r','小写r'],[115,'73','163','s','小写s'],
    [116,'74','164','t','小写t'],[117,'75','165','u','小写u'],[118,'76','166','v','小写v'],
    [119,'77','167','w','小写w'],[120,'78','170','x','小写x'],[121,'79','171','y','小写y'],
    [122,'7A','172','z','小写z'],[123,'7B','173','{','左花括号'],[124,'7C','174','|','竖线'],
    [125,'7D','175','}','右花括号'],[126,'7E','176','~','波浪号'],[127,'7F','177','DEL','删除']
  ];

  function renderTable(d) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = d.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td style="font-family:var(--font-mono);font-size:1.1rem;">' + r[3] + '</td><td>' + r[4] + '</td></tr>').join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderTable(asciiData);
    document.getElementById('search').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = asciiData.filter(r => r.some(v => String(v).toLowerCase().includes(q)));
      renderTable(filtered);
    });
  });
`);

// 5. 特殊字符
generateToolPage('special-chars.astro', '特殊字符大全', '常用特殊符号和字符集合', `
  <div class="search-bar">
    <input type="text" id="search" class="form-input" placeholder="搜索字符...">
  </div>
  <div id="categories"></div>`, `
  const categories = [
    { name: '数学符号', items: ['∑','∏','∫','∂','√','∞','≈','≠','≤','≥','±','×','÷','¼','½','¾','‰','‰','°','′','″'] },
    { name: '箭头符号', items: ['←','→','↑','↓','↔','↕','⇐','⇒','⇑','⇓','⇔','⇕','↵','↩','↪','↰','↱','↲','↳'] },
    { name: '货币符号', items: ['$','€','£','¥','¢','₹','₽','₩','₿','₴','₺','₼','₸','₮','₯','₠','₡','₢','₣','₤'] },
    { name: '标点符号', items: ['«','»','‹','›','"','"',''',''','‡','†','•','‣','※','⁂','⁇','⁈','⁉','‼','⁑'] },
    { name: '希腊字母', items: ['α','β','γ','δ','ε','ζ','η','θ','ι','κ','λ','μ','ν','ξ','ο','π','ρ','σ','τ','υ','φ','χ','ψ','ω'] },
    { name: '几何符号', items: ['■','□','▢','▣','▤','▥','▦','▧','▨','▩','◆','◇','◈','○','●','◐','◑','◒','◓','◔','◕'] },
    { name: '星号花朵', items: ['★','☆','✡','✦','✧','✩','✪','✫','✬','✭','✮','✯','✰','❀','❁','❂','❃','❋','✿','❀'] },
    { name: '音乐符号', items: ['♩','♪','♫','♬','♭','♮','♯','𝄞','𝄢','𝄪','𝄫','𝄬'] },
    { name: '星座符号', items: ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','⛎'] },
    { name: '扑克花色', items: ['♠','♣','♥','♦','♤','♧','♡','♢'] }
  ];

  function renderCategories(filter) {
    const container = document.getElementById('categories');
    let html = '';
    categories.forEach(cat => {
      const items = filter ? cat.items.filter(i => i.includes(filter)) : cat.items;
      if (items.length === 0) return;
      html += '<div style="margin-bottom:var(--space-4);"><h3 style="font-size:var(--text-sm);font-weight:var(--font-medium);margin-bottom:var(--space-2);color:var(--text-secondary);">' + cat.name + '</h3>';
      html += '<div class="emoji-grid">';
      items.forEach(item => {
        html += '<div class="emoji-item" data-char="' + item + '" title="点击复制"><span class="emoji">' + item + '</span></div>';
      });
      html += '</div></div>';
    });
    container.innerHTML = html;

    container.querySelectorAll('.emoji-item').forEach(el => {
      el.addEventListener('click', () => {
        const char = el.dataset.char;
        navigator.clipboard.writeText(char).then(() => {
          el.style.background = 'var(--color-primary)';
          setTimeout(() => { el.style.background = ''; }, 500);
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderCategories();
    document.getElementById('search').addEventListener('input', (e) => {
      renderCategories(e.target.value || null);
    });
  });
`);

// 6. Emoji大全
generateToolPage('emoji.astro', 'Emoji表情大全', '浏览和复制常用Emoji表情符号', `
  <div class="search-bar">
    <input type="text" id="search" class="form-input" placeholder="搜索Emoji...">
  </div>
  <div id="categories"></div>`, `
  const categories = [
    { name: '表情', items: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐'] },
    { name: '手势', items: ['👋','🤚','🖐','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏'] },
    { name: '爱心', items: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟'] },
    { name: '动物', items: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈'] },
    { name: '食物', items: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠','🥐','🥖','🍞','🥨','🥯','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🥛','🍼','🫖','☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾'] },
    { name: '旅行', items: ['🚗','🚕','🚙','🚌','🚎','🏎','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍','🛵','🚲','🛴','🚨','🚔','🚍','🚘','🚖','🛞','🚡','🚠','🚟','🚃','🚋','🚞','🚝','🚄','🚅','🚈','🚂','🚆','🚇','🚊','🚉','✈️','🛫','🛬','🛩','💺','🛰','🚀','🛸','🚁','🛶','⛵','🚤','🛥','🛳','⛴','🚢','🗼','🏰','🏯','🏟','🎡','🎢','🎠','⛲','⛱','🏖','🏝','🏜','🌋','⛰','🏔','🗻','🏕','⛺','🛖','🏠','🏡','🏘','🏚','🏗','🏢','🏬','🏣','🏤','🏥','🏦','🏨','🏪','🏫','🏩','💒','🏛','⛪','🕌','🕍','🛕','🕋','⛩'] },
    { name: '物品', items: ['⌚','📱','📲','💻','⌨️','🖥','🖨','🖱','🖲','🕹','🗜','💽','💾','💿','📀','📼','📷','📸','📹','🎥','📽','🎞','📞','☎️','📟','📠','📺','📻','🎙','🎚','🎛','🧭','⏱','⏲','⏰','🕰','⌛','⏳','📡','🔋','🔌','💡','🔦','🕯','🧯','🗑','🛢','💸','💵','💴','💶','💷','🪙','💰','💳','💎','⚖️','🧰','🔧','🔨','⚒','🛠','⛏','🪚','🔩','⚙️','🧲','🔫','💣','🧨','🪓','🔪','🗡','⚔️','🛡','🚬','⚰️','🪦','⚱️','🏺','🔮','📿','🧿','🪬','💈','⚗️','🔭','🔬','🕳','🩹','🩺','🩻','🩼','💊','💉','🩸','🧬','🦠','🧫','🧪','🌡','🧹','🪠','🧺','🧻','🚽','🚰','🚿','🛁','🛀','🧼','🪥','🪒','🧽','🪣','🔑','🗝','🚪','🪑','🛋','🛏','🛌','🧸','🪆','🖼','🪞','🪟','🛍','🛒','🎁','🎈','🎏','🎀','🪄','🪅','🎊','🎉','🎎','🏮','🎐','🧧','✉️','📩','📨','📧','💌','📥','📤','📦','🏷','📪','📫','📬','📭','📮','📯','📜','📃','📄','📑','🧾','📊','📈','📉','📆','📅','🗑','📇','🗃','🗳','🗄','📋','📁','📂','🗂','🗞','📰','📓','📔','📒','📕','📗','📘','📙','📚','📖','🔖','🧷','🔗','📎','🖇','📐','📏','🧮','📌','📍','✂️','🖊','🖋','✒️','🖌','🖍','📝','✏️','🔍','🔎','🔏','🔐','🔒','🔓'] },
    { name: '旗帜', items: ['🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️','🇨🇳','🇺🇸','🇬🇧','🇯🇵','🇰🇷','🇩🇪','🇫🇷','🇷🇺','🇮🇳','🇦🇺','🇨🇦','🇧🇷','🇮🇹','🇪🇸','🇲🇽','🇮🇩','🇳🇱','🇨🇭','🇸🇦','🇹🇷','🇵🇱','🇹🇭','🇸🇪','🇳🇬','🇦🇷','🇦🇹','🇳🇴','🇮🇱','🇿🇦','🇸🇬','🇲🇾','🇻🇳','🇵🇭','🇪🇬','🇵🇰','🇧🇩','🇺🇦','🇨🇴','🇨🇱','🇫🇮','🇩🇰','🇮🇪','🇳🇿','🇵🇹','🇬🇷','🇨🇿','🇷🇴','🇭🇺','🇧🇪','🇵🇪','🇦🇪'] }
  ];

  function renderCategories(filter) {
    const container = document.getElementById('categories');
    let html = '';
    categories.forEach(cat => {
      const items = filter ? cat.items.filter(i => i.includes(filter)) : cat.items;
      if (items.length === 0) return;
      html += '<div style="margin-bottom:var(--space-4);"><h3 style="font-size:var(--text-sm);font-weight:var(--font-medium);margin-bottom:var(--space-2);color:var(--text-secondary);">' + cat.name + '</h3>';
      html += '<div class="emoji-grid">';
      items.forEach(item => {
        html += '<div class="emoji-item" data-char="' + item + '" title="点击复制"><span class="emoji">' + item + '</span></div>';
      });
      html += '</div></div>';
    });
    container.innerHTML = html;

    container.querySelectorAll('.emoji-item').forEach(el => {
      el.addEventListener('click', () => {
        const char = el.dataset.char;
        navigator.clipboard.writeText(char).then(() => {
          el.style.background = 'var(--color-primary)';
          setTimeout(() => { el.style.background = ''; }, 500);
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderCategories();
    document.getElementById('search').addEventListener('input', (e) => {
      renderCategories(e.target.value || null);
    });
  });
`);

console.log('\n✅ 第五批工具生成完成');
console.log('Done!');
