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

  // Atualiza status vencidas — usa lte (menor ou igual a ontem)
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const ontemStr = ontem.toISOString().split('T')[0];

  await window._supabase.from('parcelas_crediario')
    .update({ status:'vencido' })
    .eq('status','pendente')
    .lte('vencimento', ontemStr);

  const status = document.getElementById('filtroStatusRec').value;
  let q = window._supabase
    .from('parcelas_crediario')
    .select('*, crediario(id, parcelas, clientes(nome, telefone), vendas(status))')
    .order('vencimento');
  if (status) q = q.eq('status', status);

  const { data } = await q;
  // Filtra parcelas de vendas canceladas
  _parcelas = (data || []).filter(p => p.crediario?.vendas?.status !== 'cancelada');
  atualizarKPIs(hoje, semana, mes1, mes2);
  renderParcelas();
}

function atualizarKPIs(hoje, semana, mes1, mes2) {
  const ontem   = new Date(); ontem.setDate(ontem.getDate() - 1);
  const ontemStr = ontem.toISOString().split('T')[0];

  // Vencidas: status vencido OU data anterior a hoje e não pago
  const vencidas = _parcelas.filter(p =>
    p.status !== 'pago' && (p.status === 'vencido' || p.vencimento <= ontemStr)
  );
  const daSemana = _parcelas.filter(p =>
    p.status !== 'pago' && p.status !== 'vencido' && p.vencimento >= hoje && p.vencimento <= semana
  );
  const doMes    = _parcelas.filter(p =>
    p.status !== 'pago' && p.vencimento >= mes1 && p.vencimento <= mes2
  );
  const pagas    = _parcelas.filter(p =>
    p.status === 'pago' && p.data_pag >= mes1 && p.data_pag <= mes2
  );

  const soma = arr => arr.reduce((s,p) => s + (p.valor||0), 0);
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
    const ontem   = new Date(); ontem.setDate(ontem.getDate() - 1);
    const ontemStr = ontem.toISOString().split('T')[0];
    const vencida    = p.status !== 'pago' && (p.status === 'vencido' || p.vencimento <= ontemStr);
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

async function abrirReceberParcela(parcId, valor, nomeCliente) {
  document.getElementById('msgReceberParc').textContent =
    `Confirmar recebimento de ${Format.currency(valor)} de ${nomeCliente}?`;
  document.getElementById('valorRecebidoParc').value = valor.toFixed(2);
  document.getElementById('rowBandeiraReceber').style.display = 'none';
  document.getElementById('previewTaxaReceber').innerHTML = '';

  // Carrega bandeiras e taxas
  if (window._supabase) {
    const [bandRes, taxaRes] = await Promise.all([
      window._supabase.from('bandeiras').select('id, nome').order('nome'),
      window._supabase.from('taxas_pagamento').select('tipo, parcelas, taxa, bandeira_id').order('parcelas'),
    ]);
    const sel = document.getElementById('bandeiraReceberParc');
    sel.innerHTML = '<option value="">Selecione...</option>' +
      (bandRes.data||[]).map(b => `<option value="${b.id}">${b.nome}</option>`).join('');
    window._taxasReceberList = taxaRes.data || [];
  }

  document.getElementById('btnConfirmarReceberParc').onclick = async () => {
    const valorPagoRaw = parseFloat(document.getElementById('valorRecebidoParc').value);
    const forma    = document.getElementById('formaReceberParc').value;
    const dataPag  = document.getElementById('dataReceberParc').value;
    const bandeiraId = parseInt(document.getElementById('bandeiraReceberParc')?.value) || null;
    const parcelas   = parseInt(document.getElementById('parcelasReceberParc')?.value) || 1;

    if (isNaN(valorPagoRaw) || valorPagoRaw <= 0) { Toast.error('Erro', 'Informe um valor válido.'); return; }

    // Busca dados da parcela atual para obter o crediario_id
    const parcAtual = _parcelas.find(p => p.id === parcId);
    if (!parcAtual) return;
    const credId = parcAtual.crediario_id;

    // Calcula taxa se cartão
    let valorTaxa = 0, taxaPct = 0;
    if (['credito','debito'].includes(forma) && bandeiraId && window._taxasReceberList?.length) {
      const tipoFiltro = forma === 'debito' ? 'debito'
        : parcelas > 1 ? 'credito_parcelado' : 'credito_vista';
      const found = window._taxasReceberList.find(t =>
        parseInt(t.bandeira_id) === bandeiraId && t.tipo === tipoFiltro &&
        (tipoFiltro === 'credito_parcelado' ? parseInt(t.parcelas) === parcelas : true)
      );
      taxaPct   = found ? parseFloat(found.taxa) : 0;
      valorTaxa = parseFloat((valorPagoRaw * taxaPct / 100).toFixed(2));
    }

    if (!window._supabase) {
      // Demo logic
      const i = _parcelas.findIndex(p => p.id === parcId);
      if (i >= 0) { _parcelas[i].status = 'pago'; _parcelas[i].data_pag = dataPag; _parcelas[i].valor = valorPagoRaw; }
      renderParcelas(); fecharModal('modalReceberParc'); Toast.success('Recebimento registrado!'); return;
    }

    const liberar = bloquearBtn('btnConfirmarReceberParc', 'Processando...');

    try {
      // LOGICA DE CASCATA
      let restante = valorPagoRaw;

      // 1. Busca todas as parcelas pendentes deste crediário ordenadas por número
      const { data: pendentes } = await window._supabase
        .from('parcelas_crediario')
        .select('*')
        .eq('crediario_id', credId)
        .or('status.eq.pendente,status.eq.vencido')
        .order('numero');

      if (!pendentes || pendentes.length === 0) throw new Error('Nenhuma parcela pendente encontrada.');

      // O processamento começa pela parcela que o usuário clicou (parcId), mas se houver saldo, segue as próximas.
      for (const p of pendentes) {
        if (restante <= 0) break;

        if (p.id === parcId || restante > 0) {
          if (restante >= p.valor) {
            let valorEfetivo = p.valor;
            if (p.id === parcId) valorEfetivo = restante;

            await window._supabase.from('parcelas_crediario').update({
              status:          'pago',
              data_pag:        dataPag,
              forma_pagamento: forma,
              bandeira_id:     bandeiraId,
              valor_taxa:      p.id === parcId ? valorTaxa : 0, 
              taxa_aplicada:   p.id === parcId ? taxaPct : 0,
              valor:           parseFloat(valorEfetivo.toFixed(2)) 
            }).eq('id', p.id);

            restante -= p.valor;
          } else {
            // Pagamento parcial: reduz o valor da parcela e mantém pendente
            await window._supabase.from('parcelas_crediario').update({
              valor: parseFloat((p.valor - restante).toFixed(2))
            }).eq('id', p.id);
            restante = 0;
          }
        }
      }

      // Verifica se quitou tudo
      const { data: rest } = await window._supabase.from('parcelas_crediario').select('id').eq('crediario_id', credId).neq('status','pago');
      if (rest && rest.length === 0) {
        await window._supabase.from('crediario').update({ status: 'quitado' }).eq('id', credId);
      }

      fecharModal('modalReceberParc');
      Toast.success('Recebimento processado com sucesso!');
      carregarContasReceber();
    } catch (err) {
      Toast.error('Erro no processamento', ErrorTranslator.translate(err.message));
    } finally {
      liberar();
    }
  };
  };

  abrirModal('modalReceberParc');
}

function onChangeFormaReceber() {
  const forma      = document.getElementById('formaReceberParc').value;
  const isCartao   = ['credito','debito'].includes(forma);
  const rowBandeira = document.getElementById('rowBandeiraReceber');
  rowBandeira.style.display = isCartao ? 'block' : 'none';

  if (!isCartao) {
    document.getElementById('previewTaxaReceber').innerHTML = '';
    return;
  }

  const bandeiraId = parseInt(document.getElementById('bandeiraReceberParc')?.value) || null;
  const parcelas   = parseInt(document.getElementById('parcelasReceberParc')?.value) || 1;

  if (!bandeiraId || !window._taxasReceberList?.length) {
    document.getElementById('previewTaxaReceber').innerHTML =
      '<span style="color:var(--color-gray-400)">Selecione a bandeira para ver a taxa</span>';
    return;
  }

  const tipoFiltro = forma === 'debito' ? 'debito'
    : parcelas > 1 ? 'credito_parcelado' : 'credito_vista';
  const found = window._taxasReceberList.find(t =>
    parseInt(t.bandeira_id) === bandeiraId && t.tipo === tipoFiltro &&
    (tipoFiltro === 'credito_parcelado' ? parseInt(t.parcelas) === parcelas : true)
  );
  const pct  = found ? parseFloat(found.taxa) : 0;

  document.getElementById('previewTaxaReceber').innerHTML = pct > 0
    ? `Taxa ${pct}%: <strong style="color:var(--color-danger)">— ${Format.currency(0)}</strong> <span style="color:var(--color-gray-400)">(calculada sobre o valor da parcela)</span>`
    : '<span style="color:var(--color-warning)">⚠ Taxa não encontrada para esta combinação</span>';
}

function abrirModal(id){ document.getElementById(id).classList.add('active'); document.body.style.overflow='hidden'; }
function fecharModal(id){ document.getElementById(id).classList.remove('active'); document.body.style.overflow=''; }
function setText(id,t){ const el=document.getElementById(id); if(el) el.textContent=t; }
document.addEventListener('click',e=>{ if(e.target.classList.contains('modal-overlay')) fecharModal(e.target.id); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') document.querySelectorAll('.modal-overlay.active').forEach(m=>fecharModal(m.id)); });

/**
 * Tradutor de Erros do Supabase / Sistema
 */
const ErrorTranslator = {
  translate(msg) {
    if (!msg) return 'Erro desconhecido ao processar.';
    const m = msg.toLowerCase();
    if (m.includes('duplicate key')) return 'Este registro já existe no sistema.';
    if (m.includes('network') || m.includes('fetch')) return 'Erro de conexão (internet).';
    if (m.includes('permission denied')) return 'Você não tem permissão para esta ação.';
    return `Erro: ${msg}`;
  }
};
