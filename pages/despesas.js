/**
 * TREEMALI ERP — Despesas
 */

let _despesas = [];

document.addEventListener('DOMContentLoaded', () => {
  preencherMeses();
  document.getElementById('searchDespesas')
    .addEventListener('input', () => renderDespesas());
  document.getElementById('despDataLanc').value = new Date().toISOString().split('T')[0];
  carregarDespesas();
});

function preencherMeses() {
  const sel = document.getElementById('filtroMesDespesa');
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const hoje = new Date();
  let opts = '<option value="">Todos os meses</option>';
  for (let i = 0; i < 12; i++) {
    const m = String(i+1).padStart(2,'0');
    const y = hoje.getFullYear();
    opts += `<option value="${y}-${m}" ${i===hoje.getMonth()?'selected':''}>${meses[i]} ${y}</option>`;
  }
  sel.innerHTML = opts;
}

async function carregarDespesas() {
  if (!window._supabase) {
    _despesas = [
      { id:1, descricao:'Aluguel', categoria:'Aluguel', valor:1200, vencimento:'2026-03-05', forma_pagamento:'pix', parcelado:false, total_parcelas:1, status:'pago',    created_at:new Date().toISOString() },
      { id:2, descricao:'Energia', categoria:'Energia', valor:280,  vencimento:'2026-03-10', forma_pagamento:'debito',parcelado:false,total_parcelas:1, status:'pendente',created_at:new Date().toISOString() },
      { id:3, descricao:'Fornecedor XYZ', categoria:'Fornecedor', valor:1800, vencimento:'2026-03-20', forma_pagamento:'boleto',parcelado:true,total_parcelas:3,status:'pendente',created_at:new Date().toISOString() },
    ];
    renderDespesas();
    return;
  }

  const mes    = document.getElementById('filtroMesDespesa').value;
  const status = document.getElementById('filtroStatusDespesa').value;

  let q = window._supabase.from('despesas').select('*').order('vencimento');
  if (status) q = q.eq('status', status);
  if (mes)    q = q.gte('vencimento', mes+'-01').lte('vencimento', mes+'-31');

  const { data } = await q;
  _despesas = data || [];
  renderDespesas();

  // Atualiza status de vencidas
  atualizarStatusVencidas();
}

async function atualizarStatusVencidas() {
  if (!window._supabase) return;
  const hoje = new Date().toISOString().split('T')[0];
  await window._supabase.from('despesas')
    .update({ status: 'vencido' })
    .eq('status', 'pendente')
    .lt('vencimento', hoje);
  await window._supabase.from('parcelas_despesa')
    .update({ status: 'vencido' })
    .eq('status', 'pendente')
    .lt('vencimento', hoje);
}

function renderDespesas() {
  const busca  = document.getElementById('searchDespesas').value.toLowerCase();
  const hoje   = new Date().toISOString().split('T')[0];
  let lista = _despesas;
  if (busca) lista = lista.filter(d => d.descricao?.toLowerCase().includes(busca) || d.categoria?.toLowerCase().includes(busca));

  const tbody = document.getElementById('bodyDespesas');
  if (!lista.length) { tbody.innerHTML='<tr><td colspan="7" class="table-loading">Nenhuma despesa encontrada</td></tr>'; return; }

  tbody.innerHTML = lista.map(d => {
    const venc = d.vencimento;
    const vencida = venc && venc < hoje && d.status !== 'pago';
    return `
      <tr>
        <td><strong>${d.descricao}</strong></td>
        <td>${d.categoria || '—'}</td>
        <td>${Format.currency(d.valor)}</td>
        <td style="color:${vencida?'var(--color-danger)':'inherit'}">${Format.date(venc)}${vencida?' ⚠':''}</td>
        <td>${d.forma_pagamento || '—'}</td>
        <td><span class="badge ${d.status==='pago'?'badge-success':d.status==='vencido'?'badge-danger':'badge-warning'}">${d.status==='pago'?'Pago':d.status==='vencido'?'Vencida':'Pendente'}</span>${d.parcelado?` <small style="color:var(--color-gray-400)">${d.total_parcelas}x</small>`:''}</td>
        <td>
          ${d.status!=='pago'?`<button class="btn-table success" onclick="abrirPagarDespesa(${d.id})" title="Marcar como pago">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </button>`:''}
          <button class="btn-table" onclick="editarDespesa(${d.id})" title="Editar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function abrirNovaDespesa() {
  document.getElementById('despesaId').value = '';
  document.getElementById('despDescricao').value = '';
  document.getElementById('despValor').value = '';
  document.getElementById('despCategoria').value = '';
  document.getElementById('despDataLanc').value = new Date().toISOString().split('T')[0];
  document.getElementById('despVencimento').value = '';
  document.getElementById('despFormaPag').value = 'pix';
  document.getElementById('despParcelado').value = 'false';
  document.getElementById('despNParcelas').value = '2';
  document.getElementById('rowParcelas').style.display = 'none';
  document.getElementById('parcelasPreview').classList.add('hidden');
  document.getElementById('tituloModalDesp').textContent = 'Nova Despesa';
  esconderErro('erroDesp');
  abrirModal('modalDespesa');
}

function editarDespesa(id) {
  const d = _despesas.find(x => x.id === id);
  if (!d) return;
  document.getElementById('despesaId').value = d.id;
  document.getElementById('despDescricao').value = d.descricao;
  document.getElementById('despValor').value = d.valor;
  document.getElementById('despCategoria').value = d.categoria||'';
  document.getElementById('despDataLanc').value = d.data_lancamento||'';
  document.getElementById('despVencimento').value = d.vencimento||'';
  document.getElementById('despFormaPag').value = d.forma_pagamento||'pix';
  document.getElementById('despParcelado').value = d.parcelado?'true':'false';
  document.getElementById('rowParcelas').style.display = d.parcelado?'block':'none';
  document.getElementById('despNParcelas').value = d.total_parcelas||2;
  document.getElementById('tituloModalDesp').textContent = 'Editar Despesa';
  esconderErro('erroDesp');
  abrirModal('modalDespesa');
}

function toggleParcelamento() {
  const par = document.getElementById('despParcelado').value === 'true';
  document.getElementById('rowParcelas').style.display = par ? 'block' : 'none';
  atualizarParcelasDesp();
}

function atualizarParcelasDesp() {
  const valor = parseFloat(document.getElementById('despValor').value) || 0;
  const parc  = document.getElementById('despParcelado').value === 'true';
  const n     = parseInt(document.getElementById('despNParcelas').value) || 2;
  const prev  = document.getElementById('parcelasPreview');
  if (parc && valor > 0) {
    document.getElementById('parcelasPreviewTxt').textContent =
      `${n}x de ${Format.currency(valor/n)}`;
    prev.classList.remove('hidden');
  } else {
    prev.classList.add('hidden');
  }
}

async function salvarDespesa() {
  const desc = document.getElementById('despDescricao').value.trim();
  const valor = parseFloat(document.getElementById('despValor').value) || 0;
  if (!desc)  { mostrarErroModal('erroDesp','A descrição é obrigatória.'); return; }
  if (!valor) { mostrarErroModal('erroDesp','O valor é obrigatório.'); return; }

  const id     = document.getElementById('despesaId').value;
  const parc   = document.getElementById('despParcelado').value === 'true';
  const nParc  = parseInt(document.getElementById('despNParcelas').value) || 1;
  const dados  = {
    descricao:       desc,
    valor,
    categoria:       document.getElementById('despCategoria').value || null,
    data_lancamento: document.getElementById('despDataLanc').value,
    vencimento:      document.getElementById('despVencimento').value || null,
    forma_pagamento: document.getElementById('despFormaPag').value,
    parcelado:       parc,
    total_parcelas:  parc ? nParc : 1,
    status:          'pendente',
  };

  setBtnLoading('btnSalvarDesp', true);

  if (!window._supabase) {
    if (id) { const i=_despesas.findIndex(x=>x.id===Number(id)); if(i>=0) _despesas[i]={..._despesas[i],...dados}; }
    else _despesas.push({ id:Date.now(), ...dados });
    renderDespesas();
    fecharModal('modalDespesa');
    Toast.success('Despesa salva!');
    setBtnLoading('btnSalvarDesp', false);
    return;
  }

  let errMsg;
  if (id) {
    const { error } = await window._supabase.from('despesas').update(dados).eq('id', id);
    errMsg = error?.message;
  } else {
    const { data: novaDesp, error } = await window._supabase.from('despesas').insert(dados).select().single();
    errMsg = error?.message;

    // Cria parcelas automaticamente
    if (!error && novaDesp && parc) {
      const venc = document.getElementById('despVencimento').value;
      for (let i = 1; i <= nParc; i++) {
        const dataVenc = venc ? new Date(venc) : new Date();
        dataVenc.setMonth(dataVenc.getMonth() + (i-1));
        await window._supabase.from('parcelas_despesa').insert({
          despesa_id: novaDesp.id,
          numero:     i,
          vencimento: dataVenc.toISOString().split('T')[0],
          valor:      parseFloat((valor/nParc).toFixed(2)),
        });
      }
    }
  }

  setBtnLoading('btnSalvarDesp', false);
  if (errMsg) { mostrarErroModal('erroDesp', errMsg); return; }
  fecharModal('modalDespesa');
  Toast.success('Despesa salva com sucesso!');
  carregarDespesas();
}

function abrirPagarDespesa(id) {
  const d = _despesas.find(x => x.id === id);
  if (!d) return;
  document.getElementById('msgPagarDesp').textContent = `Confirmar pagamento de "${d.descricao}" — ${Format.currency(d.valor)}?`;
  document.getElementById('dataPagDesp').value = new Date().toISOString().split('T')[0];

  document.getElementById('btnConfirmarPagDesp').onclick = async () => {
    const dataPag = document.getElementById('dataPagDesp').value;
    if (!window._supabase) {
      const i = _despesas.findIndex(x=>x.id===id);
      if(i>=0) _despesas[i].status='pago';
      renderDespesas();
      fecharModal('modalPagarDesp');
      Toast.success('Pagamento registrado!');
      return;
    }
    await window._supabase.from('despesas').update({ status:'pago' }).eq('id', id);
    await window._supabase.from('parcelas_despesa')
      .update({ status:'pago', data_pag: dataPag }).eq('despesa_id', id);
    fecharModal('modalPagarDesp');
    Toast.success('Pagamento registrado!');
    carregarDespesas();
  };

  abrirModal('modalPagarDesp');
}

// Helpers
function abrirModal(id){ document.getElementById(id).classList.add('active'); document.body.style.overflow='hidden'; }
function fecharModal(id){ document.getElementById(id).classList.remove('active'); document.body.style.overflow=''; }
function mostrarErroModal(id,msg){ const el=document.getElementById(id); if(!el)return; el.textContent=msg; el.classList.remove('hidden'); }
function esconderErro(id){ const el=document.getElementById(id); if(el) el.classList.add('hidden'); }
function setBtnLoading(id,l){ const b=document.getElementById(id); if(!b)return; b.disabled=l; b.textContent=l?'Salvando...':'Salvar'; }
document.addEventListener('click',e=>{ if(e.target.classList.contains('modal-overlay')) fecharModal(e.target.id); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') document.querySelectorAll('.modal-overlay.active').forEach(m=>fecharModal(m.id)); });
