/**
 * TREEMALI ERP — Layout Module
 * Handles sidebar, header, navigation, and shared UI behavior
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Auth guard: redirect if not logged in
  if (!Auth.isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }

  const user = Auth.getUser();

  // ── Populate user info in sidebar
  const userAvatar = document.getElementById('userAvatar');
  const userName   = document.getElementById('userName');
  const userRole   = document.getElementById('userRole');

  if (userAvatar && user) {
    userAvatar.textContent = (user.nome || user.login || 'U')[0].toUpperCase();
  }
  if (userName && user) {
    userName.textContent = user.nome || user.login;
  }
  if (userRole && user) {
    userRole.textContent = user.role === 'master' ? 'Administrador' : 'Vendedor';
  }

  // ── Logout button
  document.getElementById('btnLogout')?.addEventListener('click', () => {
    Auth.logout();
  });

  // ── Sidebar toggle (collapse/expand on desktop)
  const sidebar      = document.getElementById('sidebar');
  const toggleBtn    = document.getElementById('btnSidebarToggle');
  const overlay      = document.getElementById('sidebarOverlay');

  const isMobile = () => window.innerWidth <= 768;

  toggleBtn?.addEventListener('click', () => {
    if (isMobile()) {
      sidebar.classList.toggle('mobile-open');
      overlay?.classList.toggle('active');
    } else {
      sidebar.classList.toggle('collapsed');
      localStorage.setItem('sidebar_collapsed', sidebar.classList.contains('collapsed'));
    }
  });

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('active');
  });

  // Restore sidebar collapsed state on desktop
  if (!isMobile()) {
    const wasCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (wasCollapsed) sidebar.classList.add('collapsed');
  }

  // ── Highlight active nav item
  const currentPage = window.location.pathname.split('/').pop();
  document.querySelectorAll('.nav-item').forEach(item => {
    const href = item.getAttribute('href') || '';
    if (href === currentPage || href.endsWith(currentPage)) {
      item.classList.add('active');
    }
  });

  // ── Update header date
  const headerDate = document.getElementById('headerDate');
  if (headerDate) {
    const now = new Date();
    headerDate.textContent = now.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  // ── Botões do header: Atualizar + Ocultar Valores
  const headerActions = document.querySelector('.header-actions');

  if (headerActions) {
    // 1. Cria botão OCULTAR primeiro
    if (!document.getElementById('btnOcultarValores')) {
      const btn = document.createElement('button');
      btn.id = 'btnOcultarValores';
      btn.title = 'Ocultar/Mostrar valores';
      btn.style.cssText = `
        background:none; border:1px solid var(--color-gray-200); cursor:pointer;
        color:var(--color-gray-500); padding:5px 10px; border-radius:var(--radius-md);
        font-size:var(--text-xs); display:inline-flex; align-items:center; gap:5px;
        transition:all var(--transition-fast); white-space:nowrap;
      `;
      btn.innerHTML = `
        <svg id="iconeOlho" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <span id="textoOlho">Ocultar</span>
      `;
      btn.addEventListener('mouseenter', () => { btn.style.borderColor='var(--color-taupe)'; btn.style.color='var(--color-taupe)'; });
      btn.addEventListener('mouseleave', () => { btn.style.borderColor='var(--color-gray-200)'; btn.style.color='var(--color-gray-500)'; });
      btn.addEventListener('click', toggleOcultarValores);
      headerActions.insertBefore(btn, headerDate || null);
    }

    // 2. Cria botão ATUALIZAR antes do Ocultar
    if (!document.getElementById('btnAtualizarPagina')) {
      const btnRefresh = document.createElement('button');
      btnRefresh.id = 'btnAtualizarPagina';
      btnRefresh.title = 'Atualizar dados da página';
      btnRefresh.style.cssText = `
        background:none; border:1px solid var(--color-gray-200); cursor:pointer;
        color:var(--color-gray-500); padding:5px 10px; border-radius:var(--radius-md);
        font-size:var(--text-xs); display:inline-flex; align-items:center; gap:5px;
        transition:all var(--transition-fast); white-space:nowrap;
      `;
      btnRefresh.innerHTML = `
        <svg id="iconeRefresh" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
        Atualizar
      `;
      btnRefresh.addEventListener('mouseenter', () => { btnRefresh.style.borderColor='var(--color-taupe)'; btnRefresh.style.color='var(--color-taupe)'; });
      btnRefresh.addEventListener('mouseleave', () => { btnRefresh.style.borderColor='var(--color-gray-200)'; btnRefresh.style.color='var(--color-gray-500)'; });
      btnRefresh.addEventListener('click', () => {
        const svg = document.getElementById('iconeRefresh');
        if (svg) { svg.style.transition='transform 0.5s'; svg.style.transform='rotate(360deg)'; setTimeout(()=>{ svg.style.transform=''; svg.style.transition=''; },500); }
        if      (typeof carregarDashboard    === 'function') carregarDashboard();
        else if (typeof carregarVendas       === 'function') carregarVendas();
        else if (typeof carregarHistorico    === 'function') carregarHistorico();
        else if (typeof carregarCondicionais === 'function') carregarCondicionais();
        else if (typeof carregarDespesas     === 'function') carregarDespesas();
        else if (typeof carregarFinanceiro   === 'function') carregarFinanceiro();
        else if (typeof carregarContasPagar  === 'function') carregarContasPagar();
        else if (typeof carregarContasReceber=== 'function') carregarContasReceber();
        else if (typeof carregarCrediario    === 'function') carregarCrediario();
        else if (typeof carregarEstoque      === 'function') carregarEstoque();
        else if (typeof carregarSaidas       === 'function') carregarSaidas();
        else if (typeof carregarRelatorios   === 'function') carregarRelatorios();
        else if (typeof carregarAlertas      === 'function') carregarAlertas();
        else location.reload();
      });
      // Insere ANTES do botão Ocultar
      const btnOcultar = document.getElementById('btnOcultarValores');
      headerActions.insertBefore(btnRefresh, btnOcultar);
    }
  }

  // ── Hide master-only nav items for sellers
  if (Auth.isSeller()) {
    document.querySelectorAll('[data-role="master"]').forEach(el => {
      el.style.display = 'none';
    });
  }

  // ── Alert bell — load alert count
  loadAlertCount();
});

// ============================================================
// ALERT COUNT
// ============================================================

async function loadAlertCount() {
  // This will be connected to Supabase queries in full implementation
  // For now it reads from a global state set by each page
  const count = window._alertCount || 0;
  const dot = document.querySelector('.alert-dot');
  if (dot) {
    dot.style.display = count > 0 ? 'block' : 'none';
  }
}

// ============================================================
// TOAST NOTIFICATION SYSTEM
// ============================================================

const Toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(title, message = '', type = 'default', duration = 4000) {
    this.init();

    const icons = {
      success: '✓',
      warning: '⚠',
      error:   '✕',
      default: 'ℹ'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.default}</span>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
    `;

    this.container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  },

  success(title, message) { this.show(title, message, 'success'); },
  warning(title, message) { this.show(title, message, 'warning'); },
  error(title, message)   { this.show(title, message, 'error');   },
};

// ============================================================
// MODAL SYSTEM
// ============================================================

const Modal = {
  open(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  },

  close(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  closeAll() {
    document.querySelectorAll('.modal-overlay.active').forEach(el => {
      el.classList.remove('active');
    });
    document.body.style.overflow = '';
  }
};

// Close modal when clicking overlay backdrop
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    Modal.closeAll();
  }
});

// Close on ESC key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') Modal.closeAll();
});

// ============================================================
// FORMAT HELPERS
// ============================================================

const Format = {
  currency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  },

  percent(value) {
    return `${Number(value).toFixed(2).replace('.', ',')}%`;
  },

  date(dateStr) {
    if (!dateStr) return '—';
    // Adiciona T12:00:00 para evitar problema de fuso horário (UTC vs local)
    const str = String(dateStr).length === 10 ? dateStr + 'T12:00:00' : dateStr;
    return new Date(str).toLocaleDateString('pt-BR');
  },

  datetime(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('pt-BR');
  },

  number(value) {
    return new Intl.NumberFormat('pt-BR').format(value || 0);
  }
};

// ============================================================
// SUPABASE DATA HELPERS
// ============================================================

const DB = {
  // Use a getter so we always pick up window._supabase after it's initialized
  get supabase() { return window._supabase || null; },

  async query(table, options = {}) {
    if (!this.supabase) {
      console.warn('Supabase not configured. Using demo data.');
      return { data: [], error: null };
    }

    let q = this.supabase.from(table).select(options.select || '*');

    if (options.filters) {
      options.filters.forEach(([col, val]) => { q = q.eq(col, val); });
    }

    if (options.order) {
      q = q.order(options.order.col, { ascending: options.order.asc ?? true });
    }

    if (options.limit) q = q.limit(options.limit);

    return await q;
  },

  async insert(table, data) {
    if (!this.supabase) return { error: 'No Supabase connection' };
    return await this.supabase.from(table).insert(data).select().single();
  },

  async update(table, id, data) {
    if (!this.supabase) return { error: 'No Supabase connection' };
    return await this.supabase.from(table).update(data).eq('id', id).select().single();
  },

  async remove(table, id) {
    if (!this.supabase) return { error: 'No Supabase connection' };
    return await this.supabase.from(table).delete().eq('id', id);
  }
};

// ============================================================
// TOOLTIP SYSTEM — KPI Info Tooltips
// ============================================================

const KPI_TOOLTIPS = {
  // Dashboard
  'Vendas Hoje':          'Total faturado nas vendas concluídas hoje. Não inclui condicionais ou crediários pendentes.',
  'Vendas do Mês':        'Total faturado em vendas concluídas no mês atual.',
  'Lucro Estimado':       'Faturamento menos custo das mercadorias e taxas da maquininha. Não desconta despesas operacionais.',
  'Condicionais Abertas': 'Peças que saíram em condicional e ainda estão na casa do cliente aguardando decisão de compra.',
  'Contas a Pagar':       'Soma de todas as despesas e parcelas com status pendente ou vencido.',
  'Contas a Receber':     'Soma de todas as parcelas de crediário pendentes ou vencidas.',
  'Saldo do Mês':         'Entradas do mês (valor líquido das vendas) menos saídas pagas (despesas + saídas não comerciais).',
  'Saldo Histórico':      'Posição real acumulada do caixa desde o início — todas as entradas menos todas as saídas pagas.',

  // Financeiro
  'Faturamento':          'Total bruto de todas as vendas concluídas no período selecionado.',
  'Despesas':             'Total de despesas operacionais pagas no período (aluguel, fornecedor, energia, etc.).',
  'Taxas Maquininha':     'Total de taxas cobradas pelo cartão nas vendas do período. PIX e dinheiro não geram taxa.',
  'Custo Mercadoria':     'Custo de compra dos produtos vendidos no período, com base no custo cadastrado.',
  'Lucro Operacional':    'Faturamento − Custo Mercadoria − Taxas − Despesas. Base para a distribuição do lucro.',

  // Estoque
  'Total de Produtos':    'Quantidade total de produtos cadastrados no sistema, ativos e inativos.',
  'Produtos Ativos':      'Produtos disponíveis para venda, com estoque positivo.',
  'Total de Peças':       'Soma de todas as unidades em estoque de todos os produtos ativos.',
  'Estoque Baixo':        'Produtos com estoque atual igual ou abaixo do estoque mínimo cadastrado.',
  'Valor em Estoque':     'Custo total do estoque disponível. Calculado como: custo unitário × quantidade. Produtos zerados não somam.',

  // Condicionais
  'Em Aberto':            'Condicionais ativas — produtos que estão na casa do cliente aguardando retorno.',
  'Vencendo Hoje':        'Condicionais cujo prazo de devolução é hoje.',
  'Vencidas':             'Condicionais com prazo de devolução já ultrapassado e ainda não resolvidas.',
  'Convertidas (mês)':    'Condicionais que viraram venda confirmada no mês atual.',

  // Histórico de Vendas
  'Vendas concluídas':    'Total de vendas finalizadas no período — não inclui canceladas.',
  'Faturamento':          'Soma dos valores de todas as vendas concluídas no período.',
  'Lucro estimado':       'Soma dos lucros registrados nas vendas concluídas (já com taxa deduzida).',
  'Canceladas':           'Vendas que foram canceladas. Não afetam faturamento nem lucro.',

  // Contas a Pagar
  'Vencidas':             'Parcelas de despesas com data de vencimento já passou e ainda não foram pagas.',
  'Vencem esta semana':   'Parcelas que vencem nos próximos 7 dias — fique atento para não atrasar.',
  'Pendentes do mês':     'Total de parcelas com vencimento no mês atual ainda não pagas.',
  'Pagas este mês':       'Total de parcelas que já foram pagas no mês atual.',

  // Contas a Receber
  'Vencem esta semana':   'Parcelas de crediário que vencem nos próximos 7 dias.',
  'Pendentes do mês':     'Parcelas de crediário com vencimento no mês atual ainda não recebidas.',
  'Recebidas este mês':   'Parcelas de crediário já recebidas no mês atual.',

  // Crediário
  'Crediários Ativos':    'Clientes com crediário em aberto — com parcelas ainda pendentes.',
  'Total a Receber':      'Soma de todas as parcelas pendentes de todos os crediários ativos.',
  'Parcelas Vencidas':    'Parcelas de crediário com data de vencimento ultrapassada e ainda não pagas.',
  'Recebimentos do Mês':  'Total recebido de parcelas de crediário no mês atual.',

  // Saídas Não Comerciais
  'Saídas este mês':      'Quantidade de saídas não comerciais registradas no mês atual.',
  'Custo total este mês': 'Valor total em custo das mercadorias retiradas para uso não comercial no mês.',
  'Parcerias / Influencer': 'Saídas destinadas a parcerias com influenciadores ou criadores de conteúdo.',
  'Marketing / Divulgação': 'Saídas utilizadas em ações de marketing, fotos ou divulgação da loja.',

  // Alertas
  'Críticos':             'Alertas que precisam de atenção imediata — estoque zerado, parcelas vencidas.',
  'Atenção':              'Alertas importantes mas não urgentes — estoque baixo, condicionais vencendo.',
  'Informativos':         'Alertas de acompanhamento — aniversariantes, condicionais próximas do prazo.',
};

function initTooltips() {
  // Cria o elemento de tooltip uma vez
  let tooltipEl = document.getElementById('kpi-tooltip-global');
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'kpi-tooltip-global';
    tooltipEl.style.cssText = `
      position:fixed; z-index:9999; max-width:260px; padding:10px 14px;
      background:rgba(30,25,22,0.95); color:#fff; font-size:12px; line-height:1.5;
      border-radius:8px; pointer-events:none; opacity:0; transition:opacity 0.15s;
      box-shadow:0 4px 16px rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.08);
    `;
    document.body.appendChild(tooltipEl);
  }

  // Adiciona ícone ℹ em todos os KPI labels que têm tooltip
  const labelSelectors = [
    '.kpi-label', '.fkpi-label', '.ckpi-label', '.ekpi-label',
    '.skpi-label', '.cpkpi-label', '.crkpi-label', '.akpi-label',
    '.hv-kpi-label', '.rkpi-label'
  ];

  document.querySelectorAll(labelSelectors.join(',')).forEach(el => {
    const texto = el.textContent.trim();
    const dica  = KPI_TOOLTIPS[texto];
    if (!dica || el.dataset.tooltipInit) return;
    el.dataset.tooltipInit = '1';

    // Adiciona ícone
    const ico = document.createElement('span');
    ico.innerHTML = ' <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;opacity:0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    ico.style.cursor = 'help';
    el.appendChild(ico);

    // Mostra tooltip
    const show = (e) => {
      tooltipEl.textContent = dica;
      tooltipEl.style.opacity = '1';
      posicionarTooltip(e, tooltipEl);
    };
    const hide = () => { tooltipEl.style.opacity = '0'; };
    const move = (e) => posicionarTooltip(e, tooltipEl);

    el.addEventListener('mouseenter', show);
    el.addEventListener('mousemove',  move);
    el.addEventListener('mouseleave', hide);
    el.addEventListener('touchstart', (e) => { show(e.touches[0]); setTimeout(hide, 3000); });
  });
}

function posicionarTooltip(e, el) {
  const x = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
  const y = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
  const w = el.offsetWidth  || 260;
  const h = el.offsetHeight || 60;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  el.style.left = Math.min(x + 12, vw - w - 8) + 'px';
  el.style.top  = (y + h + 16 > vh) ? (y - h - 8) + 'px' : (y + 16) + 'px';
}

// Inicializa após o DOM carregar e após renderizações dinâmicas
document.addEventListener('DOMContentLoaded', () => setTimeout(initTooltips, 500));
// Permite chamar manualmente após renders dinâmicos
window.initTooltips = initTooltips;

// ============================================================
// OCULTAR / MOSTRAR VALORES E DADOS SENSÍVEIS
// ============================================================

function toggleOcultarValores() {
  const oculto = localStorage.getItem('treemali_ocultar_valores') === 'true';
  localStorage.setItem('treemali_ocultar_valores', !oculto);
  aplicarOcultarValores(!oculto);
}

function aplicarOcultarValores(ocultar) {
  document.body.classList.toggle('valores-ocultos', ocultar);
  const icone = document.getElementById('iconeOlho');
  const texto = document.getElementById('textoOlho');
  if (icone) {
    icone.innerHTML = ocultar
      ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
         <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
         <line x1="1" y1="1" x2="23" y2="23"/>`
      : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
         <circle cx="12" cy="12" r="3"/>`;
  }
  if (texto) texto.textContent = ocultar ? 'Mostrar' : 'Ocultar';
  if (ocultar) {
    mascararTudo();
  } else {
    desmascarar();
    if (window.initTooltips) setTimeout(initTooltips, 100);
  }
}

function mascararTudo() {
  document.querySelectorAll('*:not(script):not(style):not(input):not(select):not(textarea):not(button):not(label):not(th):not(svg):not(path):not(circle):not(line)').forEach(el => {
    if (el.children.length > 0 || el.dataset.valorOriginal) return;
    const texto = el.textContent.trim();
    if (!texto || texto.length < 2) return;
    let m = texto; let ok = false;

    // Valores R$
    if (/R\$\s*[\d.,]+/.test(m))                              { m = m.replace(/R\$\s*[\d.,]+/g, 'R$ ••••'); ok = true; }
    // Telefone
    if (/\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/.test(m))          { m = m.replace(/\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/g, '(••) •••••-••••'); ok = true; }
    // CPF
    if (/\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/.test(m))        { m = m.replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g, '•••.•••.•••-••'); ok = true; }
    // CNPJ
    if (/\d{2}\.?\d{3}\.?\d{3}\/?\.?\d{4}-?\d{2}/.test(m))   { m = m.replace(/\d{2}\.?\d{3}\.?\d{3}\/?\.?\d{4}-?\d{2}/g, '••.•••.•••/••••-••'); ok = true; }
    // Email
    if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(m)) { m = m.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '••••@••••.••'); ok = true; }
    // Data nascimento/aniversário dd/mm/aaaa
    if (/\d{2}\/\d{2}\/\d{4}/.test(m))                        { m = m.replace(/\d{2}\/\d{2}\/\d{4}/g, '••/••/••••'); ok = true; }

    if (ok) { el.dataset.valorOriginal = texto; el.textContent = m; }
  });

  // Elementos marcados com data-privado-nome (cliente, fornecedor, descrição)
  document.querySelectorAll('[data-privado-nome]').forEach(el => {
    if (el.dataset.valorOriginal) return;
    const t = el.textContent.trim();
    if (!t || t === '—') return;
    el.dataset.valorOriginal = t;
    // Se contém "Venda —" mantém o prefixo e mascara só o nome
    if (t.startsWith('Venda —')) {
      el.textContent = t.replace(/Venda — (.+)/, (_, nome) => {
        const partes = nome.trim().split(' ').filter(p => p);
        return 'Venda — ' + partes.map((p, i) => i === 0 ? p[0] + '.' : '••••').join(' ');
      });
    } else {
      // Nome simples ou razão social
      const partes = t.split(' ').filter(p => p);
      el.textContent = partes.map((p, i) => i === 0 ? p[0] + '.' : '••••').join(' ');
    }
  });

  // Nomes em primeira coluna de tabelas
  document.querySelectorAll('tbody tr td:first-child').forEach(td => {
    const el = td.querySelector('strong') || td;
    if (el.children.length > 0 || el.dataset.valorOriginal) return;
    const t = el.textContent.trim();
    if (t && !t.includes('R$') && !t.includes('••') && /[a-zA-ZÀ-ú]{3,}/.test(t)) {
      el.dataset.valorOriginal = t;
      const partes = t.split(' ').filter(p => p.length > 0);
      el.textContent = partes.map((p, i) => i === 0 ? p[0] + '.' : '••••').join(' ');
    }
  });

  // Condicionais — .cond-cliente (nome do cliente no card)
  document.querySelectorAll('.cond-cliente').forEach(el => {
    if (el.dataset.valorOriginal) return;
    const t = el.textContent.trim();
    el.dataset.valorOriginal = t;
    el.textContent = t.replace(/[A-Za-zÀ-ú][\w\sÀ-ú'-]{2,}/g, m => {
      const partes = m.trim().split(' ');
      return partes.map((p, i) => i === 0 ? p[0] + '.' : '••••').join(' ');
    });
  });

  // Financeiro — descrição nas últimas movimentações (ex: "Venda — Maria Silva")
  document.querySelectorAll('#bodyFluxo td:nth-child(2), .fluxo-desc').forEach(el => {
    if (el.children.length > 0 || el.dataset.valorOriginal) return;
    const t = el.textContent.trim();
    if (t.includes('Venda —')) {
      el.dataset.valorOriginal = t;
      el.textContent = t.replace(/Venda — (.+)/, (_, nome) => {
        const partes = nome.trim().split(' ');
        return 'Venda — ' + partes.map((p, i) => i === 0 ? p[0] + '.' : '••••').join(' ');
      });
    }
  });

  // Crediário — nome do cliente
  document.querySelectorAll('.cred-cliente, .cred-nome').forEach(el => {
    if (el.dataset.valorOriginal) return;
    const t = el.textContent.trim();
    if (/[a-zA-ZÀ-ú]{3,}/.test(t)) {
      el.dataset.valorOriginal = t;
      const partes = t.split(' ').filter(p => p.length > 0);
      el.textContent = partes.map((p, i) => i === 0 ? p[0] + '.' : '••••').join(' ');
    }
  });

  // Relatórios — produtos mais vendidos e mais lucrativos (.rank-nome)
  document.querySelectorAll('.rank-nome').forEach(el => {
    if (el.dataset.valorOriginal) return;
    el.dataset.valorOriginal = el.textContent;
    el.textContent = '••••';
  });

  // Crediário — telefone na .cred-meta
  document.querySelectorAll('.cred-meta').forEach(el => {
    if (el.children.length > 0 || el.dataset.valorOriginal) return;
    const t = el.textContent;
    const mascarado = t.replace(/\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/g, '(••) •••••-••••');
    if (mascarado !== t) { el.dataset.valorOriginal = t; el.textContent = mascarado; }
  });
  document.querySelectorAll('#comprovante').forEach(el => {
    if (el.dataset.valorOriginal) return;
    el.dataset.valorOriginal = el.textContent;
    el.textContent = el.textContent
      .replace(/R\$\s*[\d.,]+/g, 'R$ ••••')
      .replace(/Cliente:\s*(.+)/g, (_, nome) => {
        const partes = nome.trim().split(' ');
        return 'Cliente: ' + partes.map((p, i) => i === 0 ? p[0] + '.' : '••••').join(' ');
      })
      .replace(/\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/g, '(••) •••••-••••');
  });
}

function desmascarar() {
  document.querySelectorAll('[data-valor-original]').forEach(el => {
    el.textContent = el.dataset.valorOriginal;
    delete el.dataset.valorOriginal;
  });
}

const _observerValores = new MutationObserver(() => {
  if (localStorage.getItem('treemali_ocultar_valores') === 'true') mascararTudo();
});
document.addEventListener('DOMContentLoaded', () => {
  _observerValores.observe(document.body, { childList: true, subtree: true });
  // Restaura estado salvo
  if (localStorage.getItem('treemali_ocultar_valores') === 'true') {
    setTimeout(() => aplicarOcultarValores(true), 300);
  }
});
