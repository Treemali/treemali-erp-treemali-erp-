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
  const parcObj = _parcelas.find(p => p.id === parcId);
  const credId = parcObj?.crediario_id;

  window._valorParcelaAtual = valor; // guarda para uso retrocompatível se necessário
  document.getElementById('msgReceberParc').textContent =
    `Confirmar recebimento de parcela de ${Format.currency(valor)} de ${nomeCliente}?`;
  document.getElementById('valorRecebidoParc').value = valor.toFixed(2);
  document.getElementById('dataReceberParc').value = new Date().toISOString().split('T')[0];
  document.getElementById('formaReceberParc').value = 'dinheiro';
  document.getElementById('rowBandeiraReceber').style.display = 'none';
  document.getElementById('previewTaxaReceber').innerHTML = '';

  // Carrega bandeiras e taxas
  if (window._supabase) {
    const [bandRes, taxaRes] = await Promise.all([
      window._supabase.from('bandeiras').select('id, nome').order('nome'),
      window._supabase.from('taxas_pagamento').select('tipo, parcelas, taxa, bandeira_id').order('parcelas'),
    ]);
    const sel = document.getElementById('bandeiraReceberParc');
    if (sel) {
      sel.innerHTML = '<option value="">Selecione...</option>' +
        (bandRes.data||[]).map(b => `<option value="${b.id}">${b.nome}</option>`).join('');
    }
    window._taxasReceberList = taxaRes.data || [];
  }

  document.getElementById('btnConfirmarReceberParc').onclick = async () => {
    const valorPagoRaw = parseFloat(document.getElementById('valorRecebidoParc').value);
    const forma    = document.getElementById('formaReceberParc').value;
    const dataPag  = document.getElementById('dataReceberParc').value;
    const bandeiraId = parseInt(document.getElementById('bandeiraReceberParc')?.value) || null;
    const parcelas   = parseInt(document.getElementById('parcelasReceberParc')?.value) || 1;

    if (isNaN(valorPagoRaw) || valorPagoRaw <= 0) { Toast.error('Erro', 'Informe um valor válido.'); return; }

    const liberar = bloquearBtn('btnConfirmarReceberParc', 'Processando...');

    if (!window._supabase) {
      if (credId) {
        processarPagamentoCascataDemo(credId, valorPagoRaw, forma, dataPag);
      } else {
        const i = _parcelas.findIndex(p => p.id === parcId);
        if (i >= 0) { _parcelas[i].status = 'pago'; _parcelas[i].data_pag = dataPag; }
      }
      renderParcelas();
      fecharModal('modalReceberParc');
      Toast.success('Recebimento registrado!');
      liberar();
      return;
    }

    try {
      const isCartao = ['credito','debito'].includes(forma);
      let taxaPct = 0;
      if (isCartao && bandeiraId && window._taxasReceberList?.length) {
        const tipoFiltro = forma === 'debito' ? 'debito'
          : parcelas > 1 ? 'credito_parcelado' : 'credito_vista';
        const found = window._taxasReceberList.find(t =>
          parseInt(t.bandeira_id) === bandeiraId && t.tipo === tipoFiltro &&
          (tipoFiltro === 'credito_parcelado' ? parseInt(t.parcelas) === parcelas : true)
        );
        taxaPct = found ? parseFloat(found.taxa) : 0;
      }

      // Confirmação para pagamento parcial
      if (valorPagoRaw < valor - 0.01) {
        const diferenca = valor - valorPagoRaw;
        const confirmar = confirm(`O valor pago (R$ ${valorPagoRaw.toFixed(2)}) é menor que o valor original da parcela (R$ ${valor.toFixed(2)}).\n\nO sistema registrará R$ ${valorPagoRaw.toFixed(2)} como pagos e criará uma nova parcela de R$ ${diferenca.toFixed(2)} pendente.\n\nDeseja continuar?`);
        if (!confirmar) {
          liberar();
          return;
        }
      }

      // Executa o pagamento em cascata e amortizações
      await processarPagamentoCascata(credId, valorPagoRaw, forma, dataPag, bandeiraId, parcelas, window._taxasReceberList);

      fecharModal('modalReceberParc');
      Toast.success('Recebimento processado com sucesso!');
      carregarContasReceber();
    } catch (err) {
      console.error(err);
      Toast.error('Erro no processamento', err.message || 'Erro desconhecido');
    } finally {
      liberar();
    }
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

  const valorRecebido = parseFloat(document.getElementById('valorRecebidoParc').value) || 0;

  const tipoFiltro = forma === 'debito' ? 'debito'
    : parcelas > 1 ? 'credito_parcelado' : 'credito_vista';
  const found = window._taxasReceberList.find(t =>
    parseInt(t.bandeira_id) === bandeiraId && t.tipo === tipoFiltro &&
    (tipoFiltro === 'credito_parcelado' ? parseInt(t.parcelas) === parcelas : true)
  );
  const pct  = found ? parseFloat(found.taxa) : 0;
  const taxa = parseFloat((valorRecebido * pct / 100).toFixed(2));
  const liq  = parseFloat((valorRecebido - taxa).toFixed(2));

  document.getElementById('previewTaxaReceber').innerHTML = pct > 0
    ? `Taxa ${pct}%: <strong style="color:var(--color-danger)">— ${Format.currency(taxa)}</strong>
       &nbsp;|&nbsp; <strong style="color:var(--color-success)">Entra no caixa: ${Format.currency(liq)}</strong>`
    : '<span style="color:var(--color-warning)">⚠ Selecione a bandeira para calcular a taxa</span>';
}

async function processarPagamentoCascata(credId, valorPagoTotal, forma, dataPag, bandeiraId, parcelasMaquininha, taxasList) {
  const { data: parcelas, error: errParc } = await window._supabase
    .from('parcelas_crediario')
    .select('*')
    .eq('crediario_id', credId)
    .in('status', ['pendente', 'vencido'])
    .order('numero', { ascending: true })
    .order('vencimento', { ascending: true });

  if (errParc) throw errParc;
  if (!parcelas || parcelas.length === 0) {
    throw new Error("Nenhuma parcela pendente encontrada para este crediário.");
  }

  // Sanitiza o ID do usuário para evitar erro de UUID inválido (ex: "1") no Postgres
  const rawUserId = Auth.getUser()?.id;
  const isUuid = typeof rawUserId === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(rawUserId);
  const pUsuarioId = isUuid ? rawUserId : null;

  let valorRestante = valorPagoTotal;

  for (let i = 0; i < parcelas.length; i++) {
    const parc = parcelas[i];
    const valorParcela = parseFloat(parc.valor);

    if (valorRestante <= 0.005) break;

    const isCartao = ['credito','debito'].includes(forma);
    let taxaPct = 0;
    if (isCartao && bandeiraId && taxasList && taxasList.length > 0) {
      const tipoTaxa = forma === 'debito' ? 'debito'
        : parcelasMaquininha > 1 ? 'credito_parcelado' : 'credito_vista';
      const taxaObj = taxasList.find(t => 
        parseInt(t.bandeira_id) === bandeiraId && 
        t.tipo === tipoTaxa && 
        (tipoTaxa === 'credito_parcelado' ? parseInt(t.parcelas) === parcelasMaquininha : true)
      );
      taxaPct = taxaObj ? parseFloat(taxaObj.taxa) : 0;
    }

    if (valorRestante >= valorParcela - 0.01) {
      const valorAPagar = valorParcela;
      
      const { error: errRpc } = await window._supabase.rpc('processar_pagamento_crediario', {
        p_crediario_id: credId,
        p_valor_pago:   valorAPagar,
        p_forma_pag:    forma,
        p_data_pag:     dataPag,
        p_usuario_id:   pUsuarioId,
        p_bandeira_id:  isCartao ? bandeiraId : null,
        p_taxa_pct:     taxaPct
      });
      if (errRpc) throw errRpc;

      valorRestante -= valorAPagar;
    } else {
      const valorAPagar = valorRestante;
      const diferenca = valorParcela - valorAPagar;

      const { error: errUpdate } = await window._supabase
        .from('parcelas_crediario')
        .update({ valor: valorAPagar })
        .eq('id', parc.id);
      if (errUpdate) throw errUpdate;

      const { error: errInsert } = await window._supabase
        .from('parcelas_crediario')
        .insert({
          crediario_id: credId,
          numero:       parc.numero,
          vencimento:   parc.vencimento,
          valor:        diferenca,
          status:       'pendente'
        });
      if (errInsert) throw errInsert;

      const { error: errRpc } = await window._supabase.rpc('processar_pagamento_crediario', {
        p_crediario_id: credId,
        p_valor_pago:   valorAPagar,
        p_forma_pag:    forma,
        p_data_pag:     dataPag,
        p_usuario_id:   pUsuarioId,
        p_bandeira_id:  isCartao ? bandeiraId : null,
        p_taxa_pct:     taxaPct
      });
      if (errRpc) throw errRpc;

      valorRestante = 0;
      break;
    }
  }
  return true;
}

function processarPagamentoCascataDemo(credId, valorPagoTotal, forma, dataPag) {
  let valorRestante = valorPagoTotal;
  
  let parcelas = _parcelas
    .filter(p => p.crediario_id === credId && p.status !== 'pago')
    .sort((a,b) => a.numero - b.numero);

  for (let i = 0; i < parcelas.length; i++) {
    const parc = parcelas[i];
    const valorParcela = parc.valor;

    if (valorRestante <= 0.005) break;

    if (valorRestante >= valorParcela - 0.01) {
      parc.status = 'pago';
      parc.data_pag = dataPag;
      valorRestante -= valorParcela;
    } else {
      const valorAPagar = valorRestante;
      const diferenca = valorParcela - valorAPagar;

      parc.valor = valorAPagar;
      parc.status = 'pago';
      parc.data_pag = dataPag;

      _parcelas.push({
        id: Date.now() + i,
        crediario_id: credId,
        crediario: parc.crediario,
        numero: parc.numero,
        total: parc.total,
        vencimento: parc.vencimento,
        valor: diferenca,
        status: 'pendente',
        data_pag: null
      });

      valorRestante = 0;
      break;
    }
  }
}

function abrirModal(id){ document.getElementById(id).classList.add('active'); document.body.style.overflow='hidden'; }
function fecharModal(id){ document.getElementById(id).classList.remove('active'); document.body.style.overflow=''; }
function setText(id,t){ const el=document.getElementById(id); if(el) el.textContent=t; }
document.addEventListener('click',e=>{ if(e.target.classList.contains('modal-overlay')) fecharModal(e.target.id); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') document.querySelectorAll('.modal-overlay.active').forEach(m=>fecharModal(m.id)); });
