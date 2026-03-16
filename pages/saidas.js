/**
 * TREEMALI ERP — Saídas Não Comerciais
 * Parcerias, brindes, marketing, uso pessoal, perdas
 * Baixa estoque pelo custo e lança como despesa no financeiro
 */

let _saidas   = [];
let _produtos = [];

const CAT_LABELS = {
  parceria:   '🤝 Parceria / Influencer',
  brinde:     '🎁 Brinde a Cliente',
  marketing:  '📣 Marketing / Divulgação',
  uso_pessoal:'👗 Uso Pessoal',
  perda:      '📦 Perda / Avaria',
  outros:     '📋 Outros',
};

const CAT_BADGE = {
  parceria:   'badge-parceria',
  brinde:     'badge-brinde',
  marketing:  'badge-marketing',
  uso_pessoal:'badge-uso',
  perda:      'badge-perda',
  outros:     'badge-outros',
};

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  // Proteção — somente master/admin acessa
  if (typeof Auth !== 'undefined' && Auth.isSeller()) {
    window.location.href = 'dashboard.html';
    return;
  }
  preencherMeses();
  document.getElementById('searchSaidas')
    .addEventListener('input', () => renderSaidas());
  carregarProdutos();
  carregarSaidas();
});

function preencherMeses() {
  const sel   = document.getElementById('filtroMesSaida');
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const hoje  = new Date();
  let opts = '<option value="">Todos os meses</option>';
  for (let i = 0; i < 12; i++) {
    const m = String(i+1).padStart(2,'0');
    opts += `<option value="${hoje.getFullYear()}-${m}" ${i===hoje.getMonth()?'selected':''}>${meses[i]} ${hoje.getFullYear()}</option>`;
  }
  sel.innerHTML = opts;
}

// ══════════════════════════════════════════════
// CARREGAR PRODUTOS
// ══════════════════════════════════════════════

async function carregarProdutos() {
  if (!window._supabase) {
    _produtos = [
      { id:1, nome:'Camiseta Preta P',  sku:'CAM-001', custo:30,  estoque_atual:15 },
      { id:2, nome:'Calça Jeans 38',    sku:'CAL-001', custo:80,  estoque_atual:3  },
      { id:3, nome:'Blusa Floral M',    sku:'BLU-001', custo:45,  estoque_atual:8  },
      { id:4, nome:'Vestido Midi Bege', sku:'VES-001', custo:90,  estoque_atual:5  },
    ];
  } else {
    const { data } = await window._supabase
      .from('produtos').select('id, nome, sku, custo, estoque_atual')
      .eq('ativo', true).order('nome');
    _produtos = data || [];
  }

  const sel = document.getElementById('saidaProduto');
  sel.innerHTML = '<option value="">Selecione o produto...</option>' +
    _produtos.map(p => `<option value="${p.id}" data-custo="${p.custo}" data-estoque="${p.estoque_atual}">
      ${p.nome}${p.sku ? ' — ' + p.sku : ''} (Estq: ${p.estoque_atual})
    </option>`).join('');
}

// ══════════════════════════════════════════════
// CARREGAR SAÍDAS
// ══════════════════════════════════════════════

async function carregarSaidas() {
  const mes      = document.getElementById('filtroMesSaida').value;
  const categoria = document.getElementById('filtroCategoriaSaida').value;

  if (!window._supabase) {
    _saidas = [
      { id:1, data:'2026-03-10', produto_id:1, produtos:{nome:'Camiseta Preta P'}, quantidade:2, custo_unit:30, custo_total:60, categoria:'parceria',  destino:'@influencer_moda', observacao:'Provador de verão', lancou_despesa:true, created_at:new Date().toISOString() },
      { id:2, data:'2026-03-12', produto_id:3, produtos:{nome:'Blusa Floral M'},   quantidade:1, custo_unit:45, custo_total:45, categoria:'marketing',  destino:'Foto campanha redes sociais', observacao:'', lancou_despesa:true, created_at:new Date().toISOString() },
      { id:3, data:'2026-03-14', produto_id:4, produtos:{nome:'Vestido Midi Bege'},quantidade:1, custo_unit:90, custo_total:90, categoria:'uso_pessoal',destino:'Uso da proprietária', observacao:'', lancou_despesa:false, created_at:new Date().toISOString() },
    ];
  } else {
    let q = window._supabase
      .from('saidas_nao_comerciais')
      .select('*, produtos(nome, sku)')
      .order('data', { ascending: false });
    if (categoria) q = q.eq('categoria', categoria);
    if (mes)       q = q.gte('data', mes+'-01').lte('data', mes+'-31');

    const { data } = await q;
    _saidas = data || [];
  }

  atualizarKPIs();
  renderSaidas();
}

// ══════════════════════════════════════════════
// KPIs
// ══════════════════════════════════════════════

function atualizarKPIs() {
  const mes1 = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const mes2 = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).toISOString().split('T')[0];

  const doMes     = _saidas.filter(s => s.data >= mes1 && s.data <= mes2);
  const custoMes  = doMes.reduce((s, x) => s + (x.custo_total||0), 0);
  const parcerias = _saidas.filter(s => s.categoria === 'parceria').length;
  const marketing = _saidas.filter(s => s.categoria === 'marketing').length;

  setText('kpiQtdMes',    doMes.length);
  setText('kpiCustoMes',  Format.currency(custoMes));
  setText('kpiParcerias', parcerias);
  setText('kpiMarketing', marketing);
}

// ══════════════════════════════════════════════
// RENDER TABELA
// ══════════════════════════════════════════════

function renderSaidas() {
  const busca = document.getElementById('searchSaidas').value.toLowerCase();
  let lista   = _saidas;

  if (busca) {
    lista = lista.filter(s =>
      s.produtos?.nome?.toLowerCase().includes(busca) ||
      s.destino?.toLowerCase().includes(busca) ||
      s.observacao?.toLowerCase().includes(busca)
    );
  }

  const tbody = document.getElementById('bodySaidas');
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-loading">Nenhuma saída encontrada</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(s => `
    <tr>
      <td>${Format.date(s.data)}</td>
      <td><strong>${s.produtos?.nome || '—'}</strong></td>
      <td>${s.quantidade}</td>
      <td><span class="badge ${CAT_BADGE[s.categoria]||'badge-neutral'}">${CAT_LABELS[s.categoria]||s.categoria}</span></td>
      <td>${s.destino || '—'}${s.observacao ? `<br><small style="color:var(--color-gray-400);font-style:italic">${s.observacao}</small>` : ''}</td>
      <td>${Format.currency(s.custo_unit)}</td>
      <td><strong style="color:var(--color-danger)">— ${Format.currency(s.custo_total)}</strong></td>
      <td>
        ${s.lancou_despesa
          ? '<span title="Despesa lançada" style="color:var(--color-success);font-size:1.1rem">✓</span>'
          : '<span title="Sem lançamento" style="color:var(--color-gray-300);font-size:1.1rem">—</span>'}
        <button class="btn-table danger" onclick="excluirSaida(${s.id})" title="Excluir">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
      </td>
    </tr>
  `).join('');
}

// ══════════════════════════════════════════════
// MODAL — NOVA SAÍDA
// ══════════════════════════════════════════════

function abrirNovaSaida() {
  document.getElementById('saidaId').value = '';
  document.getElementById('saidaProduto').value = '';
  document.getElementById('saidaQtd').value = 1;
  document.getElementById('saidaCustoUnit').value = '';
  document.getElementById('saidaCustoTotal').textContent = 'R$ 0,00';
  document.getElementById('saidaCategoria').value = 'parceria';
  document.getElementById('saidaDestino').value = '';
  document.getElementById('saidaData').value = new Date().toISOString().split('T')[0];
  document.getElementById('saidaLancarDespesa').value = 'true';
  document.getElementById('saidaObs').value = '';
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === 'parceria'));
  esconderErro('erroSaida');
  abrirModal('modalSaida');
}

function preencherCustoProduto() {
  const sel    = document.getElementById('saidaProduto');
  const opt    = sel.options[sel.selectedIndex];
  const custo  = opt?.dataset.custo || '';
  document.getElementById('saidaCustoUnit').value = custo;
  calcularCustoSaida();
}

function calcularCustoSaida() {
  const custo = parseFloat(document.getElementById('saidaCustoUnit').value) || 0;
  const qtd   = parseInt(document.getElementById('saidaQtd').value) || 0;
  document.getElementById('saidaCustoTotal').textContent = Format.currency(custo * qtd);
}

function setCategoria(cat) {
  document.getElementById('saidaCategoria').value = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
}

// ══════════════════════════════════════════════
// SALVAR SAÍDA
// ══════════════════════════════════════════════

async function salvarSaida() {
  const prodId    = parseInt(document.getElementById('saidaProduto').value);
  const qtd       = parseInt(document.getElementById('saidaQtd').value) || 0;
  const custoUnit = parseFloat(document.getElementById('saidaCustoUnit').value) || 0;
  const categoria = document.getElementById('saidaCategoria').value;
  const destino   = document.getElementById('saidaDestino').value.trim();
  const data      = document.getElementById('saidaData').value;
  const lancar    = document.getElementById('saidaLancarDespesa').value === 'true';
  const obs       = document.getElementById('saidaObs').value.trim();

  if (!prodId)   { mostrarErroModal('erroSaida', 'Selecione o produto.'); return; }
  if (!qtd)      { mostrarErroModal('erroSaida', 'Informe a quantidade.'); return; }
  if (!destino)  { mostrarErroModal('erroSaida', 'Informe o destino / motivo.'); return; }
  if (!data)     { mostrarErroModal('erroSaida', 'Informe a data.'); return; }

  const custoTotal = custoUnit * qtd;
  const produto    = _produtos.find(p => p.id === prodId);

  // Verifica estoque disponível
  if (produto && qtd > produto.estoque_atual) {
    mostrarErroModal('erroSaida', `Estoque insuficiente. Disponível: ${produto.estoque_atual} unidades.`);
    return;
  }

  setBtnLoading('btnSalvarSaida', true);

  if (!window._supabase) {
    // Demo
    _saidas.unshift({
      id: Date.now(),
      data, produto_id: prodId,
      produtos: { nome: produto?.nome || '—' },
      quantidade: qtd, custo_unit: custoUnit, custo_total: custoTotal,
      categoria, destino, observacao: obs, lancou_despesa: lancar,
      created_at: new Date().toISOString(),
    });
    atualizarKPIs();
    renderSaidas();
    fecharModal('modalSaida');
    Toast.success('Saída registrada!', `${qtd}x ${produto?.nome} — ${Format.currency(custoTotal)} lançado${lancar?' como despesa':''}.`);
    setBtnLoading('btnSalvarSaida', false);
    return;
  }

  try {
    // 1. Registra a saída
    const { data: saida, error } = await window._supabase
      .from('saidas_nao_comerciais')
      .insert({
        produto_id:      prodId,
        quantidade:      qtd,
        custo_unit:      custoUnit,
        custo_total:     custoTotal,
        categoria,
        destino,
        observacao:      obs || null,
        data,
        lancou_despesa:  lancar,
        usuario_id:      Auth.getUser()?.id || null,
      }).select().single();

    if (error) { mostrarErroModal('erroSaida', error.message); setBtnLoading('btnSalvarSaida', false); return; }

    // 2. Baixa o estoque
    const { data: prod } = await window._supabase
      .from('produtos').select('estoque_atual').eq('id', prodId).single();
    if (prod) {
      await window._supabase.from('produtos')
        .update({ estoque_atual: prod.estoque_atual - qtd, updated_at: new Date().toISOString() })
        .eq('id', prodId);
    }

    // 3. Registra movimentação
    await window._supabase.from('movimentacoes_estoque').insert({
      produto_id:  prodId,
      tipo:        'saida_nao_comercial',
      quantidade:  -qtd,
      referencia:  `${CAT_LABELS[categoria]} — ${destino}`,
      usuario_id:  Auth.getUser()?.id || null,
    });

    // 4. Lança como despesa se solicitado
    if (lancar) {
      const { data: despesa } = await window._supabase.from('despesas').insert({
        descricao:       `${CAT_LABELS[categoria]} — ${produto?.nome || 'Produto'} (${destino})`,
        valor:           custoTotal,
        categoria:       'Marketing',
        data_lancamento: data,
        vencimento:      data,
        forma_pagamento: 'custo_produto',
        parcelado:       false,
        total_parcelas:  1,
        status:          'pago',
        observacao:      obs || `Saída não comercial registrada automaticamente`,
      }).select().single();

      // Registra parcela como paga
      if (despesa) {
        await window._supabase.from('parcelas_despesa').insert({
          despesa_id: despesa.id,
          numero:     1,
          vencimento: data,
          valor:      custoTotal,
          status:     'pago',
          data_pag:   data,
        });
      }
    }

    fecharModal('modalSaida');
    Toast.success('Saída registrada!', `${qtd}x ${produto?.nome} — ${Format.currency(custoTotal)}${lancar?' lançado como despesa':''}.`);
    carregarSaidas();
    carregarProdutos();

  } catch (err) {
    mostrarErroModal('erroSaida', err.message || 'Erro ao registrar saída.');
  }

  setBtnLoading('btnSalvarSaida', false);
}

// ══════════════════════════════════════════════
// EXCLUIR
// ══════════════════════════════════════════════

async function excluirSaida(id) {
  if (!confirm('Excluir esta saída? O estoque NÃO será revertido automaticamente.')) return;

  if (!window._supabase) {
    _saidas = _saidas.filter(s => s.id !== id);
    atualizarKPIs();
    renderSaidas();
    Toast.success('Saída excluída.');
    return;
  }

  const { error } = await window._supabase
    .from('saidas_nao_comerciais').delete().eq('id', id);

  if (error) { Toast.error('Erro', error.message); return; }
  Toast.success('Saída excluída.');
  carregarSaidas();
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

function abrirModal(id)  { document.getElementById(id).classList.add('active'); document.body.style.overflow = 'hidden'; }
function fecharModal(id) { document.getElementById(id).classList.remove('active'); document.body.style.overflow = ''; }
function mostrarErroModal(id, msg) { const el = document.getElementById(id); if (!el) return; el.textContent = msg; el.classList.remove('hidden'); }
function esconderErro(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }
function setBtnLoading(id, l) { const b = document.getElementById(id); if (!b) return; b.disabled = l; b.textContent = l ? 'Salvando...' : 'Registrar Saída'; }
function setText(id, t) { const el = document.getElementById(id); if (el) el.textContent = t; }
document.addEventListener('click', e => { if (e.target.classList.contains('modal-overlay')) fecharModal(e.target.id); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.active').forEach(m => fecharModal(m.id)); });
