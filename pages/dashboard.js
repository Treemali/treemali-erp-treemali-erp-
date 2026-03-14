/**
 * TREEMALI ERP — Dashboard Page
 * Loads KPIs, alerts, top products, and recent sales
 */

document.addEventListener('DOMContentLoaded', async () => {

  const user = Auth.getUser();

  // Greet user
  document.getElementById('dashGreetName').textContent =
    (user?.nome || user?.login || 'Usuário').split(' ')[0];

  // Hide master-only cards for sellers
  if (Auth.isSeller()) {
    document.querySelectorAll('[data-role="master"]').forEach(el => {
      el.style.display = 'none';
    });
  }

  // Load all dashboard data in parallel
  await Promise.all([
    loadKPIs(),
    loadAlerts(),
    loadTopProducts(),
    loadRecentSales(),
  ]);
});

// ============================================================
// KPI DATA
// ============================================================

async function loadKPIs() {
  // Real implementation queries Supabase
  // Demo data shown when not connected

  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const startOfDay   = new Date(today.setHours(0,0,0,0)).toISOString();

  if (!window._supabase) {
    // Demo values
    renderKPIs({
      vendasHoje:      1850.00,
      vendasHojeQtd:   5,
      vendasMes:       24750.00,
      vendasMesQtd:    78,
      lucroMes:        9100.00,
      condicionaisAbertas: 3,
      condicionaisVencendo: 1,
      contasPagar:     3200.00,
      contasReceber:   6800.00,
    });
    return;
  }

  // Supabase queries
  try {
    const [vendasHojeRes, vendasMesRes, condicionaisRes] = await Promise.all([
      window._supabase
        .from('vendas')
        .select('valor_total')
        .gte('created_at', startOfDay),

      window._supabase
        .from('vendas')
        .select('valor_total, custo_total')
        .gte('created_at', startOfMonth),

      window._supabase
        .from('condicionais')
        .select('id, prazo_devolucao')
        .eq('status', 'em_condicional'),
    ]);

    const vendasHojeTotal = (vendasHojeRes.data || []).reduce((s, v) => s + v.valor_total, 0);
    const vendasMesTotal  = (vendasMesRes.data  || []).reduce((s, v) => s + v.valor_total, 0);
    const lucroMes        = (vendasMesRes.data  || []).reduce((s, v) => s + (v.valor_total - v.custo_total), 0);

    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 2);
    const condicionaisVencendo = (condicionaisRes.data || []).filter(c =>
      c.prazo_devolucao && new Date(c.prazo_devolucao) <= tomorrow
    ).length;

    renderKPIs({
      vendasHoje:   vendasHojeTotal,
      vendasHojeQtd: (vendasHojeRes.data || []).length,
      vendasMes:    vendasMesTotal,
      vendasMesQtd: (vendasMesRes.data  || []).length,
      lucroMes,
      condicionaisAbertas:  (condicionaisRes.data || []).length,
      condicionaisVencendo,
      contasPagar:   0, // TODO: query despesas
      contasReceber: 0, // TODO: query crediario
    });

  } catch (err) {
    console.error('Erro ao carregar KPIs:', err);
  }
}

function renderKPIs(data) {
  setText('kpiVendasHoje',    Format.currency(data.vendasHoje));
  setText('kpiVendasHojeQtd', `${data.vendasHojeQtd} venda${data.vendasHojeQtd !== 1 ? 's' : ''}`);
  setText('kpiVendasMes',     Format.currency(data.vendasMes));
  setText('kpiVendasMesQtd',  `${data.vendasMesQtd} venda${data.vendasMesQtd !== 1 ? 's' : ''}`);
  setText('kpiLucro',         Format.currency(data.lucroMes));
  setText('kpiCondicionais',  data.condicionaisAbertas);
  setText('kpiCondicionaisVenc',
    data.condicionaisVencendo > 0
      ? `⚠ ${data.condicionaisVencendo} vencendo`
      : 'Todas no prazo'
  );
  setText('kpiPagar',   Format.currency(data.contasPagar));
  setText('kpiReceber', Format.currency(data.contasReceber));
}

// ============================================================
// ALERTS
// ============================================================

async function loadAlerts() {
  const alerts = [];

  if (!window._supabase) {
    // Demo alerts
    alerts.push(
      { type: 'warning', text: 'Produto "Camiseta Branca M" com estoque baixo (2 unidades)' },
      { type: 'danger',  text: 'Condicional de Ana Silva vence hoje' },
    );
  } else {
    // TODO: query estoque_minimo, condicionais vencidas, parcelas vencidas
  }

  // Update badge
  const badge = document.getElementById('navAlertBadge');
  const dot   = document.getElementById('alertDot');

  if (alerts.length > 0) {
    if (badge) { badge.textContent = alerts.length; badge.style.display = ''; }
    if (dot)   { dot.style.display = ''; }

    // Show banner
    const banner = document.getElementById('alertsBanner');
    const list   = document.getElementById('alertsList');
    if (banner && list) {
      list.innerHTML = alerts.map(a => `
        <div class="alert-item">
          <span class="alert-item-dot ${a.type === 'danger' ? 'danger' : ''}"></span>
          <span>${a.text}</span>
        </div>
      `).join('');
      banner.classList.remove('hidden');
    }
  }
}

// ============================================================
// TOP PRODUCTS
// ============================================================

async function loadTopProducts() {
  let products = [];

  if (!window._supabase) {
    products = [
      { nome: 'Camiseta Preta P',    qtd: 24 },
      { nome: 'Calça Jeans 38',       qtd: 18 },
      { nome: 'Blusa Floral M',       qtd: 15 },
      { nome: 'Tênis Casual 39',      qtd: 11 },
      { nome: 'Vestido Midi Bege',    qtd: 8  },
    ];
  } else {
    // TODO: GROUP BY produto_id on itens_venda
  }

  const maxQtd = products[0]?.qtd || 1;
  const list   = document.getElementById('topProductsList');

  if (!list) return;

  if (products.length === 0) {
    list.innerHTML = '<div class="empty-state-sm">Nenhuma venda este mês</div>';
    return;
  }

  list.innerHTML = products.map((p, i) => `
    <div class="product-rank-item">
      <span class="product-rank-num">${i + 1}</span>
      <div class="product-rank-info">
        <div class="product-rank-name">${p.nome}</div>
        <div class="product-rank-qty">${p.qtd} vendidos</div>
      </div>
      <div class="product-rank-bar-wrap">
        <div class="product-rank-bar" style="width: ${Math.round((p.qtd / maxQtd) * 100)}%"></div>
      </div>
    </div>
  `).join('');
}

// ============================================================
// RECENT SALES
// ============================================================

async function loadRecentSales() {
  let sales = [];

  if (!window._supabase) {
    sales = [
      { cliente: 'Ana Silva',    valor: 320.00,  hora: '14:32', pagamento: 'PIX'     },
      { cliente: 'Pedro Souza',  valor: 185.50,  hora: '13:15', pagamento: 'Débito'  },
      { cliente: 'Maria Lima',   valor: 740.00,  hora: '11:48', pagamento: '3x Visa' },
      { cliente: 'Carlos Neto',  valor:  95.90,  hora: '10:22', pagamento: 'PIX'     },
      { cliente: 'Julia Ramos',  valor: 430.00,  hora: '09:05', pagamento: 'Crédito' },
    ];
  } else {
    // TODO: query last 5 vendas
  }

  const list = document.getElementById('recentSalesList');
  if (!list) return;

  if (sales.length === 0) {
    list.innerHTML = '<div class="empty-state-sm">Nenhuma venda hoje</div>';
    return;
  }

  list.innerHTML = sales.map(s => `
    <div class="sale-item">
      <div class="sale-item-info">
        <div class="sale-item-client">${s.cliente}</div>
        <div class="sale-item-time">${s.hora} · ${s.pagamento}</div>
      </div>
      <div class="sale-item-value">${Format.currency(s.valor)}</div>
    </div>
  `).join('');
}

// ── Helper
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
