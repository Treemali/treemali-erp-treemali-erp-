/**
 * TREEMALI ERP — Histórico de Vendas
 * Página separada — Admin vê todas, Vendedor vê só as suas
 */

let _vendas = [];

// Formata forma de pagamento exibindo parcelas quando crédito parcelado
function formatarPagamento(forma, parcelas) {
  if (!forma) return '—';
  const mapa = {
    'dinheiro':   '💵 Dinheiro',
    'pix':        '⚡ PIX',
    'debito':     '💳 Débito',
    'credito':    '💳 Crédito',
    'crediario':  '📋 Crediário',
    'boleto':     '📄 Boleto',
  };
  const label = mapa[forma] || forma;
  if ((forma === 'credito') && parcelas && parcelas > 1) {
    return `${label} ${parcelas}x`;
  }
  return label;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('searchHistorico')
    .addEventListener('input', renderHistorico);
  carregarHistorico();
});

// ══════════════════════════════════════════════
// CARREGAR
// ══════════════════════════════════════════════

async function carregarHistorico() {
  const tbody = document.getElementById('bodyHistorico');
  tbody.innerHTML = '<tr><td colspan="7" class="table-loading">Carregando...</td></tr>';

  const isMaster = Auth.isMaster();
  const user     = Auth.getUser();
  const tipo     = document.getElementById('filtroTipoHist').value;
  const status   = document.getElementById('filtroStatusHist').value;
  const periodo  = document.getElementById('filtroPeriodoHist')?.value || 'mes';

  if (!window._supabase) {
    _vendas = [
      { id:1, created_at: new Date().toISOString(), clientes:{nome:'Ana Silva'},   tipo:'normal',     forma_pagamento:'pix',    valor_total:320,  lucro:250,  status:'concluida', observacao:'' },
      { id:2, created_at: new Date().toISOString(), clientes:{nome:'Pedro Souza'}, tipo:'crediario',  forma_pagamento:'crediario', valor_total:450, lucro:180, status:'concluida', observacao:'' },
      { id:3, created_at: new Date().toISOString(), clientes:{nome:'Maria Lima'},  tipo:'condicional',forma_pagamento:'—',      valor_total:280,  lucro:0,    status:'cancelada', observacao:'Venda de teste' },
    ];
    atualizarKpis();
    renderHistorico();
    return;
  }

  // Calcula intervalo de datas
  const { inicio, fim } = getPeriodoHist(periodo);

  let query = window._supabase
    .from('vendas')
    .select('*, clientes(nome), itens_venda(quantidade, preco_vend, preco_unit, produtos(nome, sku))')
    .order('created_at', { ascending: false })
    .limit(500);

  if (!isMaster)  query = query.eq('vendedor_id', user?.id);
  if (tipo)       query = query.eq('tipo', tipo);
  if (status)     query = query.eq('status', status);
  if (inicio)     query = query.gte('created_at', inicio);
  if (fim)        query = query.lte('created_at', fim);

  const { data } = await query;
  _vendas = data || [];
  atualizarKpis();
  renderHistorico();
}

function onChangePeriodoHist() {
  const periodo  = document.getElementById('filtroPeriodoHist').value;
  const customDiv = document.getElementById('hvDatasCustom');
  if (periodo === 'personalizado') {
    customDiv.style.display = 'flex';
    const hoje = new Date();
    if (!document.getElementById('hvDataInicio').value) {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      document.getElementById('hvDataInicio').value = inicio.toISOString().split('T')[0];
    }
    if (!document.getElementById('hvDataFim').value) {
      document.getElementById('hvDataFim').value = hoje.toISOString().split('T')[0];
    }
  } else {
    customDiv.style.display = 'none';
    carregarHistorico();
  }
}

function getPeriodoHist(periodo) {
  const agora = new Date();
  let inicio = null, fim = null;

  if (periodo === 'hoje') {
    inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).toISOString();
    fim    = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59).toISOString();
  } else if (periodo === 'semana') {
    const d = new Date(); d.setDate(d.getDate() - 7);
    inicio = d.toISOString();
    fim    = agora.toISOString();
  } else if (periodo === 'mes') {
    inicio = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
    fim    = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59).toISOString();
  } else if (periodo === 'mes_passado') {
    inicio = new Date(agora.getFullYear(), agora.getMonth() - 1, 1).toISOString();
    fim    = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59).toISOString();
  } else if (periodo === 'ano') {
    inicio = new Date(agora.getFullYear(), 0, 1).toISOString();
    fim    = new Date(agora.getFullYear(), 11, 31, 23, 59, 59).toISOString();
  } else if (periodo === 'personalizado') {
    const di = document.getElementById('hvDataInicio').value;
    const df = document.getElementById('hvDataFim').value;
    if (di) inicio = new Date(di + 'T00:00:00').toISOString();
    if (df) fim    = new Date(df + 'T23:59:59').toISOString();
  }
  // 'todos' → sem filtro de data (inicio e fim null)
  return { inicio, fim };
}

// ══════════════════════════════════════════════
// KPIs (somente admin)
// ══════════════════════════════════════════════

function atualizarKpis() {
  if (!Auth.isMaster()) return;
  const dataCorte   = '2026-03-20';
  const concluidas  = _vendas.filter(v => v.status === 'concluida');
  // Só conta canceladas visíveis (a partir da data de corte)
  const canceladas  = _vendas.filter(v => {
    if (v.status !== 'cancelada') return false;
    const dataVenda = (v.updated_at || v.created_at || '').split('T')[0];
    return dataVenda >= dataCorte;
  });
  const faturamento = concluidas.reduce((s, v) => s + (v.valor_total||0), 0);
  const lucro       = concluidas.reduce((s, v) => s + (v.lucro||0), 0);

  document.getElementById('hvKpis').innerHTML = `
    <div class="hv-kpi"><span class="hv-kpi-icon">🛒</span><div><span class="hv-kpi-label">Vendas concluídas</span><span class="hv-kpi-value">${concluidas.length}</span></div></div>
    <div class="hv-kpi"><span class="hv-kpi-icon">💰</span><div><span class="hv-kpi-label">Faturamento</span><span class="hv-kpi-value">${Format.currency(faturamento)}</span></div></div>
    <div class="hv-kpi"><span class="hv-kpi-icon">📈</span><div><span class="hv-kpi-label">Lucro estimado</span><span class="hv-kpi-value">${Format.currency(lucro)}</span></div></div>
    <div class="hv-kpi"><span class="hv-kpi-icon">🚫</span><div><span class="hv-kpi-label">Canceladas</span><span class="hv-kpi-value">${canceladas.length}</span></div></div>
  `;
}

// ══════════════════════════════════════════════
// RENDER TABELA
// ══════════════════════════════════════════════

function renderHistorico() {
  const busca    = (document.getElementById('searchHistorico').value || '').toLowerCase();
  const isMaster = Auth.isMaster();

  // Data de corte: 20/03/2026 — canceladas antes disso eram testes, não aparecem
  const dataCorte = '2026-03-20';

  let lista = _vendas.filter(v => {
    if (v.status === 'cancelada') {
      // Só mostra canceladas de hoje (20/03) em diante
      const dataVenda = (v.updated_at || v.created_at || '').split('T')[0];
      return dataVenda >= dataCorte;
    }
    return true; // concluídas sempre aparecem
  });

  if (busca) {
    lista = lista.filter(v =>
      v.clientes?.nome?.toLowerCase().includes(busca) ||
      v.forma_pagamento?.toLowerCase().includes(busca)
    );
  }

  const tbody = document.getElementById('bodyHistorico');
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-loading">${isMaster ? 'Nenhuma venda encontrada' : 'Você ainda não realizou nenhuma venda'}</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(v => {
    const cancelada = v.status === 'cancelada';
    const nomeEsc   = (v.clientes?.nome || 'Cliente').replace(/'/g, "\\'");
    const dataFmt   = Format.date(v.created_at);
    const motivoEsc = (v.observacao || '').replace(/'/g, "\\'");

    return `
      <tr style="${cancelada ? 'opacity:0.6' : ''}">
        <td>${dataFmt}</td>
        <td data-privado-nome>${v.clientes?.nome || '—'}</td>
        <td><span class="badge badge-neutral">${v.tipo}</span></td>
        <td>${formatarPagamento(v.forma_pagamento, v.parcelas)}</td>
        <td style="${cancelada ? 'text-decoration:line-through;color:var(--color-gray-400)' : 'font-weight:600'}">${Format.currency(v.valor_total)}</td>
        <td>
          ${cancelada
            ? `<span class="badge badge-danger" style="cursor:pointer"
                onclick="verMotivo('${nomeEsc}',${v.valor_total},'${dataFmt}','${motivoEsc}')"
                title="Ver motivo">🚫 Cancelada ${v.observacao ? '💬' : ''}</span>`
            : '<span class="badge badge-success">Concluída</span>'}
        </td>
        <td style="display:flex;gap:4px;align-items:center">
          ${!cancelada ? `
            <button class="btn-table" onclick="abrirComprovante(${v.id})" title="Ver / reenviar comprovante">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </button>` : ''}
          ${isMaster && !cancelada ? `
            <button class="btn-table" style="color:var(--color-info)" onclick="abrirEditarPagamento(${v.id},'${v.forma_pagamento}',${v.parcelas||1},${v.valor_total},${v.valor_taxa||0})" title="Editar forma de pagamento">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-table" style="color:var(--color-success)" onclick="abrirEditarItensVenda(${v.id})" title="Editar itens da venda">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
            ${v.tipo === 'condicional' ? `
            <button class="btn-table" style="color:var(--color-warning)" onclick="reverterParaCondicional(${v.id})" title="Reverter para condicional">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            </button>` : ''}
            <button class="btn-table danger"
              onclick="confirmarCancelar(${v.id},'${nomeEsc}',${v.valor_total})"
              title="Cancelar venda">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              </svg>
            </button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

// ══════════════════════════════════════════════
// COMPROVANTE
// ══════════════════════════════════════════════

async function abrirComprovante(vendaId) {
  if (!window._supabase) {
    document.getElementById('comprovante').textContent = '— Comprovante demo —\nVenda #' + vendaId;
    abrirModal('modalComprovante');
    return;
  }

  const { data: venda } = await window._supabase
    .from('vendas')
    .select('*, clientes(nome), itens_venda(quantidade, preco_vend, preco_unit, produtos(nome, descricao)), crediario(id, parcelas, parcelas_crediario(numero, valor, vencimento, status))')
    .eq('id', vendaId)
    .single();

  if (!venda) { Toast.error('Erro', 'Venda não encontrada.'); return; }

  const linhaItens = (venda.itens_venda || []).map(i => {
    const nome = i.produtos?.nome || '';
    const desc = i.produtos?.descricao ? `\n     ${i.produtos.descricao}` : '';
    const valor = Format.currency((i.preco_vend || i.preco_unit || 0) * i.quantidade);
    return `  ${i.quantidade}x ${nome}  ${valor}${desc}`;
  }).join('\n');

  const isMaster = Auth.isMaster();
  const taxa = (isMaster && venda.valor_taxa > 0) ? `\nTaxa maquininha:   — ${Format.currency(venda.valor_taxa)}` : '';
  const liq  = (isMaster && venda.valor_taxa > 0) ? `\nValor líquido:       ${Format.currency(venda.valor_liquido)}` : '';
  const desconto = venda.desconto > 0 ? `\nDesconto:          — ${Format.currency(venda.desconto)}` : '';
  const obs  = venda.observacao ? `\nObs: ${venda.observacao}` : '';

  // Linha de pagamento — crediário mostra parcelas e vencimentos
  let linhaPag = formatarPagamento(venda.forma_pagamento, venda.parcelas);
  if (venda.forma_pagamento === 'crediario' && venda.crediario?.length) {
    const cred = venda.crediario[0];
    const parcs = (cred.parcelas_crediario || []).sort((a,b) => a.numero - b.numero);
    if (parcs.length) {
      linhaPag = `Crediário ${cred.parcelas}x de ${Format.currency(parcs[0].valor)}`;
      linhaPag += parcs.map(p =>
        `\n  Parcela ${p.numero}/${cred.parcelas}: ${Format.currency(p.valor)} — vence ${Format.date(p.vencimento)} [${p.status === 'pago' ? '✓ Pago' : 'Pendente'}]`
      ).join('');
    }
  }

  document.getElementById('comprovante').textContent =
`━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        TREEMALI
     Comprovante de Venda
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Data: ${new Date(venda.created_at).toLocaleString('pt-BR')}
Cliente: ${venda.clientes?.nome || 'Sem cadastro'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITENS:
${linhaItens}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Subtotal:            ${Format.currency(venda.valor_total + (venda.desconto||0))}${desconto}
Total:               ${Format.currency(venda.valor_total)}${taxa}${liq}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pagamento: ${linhaPag}${obs}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       Obrigado pela compra!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  abrirModal('modalComprovante');
}

function imprimirComprovante() {
  const win = window.open('', '_blank');
  win.document.write(`<pre style="font-family:monospace;font-size:13px;padding:20px">${document.getElementById('comprovante').textContent}</pre>`);
  win.print(); win.close();
}

function copiarComprovante() {
  navigator.clipboard.writeText(document.getElementById('comprovante').textContent)
    .then(() => Toast.success('Copiado!', 'Comprovante copiado.'));
}

function enviarWhatsApp() {
  window.open(`https://wa.me/?text=${encodeURIComponent(document.getElementById('comprovante').textContent)}`, '_blank');
}

// ══════════════════════════════════════════════
// EDITAR FORMA DE PAGAMENTO
// ══════════════════════════════════════════════

const TAXAS_PADRAO = {
  'dinheiro':      0,
  'pix':           0,
  'debito':        1.37,
  'credito':       3.15,
  'credito_2x':    5.39,
  'credito_3x':    6.12,
  'credito_4x':    6.85,
  'credito_5x':    7.57,
  'credito_6x':    8.28,
  'credito_12x':   12.40,
};

async function abrirEditarPagamento(vendaId, formaAtual, parcelasAtuais, valorTotal, taxaAtual) {
  document.getElementById('editPagVendaId').value    = vendaId;
  document.getElementById('editPagValorTotal').value  = valorTotal;
  document.getElementById('editPagTaxaAtual').value   = taxaAtual;
  document.getElementById('editPagAtual').textContent =
    `${formatarPagamento(formaAtual, parcelasAtuais)} — ${Format.currency(taxaAtual)} de taxa`;
  document.getElementById('editPagForma').value    = formaAtual || 'dinheiro';
  document.getElementById('editPagParcelas').value = parcelasAtuais || 1;
  document.getElementById('editPagObs').value      = '';
  document.getElementById('erroEditPag').classList.add('hidden');

  if (window._supabase) {
    // Carrega bandeiras
    const { data: bandeiras } = await window._supabase.from('bandeiras').select('id, nome').order('nome');
    const selBand = document.getElementById('editPagBandeira');
    selBand.innerHTML = '<option value="">Selecione a bandeira...</option>' +
      (bandeiras||[]).map(b => `<option value="${b.id}">${b.nome}</option>`).join('');

    // Busca dados atuais da venda
    const { data: vAtual } = await window._supabase
      .from('vendas').select('bandeira_id, observacao').eq('id', vendaId).single();
    if (vAtual?.bandeira_id) selBand.value = vAtual.bandeira_id;
    document.getElementById('editPagObs').value = vAtual?.observacao || '';

    // Carrega taxas reais por bandeira
    const { data: taxasData } = await window._supabase
      .from('taxas_pagamento').select('tipo, parcelas, taxa, bandeira_id').order('parcelas');
    if (taxasData) {
      window._taxasReaisList = taxasData;
      window._taxasReais = {};
      taxasData.forEach(t => {
        const key = t.tipo === 'credito_parcelado' ? `credito_${t.parcelas}x` : t.tipo;
        window._taxasReais[key] = t.taxa;
      });
    }
  }

  onChangeEditPagForma(valorTotal);
  abrirModal('modalEditarPagamento');
}

function onChangeEditPagForma(valorTotalOverride) {
  const forma      = document.getElementById('editPagForma').value;
  const parcelas   = parseInt(document.getElementById('editPagParcelas').value) || 1;
  const valor      = parseFloat(valorTotalOverride || document.getElementById('editPagValorTotal').value) || 0;
  const bandeiraId = parseInt(document.getElementById('editPagBandeira')?.value) || null;

  const rowParcelas  = document.getElementById('editPagRowParcelas');
  const rowCrediario = document.getElementById('editPagRowCrediario');
  const rowBandeira  = document.getElementById('editPagRowBandeira');

  rowCrediario.style.display = forma === 'crediario' ? 'block' : 'none';
  rowParcelas.style.display  = forma === 'credito'   ? 'block' : 'none';
  if (rowBandeira) rowBandeira.style.display = ['credito','debito'].includes(forma) ? 'block' : 'none';

  if (forma === 'crediario' && !document.getElementById('editPagVencCrediario').value) {
    const prox = new Date(); prox.setMonth(prox.getMonth() + 1);
    document.getElementById('editPagVencCrediario').value = prox.toISOString().split('T')[0];
  }

  if (!['credito','debito'].includes(forma)) {
    document.getElementById('editPagPreview').innerHTML =
      `<span style="color:var(--color-success)">Sem taxa de maquininha</span> &nbsp;|&nbsp; Líquido: <strong>${Format.currency(valor)}</strong>`;
    document.getElementById('editPagNovaTaxa').value    = 0;
    document.getElementById('editPagNovoLiquido').value = valor;
    return;
  }

  // Calcula taxa pela bandeira e parcelas
  let pct = 0;
  if (bandeiraId && window._taxasReaisList && window._taxasReaisList.length) {
    // Tipo correto conforme tabela: credito_vista (1x) ou credito_parcelado (>1x)
    const tipoFiltro = forma === 'debito' ? 'debito'
      : parcelas > 1 ? 'credito_parcelado'
      : 'credito_vista';
    // Compara como número (parseInt garante isso)
    const found = window._taxasReaisList.find(t =>
      parseInt(t.bandeira_id) === parseInt(bandeiraId) &&
      t.tipo === tipoFiltro &&
      (tipoFiltro === 'credito_parcelado' ? parseInt(t.parcelas) === parseInt(parcelas) : true)
    );
    pct = found ? parseFloat(found.taxa) : 0;
  } else {
    const chave = forma === 'credito' && parcelas > 1 ? `credito_${parcelas}x` : forma;
    pct = (window._taxasReais || TAXAS_PADRAO)[chave] ?? (window._taxasReais || TAXAS_PADRAO)[forma] ?? 0;
  }

  const valorTaxa    = parseFloat((valor * pct / 100).toFixed(2));
  const valorLiquido = parseFloat((valor - valorTaxa).toFixed(2));

  document.getElementById('editPagPreview').innerHTML = pct > 0
    ? `Taxa ${pct}%: <strong style="color:var(--color-danger)">— ${Format.currency(valorTaxa)}</strong> &nbsp;|&nbsp; Líquido: <strong>${Format.currency(valorLiquido)}</strong>`
    : `<span style="color:var(--color-warning)">⚠ Selecione a bandeira para calcular a taxa</span>`;

  document.getElementById('editPagNovaTaxa').value    = valorTaxa;
  document.getElementById('editPagNovoLiquido').value = valorLiquido;
}

async function salvarEditarPagamento() {
  const liberar = bloquearBtn('btnSalvarEditPag', 'Salvando...');
  const vendaId      = parseInt(document.getElementById('editPagVendaId').value);
  const forma        = document.getElementById('editPagForma').value;
  const parcelas     = parseInt(document.getElementById('editPagParcelas').value) || 1;
  const valorTotal   = parseFloat(document.getElementById('editPagValorTotal').value) || 0;
  const novaTaxa     = parseFloat(document.getElementById('editPagNovaTaxa').value)   || 0;
  const novoLiquido  = parseFloat(document.getElementById('editPagNovoLiquido').value)|| valorTotal;
  const erroEl       = document.getElementById('erroEditPag');

  // Validação crediário
  if (forma === 'crediario') {
    const nParc = parseInt(document.getElementById('editPagParcelasCrediario').value) || 0;
    const venc  = document.getElementById('editPagVencCrediario').value;
    if (!nParc || nParc < 1) { erroEl.textContent = 'Informe o número de parcelas.'; erroEl.classList.remove('hidden'); return; }
    if (!venc)               { erroEl.textContent = 'Informe a data de vencimento da 1ª parcela.'; erroEl.classList.remove('hidden'); return; }
  }
  erroEl.classList.add('hidden');

  if (!window._supabase) {
    Toast.success('Pagamento atualizado! (demo)');
    fecharModal('modalEditarPagamento');
    return;
  }

  // Busca custo para recalcular lucro
  const { data: vendaAtual } = await window._supabase
    .from('vendas').select('custo_total, cliente_id, bandeira_id').eq('id', vendaId).single();
  const custoTotal  = vendaAtual?.custo_total || 0;
  const clienteId   = vendaAtual?.cliente_id  || null;

  // Bandeira: usa a selecionada no modal se for cartão
  let bandeira_id = null;
  if (['credito','debito'].includes(forma)) {
    bandeira_id = parseInt(document.getElementById('editPagBandeira')?.value) || vendaAtual?.bandeira_id || null;
  }

  // Recalcula taxa na hora do save — garante que usa bandeira e parcelas atuais
  let taxaFinal = 0;
  if (['credito','debito'].includes(forma) && bandeira_id && window._taxasReaisList?.length) {
    const tipoFiltro = forma === 'debito' ? 'debito'
      : parcelas > 1 ? 'credito_parcelado'
      : 'credito_vista';
    const found = window._taxasReaisList.find(t =>
      parseInt(t.bandeira_id) === parseInt(bandeira_id) &&
      t.tipo === tipoFiltro &&
      (tipoFiltro === 'credito_parcelado' ? parseInt(t.parcelas) === parseInt(parcelas) : true)
    );
    taxaFinal = found ? parseFloat(found.taxa) : 0;
  }
  const valorTaxaFinal    = parseFloat((valorTotal * taxaFinal / 100).toFixed(2));
  const valorLiquidoFinal = parseFloat((valorTotal - valorTaxaFinal).toFixed(2));
  const lucroReal         = parseFloat((valorLiquidoFinal - custoTotal).toFixed(2));

  const novaObs = document.getElementById('editPagObs').value.trim();

  const { error } = await window._supabase.from('vendas').update({
    forma_pagamento: forma,
    parcelas:        forma === 'credito' ? parcelas : (forma === 'crediario' ? parseInt(document.getElementById('editPagParcelasCrediario').value) : 1),
    valor_taxa:      ['credito','debito'].includes(forma) ? valorTaxaFinal    : (novaTaxa    || 0),
    valor_liquido:   ['credito','debito'].includes(forma) ? valorLiquidoFinal : (novoLiquido || valorTotal),
    lucro:           lucroReal,
    taxa_aplicada:   taxaFinal > 0 ? taxaFinal : (novaTaxa > 0 ? parseFloat((novaTaxa / valorTotal * 100).toFixed(2)) : 0),
    bandeira_id:     bandeira_id,
    observacao:      novaObs || null,
  }).eq('id', vendaId);

  if (error) { erroEl.textContent = 'Erro ao salvar: ' + error.message; erroEl.classList.remove('hidden'); return; }

  // Se for crediário — cria registro e parcelas
  if (forma === 'crediario') {
    const nParc     = parseInt(document.getElementById('editPagParcelasCrediario').value);
    const vencBase  = document.getElementById('editPagVencCrediario').value;
    const valorParc = parseFloat((valorTotal / nParc).toFixed(2));

    // Remove crediário antigo desta venda se existir
    const { data: credAntigo } = await window._supabase
      .from('crediario').select('id').eq('venda_id', vendaId).single();
    if (credAntigo) {
      await window._supabase.from('parcelas_crediario').delete().eq('crediario_id', credAntigo.id);
      await window._supabase.from('crediario').delete().eq('id', credAntigo.id);
    }

    // Cria novo crediário
    const { data: novoCred } = await window._supabase.from('crediario').insert({
      venda_id:    vendaId,
      cliente_id:  clienteId,
      valor_total: valorTotal,
      parcelas:    nParc,
    }).select().single();

    if (novoCred) {
      for (let i = 0; i < nParc; i++) {
        const venc = new Date(vencBase + 'T12:00:00');
        venc.setMonth(venc.getMonth() + i);
        await window._supabase.from('parcelas_crediario').insert({
          crediario_id: novoCred.id,
          numero:       i + 1,
          vencimento:   venc.toISOString().split('T')[0],
          valor:        valorParc,
        });
      }
    }
  }

  fecharModal('modalEditarPagamento');
  Toast.success('Pagamento atualizado!', 'Financeiro, relatórios e contas a receber atualizados.');
  liberar();
  carregarHistorico();
}

// ══════════════════════════════════════════════
// CANCELAR VENDA
// ══════════════════════════════════════════════

function confirmarCancelar(vendaId, nomeCliente, valorTotal) {
  document.getElementById('msgCancelarVenda').innerHTML =
    `Deseja cancelar a venda de <strong>${nomeCliente}</strong> — ${Format.currency(valorTotal)}?`;
  document.getElementById('motivoCancelamento').value = '';
  document.getElementById('erroMotivo').classList.add('hidden');

  document.getElementById('btnConfirmarCancelarVenda').onclick = () => {
    const motivo = document.getElementById('motivoCancelamento').value.trim();
    if (!motivo) {
      const el = document.getElementById('erroMotivo');
      el.textContent = 'O motivo é obrigatório.';
      el.classList.remove('hidden');
      return;
    }
    executarCancelamento(vendaId, motivo);
  };
  abrirModal('modalCancelarVenda');
}

async function executarCancelamento(vendaId, motivo) {
  const btn = document.getElementById('btnConfirmarCancelarVenda');
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = 'Cancelando...';

  if (!window._supabase) {
    fecharModal('modalCancelarVenda');
    Toast.success('Venda cancelada!', 'Estoque revertido.');
    carregarHistorico();
    btn.disabled = false;
    btn.textContent = 'Sim, cancelar';
    return;
  }

  try {
    // 1. Busca itens da venda
    const { data: itens } = await window._supabase
      .from('itens_venda').select('produto_id, quantidade').eq('venda_id', vendaId);

    // 2. Reverte estoque de cada produto
    for (const item of (itens || [])) {
      const { data: prod } = await window._supabase
        .from('produtos').select('estoque_atual').eq('id', item.produto_id).single();
      if (prod) {
        await window._supabase.from('produtos')
          .update({ estoque_atual: prod.estoque_atual + item.quantidade, updated_at: new Date().toISOString() })
          .eq('id', item.produto_id);
      }
      await window._supabase.from('movimentacoes_estoque').insert({
        produto_id: item.produto_id,
        tipo:       'estorno_venda',
        quantidade:  item.quantidade,
        referencia: `Cancelamento venda #${vendaId} — ${motivo}`,
        usuario_id:  Auth.getUser()?.id || null,
      });
    }

    // 3. Marca venda como cancelada — verifica erro explicitamente
    const { error: errUpdate } = await window._supabase
      .from('vendas')
      .update({
        status:     'cancelada',
        observacao:  motivo,
        updated_at:  new Date().toISOString()
      })
      .eq('id', vendaId);

    if (errUpdate) {
      console.error('Erro ao cancelar venda:', errUpdate);
      Toast.error('Erro', 'Não foi possível cancelar a venda: ' + errUpdate.message);
      return;
    }

    // 4. Confirma que o update funcionou
    const { data: check } = await window._supabase
      .from('vendas').select('status').eq('id', vendaId).single();

    if (check?.status !== 'cancelada') {
      Toast.error('Erro', 'A venda não foi cancelada no banco. Verifique as permissões RLS.');
      return;
    }

    fecharModal('modalCancelarVenda');
    Toast.success('Venda cancelada!', 'Estoque revertido e removida dos relatórios.');
    carregarHistorico();

  } catch (err) {
    fecharModal('modalCancelarVenda');
    Toast.error('Erro ao cancelar', err.message);
  } finally {
    const btn = document.getElementById('btnConfirmarCancelarVenda');
    if (btn) { btn.disabled = false; btn.textContent = 'Sim, cancelar'; }
  }
}

// ══════════════════════════════════════════════
// VER MOTIVO
// ══════════════════════════════════════════════

function verMotivo(nomeCliente, valorTotal, data, motivo) {
  document.getElementById('bodyMotivoCancelamento').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--space-3)">
      <div style="background:var(--color-gray-100);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4)">
        <div style="font-size:var(--text-xs);color:var(--color-gray-400);text-transform:uppercase;letter-spacing:0.05em">Cliente</div>
        <div style="font-weight:600;color:var(--color-gray-800)">${nomeCliente}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
        <div style="background:var(--color-gray-100);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4)">
          <div style="font-size:var(--text-xs);color:var(--color-gray-400);text-transform:uppercase;letter-spacing:0.05em">Valor</div>
          <div style="font-weight:600;color:var(--color-danger)">${Format.currency(valorTotal)}</div>
        </div>
        <div style="background:var(--color-gray-100);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4)">
          <div style="font-size:var(--text-xs);color:var(--color-gray-400);text-transform:uppercase;letter-spacing:0.05em">Data</div>
          <div style="font-weight:600;color:var(--color-gray-800)">${data}</div>
        </div>
      </div>
      <div style="background:var(--color-danger-light);border:1px solid rgba(176,85,85,0.2);border-radius:var(--radius-md);padding:var(--space-4)">
        <div style="font-size:var(--text-xs);color:var(--color-danger);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:var(--space-2)">Motivo do Cancelamento</div>
        <div style="font-size:var(--text-sm);color:var(--color-gray-700);font-style:italic">"${motivo || 'Não informado'}"</div>
      </div>
    </div>
  `;
  abrirModal('modalMotivoCancelamento');
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

function abrirModal(id)  { document.getElementById(id)?.classList.add('active'); document.body.style.overflow = 'hidden'; }
function fecharModal(id) { document.getElementById(id)?.classList.remove('active'); document.body.style.overflow = ''; }
document.addEventListener('click', e => { if (e.target.classList.contains('modal-overlay')) fecharModal(e.target.id); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.active').forEach(m => fecharModal(m.id)); });

// ══════════════════════════════════════════════
// REVERTER VENDA → CONDICIONAL
// ══════════════════════════════════════════════

let _vendaReverterID = null;

function reverterParaCondicional(vendaId) {
  _vendaReverterID = vendaId;
  const v = _vendas.find(x => x.id === vendaId);
  document.getElementById('msgReverterCond').textContent =
    `Reverter venda de ${v?.clientes?.nome || 'Cliente'} — ${Format.currency(v?.valor_total || 0)} para condicional?`;
  document.getElementById('motivoReverterCond').value = '';
  document.getElementById('erroReverterCond').classList.add('hidden');
  abrirModal('modalReverterCond');
}

async function executarReverterCondicional() {
  const liberar = bloquearBtn('btnConfirmarReverter', 'Revertendo...');
  const motivo = document.getElementById('motivoReverterCond').value.trim();
  const erroEl = document.getElementById('erroReverterCond');

  if (!motivo) { erroEl.textContent = 'Informe o motivo.'; erroEl.classList.remove('hidden'); liberar(); return; }

  try {
    const vendaId = _vendaReverterID;
    const user = Auth.getUser();

    // Busca condicional vinculada à venda
    const { data: cond } = await window._supabase
      .from('condicionais').select('id').eq('venda_id', vendaId).single();

    if (!cond) { erroEl.textContent = 'Condicional original não encontrada.'; erroEl.classList.remove('hidden'); liberar(); return; }

    // Cancela a venda (sem reverter estoque — produtos ainda com cliente)
    await window._supabase.from('vendas').update({
      status:     'cancelada',
      observacao:  `Revertida para condicional — ${motivo}`,
      updated_at:  new Date().toISOString(),
    }).eq('id', vendaId);

    // Restaura o condicional para em_condicional
    await window._supabase.from('condicionais').update({
      status:     'em_condicional',
      venda_id:    null,
      updated_at:  new Date().toISOString(),
    }).eq('id', cond.id);

    // Restaura itens que foram marcados como vendidos
    await window._supabase.from('itens_condicional').update({ status: 'pendente' })
      .eq('condicional_id', cond.id).eq('status', 'vendido');

    // Registra histórico
    await window._supabase.from('historico_condicional').insert({
      condicional_id: cond.id,
      acao:           'revertida',
      descricao:      `Venda #${vendaId} revertida para condicional — ${motivo}`,
      usuario_id:     user?.id || null,
    });

    fecharModal('modalReverterCond');
    Toast.success('Revertido!', 'Condicional restaurada. Financeiro ajustado.');
    carregarHistorico();

  } catch(e) {
    erroEl.textContent = 'Erro: ' + e.message;
    erroEl.classList.remove('hidden');
  } finally {
    liberar();
  }
}

// ══════════════════════════════════════════════
// EDITAR ITENS DA VENDA
// ══════════════════════════════════════════════

let _vendaEditarItensID  = null;
let _produtosDisponiveis = [];
let _itensParaRemover    = [];

async function abrirEditarItensVenda(vendaId) {
  _vendaEditarItensID = vendaId;
  _itensParaRemover = [];

  const { data: venda } = await window._supabase
    .from('vendas').select('valor_total, clientes(nome), itens_venda(id, quantidade, preco_vend, preco_unit, produtos(id, nome, sku, custo, estoque_atual))')
    .eq('id', vendaId).single();

  if (!venda) { Toast.error('Erro', 'Venda não encontrada.'); return; }

  // Carrega produtos disponíveis para adicionar
  const { data: prods } = await window._supabase
    .from('produtos').select('id, nome, sku, preco_venda, custo, estoque_atual')
    .gt('estoque_atual', 0).order('nome');
  _produtosDisponiveis = prods || [];

  document.getElementById('editItensVendaInfo').textContent =
    `${venda.clientes?.nome || 'Cliente'} — ${Format.currency(venda.valor_total)}`;

  // Renderiza itens atuais
  const itens = venda.itens_venda || [];
  document.getElementById('editItensLista').innerHTML = itens.length
    ? itens.map(i => `
      <div id="editItemRow${i.id}" style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) 0;border-bottom:1px solid var(--color-gray-100)">
        <div style="flex:1;font-size:var(--text-sm)">
          <div style="font-weight:500">${i.produtos?.nome || '—'}</div>
          <div style="color:var(--color-gray-400);font-size:var(--text-xs)">${i.produtos?.sku || ''}</div>
        </div>
        <div style="font-size:var(--text-sm);color:var(--color-gray-500)">${i.quantidade}x ${Format.currency(i.preco_vend || i.preco_unit)}</div>
        <button onclick="removerItemVenda(${i.id}, ${i.produtos?.id}, ${i.quantidade})" title="Remover item"
          style="background:none;border:none;cursor:pointer;color:var(--color-danger);padding:4px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    `).join('')
    : '<div style="color:var(--color-gray-400);font-size:var(--text-sm)">Nenhum item</div>';

  // Reset campos novo item
  document.getElementById('editItensNovoBusca').value = '';
  document.getElementById('editItensNovoProdId').value = '';
  document.getElementById('editItensNovoDropdown').style.display = 'none';
  document.getElementById('editItensNovoQtd').value = 1;
  document.getElementById('editItensNovoPreco').value = '';
  document.getElementById('erroEditItens').classList.add('hidden');

  abrirModal('modalEditarItens');
}

function removerItemVenda(itemId, prodId, qtd) {
  _itensParaRemover.push({ itemId, prodId, qtd });
  const row = document.getElementById(`editItemRow${itemId}`);
  if (row) {
    row.style.opacity = '0.4';
    row.style.textDecoration = 'line-through';
    row.querySelector('button').disabled = true;
  }
  Toast.success('Marcado para remover', 'Clique em Salvar Alterações para confirmar.');
}

function filtrarProdutosEditItens() {
  const busca    = document.getElementById('editItensNovoBusca').value.toLowerCase().trim();
  const dropdown = document.getElementById('editItensNovoDropdown');
  if (!busca) { dropdown.style.display = 'none'; return; }

  const filtrados = _produtosDisponiveis.filter(p =>
    p.nome.toLowerCase().includes(busca) || (p.sku||'').toLowerCase().includes(busca)
  ).slice(0, 8);

  if (!filtrados.length) {
    dropdown.innerHTML = '<div style="padding:10px 14px;color:var(--color-gray-400);font-size:var(--text-sm)">Nenhum produto encontrado</div>';
    dropdown.style.display = 'block';
    return;
  }

  dropdown.innerHTML = filtrados.map(p => `
    <div onclick="selecionarProdutoEditItens(${p.id})"
      style="padding:10px 14px;cursor:pointer;font-size:var(--text-sm);border-bottom:1px solid var(--color-gray-100);display:flex;justify-content:space-between"
      onmouseenter="this.style.background='var(--color-gray-50)'" onmouseleave="this.style.background=''">
      <div><div style="font-weight:500">${p.nome}</div>${p.sku?`<div style="font-size:11px;color:var(--color-gray-400)">${p.sku}</div>`:''}</div>
      <div style="text-align:right"><div style="font-weight:600;color:var(--color-taupe)">${Format.currency(p.preco_venda)}</div><div style="font-size:11px;color:var(--color-gray-400)">Estoque: ${p.estoque_atual}</div></div>
    </div>
  `).join('');
  dropdown.style.display = 'block';
}

function selecionarProdutoEditItens(prodId) {
  const p = _produtosDisponiveis.find(x => x.id === prodId);
  if (!p) return;
  document.getElementById('editItensNovoProdId').value = prodId;
  document.getElementById('editItensNovoBusca').value = p.nome + (p.sku ? ` — ${p.sku}` : '');
  document.getElementById('editItensNovoDropdown').style.display = 'none';
  document.getElementById('editItensNovoPreco').value = p.preco_venda || '';
}

async function adicionarItemNaVenda() {
  const liberar = bloquearBtn('btnAddItemVenda', 'Adicionando...');
  const prodId = parseInt(document.getElementById('editItensNovoProdId').value) || 0;
  const qtd    = parseInt(document.getElementById('editItensNovoQtd').value) || 0;
  const preco  = parseFloat(document.getElementById('editItensNovoPreco').value) || 0;
  const erroEl = document.getElementById('erroEditItens');

  if (!prodId) { erroEl.textContent = 'Selecione um produto.'; erroEl.classList.remove('hidden'); liberar(); return; }
  if (qtd < 1) { erroEl.textContent = 'Informe a quantidade.'; erroEl.classList.remove('hidden'); liberar(); return; }
  if (!preco)  { erroEl.textContent = 'Informe o preço.'; erroEl.classList.remove('hidden'); liberar(); return; }

  try {
    const prod = _produtosDisponiveis.find(p => p.id === prodId);
    if (!prod || qtd > prod.estoque_atual) {
      erroEl.textContent = `Estoque insuficiente. Disponível: ${prod?.estoque_atual || 0}`;
      erroEl.classList.remove('hidden'); liberar(); return;
    }

    // Insere item na venda
    const { data: novoItem, error } = await window._supabase.from('itens_venda').insert({
      venda_id:   _vendaEditarItensID,
      produto_id:  prodId,
      quantidade:  qtd,
      preco_vend:  preco,
      preco_unit:  preco,
    }).select().single();

    if (error) throw error;

    // Abate estoque
    await window._supabase.from('produtos')
      .update({ estoque_atual: prod.estoque_atual - qtd, updated_at: new Date().toISOString() })
      .eq('id', prodId);

    // Atualiza valor total da venda
    await recalcularVenda(_vendaEditarItensID);

    erroEl.classList.add('hidden');
    Toast.success('Item adicionado!');
    // Recarrega modal
    await abrirEditarItensVenda(_vendaEditarItensID);
  } catch(e) {
    erroEl.textContent = 'Erro: ' + e.message;
    erroEl.classList.remove('hidden');
  } finally {
    liberar();
  }
}

async function salvarEdicaoItens() {
  const liberar = bloquearBtn('btnSalvarEditItens', 'Salvando...');
  const erroEl  = document.getElementById('erroEditItens');

  try {
    // Remove itens marcados e devolve estoque
    for (const { itemId, prodId, qtd } of _itensParaRemover) {
      await window._supabase.from('itens_venda').delete().eq('id', itemId);

      const { data: prod } = await window._supabase
        .from('produtos').select('estoque_atual').eq('id', prodId).single();
      if (prod) {
        await window._supabase.from('produtos')
          .update({ estoque_atual: prod.estoque_atual + qtd, updated_at: new Date().toISOString() })
          .eq('id', prodId);
      }
    }

    // Recalcula venda
    await recalcularVenda(_vendaEditarItensID);

    fecharModal('modalEditarItens');
    Toast.success('Venda atualizada!', 'Estoque, financeiro e relatórios ajustados.');
    carregarHistorico();
  } catch(e) {
    erroEl.textContent = 'Erro: ' + e.message;
    erroEl.classList.remove('hidden');
  } finally {
    liberar();
  }
}

async function recalcularVenda(vendaId) {
  // Busca todos os itens atuais
  const { data: itens } = await window._supabase
    .from('itens_venda')
    .select('quantidade, preco_vend, preco_unit, produtos(custo)')
    .eq('venda_id', vendaId);

  const { data: venda } = await window._supabase
    .from('vendas').select('valor_taxa, bandeira_id, desconto').eq('id', vendaId).single();

  const subtotal   = (itens||[]).reduce((s,i) => s + ((i.preco_vend||i.preco_unit||0) * i.quantidade), 0);
  const desconto   = venda?.desconto || 0;
  const total      = subtotal - desconto;
  const custo      = (itens||[]).reduce((s,i) => s + ((i.produtos?.custo||0) * i.quantidade), 0);
  const taxa       = venda?.bandeira_id ? (venda?.valor_taxa || 0) : 0;
  const liquido    = total - taxa;
  const lucro      = liquido - custo;

  await window._supabase.from('vendas').update({
    valor_total:   parseFloat(total.toFixed(2)),
    custo_total:   parseFloat(custo.toFixed(2)),
    valor_liquido: parseFloat(liquido.toFixed(2)),
    lucro:         parseFloat(lucro.toFixed(2)),
    updated_at:    new Date().toISOString(),
  }).eq('id', vendaId);
}
