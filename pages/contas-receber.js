/**
 * TREEMALI ERP — Contas a Receber
 */

let _parcelas = [];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('searchReceber')
    .addEventListener('input', () => renderParcelas());
  carregarContasReceber();
});

async function carregarContasReceber() {
  const hoje   = new Date().toISOString().split('T')[0];
  const semana = new Date(Date.now() + 7*86400000).toISOString().split('T')[0];
  const mes1   = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const mes2   = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).toISOString().split('T')[0];

  if (!window._supabase) {
    _parcelas = [
      { id:1, crediario_id:1, crediario:{clientes:{nome:'Ana Silva'}},   numero:3, total:6, vencimento:'2026-04-10', valor:100, status:'pendente', data_pag:null },
      { id:2, crediario_id:2, crediario:{clientes:{nome:'Pedro Souza'}}, numero:1, total:3, vencimento:'2026-02-15', valor:300, status:'vencido',  data_pag:null },
      { id:3, crediario_id:2, crediario:{clientes:{nome:'Pedro Souza'}}, numero:2, total:3, vencimento:'2026-03-15', valor:300, status:'pendente', data_pag:null },
    ];
    atualizarKPIs(hoje, semana, mes1, mes2);
    renderParcelas();
    return;
  }

  // Atualiza status vencidas
  await window._supabase.from('parcelas_crediario')
    .update({ status:'vencido' })
    .eq('status','pendente')
    .lt('vencimento', hoje);

  const status = document.getElementById('filtroStatusRec').value;
  let q = window._supabase
    .from('parcelas_crediario')
    .select('*, crediario(id, parcelas, clientes(nome, telefone))')
    .order('vencimento');
  if (status) q = q.eq('status', status);

  const { data } = await q;
  _parcelas = data || [];
  atualizarKPIs(hoje, semana, mes1, mes2);
  renderParcelas();
}

function atualizarKPIs(hoje, semana, mes1, mes2) {
  const vencidas = _parcelas.filter(p => p.status !== 'pago' && p.vencimento < hoje);
  const daSemana = _parcelas.filter(p => p.status !== 'pago' && p.vencimento >= hoje && p.vencimento <= semana);
  const doMes    = _parcelas.filter(p => p.status !== 'pago' && p.vencimento >= mes1 && p.vencimento <= mes2);
  const pagas    = _parcelas.filter(p => p.status === 'pago' && p.data_pag >= mes1 && p.data_pag <= mes2);

  const soma = arr => arr.reduce((s,p) => s + p.valor, 0);
  setText('kpiRcVencidas', Format.currency(soma(vencidas)));
  setText('kpiRcSemana',   Format.currency(soma(daSemana)));
  setText('kpiRcMes',      Format.currency(soma(doMes)));
  setText('kpiRcPagas',    Format.currency(soma(pagas)));
}

function renderParcelas() {
  const busca = document.getElementById('searchReceber').value.toLowerCase();
  const hoje  = new Date().toISOString().split('T')[0];
  let lista   = _parcelas;
  if (busca) lista = lista.filter(p => p.crediario?.clientes?.nome?.toLowerCase().includes(busca));

  const tbody = document.getElementById('bodyContasReceber');
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-loading">Nenhuma conta encontrada</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(p => {
    const vencida    = p.status !== 'pago' && p.vencimento < hoje;
    const nomeCliente = p.crediario?.clientes?.nome || '—';
    const total      = p.crediario?.parcelas || p.total || '?';
    return `
      <tr>
        <td><strong>${nomeCliente}</strong></td>
        <td>${p.numero}/${total}</td>
        <td style="color:${vencida?'var(--color-danger)':'inherit'}">${Format.date(p.vencimento)}${vencida?' ⚠':''}</td>
        <td><strong>${Format.currency(p.valor)}</strong></td>
        <td><span class="badge ${p.status==='pago'?'badge-success':vencida?'badge-danger':'badge-warning'}">${p.status==='pago'?'Recebido':vencida?'Vencida':'Pendente'}</span></td>
        <td>${p.data_pag ? Format.date(p.data_pag) : '—'}</td>
        <td>
          ${p.status !== 'pago' ? `
            <button class="btn-table success" onclick="abrirReceberParcela(${p.id}, ${p.valor}, '${nomeCliente}')" title="Registrar recebimento">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
          ` : '<span style="color:var(--color-gray-300);font-size:12px">✓</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

function abrirReceberParcela(parcId, valor, nomeCliente) {
  document.getElementById('msgReceberParc').textContent =
    `Confirmar recebimento de ${Format.currency(valor)} de ${nomeCliente}?`;
  document.getElementById('dataReceberParc').value = new Date().toISOString().split('T')[0];

  document.getElementById('btnConfirmarReceberParc').onclick = async () => {
    const forma   = document.getElementById('formaReceberParc').value;
    const dataPag = document.getElementById('dataReceberParc').value;

    if (!window._supabase) {
      const i = _parcelas.findIndex(p => p.id === parcId);
      if (i >= 0) { _parcelas[i].status = 'pago'; _parcelas[i].data_pag = dataPag; }
      renderParcelas();
      fecharModal('modalReceberParc');
      Toast.success('Recebimento registrado!');
      return;
    }

    const { error } = await window._supabase.from('parcelas_crediario')
      .update({ status:'pago', data_pag: dataPag, forma_pagamento: forma })
      .eq('id', parcId);

    if (error) { Toast.error('Erro', error.message); return; }

    fecharModal('modalReceberParc');
    Toast.success('Recebimento registrado!');
    carregarContasReceber();
  };

  abrirModal('modalReceberParc');
}

function abrirModal(id){ document.getElementById(id).classList.add('active'); document.body.style.overflow='hidden'; }
function fecharModal(id){ document.getElementById(id).classList.remove('active'); document.body.style.overflow=''; }
function setText(id,t){ const el=document.getElementById(id); if(el) el.textContent=t; }
document.addEventListener('click',e=>{ if(e.target.classList.contains('modal-overlay')) fecharModal(e.target.id); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') document.querySelectorAll('.modal-overlay.active').forEach(m=>fecharModal(m.id)); });
