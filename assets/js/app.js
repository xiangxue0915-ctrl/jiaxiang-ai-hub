const app = {
  state: {
    view: 'home',
    currentModule: null,
    sessions: {},
    history: [],
    resourceState: { category: '全部', type: '全部', query: '', page: 1, pageSize: 12 }
  },

  /* ---------- 初始化 ---------- */
  init() {
    this.loadConfig();
    this.updateBrand();
    this.updateDataStatus();
    this.renderCards();
    this.renderHistory();
    this.setupInputs();
    this.goHome();
  },

  updateBrand() {
    const cfg = window.JXAI_CONFIG.brand;
    document.getElementById('topbar-org').textContent = cfg.org;
    document.querySelector('.brand-name').textContent = cfg.name;
    document.querySelector('.brand-sub').textContent = cfg.sub;
    document.querySelector('.avatar').textContent = cfg.user.charAt(0);
    document.title = cfg.name + ' - 销售赋能工作台';
  },

  updateDataStatus() {
    const el = document.getElementById('data-status');
    const kb = window.JXAI_KNOWLEDGE;
    const res = window.JXAI_RESOURCES;
    const stats = window.JXAI_STATS;
    if (!kb || !res) {
      el.textContent = '本地资料未加载（请用本地服务器打开）';
      el.classList.remove('loaded');
      return;
    }
    el.textContent = `本地资料已加载：${stats?.files || res.length} 份 / ${stats?.chunks || kb.length} 段`;
    el.classList.add('loaded');
  },

  dataReady() {
    return !!(window.JXAI_KNOWLEDGE && window.JXAI_RESOURCES);
  },

  /* ---------- 配置读写 ---------- */
  loadConfig() {
    try {
      const saved = localStorage.getItem('jxai_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.keys(parsed).forEach(k => {
          if (window.JXAI_CONFIG.modules[k]) {
            window.JXAI_CONFIG.modules[k].workbuddyUrl = parsed[k] || '';
          }
        });
      }
    } catch (e) { console.warn('读取配置失败', e); }
  },

  saveConfigToStorage() {
    const urls = {};
    Object.values(window.JXAI_CONFIG.modules).forEach(m => urls[m.id] = m.workbuddyUrl);
    localStorage.setItem('jxai_config', JSON.stringify(urls));
  },

  /* ---------- 首页 ---------- */
  goHome() {
    this.state.view = 'home';
    this.state.currentModule = null;
    document.getElementById('home-view').classList.remove('hidden');
    document.getElementById('chat-view').classList.add('hidden');
    this.renderHistory();
  },

  renderCards() {
    const grid = document.getElementById('cards-grid');
    const mods = window.JXAI_CONFIG.modules;
    grid.innerHTML = Object.values(mods).map(m => `
      <div class="card" onclick="app.openModule('${m.id}')" role="button" tabindex="0" aria-label="${m.name}">
        <div class="card-icon ${m.color}">${m.icon}</div>
        <div class="card-body">
          <div class="card-title">${m.name}</div>
          <p class="card-desc">${m.desc}</p>
          <span class="card-status ${m.status === 'ready' ? 'ready' : 'beta'}">${m.status === 'ready' ? '已就绪' : 'P2 延后'}</span>
        </div>
      </div>
    `).join('');
  },

  /* ---------- 模块页 ---------- */
  openModule(id) {
    const mod = window.JXAI_CONFIG.modules[id];
    if (!mod) return;
    this.state.view = 'chat';
    this.state.currentModule = id;
    if (!this.state.sessions[id]) this.state.sessions[id] = [];
    document.getElementById('home-view').classList.add('hidden');
    document.getElementById('chat-view').classList.remove('hidden');
    document.getElementById('chat-title').textContent = mod.name;
    const msgs = document.getElementById('chat-messages');
    msgs.classList.toggle('resource-mode', id === 'resources');
    this.renderChat();
    if (this.state.sessions[id].length === 0) {
      if (id === 'resources') {
        this.state.resourceState = { category: '全部', type: '全部', query: '', page: 1, pageSize: 12 };
        this.renderResourceLibrary();
      } else {
        this.pushSystemIntro();
      }
    }
    this.renderHistory();
  },

  pushSystemIntro() {
    const mod = window.JXAI_CONFIG.modules[this.state.currentModule];
    const chipsHtml = mod.chips.map(t => `<span class="chip" onclick="app.sendChip('${this.escape(t)}')">${this.escape(t)}</span>`).join('');
    const html = `<div><h4>您已选择 <b>${mod.name}</b> 功能 ${mod.icon}</h4>
      <p>${mod.intro}</p>
      <ul>${mod.bullets.map(b => `<li>${b}</li>`).join('')}</ul>
      <p class="muted">当前优先使用本地 360 产品资料直接回答。</p>
      <div class="chips">${chipsHtml}</div></div>`;
    this.addMessage('system', html, false);
  },

  renderChat() {
    const container = document.getElementById('chat-messages');
    const msgs = this.state.sessions[this.state.currentModule] || [];
    container.innerHTML = msgs.map(m => this.renderMessage(m)).join('');
    this.scrollToBottom();
  },

  renderMessage(msg) {
    const isSystem = msg.role === 'system';
    const avatar = isSystem ? '🎓' : '印';
    return `
      <div class="message ${msg.role}">
        <div class="message-avatar ${msg.role}">${avatar}</div>
        <div class="bubble">${msg.content}</div>
      </div>
      ${isSystem && window.JXAI_CONFIG.settings.showCitations && msg.source ? `<div class="message-actions"><button onclick="app.toast('来源：${this.escape(msg.source)}')">📎 ${this.ellipsize(this.escape(msg.source), 24)}</button><button onclick="app.copyToClipboard('${this.escape(this.stripHtml(msg.content))}')">📋 复制</button></div>` : ''}
    `;
  },

  addMessage(role, content, source) {
    this.state.sessions[this.state.currentModule].push({ role, content, source, time: new Date().toISOString() });
    this.renderChat();
    this.addToHistory(this.state.currentModule, content);
  },

  addToHistory(moduleId, content) {
    const mod = window.JXAI_CONFIG.modules[moduleId];
    const title = mod.name + ' · ' + this.ellipsize(this.stripHtml(content), 18);
    const existing = this.state.history.find(h => h.module === moduleId);
    const dateStr = new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    if (existing) {
      existing.title = title;
      existing.time = dateStr;
    } else {
      this.state.history.unshift({ module: moduleId, title, time: dateStr });
    }
    this.renderHistory();
  },

  renderHistory() {
    const el = document.getElementById('history');
    if (this.state.history.length === 0) {
      el.innerHTML = '<div class="history-empty">暂无会话记录</div>';
      return;
    }
    el.innerHTML = this.state.history.map(h => {
      const active = this.state.currentModule === h.module ? 'active' : '';
      const mod = window.JXAI_CONFIG.modules[h.module];
      return `<div class="history-item ${active}" onclick="app.openModule('${h.module}')">
        <div class="history-title">${mod.icon} ${h.title}</div>
        <div class="history-meta"><span>${mod.name}</span><span>${h.time}</span></div>
      </div>`;
    }).join('');
  },

  /* ---------- 发送消息 ---------- */
  homeSend() {
    const input = document.getElementById('home-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    this.openModule('qa');
    setTimeout(() => this.userSend(text), 50);
  },

  chatSend() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    this.userSend(text);
  },

  sendChip(text) {
    this.userSend(text);
  },

  userSend(text) {
    const id = this.state.currentModule;
    const mod = window.JXAI_CONFIG.modules[id];
    if (!mod) return;
    this.addMessage('user', this.escape(text));
    this.showTyping();

    setTimeout(() => {
      this.hideTyping();
      if (!this.dataReady()) {
        this.replyDataError();
        return;
      }
      if (id === 'resources') {
        this.state.resourceState.query = text;
        this.state.resourceState.page = 1;
        this.renderResourceLibrary();
      } else if (id === 'qa') {
        this.replySearch(mod, text);
      } else if (id === 'docs') {
        this.replyDocSearch(mod, text);
      } else if (id === 'scenario') {
        this.replyScenario(mod, text);
      } else if (id === 'quote') {
        this.replyQuote(mod, text);
      } else if (id === 'learn' || id === 'practice') {
        this.replyPlaceholder(mod);
      } else {
        this.replySearch(mod, text);
      }
    }, 600);
  },

  /* ---------- 同义词扩展 ---------- */
  synonymMap: {
    '智能体平台': ['智能体平台', '智能体应用开发', 'ai实验室', '智能体实训', '实训平台', '平台'],
    '核心功能': ['核心功能', '功能特点', '功能特性', '主要功能', '平台功能', '能力', '亮点', '模块'],
    '高职院校': ['高职', '职业院校', '职业技术学院', '技工院校', '中职', '院校'],
    '高校': ['高校', '本科', '大学', '学院', '院校'],
    '产教融合': ['产教融合', '产教', '校企合作', '产业学院', '实训基地'],
    '双高': ['双高', '高水平', '示范校', '示范'],
    '人才基地': ['人才基地', '人才培养', '人才培训', '培训中心'],
    '常见问题': ['常见问题', 'faq', '销售问题', '答疑', '疑问'],
    '人才培养方案': ['人才培养', '企业人工智能人才', '解决方案', '培养方案'],
    '报价': ['报价', '价格', '金额', '单价', '总价', '预算'],
    '招投标': ['招投标', '参数', '技术指标', '软著', '著作权'],
    '销售指南': ['销售指南', '目标客户', '客户画像', '卖点', '话术'],
    '白皮书': ['白皮书', '产品手册', '功能架构'],
    '课程': ['课程', '课时', '讲义', '实验', '实训'],
    '认证': ['认证', '证书', '培训', '考试'],
    '并发': ['并发', '授权', '用户数', '100人', '50人']
  },

  expandQuery(query) {
    const q = query.toLowerCase();
    const expanded = new Set([q]);
    // 分词后匹配同义词
    const tokens = q.split(/[\s，,、]+/).filter(t => t.length > 1);
    tokens.forEach(t => {
      Object.entries(this.synonymMap).forEach(([key, syns]) => {
        if (t.includes(key) || key.includes(t)) {
          syns.forEach(s => expanded.add(s));
        }
      });
    });
    // 特别处理：如果含"核心功能"没扩展，补充通用功能词
    if (q.includes('功能') || q.includes('能力')) {
      ['功能', '能力', '模块', '亮点', '特性'].forEach(s => expanded.add(s));
    }
    if (q.includes('高职') || q.includes('职业') || q.includes('学院')) {
      ['高职', '职业院校', '职业技术学院', '高校', '学院'].forEach(s => expanded.add(s));
    }
    return Array.from(expanded);
  },

  /* ---------- 本地检索（知识块） ---------- */
  searchKB(query, limit = 6) {
    const kb = window.JXAI_KNOWLEDGE || [];
    const terms = this.expandQuery(query).filter(t => t.length > 1);
    if (terms.length === 0) return [];

    const scored = kb.map(chunk => {
      const text = chunk.text.toLowerCase();
      const name = chunk.resourceName.toLowerCase();
      const cat = (chunk.category || '').toLowerCase();
      const keys = (chunk.keywords || []).join(' ').toLowerCase();
      let score = 0;
      terms.forEach(t => {
        // 关键词命中权重最高
        const keyIdx = keys.indexOf(t);
        if (keyIdx >= 0) score += 12;
        // 文件名命中
        const nameIdx = name.indexOf(t);
        if (nameIdx >= 0) score += 8;
        // 类别命中
        if (cat.includes(t)) score += 6;
        // 文本命中
        const idx = text.indexOf(t);
        if (idx >= 0) {
          score += 5;
          if (idx < 50) score += 3; // 开头命中
        }
        // 频次
        const re = new RegExp(this.escapeRegExp(t), 'g');
        const matches = (text.match(re) || []).length;
        score += Math.min(matches, 4);
      });
      return { ...chunk, score };
    }).filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);

    return scored;
  },

  /* ---------- 本地检索（资源文件） ---------- */
  searchResources(query) {
    const res = window.JXAI_RESOURCES || [];
    const q = query.toLowerCase().trim();
    if (!q) return res;
    const terms = this.expandQuery(q).filter(t => t.length > 1);
    return res.filter(r => {
      const hay = (r.name + ' ' + r.category + ' ' + r.summary + ' ' + (r.keywords || []).join(' ') + ' ' + r.type).toLowerCase();
      // 至少命中一个扩展词
      return terms.some(t => hay.includes(t));
    }).sort((a, b) => {
      // 文件名直接包含查询词的排前面
      const aq = a.name.toLowerCase().includes(q);
      const bq = b.name.toLowerCase().includes(q);
      if (aq && !bq) return -1;
      if (!aq && bq) return 1;
      return 0;
    });
  },

  highlight(text, query) {
    if (!query) return this.escape(text);
    const terms = this.expandQuery(query).filter(t => t.length > 1);
    let html = this.escape(text);
    // 按长度降序避免短词覆盖长词
    terms.sort((a, b) => b.length - a.length);
    terms.forEach(t => {
      const re = new RegExp('(' + this.escapeRegExp(t) + ')', 'gi');
      html = html.replace(re, '<span class="highlight">$1</span>');
    });
    return html;
  },

  /* ---------- 智能问答 ---------- */
  replySearch(mod, query) {
    const results = this.searchKB(query, 6);
    if (results.length === 0) {
      this.addMessage('system', `<div><p>未在本地资料中找到与「<b>${this.escape(query)}</b>」相关的内容。</p><p class="muted">建议尝试：① 换更具体的关键词，如“课程资源”“MCP工具”“私有化部署”；② 到「智享资源库」浏览文件；③ 使用「文档获取」按文件名查找。</p></div>`, '本地知识库');
      return;
    }
    // 去重资源名
    const seen = new Set();
    const unique = results.filter(r => {
      const key = r.resourceId;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5);

    // 提取前3条作为答案正文，后2条作为参考
    const answerChunks = results.slice(0, 3);
    const sentences = [];
    answerChunks.forEach(r => {
      const lines = r.text.split(/[。！？\n]/).filter(s => s.trim().length > 15 && s.trim().length < 160);
      lines.slice(0, 1).forEach(s => {
        const t = s.trim();
        if (!sentences.includes(t)) sentences.push(t);
      });
    });

    const answerHtml = sentences.length ? `<div style="margin:10px 0;line-height:1.8;">${sentences.map(s => `<p>${this.highlight(s, query)}</p>`).join('')}</div>` : '';
    const refsHtml = unique.map((r, i) => `
      <div class="search-result">
        <div class="search-result-title">${i + 1}. ${this.escape(r.resourceName)} <span class="resource-tag">${this.escape(r.category)}</span></div>
        <div class="search-result-text">${this.highlight(r.text.slice(0, 220), query)}${r.text.length > 220 ? '…' : ''}</div>
      </div>
    `).join('');

    const html = `<div>
      <p>基于本地 360 产品资料，为您找到 <b>${results.length}</b> 条相关内容：</p>
      ${answerHtml}
      <h4 style="margin-top:12px;">参考来源</h4>
      ${refsHtml}
      <p class="muted">以上内容来自本地产品资料，仅供销售参考。</p>
    </div>`;
    this.addMessage('system', html, unique[0].resourceName);
  },

  /* ---------- 文档获取（按文件定位） ---------- */
  replyDocSearch(mod, query) {
    const results = this.searchResources(query).slice(0, 8);
    if (results.length === 0) {
      this.addMessage('system', `<div><p>未找到与「<b>${this.escape(query)}</b>」相关的文件。</p><p class="muted">建议尝试：输入文件类型（如“白皮书”“报价”“FAQ”）或去「智享资源库」浏览全部资料。</p></div>`, '本地资源库');
      return;
    }
    const listHtml = results.map((r, i) => `
      <div class="search-result">
        <div class="search-result-title">${i + 1}. ${this.escape(r.name)} <span class="resource-tag">${this.escape(r.category)}</span> <span class="resource-tag">${r.type.toUpperCase()}</span></div>
        <div class="search-result-text">${this.escape(r.summary.slice(0, 160))}${r.summary.length > 160 ? '…' : ''}</div>
        <div class="search-result-meta">
          <a class="btn-link-sm" href="${this.escape(this.resourceUrl(r.path))}" target="_blank">打开文件</a>
          <button class="btn-link-sm secondary" onclick="app.previewResource('${this.escape(r.id)}')">预览摘要</button>
        </div>
      </div>
    `).join('');

    const html = `<div>
      <p>为您找到 <b>${results.length}</b> 份相关文件：</p>
      ${listHtml}
      <p class="muted">点击“打开文件”可直接访问本地文档。</p>
    </div>`;
    this.addMessage('system', html, results[0].name);
  },

  /* ---------- 产品场景融入 ---------- */
  replyScenario(mod, query) {
    // 先尝试检索场景相关内容
    const sceneBoost = query + ' 产教融合 人才基地 产业学院 实训室 双高 高校';
    const results = this.searchKB(sceneBoost, 6);
    if (results.length === 0) {
      this.addMessage('system', `<div><p>暂未找到与「<b>${this.escape(query)}</b>」直接匹配的场景融入内容。</p><p class="muted">当前本地资料以 360 企业人工智能人才培养方案为主要场景来源，建议补充更针对性的产教融合/人才基地方案文档。</p></div>`, '本地知识库');
      return;
    }
    const summary = this.buildScenarioAnswer(query, results);
    const refsHtml = results.slice(0, 4).map((r, i) => `
      <div class="search-result">
        <div class="search-result-title">${i + 1}. ${this.escape(r.resourceName)} <span class="resource-tag">${this.escape(r.category)}</span></div>
        <div class="search-result-text">${this.highlight(r.text.slice(0, 180), sceneBoost)}${r.text.length > 180 ? '…' : ''}</div>
      </div>
    `).join('');

    const html = `<div>
      <h4>🎯 ${this.escape(query)}</h4>
      <div style="background:#F9FAFB;border:1px solid var(--border);border-radius:10px;padding:14px 16px;line-height:1.8;">
        ${summary}
      </div>
      <h4 style="margin-top:14px;">参考依据</h4>
      ${refsHtml}
      <p class="muted">此回答由本地资料检索组合生成，实际方案请结合客户预算与政策要求调整。</p>
    </div>`;
    this.addMessage('system', html, results[0].resourceName);
  },

  buildScenarioAnswer(query, results) {
    const sentences = [];
    results.forEach(r => {
      const lines = r.text.split(/[。！？\n]/).filter(s => s.trim().length > 12 && s.trim().length < 140);
      lines.slice(0, 2).forEach(s => {
        const t = s.trim();
        if (!sentences.includes(t)) sentences.push(t);
      });
    });
    const unique = sentences.slice(0, 6);
    const lowerQ = query.toLowerCase();
    const isSchool = /高职|职业|学院|高校|本科|大学|院校/.test(lowerQ);
    const isTalentBase = /人才基地|人才培养|培训中心/.test(lowerQ);
    const isDoubleHigh = /双高|高水平|示范/.test(lowerQ);
    const isIntegration = /产教融合|产业学院|校企合作/.test(lowerQ);

    let sceneLabel = '高校人工智能实训与人才培养';
    if (isDoubleHigh) sceneLabel = '双高/示范校建设';
    else if (isIntegration) sceneLabel = '产教融合/产业学院';
    else if (isTalentBase) sceneLabel = '人才基地/企业培训';
    else if (isSchool) sceneLabel = '高职院校智能体实训';

    return `
      <p><b>场景定位：</b>${this.escape(sceneLabel)}</p>
      <p><b>价值切入点：</b>针对「${this.escape(query)}」，360 智能体应用开发实训平台可作为人工智能人才培养的核心载体，提供课程、平台、实训环境一体化支撑。</p>
      <p><b>可引用要点：</b></p>
      <ul>${unique.map(s => `<li>${this.escape(s)}</li>`).join('')}</ul>
      <p><b>对接角色建议：</b>${isTalentBase ? '培训中心/人力资源/数字化部门' : '教务处 / 产教融合处 / 二级学院 / 实训中心'}</p>
      <p><b>下一步动作：</b>带白皮书 + 解决方案 PPT 上门，针对学校/企业已有专业做课程映射，明确预算与采购路径。</p>
    `;
  },

  /* ---------- 智能报价（结构化） ---------- */
  replyQuote(mod, query) {
    const qd = window.JXAI_QUOTE_DATA;
    if (!qd) {
      this.addMessage('system', `<div><p>未找到结构化报价数据。</p><p class="muted">请确认报价 Excel 已放入源文件夹并重新运行 build_data.py。</p></div>`, '本地报价库');
      return;
    }

    // 判断规模：默认100人，如提到50人则按比例折算
    const lower = query.toLowerCase();
    let scaleLabel = qd.scale;
    let ratio = 1;
    let concurrencyNote = '';
    if (lower.includes('50人') || lower.includes('50 人')) {
      ratio = 0.5;
      scaleLabel = '50人并发';
      concurrencyNote = '按100人标准配置折半估算，实际以商务确认为准。';
    } else if (lower.includes('200人') || lower.includes('200 人')) {
      ratio = 2;
      scaleLabel = '200人并发';
      concurrencyNote = '按100人标准配置翻倍估算，实际以商务确认为准。';
    }

    const rows = qd.items.map(item => {
      const amt = Math.round((item.amount || 0) * ratio);
      const price = Math.round((item.price || 0) * ratio);
      return `
        <tr>
          <td>${this.escape(item.attr || '')}</td>
          <td>${this.escape(item.name || '')}</td>
          <td style="max-width:260px;font-size:12px;">${this.escape(item.spec || '').replace(/\n/g, '<br>')}</td>
          <td>${this.escape(item.unit || '')}</td>
          <td>${this.escape(item.qty || '')}</td>
          <td>${price ? '¥' + price.toLocaleString() : '-'}</td>
          <td>${amt ? '¥' + amt.toLocaleString() : '-'}</td>
        </tr>
      `;
    }).join('');

    const total = Math.round(qd.total * ratio);
    const html = `<div>
      <h4>📋 ${this.escape(qd.productName)} 报价单（${scaleLabel}）</h4>
      <p>基于本地报价文件自动生成的标准配置明细：</p>
      <div style="overflow-x:auto;">
        <table class="quote-table">
          <thead><tr><th>属性</th><th>名称</th><th>规格型号描述</th><th>单位</th><th>数量</th><th>单价</th><th>小计</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="6" style="text-align:right;font-weight:700;">合计（参考价）</td><td style="font-weight:700;color:var(--primary-dark);">¥${total.toLocaleString()}</td></tr></tfoot>
        </table>
      </div>
      ${concurrencyNote ? `<p class="muted">${concurrencyNote}</p>` : ''}
      <p class="muted"><b>免责声明：</b>以上价格为资料中的参考参数，最终报价需商务确认并以合同为准。</p>
    </div>`;
    this.addMessage('system', html, '本地报价库');
  },

  replyPlaceholder(mod) {
    const html = `<div>
      <p>「${mod.name}」模块当前为 P2 延后规划，仅作入口展示。</p>
      <p class="muted">如需快速使用，可先在「智能问答」或「产品场景融入」中体验本地资料检索能力。</p>
    </div>`;
    this.addMessage('system', html, '系统提示');
  },

  replyDataError() {
    const html = `<div>
      <p>本地资料未能加载，可能原因是通过 <code>file://</code> 协议直接打开导致安全限制。</p>
      <p>解决方法：</p>
      <ol>
        <li>在 VS Code 中安装「Live Server」插件，右键 index.html → Open with Live Server；</li>
        <li>或在命令行运行 <code>python -m http.server 8080</code>，然后访问 <code>http://localhost:8080</code>。</li>
      </ol>
    </div>`;
    this.addMessage('system', html, '系统提示');
  },

  /* ---------- 智享资源库（左侧导航+顶部标签+卡片网格+分页） ---------- */
  renderResourceLibrary() {
    if (!this.dataReady()) {
      this.replyDataError();
      return;
    }
    const state = this.state.resourceState;
    const all = window.JXAI_RESOURCES || [];

    // 筛选
    let filtered = all;
    if (state.category !== '全部') filtered = filtered.filter(r => r.category === state.category);
    if (state.type !== '全部') filtered = filtered.filter(r => r.type === state.type);
    if (state.query.trim()) {
      const terms = this.expandQuery(state.query).filter(t => t.length > 1);
      filtered = filtered.filter(r => {
        const hay = (r.name + ' ' + r.category + ' ' + r.summary + ' ' + (r.keywords || []).join(' ') + ' ' + r.type).toLowerCase();
        return terms.some(t => hay.includes(t));
      });
    }

    // 分页
    const total = filtered.length;
    const pageCount = Math.max(1, Math.ceil(total / state.pageSize));
    state.page = Math.min(state.page, pageCount);
    const start = (state.page - 1) * state.pageSize;
    const pageItems = filtered.slice(start, start + state.pageSize);

    // 左侧分类统计
    const categories = ['全部', ...new Set(all.map(r => r.category).sort())];
    const catList = categories.map(c => {
      const count = c === '全部' ? all.length : all.filter(r => r.category === c).length;
      const active = state.category === c ? 'active' : '';
      return `<div class="res-nav-item ${active}" onclick="app.setResCategory('${this.escape(c)}')">
        <span class="res-nav-label">${this.escape(c)}</span>
        <span class="res-nav-count">${count}</span>
      </div>`;
    }).join('');

    // 顶部类型标签
    const types = ['全部', 'pptx', 'docx', 'xlsx', 'pdf'];
    const typeLabels = { '全部': '全部', 'pptx': 'PPT', 'docx': 'Word', 'xlsx': 'Excel', 'pdf': 'PDF' };
    const typeTabs = types.map(t => {
      const active = state.type === t ? 'active' : '';
      return `<button class="res-type-tab ${active}" onclick="app.setResType('${this.escape(t)}')">${typeLabels[t]}</button>`;
    }).join('');

    // 当前筛选提示
    const activeFilters = [];
    if (state.category !== '全部') activeFilters.push(`分类：${state.category}`);
    if (state.type !== '全部') activeFilters.push(`类型：${typeLabels[state.type]}`);
    if (state.query.trim()) activeFilters.push(`搜索：${state.query}`);
    const filterHtml = activeFilters.length ? `<div class="res-active-filters">当前筛选：${activeFilters.map(f => `<span class="res-filter-chip">${this.escape(f)} <button onclick="app.clearResFilters()">✕</button></span>`).join('')} <button class="res-clear-link" onclick="app.clearResFilters()">清除全部</button></div>` : '';

    // 卡片
    const iconMap = { docx: '📄', pptx: '📊', xlsx: '📈', pdf: '📑' };
    const colorMap = { docx: 'c-blue', pptx: 'c-orange', xlsx: 'c-green', pdf: 'c-purple' };
    const cards = pageItems.map(r => {
      const ext = r.type;
      const icon = iconMap[ext] || '📎';
      const color = colorMap[ext] || 'c-indigo';
      const kw = (r.keywords || []).slice(0, 4).map(k => `<span class="res-card-tag">${this.escape(k)}</span>`).join('');
      return `
        <div class="res-card">
          <div class="res-card-cover ${color}">${icon}</div>
          <div class="res-card-body">
            <div class="res-card-title" title="${this.escape(r.name)}">${this.escape(r.name)}</div>
            <div class="res-card-meta">
              <span>${this.escape(r.category)}</span>
              <span>·</span>
              <span>${ext.toUpperCase()}</span>
              <span>·</span>
              <span>${r.size}</span>
            </div>
            <div class="res-card-summary">${this.escape(r.summary.slice(0, 90))}${r.summary.length > 90 ? '…' : ''}</div>
            <div class="res-card-keywords">${kw}</div>
          </div>
          <div class="res-card-actions">
            <a class="rc-btn primary" href="${this.escape(this.resourceUrl(r.path))}" target="_blank">打开文件</a>
            <button class="rc-btn" onclick="app.previewResource('${this.escape(r.id)}')">预览</button>
          </div>
        </div>
      `;
    }).join('');

    // 空结果提示
    const emptyHtml = total === 0 ? `
      <div class="res-empty">
        <div class="res-empty-icon">🔍</div>
        <div class="res-empty-title">未找到匹配资源</div>
        <div class="res-empty-desc">当前“${this.escape(state.category)}”分类下没有满足条件的资源。</div>
        <button class="res-btn primary" onclick="app.clearResFilters()">查看全部资源</button>
      </div>
    ` : '';

    // 分页按钮（只有结果非空时才显示）
    const pages = [];
    if (total > 0) {
      for (let i = 1; i <= pageCount; i++) {
        if (i === 1 || i === pageCount || (i >= state.page - 1 && i <= state.page + 1)) {
          pages.push(`<button class="res-page ${i === state.page ? 'active' : ''}" onclick="app.setResPage(${i})">${i}</button>`);
        } else if (i === state.page - 2 || i === state.page + 2) {
          pages.push('<span class="res-page-dots">…</span>');
        }
      }
    }

    const html = `
      <div class="res-library">
        <div class="res-sidebar">
          <div class="res-section-title">筛选条件</div>
          <div class="res-nav">${catList}</div>
        </div>
        <div class="res-main">
          <div class="res-hero">
            <div>
              <div class="res-hero-title">智享资源库 · 共建共享</div>
              <div class="res-hero-sub">Skill、案例、教程、素材，一站式查找与沉淀</div>
            </div>
            <div class="res-hero-actions">
              <button class="res-btn primary" onclick="app.uploadResource()">⬆️ 上传资源</button>
              <button class="res-btn" onclick="app.toast('精选资源功能待完善')">浏览精选</button>
            </div>
          </div>
          <div class="res-type-bar">${typeTabs}</div>
          <div class="res-toolbar">
            <input type="text" class="res-search-input" id="res-search-input" placeholder="搜索资料名称、类别、关键词…" value="${this.escape(state.query)}" onkeydown="if(event.key==='Enter')app.applyResSearch()">
            <button class="res-btn primary" onclick="app.applyResSearch()">搜索</button>
          </div>
          ${filterHtml}
          <div class="res-count">共找到 <b>${total}</b> 个资源</div>
          <div class="res-cards">${cards || emptyHtml}</div>
          <div class="res-pagination">${pages.join('')}</div>
        </div>
      </div>
    `;

    const msgs = this.state.sessions.resources || [];
    if (msgs.length && msgs[msgs.length - 1].role === 'system') {
      msgs[msgs.length - 1].content = html;
      msgs[msgs.length - 1].source = '智享资源库';
      this.renderChat();
    } else {
      this.addMessage('system', html, '智享资源库');
    }
  },

  clearResFilters() {
    this.state.resourceState = { category: '全部', type: '全部', query: '', page: 1, pageSize: 12 };
    this.renderResourceLibrary();
  },

  setResCategory(cat) {
    this.state.resourceState.category = cat;
    this.state.resourceState.page = 1;
    // 切换分类时保留搜索词，但若是“全部”则顺便清空搜索词，避免交叉筛选导致为空
    if (cat === '全部') this.state.resourceState.query = '';
    this.renderResourceLibrary();
  },

  setResType(t) {
    this.state.resourceState.type = t;
    this.state.resourceState.page = 1;
    if (t === '全部') this.state.resourceState.query = '';
    this.renderResourceLibrary();
  },

  setResPage(p) {
    this.state.resourceState.page = p;
    this.renderResourceLibrary();
    this.scrollToBottom();
  },

  applyResSearch() {
    const input = document.getElementById('res-search-input');
    this.state.resourceState.query = input ? input.value : '';
    this.state.resourceState.page = 1;
    this.renderResourceLibrary();
  },

  uploadResource() {
    const note = `当前为静态网页版，浏览器无法直接把文件保存到服务器或您的本地目录。\n\n如需新增资源，请：\n1. 把文件复制到：D:\\30-产品管理\\360产品\\AI实验室平台 （智能体实训） (1)\\\n2. 运行：D:\\99-AI工具\\嘉享AI助手\\scripts\\build_data.py\n3. 刷新网页即可在资源库看到新文件。`;
    if (confirm(note + '\n\n点“确定”选择文件（仅用于本页临时预览），点“取消”关闭。')) {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = '.docx,.pptx,.xlsx,.pdf';
      input.onchange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length) {
          this.addMessage('system', `<div><p>已选择 <b>${files.length}</b> 个文件，但尚未真正入库。</p><p class="muted">请按上述步骤复制到源目录并重新运行 build_data.py，刷新后才能在资源库中检索。</p></div>`, '系统提示');
        }
      };
      input.click();
    }
  },

  previewResource(id) {
    const r = (window.JXAI_RESOURCES || []).find(x => x.id === id);
    if (!r) return;
    const chunks = (window.JXAI_KNOWLEDGE || []).filter(k => k.resourceId === id).slice(0, 3);
    const html = `<div>
      <h4>📄 ${this.escape(r.name)}</h4>
      <div class="resource-meta" style="margin-bottom:10px"><span class="resource-tag">${this.escape(r.category)}</span><span class="resource-tag">${r.type.toUpperCase()}</span><span class="resource-tag">${r.size}</span></div>
      <p><b>文件路径：</b><code>${this.escape(r.path)}</code> ${/^[A-Za-z]:[\\/]/.test(r.path) ? '<span class="resource-tag">本地文件</span>' : '<span class="resource-tag">可在线访问</span>'}</p>
      <p><b>内容摘要：</b></p>
      ${chunks.length ? chunks.map((c, i) => `<div class="search-result"><div class="search-result-text">${this.escape(c.text)}</div></div>`).join('') : '<p class="muted">暂无预览片段</p>'}
    </div>`;
    this.addMessage('system', html, r.name);
  },

  /* ---------- UI 辅助 ---------- */
  showTyping() {
    const container = document.getElementById('chat-messages');
    const id = 'typing-' + Date.now();
    const el = document.createElement('div');
    el.id = id;
    el.className = 'message system';
    el.innerHTML = `<div class="message-avatar system">🎓</div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>`;
    container.appendChild(el);
    this.scrollToBottom();
    this._typingId = id;
  },

  hideTyping() {
    if (this._typingId) {
      const el = document.getElementById(this._typingId);
      if (el) el.remove();
      this._typingId = null;
    }
  },

  newChat() {
    if (this.state.currentModule) {
      this.state.sessions[this.state.currentModule] = [];
      this.state.resourceState = { category: '全部', type: '全部', query: '', page: 1, pageSize: 12 };
      if (this.state.currentModule === 'resources') {
        this.renderResourceLibrary();
      } else {
        this.pushSystemIntro();
      }
      this.renderHistory();
    } else {
      this.goHome();
      this.toast('已新建对话，请选择一个功能模块');
    }
  },

  clearChats() {
    this.state.sessions = {};
    this.state.history = [];
    this.renderHistory();
    if (this.state.currentModule) {
      this.openModule(this.state.currentModule);
    }
    this.toast('会话记录已清空');
  },

  /* ---------- 配置弹窗 ---------- */
  openConfig() {
    const body = document.getElementById('config-body');
    const rows = Object.values(window.JXAI_CONFIG.modules).map(m => `
      <div class="config-row">
        <label>${m.icon} ${m.name}</label>
        <input type="text" id="cfg-${m.id}" placeholder="粘贴 WorkBuddy 分享链接（可选）" value="${this.escape(m.workbuddyUrl)}" />
      </div>
    `).join('');
    body.innerHTML = `
      <div class="config-note">当前已优先使用本地 360 产品资料。如需更强的 AI 生成能力，可配置 WorkBuddy Agent 分享链接作为增强入口。</div>
      ${rows}
    `;
    document.getElementById('config-modal').classList.remove('hidden');
  },

  closeConfig() {
    document.getElementById('config-modal').classList.add('hidden');
  },

  saveConfig() {
    Object.values(window.JXAI_CONFIG.modules).forEach(m => {
      const input = document.getElementById('cfg-' + m.id);
      if (input) m.workbuddyUrl = input.value.trim();
    });
    this.saveConfigToStorage();
    this.renderCards();
    this.closeConfig();
    this.toast('配置已保存');
    if (this.state.currentModule) {
      this.state.sessions[this.state.currentModule] = [];
      if (this.state.currentModule === 'resources') {
        this.renderResourceLibrary();
      } else {
        this.pushSystemIntro();
      }
    }
  },

  /* ---------- 事件与工具 ---------- */
  setupInputs() {
    const homeInput = document.getElementById('home-input');
    const chatInput = document.getElementById('chat-input');
    homeInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.homeSend(); }
    });
    chatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.chatSend(); }
    });
  },

  scrollToBottom() {
    const container = document.getElementById('chat-messages');
    container.scrollTop = container.scrollHeight;
  },

  escape(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  },

  ellipsize(str, n) {
    return str.length > n ? str.slice(0, n) + '…' : str;
  },

  resourceUrl(path) {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(path)) return path; // 完整 URL，原样返回
    if (/^[A-Za-z]:[\\/]/.test(path)) return 'file:///' + path.replace(/\\/g, '/'); // 本机 Windows 绝对路径
    return path; // 相对路径（files/...）或站点根路径（/files/...），按网页链接处理
  },

  copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => this.toast('已复制'));
  },

  toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2500);
  }
};

document.addEventListener('DOMContentLoaded', () => app.init());
