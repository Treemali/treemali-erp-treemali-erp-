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

  let query = window._supabase
    .from('vendas')
    .select('*, clientes(nome), itens_venda(quantidade, preco_vend, preco_unit, produtos(nome, sku))')
    .order('created_at', { ascending: false })
    .limit(100);

  if (!isMaster)  query = query.eq('vendedor_id', user?.id);
  if (tipo)       query = query.eq('tipo', tipo);
  if (status)     query = query.eq('status', status);
  else            query = query.neq('status', 'cancelada'); // oculta canceladas por padrão

  const { data } = await query;
  _vendas = data || [];
  atualizarKpis();
  renderHistorico();
}

// ══════════════════════════════════════════════
// KPIs (somente admin)
// ══════════════════════════════════════════════

function atualizarKpis() {
  if (!Auth.isMaster()) return;
  const concluidas = _vendas.filter(v => v.status === 'concluida');
  const canceladas = _vendas.filter(v => v.status === 'cancelada');
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
  // Oculta canceladas da listagem — continuam no banco mas não aparecem na tela
  let lista = _vendas.filter(v => v.status !== 'cancelada');

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
        <td>${v.clientes?.nome || '—'}</td>
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
    .select('*, clientes(nome), itens_venda(quantidade, preco_vend, preco_unit, produtos(nome, descricao))')
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
  const desc = venda.desconto   > 0 ? `\nDesconto:          — ${Format.currency(venda.desconto)}` : '';

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
Subtotal:            ${Format.currency(venda.valor_total + (venda.desconto||0))}${desc}
Total:               ${Format.currency(venda.valor_total)}${taxa}${liq}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pagamento: ${formatarPagamento(venda.forma_pagamento, venda.parcelas)}
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

  // Monta label atual
  document.getElementById('editPagAtual').textContent =
    `${formatarPagamento(formaAtual, parcelasAtuais)} — ${Format.currency(taxaAtual)} de taxa`;

  // Reseta selects
  const selForma = document.getElementById('editPagForma');
  selForma.value = formaAtual || 'dinheiro';
  document.getElementById('editPagParcelas').value = parcelasAtuais || 1;

  onChangeEditPagForma(valorTotal);
  document.getElementById('erroEditPag').classList.add('hidden');

  // Carrega taxas reais do Supabase se disponível
  if (window._supabase) {
    const { data } = await window._supabase
      .from('taxas_maquininha')
      .select('tipo, parcelas, taxa')
      .order('parcelas');
    if (data && data.length) {
      window._taxasReais = {};
      data.forEach(t => {
        const key = t.tipo === 'credito_parcelado' ? `credito_${t.parcelas}x` : t.tipo;
        window._taxasReais[key] = t.taxa;
      });
    }
  }

  abrirModal('modalEditarPagamento');
}

function onChangeEditPagForma(valorTotalOverride) {
  const forma    = document.getElementById('editPagForma').value;
  const parcelas = parseInt(document.getElementById('editPagParcelas').value) || 1;
  const valor    = parseFloat(valorTotalOverride || document.getElementById('editPagValorTotal').value) || 0;

  const rowParcelas  = document.getElementById('editPagRowParcelas');
  const rowCrediario = document.getElementById('editPagRowCrediario');

  // Crediário — campos especiais
  rowCrediario.style.display = forma === 'crediario' ? 'block' : 'none';
  rowParcelas.style.display  = forma === 'credito'   ? 'block' : 'none';

  // Data padrão crediário = próximo mês
  if (forma === 'crediario' && !document.getElementById('editPagVencCrediario').value) {
    const prox = new Date(); prox.setMonth(prox.getMonth() + 1);
    document.getElementById('editPagVencCrediario').value = prox.toISOString().split('T')[0];
  }

  // Preview taxa — crediário não tem taxa de maquininha
  if (forma === 'crediario' || forma === 'dinheiro' || forma === 'pix') {
    document.getElementById('editPagPreview').innerHTML =
      `<span style="color:var(--color-success)">Sem taxa de maquininha</span> &nbsp;|&nbsp; Líquido: <strong>${Format.currency(valor)}</strong>`;
    document.getElementById('editPagNovaTaxa').value    = 0;
    document.getElementById('editPagNovoLiquido').value = valor;
    return;
  }

  // Busca taxa
  const chave = forma === 'credito' && parcelas > 1 ? `credito_${parcelas}x` : forma;
  const taxas = window._taxasReais || TAXAS_PADRAO;
  const pct   = taxas[chave] ?? taxas[forma] ?? 0;

  const valorTaxa    = parseFloat((valor * pct / 100).toFixed(2));
  const valorLiquido = parseFloat((valor - valorTaxa).toFixed(2));

  document.getElementById('editPagPreview').innerHTML = pct > 0
    ? `Taxa ${pct}%: <strong style="color:var(--color-danger)">— ${Format.currency(valorTaxa)}</strong> &nbsp;|&nbsp; Líquido: <strong>${Format.currency(valorLiquido)}</strong>`
    : `<span style="color:var(--color-success)">Sem taxa de maquininha</span> &nbsp;|&nbsp; Líquido: <strong>${Format.currency(valor)}</strong>`;

  document.getElementById('editPagNovaTaxa').value    = valorTaxa;
  document.getElementById('editPagNovoLiquido').value = valorLiquido;
}

async function salvarEditarPagamento() {
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
  const lucroReal   = parseFloat((novoLiquido - custoTotal).toFixed(2));

  // Bandeira: mantém se for cartão, zera se não for
  let bandeira_id = null;
  if (['credito','debito'].includes(forma)) {
    bandeira_id = vendaAtual?.bandeira_id || null;
  }

  const { error } = await window._supabase.from('vendas').update({
    forma_pagamento: forma,
    parcelas:        forma === 'credito' ? parcelas : (forma === 'crediario' ? parseInt(document.getElementById('editPagParcelasCrediario').value) : 1),
    valor_taxa:      novaTaxa,
    valor_liquido:   novoLiquido,
    lucro:           lucroReal,
    taxa_aplicada:   novaTaxa > 0 ? parseFloat((novaTaxa / valorTotal * 100).toFixed(2)) : 0,
    bandeira_id:     bandeira_id,
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
  if (!window._supabase) {
    fecharModal('modalCancelarVenda');
    Toast.success('Venda cancelada!', 'Estoque revertido.');
    carregarHistorico();
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
