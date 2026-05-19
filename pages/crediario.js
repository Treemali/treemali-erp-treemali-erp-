/**
 * TREEMALI ERP — Crediário
 */

let _crediarios = [];
let _credAtual  = null;
let _bandeirasCred = [];
let _taxasCred     = [];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('searchCrediario')
    .addEventListener('input', () => renderCrediarios());
  carregarBandeirasCrediario();
  carregarCrediario();
});

async function carregarCrediario() {
  try {
    if (!window._supabase) {
      _crediarios = [
        {
          id:1, cliente_id:1, clientes:{nome:'Ana Silva', telefone:'(44) 99999-0001'},
          valor_total:600, parcelas:6, status:'ativo', created_at: new Date().toISOString(),
          parcelas_crediario:[
            {id:1,numero:1,vencimento:'2026-02-10',valor:100,status:'pago',  data_pag:'2026-02-09'},
            {id:2,numero:2,vencimento:'2026-03-10',valor:100,status:'pago',  data_pag:'2026-03-08'},
            {id:3,numero:3,vencimento:'2026-04-10',valor:100,status:'pendente',data_pag:null},
            {id:4,numero:4,vencimento:'2026-05-10',valor:100,status:'pendente',data_pag:null},
            {id:5,numero:5,vencimento:'2026-06-10',valor:100,status:'pendente',data_pag:null},
            {id:6,numero:6,vencimento:'2026-07-10',valor:100,status:'pendente',data_pag:null},
          ]
        },
        {
          id:2, cliente_id:2, clientes:{nome:'Pedro Souza', telefone:'(44) 99999-0002'},
          valor_total:900, parcelas:3, status:'ativo', created_at: new Date(Date.now()-5*86400000).toISOString(),
          parcelas_crediario:[
            {id:7,numero:1,vencimento:'2026-02-15',valor:300,status:'vencido', data_pag:null},
            {id:8,numero:2,vencimento:'2026-03-15',valor:300,status:'pendente',data_pag:null},
            {id:9,numero:3,vencimento:'2026-04-15',valor:300,status:'pendente',data_pag:null},
          ]
        },
      ];
    } else {
      const statusFiltro = document.getElementById('filtroStatusCred').value;
      let q = window._supabase
        .from('crediario')
        .select('*, clientes(nome, telefone), parcelas_crediario(*)')
        .order('created_at', { ascending: false });
      
      // Se filtrar por ATIVO, exclui explicitamente os cancelados e quitados
      if (statusFiltro === 'ativo') {
        q = q.eq('status', 'ativo');
      } else if (statusFiltro) {
        q = q.eq('status', statusFiltro);
      } else {
        // Se não houver filtro, ainda assim escondemos os cancelados por padrão para não poluir
        q = q.neq('status', 'cancelado');
      }
      
      const { data, error } = await q;
      if (error) throw error;
      
      // Verificação de segurança: se o status estiver 'ativo' mas todas as parcelas estiverem 'pago', 
      // tratamos como quitado visualmente
      _crediarios = (data || []).map(c => {
        const parcelas = c.parcelas_crediario || [];
        const todasPagas = parcelas.length > 0 && parcelas.every(p => p.status === 'pago');
        if (todasPagas && c.status === 'ativo') {
          return { ...c, status: 'quitado' };
        }
        return c;
      });

      // Se o filtro for 'ativo', removemos os que acabamos de identificar como 'quitados'
      if (statusFiltro === 'ativo') {
        _crediarios = _crediarios.filter(c => c.status === 'ativo');
      }
    }
  } catch (err) {
    console.error("Erro detalhado ao carregar o crediário:", err);
    if (typeof Toast !== 'undefined') {
      Toast.error('Erro no Crediário', err.message ? ErrorTranslator.translate(err.message) : 'Falha ao buscar dados do servidor.');
    }
    _crediarios = [];
  } finally {
    atualizarKPIs();
    renderCrediarios();
  }
}

function atualizarKPIs() {
  const hoje = new Date().toISOString().split('T')[0];
  const mes1 = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const mes2 = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).toISOString().split('T')[0];

  const ativos   = _crediarios.filter(c => c.status === 'ativo');
  const todasParc = _crediarios.flatMap(c => c.parcelas_crediario || []);
  const vencidas  = todasParc.filter(p => p.status !== 'pago' && p.vencimento < hoje);
  const pendentes = todasParc.filter(p => p.status !== 'pago');
  const doMes     = todasParc.filter(p => p.status === 'pago' && p.data_pag >= mes1 && p.data_pag <= mes2);

  const soma = arr => arr.reduce((s,p) => s + p.valor, 0);

  setText('kpiCredAtivos',   ativos.length);
  setText('kpiCredReceber',  Format.currency(soma(pendentes)));
  setText('kpiCredVencidas', Format.currency(soma(vencidas)));
  setText('kpiCredMes',      Format.currency(soma(doMes)));
}

function renderCrediarios() {
  const busca = document.getElementById('searchCrediario').value.toLowerCase();
  const hoje  = new Date().toISOString().split('T')[0];
  let lista   = _crediarios;
  if (busca) lista = lista.filter(c => c.clientes?.nome?.toLowerCase().includes(busca));

  const container = document.getElementById('listaCrediario');
  if (!lista.length) {
    container.innerHTML = '<div class="table-loading">Nenhum crediário encontrado</div>';
    return;
  }

  container.innerHTML = lista.map((c, idx) => {
    const parcelas  = c.parcelas_crediario || [];
    const pagas     = parcelas.filter(p => p.status === 'pago').length;
    const vencidas  = parcelas.filter(p => p.status !== 'pago' && p.vencimento < hoje).length;
    const valorPago = parcelas.filter(p => p.status === 'pago').reduce((s,p) => s + p.valor, 0);
    const valorPend = parcelas.filter(p => p.status !== 'pago').reduce((s,p) => s + p.valor, 0);
    const pct       = Math.round((valorPago / c.valor_total) * 100) || 0;

    return `
      <div class="cred-card ${vencidas > 0 ? 'has-vencida' : ''} ${c.status === 'quitado' ? 'quitado' : ''}" style="animation-delay:${idx*0.04}s">
        <div class="cred-card-header">
          <div>
            <div class="cred-cliente">👤 ${c.clientes?.nome || '—'}</div>
            <div class="cred-meta">
              Desde ${Format.date(c.created_at)} · ${c.parcelas}x de ${Format.currency(c.valor_total / c.parcelas)}
              ${c.clientes?.telefone ? ' · ' + c.clientes.telefone : ''}
            </div>
          </div>
          <div style="display:flex;gap:var(--space-2);align-items:center">
            ${vencidas > 0 ? `<span class="badge badge-danger">⚠ ${vencidas} vencida${vencidas>1?'s':''}</span>` : ''}
            <span class="badge ${c.status==='quitado'?'badge-success':'badge-warning'}">${c.status==='quitado'?'Quitado':'Ativo'}</span>
          </div>
        </div>
        <div class="cred-card-body">
          <div class="cred-progress-wrap">
            <div class="cred-progress-label">
              <span>${pagas}/${parcelas.length} pagamentos realizados</span>
              <span>${pct}%</span>
            </div>
            <div class="cred-progress-bar">
              <div class="cred-progress-fill" style="width:${pct}%"></div>
            </div>
          </div>
          <div class="cred-valores">
            <div class="cred-valor-item">
              <span class="cred-valor-label">Total</span>
              <span class="cred-valor-num">${Format.currency(c.valor_total)}</span>
            </div>
            <div class="cred-valor-item">
              <span class="cred-valor-label">Pago</span>
              <span class="cred-valor-num success">${Format.currency(valorPago)}</span>
            </div>
            <div class="cred-valor-item">
              <span class="cred-valor-label">Pendente</span>
              <span class="cred-valor-num ${vencidas>0?'danger':''}">${Format.currency(valorPend)}</span>
            </div>
          </div>
        </div>
        <div class="cred-card-footer" style="display:flex; justify-content:space-between; align-items:center">
          <button class="btn btn-primary btn-sm" onclick="verParcelas(${c.id})">
            Ver Parcelas →
          </button>
          
          ${Auth.isMaster() && c.status !== 'cancelado' ? `
            <button class="btn-table danger" onclick="confirmarCancelarCrediario(${c.id}, '${c.clientes?.nome?.replace(/'/g, "\\'")}')" title="Cancelar este crediário">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function carregarBandeirasCrediario() {
  if (!window._supabase) return;
  const [b, t] = await Promise.all([
    window._supabase.from('bandeiras').select('id, nome').order('nome'),
    window._supabase.from('taxas_pagamento').select('*')
  ]);
  _bandeirasCred = b.data || [];
  _taxasCred     = t.data || [];
  
  const sel = document.getElementById('bandeiraParc');
  if (sel) {
    sel.innerHTML = _bandeirasCred.map(b => `<option value="${b.id}">${b.nome}</option>`).join('');
  }
}

function toggleBandeiraCred() {
  const forma = document.getElementById('formaParc').value;
  const group = document.getElementById('groupBandeiraParc');
  if (['credito','debito'].includes(forma)) {
    group.classList.remove('hidden');
  } else {
    group.classList.add('hidden');
  }
}

function verParcelas(credId) {
  _credAtual = _crediarios.find(c => c.id === credId);
  if (!_credAtual) return;

  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('tituloModalParc').textContent =
    `Parcelas — ${_credAtual.clientes?.nome || 'Cliente'}`;

  const parcelas = _credAtual.parcelas_crediario || [];
  document.getElementById('bodyParcelas').innerHTML = parcelas.map(p => {
    const vencida = p.status !== 'pago' && p.vencimento < hoje;
    return `
      <tr>
        <td>${p.numero}/${_credAtual.parcelas}</td>
        <td style="color:${vencida?'var(--color-danger)':'inherit'}">${Format.date(p.vencimento)}${vencida?' ⚠':''}</td>
        <td><strong>${Format.currency(p.valor)}</strong></td>
        <td><span class="badge ${p.status==='pago'?'badge-success':vencida?'badge-danger':'badge-warning'}">${p.status==='pago'?'Pago':vencida?'Vencida':'Pendente'}</span></td>
        <td>${p.data_pag ? Format.date(p.data_pag) : '—'}</td>
        <td>
          ${p.status !== 'pago' ? `
            <button class="btn-table success" onclick="abrirPagarParcela(${p.id}, ${p.valor}, ${credId})" title="Registrar pagamento">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
          ` : '<span style="color:var(--color-gray-300);font-size:12px">✓</span>'}
        </td>
      </tr>
    `;
  }).join('');

  abrirModal('modalParcelas');
}

function abrirPagarParcela(parcId, valor, credId) {
  document.getElementById('msgPagarParc').textContent =
    `Confirmar recebimento da parcela de ${Format.currency(valor)}?`;
  document.getElementById('valorPagoParc').value = valor.toFixed(2);
  document.getElementById('dataPagarParc').value = new Date().toISOString().split('T')[0];
  document.getElementById('btnConfirmarPagarParc').onclick = async () => {
    const valorPagoRaw = parseFloat(document.getElementById('valorPagoParc').value);
    const forma   = document.getElementById('formaParc').value;
    const dataPag = document.getElementById('dataPagarParc').value;
    const bandeiraId = parseInt(document.getElementById('bandeiraParc').value) || null;

    if (isNaN(valorPagoRaw) || valorPagoRaw <= 0) { Toast.error('Erro', 'Informe um valor válido.'); return; }

    const liberar = bloquearBtn('btnConfirmarPagarParc', 'Processando...');

    if (!window._supabase) {
      processarPagamentoCascataDemo(credId, valorPagoRaw, forma, dataPag);
      fecharModal('modalPagarParc');
      verParcelas(credId);
      atualizarKPIs();
      renderCrediarios();
      Toast.success('Pagamento registrado!'); 
      liberar();
      return;
    }

    try {
      // Confirmação para pagamento parcial
      if (valorPagoRaw < valor - 0.01) {
        const diferenca = valor - valorPagoRaw;
        const confirmar = confirm(`O valor pago (R$ ${valorPagoRaw.toFixed(2)}) é menor que o valor original da parcela (R$ ${valor.toFixed(2)}).\n\nO sistema registrará R$ ${valorPagoRaw.toFixed(2)} como pagos e criará uma nova parcela de R$ ${diferenca.toFixed(2)} pendente.\n\nDeseja continuar?`);
        if (!confirmar) {
          liberar();
          return;
        }
      }

      await processarPagamentoCascata(credId, valorPagoRaw, forma, dataPag, bandeiraId, _taxasCred);

      fecharModal('modalPagarParc');
      Toast.success('Pagamento processado com sucesso!');
      carregarCrediario();
      fecharModal('modalParcelas');
    } catch (err) {
      console.error(err);
      Toast.error('Erro no processamento', ErrorTranslator.translate(err.message));
    } finally {
      liberar();
    }
  };

  toggleBandeiraCred(); // Garante que o campo de bandeira comece correto
  abrirModal('modalPagarParc');
}

async function processarPagamentoCascata(credId, valorPagoTotal, forma, dataPag, bandeiraId, taxasList) {
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
      const tipoTaxa = forma === 'debito' ? 'debito' : 'credito_vista';
      const taxaObj = taxasList.find(t => 
        parseInt(t.bandeira_id) === bandeiraId && 
        t.tipo === tipoTaxa && 
        t.parcelas === 1
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
  const cred = _crediarios.find(c => c.id === credId);
  if (!cred || !cred.parcelas_crediario) return;

  let parcelas = cred.parcelas_crediario
    .filter(p => p.status !== 'pago')
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

      cred.parcelas_crediario.push({
        id: Date.now() + i,
        numero: parc.numero,
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

function confirmarCancelarCrediario(id, nome) {
  if (!confirm(`Deseja realmente CANCELAR o crediário de ${nome}?\n\nIsso removerá as parcelas do seu contas a receber.`)) return;
  cancelarCrediarioManual(id);
}

async function cancelarCrediarioManual(id) {
  if (!window._supabase) return;
  
  const liberar = bloquearBtn(null, 'Cancelando...');
  
  try {
    // 1. Cancela o contrato principal
    const { error: err1 } = await window._supabase
      .from('crediario')
      .update({ status: 'cancelado' })
      .eq('id', id);
      
    if (err1) throw err1;

    // 2. Cancela todas as parcelas
    const { error: err2 } = await window._supabase
      .from('parcelas_crediario')
      .update({ status: 'cancelado' })
      .eq('crediario_id', id);

    if (err2) throw err2;

    Toast.success('Sucesso', 'Crediário cancelado com sucesso.');
    carregarCrediario(); // Recarrega a lista
    
  } catch (err) {
    Toast.error('Erro ao cancelar', ErrorTranslator.translate(err.message));
  } finally {
    if (typeof liberar === 'function') liberar();
  }
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
