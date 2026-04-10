/**
 * TREEMALI ERP — Contas a Pagar
 */

let _parcelas = [];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('searchContas')
    .addEventListener('input', () => renderParcelas());
  carregarContasPagar();
});

async function carregarContasPagar() {
  const hoje   = new Date().toISOString().split('T')[0];
  const semana = new Date(Date.now() + 7*86400000).toISOString().split('T')[0];
  const mes1   = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const mes2   = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).toISOString().split('T')[0];

  if (!window._supabase) {
    _parcelas = [
      { id:1, despesa_id:1, despesas:{descricao:'Aluguel'},    numero:1, total_parcelas:1, vencimento:'2026-03-05', valor:1200, status:'pago' },
      { id:2, despesa_id:2, despesas:{descricao:'Energia'},    numero:1, total_parcelas:1, vencimento:'2026-03-10', valor:280,  status:'pendente' },
      { id:3, despesa_id:3, despesas:{descricao:'Fornecedor'}, numero:1, total_parcelas:3, vencimento:'2026-03-15', valor:600,  status:'pendente' },
      { id:4, despesa_id:3, despesas:{descricao:'Fornecedor'}, numero:2, total_parcelas:3, vencimento:'2026-04-15', valor:600,  status:'pendente' },
      { id:5, despesa_id:3, despesas:{descricao:'Fornecedor'}, numero:3, total_parcelas:3, vencimento:'2026-05-15', valor:600,  status:'pendente' },
    ];
    atualizarKPIs(hoje, semana, mes1, mes2);
    renderParcelas();
    return;
  }

  const status = document.getElementById('filtroStatusConta').value;
  let q = window._supabase
    .from('parcelas_despesa')
    .select('*, despesas(descricao, categoria)')
    .order('vencimento');
  if (status) q = q.eq('status', status);

  const { data } = await q;
  _parcelas = data || [];
  atualizarKPIs(hoje, semana, mes1, mes2);
  renderParcelas();
}

function atualizarKPIs(hoje, semana, mes1, mes2) {
  const vencidas  = _parcelas.filter(p => p.status !== 'pago' && p.vencimento < hoje);
  const daSemana  = _parcelas.filter(p => p.status !== 'pago' && p.vencimento >= hoje && p.vencimento <= semana);
  const doMes     = _parcelas.filter(p => p.status !== 'pago' && p.vencimento >= mes1 && p.vencimento <= mes2);
  const pagas     = _parcelas.filter(p => p.status === 'pago' && p.vencimento >= mes1 && p.vencimento <= mes2);

  const soma = arr => arr.reduce((s,p) => s + p.valor, 0);
  setText('kpiCpVencidas', Format.currency(soma(vencidas)));
  setText('kpiCpSemana',   Format.currency(soma(daSemana)));
  setText('kpiCpMes',      Format.currency(soma(doMes)));
  setText('kpiCpPagas',    Format.currency(soma(pagas)));
}

function renderParcelas() {
  const busca = document.getElementById('searchContas').value.toLowerCase();
  const hoje  = new Date().toISOString().split('T')[0];
  let lista   = _parcelas;
  if (busca) lista = lista.filter(p => p.despesas?.descricao?.toLowerCase().includes(busca));

  const tbody = document.getElementById('bodyContasPagar');
  if (!lista.length) { tbody.innerHTML='<tr><td colspan="6" class="table-loading">Nenhuma conta encontrada</td></tr>'; return; }

  tbody.innerHTML = lista.map(p => {
    const vencida = p.vencimento < hoje && p.status !== 'pago';
    const total   = p.total_parcelas || (p.despesas?.total_parcelas) || 1;
    return `
      <tr>
        <td><strong>${p.despesas?.descricao||'—'}</strong></td>
        <td>${p.numero}/${total}</td>
        <td style="color:${vencida?'var(--color-danger)':'inherit'}">${Format.date(p.vencimento)}${vencida?' ⚠':''}</td>
        <td><strong>${Format.currency(p.valor)}</strong></td>
        <td><span class="badge ${p.status==='pago'?'badge-success':p.status==='vencido'||vencida?'badge-danger':'badge-warning'}">${p.status==='pago'?'Pago':vencida?'Vencida':'Pendente'}</span></td>
        <td>
          ${p.status!=='pago'?`<button class="btn-table success" onclick="pagarParcela(${p.id}, '${p.despesas?.descricao||''}', ${p.valor})" title="Marcar como pago">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </button>`:'<span style="color:var(--color-gray-300);font-size:12px">✓ Pago</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

function pagarParcela(id, desc, valor) {
  document.getElementById('msgPagarConta').textContent = `Confirmar pagamento de "${desc}" — ${Format.currency(valor)}?`;
  document.getElementById('dataPagConta').value = new Date().toISOString().split('T')[0];

  document.getElementById('btnConfirmarPagConta').onclick = async () => {
    const dataPag = document.getElementById('dataPagConta').value;
    const liberar = bloquearBtn('btnConfirmarPagConta', 'Processando...');

    if (!window._supabase) {
      const i = _parcelas.findIndex(x => x.id === id);
      if (i >= 0) _parcelas[i].status = 'pago';
      renderParcelas();
      fecharModal('modalPagarConta');
      Toast.success('Pagamento registrado!');
      liberar();
      return;
    }

    try {
      const { error } = await window._supabase.from('parcelas_despesa')
        .update({ status: 'pago', data_pag: dataPag }).eq('id', id);

      if (error) throw error;

      fecharModal('modalPagarConta');
      Toast.success('Pagamento registrado!');
      carregarContasPagar();
    } catch (err) {
      Toast.error('Erro ao pagar', ErrorTranslator.translate(err.message));
    } finally {
      liberar();
    }
  };

  abrirModal('modalPagarConta');
}

function abrirModal(id) { document.getElementById(id).classList.add('active'); document.body.style.overflow = 'hidden'; }
function fecharModal(id) { document.getElementById(id).classList.remove('active'); document.body.style.overflow = ''; }
function setText(id, t) { const el = document.getElementById(id); if (el) el.textContent = t; }

/**
 * Tradutor de Erros do Supabase / Sistema
 */
const ErrorTranslator = {
  translate(msg) {
    if (!msg) return 'Erro desconhecido ao processar.';
    const m = msg.toLowerCase();
    if (m.includes('network') || m.includes('fetch')) return 'Erro de conexão (internet).';
    if (m.includes('permission denied')) return 'Você não tem permissão para esta ação.';
    return `Erro: ${msg}`;
  }
};

document.addEventListener('click', e => { if (e.target.classList.contains('modal-overlay')) fecharModal(e.target.id); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.active').forEach(m => fecharModal(m.id)); });
