/**
 * TREEMALI ERP — Módulo de Condicionais
 * Listagem, venda parcial, devolução parcial e cancelamento
 */

let _condicionais = [];
let _filtroStatus = 'em_condicional';
let _condAtual    = null; // condicional aberta no modal

// ══════════════════════════════════════════════
// INICIALIZAÇÃO
// ══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('searchCondicionais')
    .addEventListener('input', () => renderCondicionais());
  carregarBandeirasCondicional();
  carregarCondicionais();
});

// ══════════════════════════════════════════════
// CARREGAR CONDICIONAIS
// ══════════════════════════════════════════════

async function carregarCondicionais() {
  if (!window._supabase) {
    const hoje = new Date().toISOString().split('T')[0];
    const ontem = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    _condicionais = [
      {
        id: 1,
        cliente_id: 1, clientes: { nome: 'Ana Silva', telefone: '(44) 99999-0001' },
        vendedor_id: 1, usuarios: { nome: 'Administrador' },
        prazo_devolucao: hoje,
        status: 'em_condicional',
        created_at: new Date().toISOString(),
        observacao: 'Cliente vai decidir até o fim do dia',
        itens_condicional: [
          { id:1, produto_id:1, produtos:{nome:'Camiseta Preta P'}, quantidade_orig:2, quantidade_atual:2, preco_unit:79.90, status:'pendente' },
          { id:2, produto_id:3, produtos:{nome:'Blusa Floral M'},   quantidade_orig:1, quantidade_atual:1, preco_unit:119.90,status:'pendente' },
        ]
      },
      {
        id: 2,
        cliente_id: 2, clientes: { nome: 'Pedro Souza', telefone: '(44) 99999-0002' },
        vendedor_id: 1, usuarios: { nome: 'Administrador' },
        prazo_devolucao: ontem,
        status: 'em_condicional',
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        observacao: null,
        itens_condicional: [
          { id:3, produto_id:2, produtos:{nome:'Calça Jeans 38'}, quantidade_orig:1, quantidade_atual:1, preco_unit:189.90, status:'pendente' },
        ]
      },
      {
        id: 3,
        cliente_id: 1, clientes: { nome: 'Maria Lima', telefone: '' },
        vendedor_id: 1, usuarios: { nome: 'Administrador' },
        prazo_devolucao: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
        status: 'convertida',
        created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        observacao: null,
        itens_condicional: [
          { id:4, produto_id:4, produtos:{nome:'Vestido Midi Bege'}, quantidade_orig:2, quantidade_atual:1, preco_unit:229.90, status:'vendido' },
          { id:5, produto_id:1, produtos:{nome:'Camiseta Preta P'},  quantidade_orig:1, quantidade_atual:1, preco_unit:79.90,  status:'devolvido' },
        ]
      },
    ];
  } else {
    const { data, error } = await window._supabase
      .from('condicionais')
      .select(`
        *,
        clientes(nome, telefone),
        usuarios(nome),
        itens_condicional(*, produtos(nome, sku, descricao, custo))
      `)
      .order('created_at', { ascending: false });

    if (error) {
      document.getElementById('listCondicionais').innerHTML =
        `<div class="table-loading" style="color:var(--color-danger)">${error.message}</div>`;
      return;
    }
    _condicionais = data || [];
  }

  atualizarKPIs();
  renderCondicionais();
}

// ══════════════════════════════════════════════
// KPIs
// ══════════════════════════════════════════════

function atualizarKPIs() {
  const hoje  = new Date().toISOString().split('T')[0];
  const abertas    = _condicionais.filter(c => c.status === 'em_condicional');
  const vencidas   = abertas.filter(c => c.prazo_devolucao < hoje);
  const vencHoje   = abertas.filter(c => c.prazo_devolucao === hoje);
  const mesAtual   = new Date().getMonth();
  const convertidas = _condicionais.filter(c => {
    return c.status === 'convertida' &&
      new Date(c.updated_at || c.created_at).getMonth() === mesAtual;
  });

  setText('kpiAberto',      abertas.length);
  setText('kpiVencendoHoje', vencHoje.length);
  setText('kpiVencidas',    vencidas.length);
  setText('kpiConvertidas', convertidas.length);
}

// ══════════════════════════════════════════════
// RENDER LISTA
// ══════════════════════════════════════════════

function setFiltroStatus(status) {
  _filtroStatus = status;
  document.querySelectorAll('.filtro-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.status === status);
  });
  renderCondicionais();
}

function renderCondicionais() {
  const busca = document.getElementById('searchCondicionais').value.toLowerCase();
  const hoje  = new Date().toISOString().split('T')[0];

  let lista = _condicionais;

  if (_filtroStatus !== 'todas') {
    lista = lista.filter(c => c.status === _filtroStatus);
  }

  if (busca) {
    lista = lista.filter(c =>
      c.clientes?.nome?.toLowerCase().includes(busca)
    );
  }

  const container = document.getElementById('listCondicionais');

  if (!lista.length) {
    container.innerHTML = '<div class="table-loading">Nenhuma condicional encontrada</div>';
    return;
  }

  container.innerHTML = lista.map((c, idx) => {
    const prazo      = c.prazo_devolucao;
    const vencida    = prazo < hoje;
    const venceHoje  = prazo === hoje;
    const diasRestantes = Math.ceil((new Date(prazo) - new Date()) / 86400000);

    let prazoClass = 'cond-prazo-ok';
    let prazoTxt   = `Prazo: ${Format.date(prazo)} (${diasRestantes} dia${Math.abs(diasRestantes) !== 1 ? 's' : ''})`;
    let cardClass  = 'status-ok';

    if (c.status === 'em_condicional') {
      if (vencida)   { prazoClass = 'cond-prazo-vencida'; prazoTxt = `⚠ VENCIDA — ${Format.date(prazo)}`; cardClass = 'status-vencida'; }
      else if (venceHoje) { prazoClass = 'cond-prazo-warn'; prazoTxt = `⚡ Vence HOJE`; cardClass = 'status-vencendo'; }
    } else if (c.status === 'convertida') { cardClass = 'status-convertida'; }
    else if (c.status === 'cancelada')    { cardClass = 'status-cancelada'; }

    const itens       = c.itens_condicional || [];
    const totalValor  = itens.reduce((s, i) => s + (i.preco_unit * i.quantidade_atual), 0);
    const qtdTotal    = itens.reduce((s, i) => s + i.quantidade_atual, 0);

    const itensHtml = itens.map(i => `
      <div class="cond-item status-${i.status}">
        <div>
          <span class="cond-item-nome">${i.produtos?.nome || '—'}</span>
          ${i.produtos?.sku ? `<span style="font-size:var(--text-xs);color:var(--color-gray-400);margin-left:4px">${i.produtos.sku}</span>` : ''}
          ${i.produtos?.descricao ? `<div style="font-size:var(--text-xs);color:var(--color-taupe);font-style:italic">${i.produtos.descricao}</div>` : ''}
        </div>
        <span class="cond-item-qtd">${i.quantidade_atual}x</span>
        <span class="cond-item-valor">${Format.currency(i.preco_unit * i.quantidade_atual)}</span>
        <span class="badge ${i.status === 'pendente' ? 'badge-warning' : i.status === 'vendido' ? 'badge-success' : 'badge-neutral'}">${
          i.status === 'pendente' ? 'Pendente' : i.status === 'vendido' ? 'Vendido' : 'Devolvido'
        }</span>
      </div>
    `).join('');

    const botoesAcao = c.status === 'em_condicional' ? `
      <button class="btn btn-ghost btn-sm" onclick="gerarComprovanteCondicional(${c.id})" title="Comprovante">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        Comprovante
      </button>
      <button class="btn btn-primary btn-sm" onclick="abrirModalCondicional(${c.id})">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        Registrar Retorno/Venda
      </button>
    ` : `
      <button class="btn btn-ghost btn-sm" onclick="gerarComprovanteCondicional(${c.id})" title="Comprovante">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        Comprovante
      </button>
      <button class="btn btn-ghost btn-sm" onclick="abrirModalCondicional(${c.id})">
        Ver Detalhes
      </button>
    `;

    return `
      <div class="cond-card ${cardClass}" style="animation-delay:${idx * 0.04}s">
        <div class="cond-card-header">
          <div>
            <div class="cond-cliente">👤 ${c.clientes?.nome || 'Cliente não informado'}</div>
            <div class="cond-meta">
              <span>📅 Saída: ${Format.date(c.created_at)}</span>
              <span class="${prazoClass}">${prazoTxt}</span>
              ${c.usuarios?.nome ? `<span>Vendedor: ${c.usuarios.nome}</span>` : ''}
            </div>
          </div>
          <span class="badge ${
            c.status === 'em_condicional' ? 'badge-warning' :
            c.status === 'convertida'     ? 'badge-success' : 'badge-neutral'
          }">${
            c.status === 'em_condicional' ? 'Em Aberto' :
            c.status === 'convertida'     ? 'Convertida' : 'Cancelada'
          }</span>
        </div>
        <div class="cond-card-body">
          ${c.observacao ? `<p style="font-size:var(--text-sm);color:var(--color-gray-400);margin-bottom:var(--space-3);font-style:italic">"${c.observacao}"</p>` : ''}
          <div class="cond-itens-lista">${itensHtml}</div>
        </div>
        <div class="cond-card-footer">
          <div class="cond-total">
            ${qtdTotal} produto(s) · Total: <strong>${Format.currency(totalValor)}</strong>
          </div>
          <div class="cond-acoes">${botoesAcao}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ══════════════════════════════════════════════
// MODAL — REGISTRAR RETORNO / VENDA PARCIAL
// ══════════════════════════════════════════════

function abrirModalCondicional(id) {
  _condAtual = _condicionais.find(c => c.id === id);
  if (!_condAtual) return;

  const c    = _condAtual;
  const hoje = new Date().toISOString().split('T')[0];
  const itens = (c.itens_condicional || []).filter(i => i.status === 'pendente');
  const isAberta = c.status === 'em_condicional';

  document.getElementById('tituloModalCond').textContent =
    `Condicional — ${c.clientes?.nome || 'Cliente'}`;

  const infoHtml = `
    <div class="modal-cond-info">
      <div class="modal-cond-info-item">
        <span class="modal-cond-info-label">Cliente</span>
        <span class="modal-cond-info-value">${c.clientes?.nome || '—'}</span>
      </div>
      <div class="modal-cond-info-item">
        <span class="modal-cond-info-label">Prazo</span>
        <span class="modal-cond-info-value ${c.prazo_devolucao < hoje ? 'cond-prazo-vencida' : ''}">${Format.date(c.prazo_devolucao)}</span>
      </div>
      <div class="modal-cond-info-item">
        <span class="modal-cond-info-label">Saída</span>
        <span class="modal-cond-info-value">${Format.datetime(c.created_at)}</span>
      </div>
      <div class="modal-cond-info-item">
        <span class="modal-cond-info-label">Situação</span>
        <span class="modal-cond-info-value">${c.status === 'em_condicional' ? '🟡 Em Aberto' : c.status === 'convertida' ? '🟢 Convertida' : '🔴 Cancelada'}</span>
      </div>
    </div>
  `;

  let itensHtml = '';

  if (isAberta && itens.length) {
    itensHtml = `
      <div class="modal-itens-title">Selecione o que aconteceu com cada item:</div>
      ${itens.map(i => `
        <div class="modal-item-row" id="rowItem${i.id}">
          <input type="checkbox" class="modal-item-check" id="chkItem${i.id}"
            checked onchange="toggleItemVenda(${i.id})" />
          <div class="modal-item-info">
            <div class="modal-item-nome">${i.produtos?.nome || '—'}${i.produtos?.sku ? ` <span style="font-size:var(--text-xs);color:var(--color-gray-400);font-weight:400">— ${i.produtos.sku}</span>` : ''}</div>
            ${i.produtos?.descricao ? `<div style="font-size:var(--text-xs);color:var(--color-taupe);font-style:italic">${i.produtos.descricao}</div>` : ''}
            <div class="modal-item-sub">Preço: ${Format.currency(i.preco_unit)} · Qtd original: ${i.quantidade_orig}</div>
          </div>
          <div class="modal-item-qtd-ctrl">
            <span>Compra:</span>
            <input type="number" id="qtdItem${i.id}" min="0" max="${i.quantidade_atual}"
              value="${i.quantidade_atual}" style="width:52px;text-align:center;padding:4px;border:1px solid var(--color-gray-200);border-radius:4px;font-size:var(--text-sm)"
              oninput="atualizarValorItem(${i.id}, ${i.preco_unit}, ${i.quantidade_atual})" />
          </div>
          <div class="modal-item-valor" id="valorItem${i.id}">
            ${Format.currency(i.preco_unit * i.quantidade_atual)}
          </div>
          <button onclick="removerItemCondicional(${i.id}, ${c.id})" title="Remover item"
            style="background:none;border:none;cursor:pointer;color:var(--color-danger);padding:4px;flex-shrink:0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      `).join('')}
      <div style="margin-top:var(--space-4);padding:var(--space-3) var(--space-4);background:var(--color-gray-100);border-radius:var(--radius-md);display:flex;justify-content:space-between;font-size:var(--text-sm)">
        <span>Total da venda:</span>
        <strong id="totalModalCond">${Format.currency(itens.reduce((s,i) => s + i.preco_unit * i.quantidade_atual, 0))}</strong>
      </div>
      <div style="margin-top:var(--space-3);display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
        <div>
          <label class="form-label">Forma de Pagamento</label>
          <select class="form-input" id="formaPagCond" style="margin-top:var(--space-2)" onchange="onChangeFormaPagCond()">
            <option value="dinheiro">💵 Dinheiro</option>
            <option value="pix">⚡ PIX</option>
            <option value="debito">💳 Débito</option>
            <option value="credito">💳 Crédito</option>
          </select>
        </div>
        <div id="rowParcelasCond" style="display:none">
          <label class="form-label">Parcelas</label>
          <select class="form-input" id="parcelasCond" style="margin-top:var(--space-2)" onchange="onChangeFormaPagCond()">
            <option value="1">1x (à vista)</option>
            <option value="2">2x</option>
            <option value="3">3x</option>
            <option value="4">4x</option>
            <option value="5">5x</option>
            <option value="6">6x</option>
            <option value="12">12x</option>
          </select>
        </div>
      </div>
      <div id="rowBandeiraCond" style="display:none;margin-top:var(--space-2)">
        <label class="form-label">Bandeira</label>
        <select class="form-input" id="bandeiraCond" style="margin-top:var(--space-2)" onchange="onChangeFormaPagCond()">
          <option value="">Selecione...</option>
        </select>
      </div>
      <div id="previewTaxaCond" style="margin-top:var(--space-2);font-size:var(--text-xs);color:var(--color-gray-400)"></div>
      <p class="modal-error hidden" id="erroModalCond"></p>
    `;
  } else if (isAberta && !itens.length) {
    itensHtml = '<p style="color:var(--color-gray-400);font-size:var(--text-sm)">Todos os itens já foram processados.</p>';
  } else {
    // Mostra todos os itens em modo visualização
    const todosItens = c.itens_condicional || [];
    itensHtml = `
      <div class="modal-itens-title">Itens da condicional:</div>
      ${todosItens.map(i => `
        <div class="modal-item-row">
          <div class="modal-item-info">
            <div class="modal-item-nome">${i.produtos?.nome || '—'}${i.produtos?.sku ? ` <span style="font-size:var(--text-xs);color:var(--color-gray-400);font-weight:400">— ${i.produtos.sku}</span>` : ''}</div>
            ${i.produtos?.descricao ? `<div style="font-size:var(--text-xs);color:var(--color-taupe);font-style:italic">${i.produtos.descricao}</div>` : ''}
            <div class="modal-item-sub">Qtd: ${i.quantidade_orig} · Preço: ${Format.currency(i.preco_unit)}</div>
          </div>
          <span class="badge ${i.status === 'pendente' ? 'badge-warning' : i.status === 'vendido' ? 'badge-success' : 'badge-neutral'}">
            ${i.status === 'pendente' ? 'Pendente' : i.status === 'vendido' ? 'Vendido' : 'Devolvido'}
          </span>
          <div class="modal-item-valor">${Format.currency(i.preco_unit * i.quantidade_atual)}</div>
        </div>
      `).join('')}
    `;
  }

  document.getElementById('bodyModalCond').innerHTML = infoHtml + itensHtml;

  // Footer com botões de ação
  const footerEl = document.getElementById('footerModalCond');
  if (isAberta && itens.length) {
    footerEl.innerHTML = `
      <button class="btn btn-ghost" onclick="fecharModal('modalCondicional')">Fechar</button>
      <button class="btn btn-ghost btn-sm" onclick="gerarComprovanteCondicional(${c.id})" title="Compartilhar condicional">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        Comprovante
      </button>
      <button class="btn btn-ghost btn-sm" style="color:var(--color-info)" onclick="abrirAdicionarItemCond(${c.id})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Adicionar Item
      </button>
      <button class="btn btn-danger btn-sm" onclick="cancelarCondicional(${c.id})">Cancelar Tudo</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--color-success);border-color:var(--color-success)" onclick="salvarCondicional(${c.id})" id="btnSalvarCond">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Salvar Condicional
      </button>
      <button class="btn btn-primary" id="btnConverterVenda" onclick="confirmarRetornoVenda(${c.id})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        Converter para Venda
      </button>
    `;
  } else if (isAberta && !itens.length) {
    footerEl.innerHTML = `
      <button class="btn btn-ghost" onclick="fecharModal('modalCondicional')">Fechar</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--color-info)" onclick="abrirAdicionarItemCond(${c.id})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Adicionar Item
      </button>
    `;
  } else {
    footerEl.innerHTML = `
      <button class="btn btn-ghost" onclick="fecharModal('modalCondicional')">Fechar</button>
      <button class="btn btn-ghost btn-sm" onclick="gerarComprovanteCondicional(${c.id})" title="Compartilhar condicional">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        Comprovante
      </button>
    `;
  }

  abrirModal('modalCondicional');
}

function toggleItemVenda(itemId) {
  const chk = document.getElementById(`chkItem${itemId}`);
  const row = document.getElementById(`rowItem${itemId}`);
  const qtdInput = document.getElementById(`qtdItem${itemId}`);
  if (!chk.checked) {
    row.style.opacity = '0.4';
    qtdInput.value = 0;
  } else {
    row.style.opacity = '1';
    const item = _condAtual.itens_condicional.find(i => i.id === itemId);
    if (item) qtdInput.value = item.quantidade_atual;
  }
  recalcularTotalModal();
}

function atualizarValorItem(itemId, preco, maxQtd) {
  const qtdInput = document.getElementById(`qtdItem${itemId}`);
  let qtd = parseInt(qtdInput.value) || 0;
  if (qtd > maxQtd) { qtd = maxQtd; qtdInput.value = qtd; }
  if (qtd < 0)      { qtd = 0; qtdInput.value = 0; }
  const valorEl = document.getElementById(`valorItem${itemId}`);
  if (valorEl) valorEl.textContent = Format.currency(preco * qtd);
  recalcularTotalModal();
}

function recalcularTotalModal() {
  const itens = (_condAtual?.itens_condicional || []).filter(i => i.status === 'pendente');
  let total = 0;
  itens.forEach(i => {
    const chk = document.getElementById(`chkItem${i.id}`);
    const qtd = parseInt(document.getElementById(`qtdItem${i.id}`)?.value) || 0;
    if (chk?.checked) total += i.preco_unit * qtd;
  });
  const el = document.getElementById('totalModalCond');
  if (el) el.textContent = Format.currency(total);
}

// ══════════════════════════════════════════════
// FORMA DE PAGAMENTO DO CONDICIONAL
// ══════════════════════════════════════════════

let _bandeirasCondicional = [];

async function carregarBandeirasCondicional() {
  if (!window._supabase) {
    _bandeirasCondicional = [
      { id:1, nome:'Visa / Mastercard' },
      { id:2, nome:'Elo / Amex' },
    ];
  } else {
    const { data } = await window._supabase.from('bandeiras').select('id, nome').order('nome');
    _bandeirasCondicional = data || [];
  }
}

function onChangeFormaPagCond() {
  const forma    = document.getElementById('formaPagCond')?.value || 'dinheiro';
  const isCartao = ['credito','debito'].includes(forma);

  const rowParcelas = document.getElementById('rowParcelasCond');
  const rowBandeira = document.getElementById('rowBandeiraCond');

  if (rowParcelas) rowParcelas.style.display = forma === 'credito' ? 'block' : 'none';
  if (rowBandeira) rowBandeira.style.display = isCartao ? 'block' : 'none';

  // Preenche bandeiras
  if (isCartao && rowBandeira) {
    const sel = document.getElementById('bandeiraCond');
    if (sel && _bandeirasCondicional.length && sel.options.length <= 1) {
      sel.innerHTML = '<option value="">Selecione...</option>' +
        _bandeirasCondicional.map(b => `<option value="${b.id}">${b.nome}</option>`).join('');
    }
  }

  // Preview taxa
  atualizarPreviewTaxaCond();
}

function atualizarPreviewTaxaCond() {
  const forma      = document.getElementById('formaPagCond')?.value || 'dinheiro';
  const parcelas   = parseInt(document.getElementById('parcelasCond')?.value) || 1;
  const totalEl    = document.getElementById('totalModalCond');
  const total      = totalEl ? parseFloat(totalEl.textContent.replace(/[^\d,]/g,'').replace(',','.')) || 0 : 0;
  const previewEl  = document.getElementById('previewTaxaCond');
  if (!previewEl) return;

  if (!['credito','debito'].includes(forma)) {
    previewEl.textContent = 'Sem taxa de maquininha';
    previewEl.style.color = 'var(--color-success)';
    return;
  }

  // Busca taxa nas taxas carregadas (reutiliza _taxas do vendas se disponível)
  const chave = forma === 'credito' && parcelas > 1 ? `credito_${parcelas}x` : forma;
  const taxasPad = { debito:1.37, credito:3.15, credito_2x:5.39, credito_3x:6.12, credito_4x:6.85, credito_5x:7.57, credito_6x:8.28, credito_12x:12.40 };
  const pct = taxasPad[chave] ?? taxasPad[forma] ?? 0;
  const valorTaxa = parseFloat((total * pct / 100).toFixed(2));

  previewEl.innerHTML = `Taxa ${pct}%: <strong style="color:var(--color-danger)">— ${Format.currency(valorTaxa)}</strong> | Líquido: <strong>${Format.currency(total - valorTaxa)}</strong>`;
  previewEl.style.color = '';
}

// ══════════════════════════════════════════════
// CONFIRMAR RETORNO / VENDA PARCIAL
// ══════════════════════════════════════════════

async function removerItemCondicional(itemId, condId) {
  if (!confirm('Remover este item do condicional? O estoque será devolvido.')) return;
  if (!window._supabase) {
    Toast.success('Item removido! (demo)');
    abrirModalCondicional(condId);
    return;
  }
  try {
    // Busca quantidade para devolver ao estoque
    const { data: item } = await window._supabase
      .from('itens_condicional').select('produto_id, quantidade_atual').eq('id', itemId).single();

    if (item) {
      // Devolve estoque
      const { data: prod } = await window._supabase
        .from('produtos').select('estoque_atual').eq('id', item.produto_id).single();
      if (prod) {
        await window._supabase.from('produtos')
          .update({ estoque_atual: prod.estoque_atual + item.quantidade_atual, updated_at: new Date().toISOString() })
          .eq('id', item.produto_id);
      }
      // Remove o item
      await window._supabase.from('itens_condicional').delete().eq('id', itemId);
    }
    Toast.success('Item removido!', 'Estoque devolvido.');
    await carregarCondicionais();
    abrirModalCondicional(condId);
  } catch(e) {
    Toast.error('Erro ao remover item', e.message);
  }
}

// Salva as alterações do condicional sem converter para venda
async function salvarCondicional(condId) {
  const liberar = bloquearBtn('btnSalvarCond', 'Salvando...');
  if (!window._supabase) {
    fecharModal('modalCondicional');
    Toast.success('Condicional salva!');
    liberar();
    return;
  }
  try {
    // Atualiza qtd de cada item conforme os campos do modal
    const c = _condAtual;
    const itens = (c.itens_condicional || []).filter(i => i.status === 'pendente');
    for (const item of itens) {
      const qtdEl = document.getElementById(`qtdItem${item.id}`);
      if (!qtdEl) continue;
      const novaQtd = parseInt(qtdEl.value) || 0;
      if (novaQtd !== item.quantidade_atual) {
        await window._supabase.from('itens_condicional')
          .update({ quantidade_atual: novaQtd })
          .eq('id', item.id);
      }
    }
    fecharModal('modalCondicional');
    Toast.success('Condicional salva!', 'Alterações registradas.');
    carregarCondicionais();
  } catch(e) {
    Toast.error('Erro ao salvar', e.message);
  } finally {
    liberar();
  }
}

async function confirmarRetornoVenda(condId) {
  const liberar = bloquearBtn('btnConverterVenda', 'Processando...');
  const c    = _condAtual;
  const itens = (c.itens_condicional || []).filter(i => i.status === 'pendente');
  const user  = Auth.getUser();
  const forma = document.getElementById('formaPagCond')?.value || 'dinheiro';
  const parcelas   = parseInt(document.getElementById('parcelasCond')?.value) || 1;
  const bandeiraId = parseInt(document.getElementById('bandeiraCond')?.value) || null;

  // Monta o que vai ser vendido e o que vai ser devolvido
  const vendidos   = [];
  const devolvidos = [];

  itens.forEach(i => {
    const chk = document.getElementById(`chkItem${i.id}`);
    const qtd = parseInt(document.getElementById(`qtdItem${i.id}`)?.value) || 0;

    if (chk?.checked && qtd > 0) {
      vendidos.push({ ...i, qtdVenda: qtd });
    }

    const qtdDevolver = i.quantidade_atual - (chk?.checked ? qtd : 0);
    if (qtdDevolver > 0) {
      devolvidos.push({ ...i, qtdDevolver });
    }
  });

  if (!vendidos.length && !devolvidos.length) {
    mostrarErroModal('erroModalCond', 'Nenhum item selecionado.');
    return;
  }

  const totalVenda = vendidos.reduce((s, i) => s + i.preco_unit * i.qtdVenda, 0);

  if (!window._supabase) {
    // Demo
    const idx = _condicionais.findIndex(x => x.id === condId);
    if (idx >= 0) {
      if (vendidos.length && !devolvidos.length) {
        _condicionais[idx].status = 'convertida';
      } else if (!vendidos.length) {
        _condicionais[idx].status = 'cancelada';
      }
    }
    fecharModal('modalCondicional');
    Toast.success('Condicional processada!',
      `${vendidos.length} item(s) vendido(s)${devolvidos.length ? `, ${devolvidos.length} devolvido(s)` : ''}.`
    );
    carregarCondicionais();
    return;
  }

  try {
    // 1. Registra venda se houver itens vendidos
    if (vendidos.length && totalVenda > 0) {
      const custTotal  = vendidos.reduce((s,i) => s + ((i.produtos?.custo || 0) * i.qtdVenda), 0);
      const taxasPad   = { debito:1.37, credito:3.15, credito_2x:5.39, credito_3x:6.12, credito_4x:6.85, credito_5x:7.57, credito_6x:8.28, credito_12x:12.40 };
      const chave      = forma === 'credito' && parcelas > 1 ? `credito_${parcelas}x` : forma;
      const isCartao   = ['credito','debito'].includes(forma) && bandeiraId;
      const taxaPct    = isCartao ? (taxasPad[chave] ?? taxasPad[forma] ?? 0) : 0;
      const valorTaxa  = parseFloat((totalVenda * taxaPct / 100).toFixed(2));
      const valorLiq   = parseFloat((totalVenda - valorTaxa).toFixed(2));
      const lucroReal  = parseFloat((valorLiq - custTotal).toFixed(2));

      const { data: venda } = await window._supabase.from('vendas').insert({
        cliente_id:      c.cliente_id,
        vendedor_id:     user?.id || null,
        tipo:            'condicional',
        forma_pagamento: forma,
        parcelas:        parcelas,
        bandeira_id:     isCartao ? bandeiraId : null,
        taxa_aplicada:   taxaPct,
        valor_total:     totalVenda,
        valor_taxa:      valorTaxa,
        valor_liquido:   valorLiq,
        custo_total:     custTotal,
        lucro:           lucroReal,
        status:          'concluida',
        observacao:      `Venda de condicional #${condId}`,
      }).select().single();

      if (venda) {
        for (const i of vendidos) {
          await window._supabase.from('itens_venda').insert({
            venda_id:   venda.id,
            produto_id: i.produto_id,
            quantidade: i.qtdVenda,
            custo_unit: i.produtos?.custo || 0,
            preco_unit: i.preco_unit,
            preco_vend: i.preco_unit,
            total:      i.preco_unit * i.qtdVenda,
          });

          // Atualiza item condicional
          await window._supabase.from('itens_condicional')
            .update({ status: 'vendido', quantidade_atual: i.qtdVenda })
            .eq('id', i.id);
        }
      }
    }

    // 2. Retorna itens devolvidos ao estoque
    for (const i of devolvidos) {
      await window._supabase.from('itens_condicional')
        .update({ status: 'devolvido', quantidade_atual: 0 })
        .eq('id', i.id);

      // Retorna ao estoque central
      const { data: prod } = await window._supabase
        .from('produtos').select('estoque_atual').eq('id', i.produto_id).single();
      if (prod) {
        await window._supabase.from('produtos')
          .update({ estoque_atual: prod.estoque_atual + i.qtdDevolver, updated_at: new Date().toISOString() })
          .eq('id', i.produto_id);
      }

      await window._supabase.from('movimentacoes_estoque').insert({
        produto_id:  i.produto_id,
        tipo:        'retorno_condicional',
        quantidade:  i.qtdDevolver,
        referencia:  `Retorno condicional #${condId}`,
        usuario_id:  user?.id || null,
      });
    }

    // 3. Atualiza status da condicional
    const novoStatus = vendidos.length > 0 ? 'convertida' : 'cancelada';
    await window._supabase.from('condicionais')
      .update({ status: novoStatus, updated_at: new Date().toISOString() })
      .eq('id', condId);

    // 4. Registra histórico
    await window._supabase.from('historico_condicional').insert({
      condicional_id: condId,
      acao:           novoStatus,
      descricao:      `${vendidos.length} vendido(s), ${devolvidos.length} devolvido(s). Total: ${Format.currency(totalVenda)}`,
      usuario_id:     user?.id || null,
    });

    fecharModal('modalCondicional');
    Toast.success('Condicional processada!',
      `${vendidos.length} item(s) vendido(s)${devolvidos.length ? `, ${devolvidos.length} devolvido(s)` : ''}.`
    );
    carregarCondicionais();

  } catch (err) {
    mostrarErroModal('erroModalCond', err.message || 'Erro ao processar.');
  } finally {
    liberar();
  }
}

// ══════════════════════════════════════════════
// CANCELAR CONDICIONAL COMPLETA
// ══════════════════════════════════════════════

function cancelarCondicional(condId) {
  fecharModal('modalCondicional');
  document.getElementById('msgConfirmar').textContent =
    'Deseja cancelar esta condicional? Todos os produtos serão devolvidos ao estoque.';

  document.getElementById('btnConfirmar').onclick = async () => {
    const c    = _condicionais.find(x => x.id === condId);
    const user = Auth.getUser();

    if (!window._supabase) {
      const idx = _condicionais.findIndex(x => x.id === condId);
      if (idx >= 0) _condicionais[idx].status = 'cancelada';
      fecharModal('modalConfirmar');
      Toast.success('Condicional cancelada. Estoque restaurado.');
      carregarCondicionais();
      return;
    }

    try {
      const itens = (c.itens_condicional || []).filter(i => i.status === 'pendente');

      for (const i of itens) {
        await window._supabase.from('itens_condicional')
          .update({ status: 'devolvido', quantidade_atual: 0 }).eq('id', i.id);

        const { data: prod } = await window._supabase
          .from('produtos').select('estoque_atual').eq('id', i.produto_id).single();
        if (prod) {
          await window._supabase.from('produtos')
            .update({ estoque_atual: prod.estoque_atual + i.quantidade_atual, updated_at: new Date().toISOString() })
            .eq('id', i.produto_id);
        }

        await window._supabase.from('movimentacoes_estoque').insert({
          produto_id:  i.produto_id,
          tipo:        'retorno_condicional',
          quantidade:  i.quantidade_atual,
          referencia:  `Cancelamento condicional #${condId}`,
          usuario_id:  user?.id || null,
        });
      }

      await window._supabase.from('condicionais')
        .update({ status: 'cancelada', updated_at: new Date().toISOString() })
        .eq('id', condId);

      await window._supabase.from('historico_condicional').insert({
        condicional_id: condId,
        acao:           'cancelada',
        descricao:      'Condicional cancelada. Todos os produtos devolvidos ao estoque.',
        usuario_id:     user?.id || null,
      });

      fecharModal('modalConfirmar');
      Toast.success('Condicional cancelada.', 'Todos os produtos foram devolvidos ao estoque.');
      carregarCondicionais();

    } catch (err) {
      Toast.error('Erro', err.message);
    }
  };

  abrirModal('modalConfirmar');
}

// ══════════════════════════════════════════════
// COMPROVANTE CONDICIONAL
// ══════════════════════════════════════════════

function gerarComprovanteCondicional(condId) {
  const c = _condicionais.find(x => x.id === condId);
  if (!c) return;

  const itens      = c.itens_condicional || [];
  const nomeCliente = c.clientes?.nome || 'Cliente';
  const telefone   = c.clientes?.telefone || '';

  const linhaItens = itens
    .filter(i => i.status !== 'devolvido')
    .map(i => {
      const sku  = i.produtos?.sku  ? ` (${i.produtos.sku})` : '';
      const desc = i.produtos?.descricao ? ` — ${i.produtos.descricao}` : '';
      return `  ${i.quantidade_atual}x ${i.produtos?.nome || '—'}${sku}${desc}\n      R$ ${Format.currency(i.preco_unit)} cada`;
    }).join('\n');

  const total = itens
    .filter(i => i.status !== 'devolvido')
    .reduce((s, i) => s + (i.preco_unit * i.quantidade_atual), 0);

  const status = c.status === 'em_condicional' ? '🟡 Em aberto' :
                 c.status === 'convertida'       ? '🟢 Convertida' : '🔴 Cancelada';

  const texto =
`━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        TREEMALI
    Condicional #${c.id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cliente: ${nomeCliente}
Data:    ${Format.date(c.created_at)}
Prazo:   ${Format.date(c.prazo_devolucao)}
Status:  ${status}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITENS:
${linhaItens}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total:   ${Format.currency(total)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Devolução até ${Format.date(c.prazo_devolucao)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  // Copia para área de transferência e abre WhatsApp
  const encoded = encodeURIComponent(texto);
  const waUrl   = telefone
    ? `https://wa.me/55${telefone.replace(/\D/g,'')}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;

  // Mostra opções
  const escolha = confirm(
    `Comprovante gerado!\n\nClique OK para enviar pelo WhatsApp\nClique Cancelar para copiar o texto`
  );

  if (escolha) {
    window.open(waUrl, '_blank');
  } else {
    navigator.clipboard.writeText(texto).then(() =>
      Toast.success('Copiado!', 'Comprovante copiado para área de transferência.')
    );
  }
}



// ══════════════════════════════════════════════
// ADICIONAR ITEM AO CONDICIONAL
// ══════════════════════════════════════════════

let _produtosParaAdicionar = [];

async function abrirAdicionarItemCond(condId) {
  if (!window._supabase) {
    _produtosParaAdicionar = [
      { id:1, nome:'Camiseta Preta P',  sku:'CAM-001', preco_venda:79.90,  estoque_atual:15 },
      { id:2, nome:'Calça Jeans 38',    sku:'CAL-001', preco_venda:189.90, estoque_atual:3  },
      { id:3, nome:'Blusa Floral M',    sku:'BLU-001', preco_venda:119.90, estoque_atual:8  },
      { id:4, nome:'Vestido Midi Bege', sku:'VES-001', preco_venda:229.90, estoque_atual:5  },
    ];
  } else {
    const { data } = await window._supabase
      .from('produtos')
      .select('id, nome, sku, preco_venda, estoque_atual')
      .gt('estoque_atual', 0)
      .order('nome');
    _produtosParaAdicionar = data || [];
  }

  const c = _condicionais.find(x => x.id === condId);
  document.getElementById('addItemCondId').value = condId;
  document.getElementById('addItemCondCliente').textContent = c?.clientes?.nome || '';

  // Reset campo busca
  document.getElementById('addItemBusca').value = '';
  document.getElementById('addItemProduto').value = '';
  document.getElementById('addItemDropdown').style.display = 'none';
  document.getElementById('addItemProdutoNome').style.display = 'none';
  document.getElementById('addItemQtd').value = 1;
  document.getElementById('addItemPreco').value = '';
  document.getElementById('addItemMaxQtd').textContent = '';
  document.getElementById('erroAddItem').classList.add('hidden');

  abrirModal('modalAddItemCond');
  // Foca no campo de busca ao abrir (abre teclado no celular)
  setTimeout(() => document.getElementById('addItemBusca').focus(), 300);
}

function filtrarProdutosAddItem() {
  const busca    = document.getElementById('addItemBusca').value.toLowerCase().trim();
  const dropdown = document.getElementById('addItemDropdown');

  if (!busca || busca.length < 1) {
    dropdown.style.display = 'none';
    return;
  }

  const filtrados = _produtosParaAdicionar.filter(p =>
    p.nome.toLowerCase().includes(busca) || (p.sku || '').toLowerCase().includes(busca)
  ).slice(0, 10);

  if (!filtrados.length) {
    dropdown.innerHTML = '<div style="padding:10px 14px;color:var(--color-gray-400);font-size:var(--text-sm)">Nenhum produto encontrado</div>';
    dropdown.style.display = 'block';
    return;
  }

  dropdown.innerHTML = filtrados.map(p => `
    <div onclick="selecionarProdutoAddItem(${p.id})"
      style="padding:10px 14px;cursor:pointer;font-size:var(--text-sm);border-bottom:1px solid var(--color-gray-100);
             display:flex;justify-content:space-between;align-items:center"
      onmouseenter="this.style.background='var(--color-gray-50)'"
      onmouseleave="this.style.background=''">
      <div>
        <div style="font-weight:500">${p.nome}</div>
        ${p.sku ? `<div style="font-size:var(--text-xs);color:var(--color-gray-400)">${p.sku}</div>` : ''}
      </div>
      <div style="text-align:right;white-space:nowrap">
        <div style="font-weight:600;color:var(--color-taupe)">${Format.currency(p.preco_venda)}</div>
        <div style="font-size:var(--text-xs);color:${p.estoque_atual<=2?'var(--color-danger)':'var(--color-gray-400)'}">Estoque: ${p.estoque_atual}</div>
      </div>
    </div>
  `).join('');
  dropdown.style.display = 'block';
}

function selecionarProdutoAddItem(prodId) {
  const prod = _produtosParaAdicionar.find(p => p.id === prodId);
  if (!prod) return;
  document.getElementById('addItemProduto').value = prodId;
  document.getElementById('addItemBusca').value = prod.nome + (prod.sku ? ` — ${prod.sku}` : '');
  document.getElementById('addItemDropdown').style.display = 'none';
  document.getElementById('addItemPreco').value = prod.preco_venda || '';
  document.getElementById('addItemQtd').max = prod.estoque_atual;
  document.getElementById('addItemMaxQtd').textContent = `máx ${prod.estoque_atual}`;
  const nomeEl = document.getElementById('addItemProdutoNome');
  nomeEl.textContent = `✓ Selecionado — Estoque: ${prod.estoque_atual}`;
  nomeEl.style.display = 'block';
}

function onChangeProdutoAddItem() {
  // mantido por compatibilidade
}

async function salvarNovoItemCond() {
  const liberar = bloquearBtn('btnSalvarAddItem', 'Adicionando...');
  const condId   = parseInt(document.getElementById('addItemCondId').value);
  const prodId   = parseInt(document.getElementById('addItemProduto').value);
  const qtd      = parseInt(document.getElementById('addItemQtd').value) || 0;
  const preco    = parseFloat(document.getElementById('addItemPreco').value) || 0;
  const erroEl   = document.getElementById('erroAddItem');

  if (!prodId) { erroEl.textContent = 'Selecione um produto.'; erroEl.classList.remove('hidden'); liberar(); return; }
  if (qtd < 1) { erroEl.textContent = 'Informe uma quantidade válida.'; erroEl.classList.remove('hidden'); liberar(); return; }
  if (!preco)  { erroEl.textContent = 'Informe o preço unitário.'; erroEl.classList.remove('hidden'); liberar(); return; }

  erroEl.classList.add('hidden');

  if (!window._supabase) {
    const cond = _condicionais.find(x => x.id === condId);
    if (cond) {
      const prod = _produtosParaAdicionar.find(p => p.id === prodId);
      cond.itens_condicional = cond.itens_condicional || [];
      cond.itens_condicional.push({
        id: Date.now(),
        produto_id: prodId,
        produtos: { nome: prod?.nome, sku: prod?.sku },
        quantidade_orig: qtd,
        quantidade_atual: qtd,
        preco_unit: preco,
        status: 'pendente',
      });
    }
    fecharModal('modalAddItemCond');
    Toast.success('Item adicionado!');
    liberar();
    abrirModalCondicional(condId);
    return;
  }

  const { error } = await window._supabase.from('itens_condicional').insert({
    condicional_id:  condId,
    produto_id:      prodId,
    quantidade_orig: qtd,
    quantidade_atual:qtd,
    preco_unit:      preco,
    status:          'pendente',
  });

  if (error) { erroEl.textContent = 'Erro: ' + error.message; erroEl.classList.remove('hidden'); liberar(); return; }

  fecharModal('modalAddItemCond');
  Toast.success('Item adicionado ao condicional!');
  liberar();
  await carregarCondicionais();
  abrirModalCondicional(condId);
}

function abrirModal(id) {
  document.getElementById(id).classList.add('active');
  document.body.style.overflow = 'hidden';
}

function fecharModal(id) {
  document.getElementById(id).classList.remove('active');
  document.body.style.overflow = '';
}

function mostrarErroModal(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) fecharModal(e.target.id);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape')
    document.querySelectorAll('.modal-overlay.active').forEach(m => fecharModal(m.id));
});
