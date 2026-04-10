/**
 * TREEMALI ERP — Crediário
 */

let _crediarios = [];
let _credAtual  = null;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('searchCrediario')
    .addEventListener('input', () => renderCrediarios());
  carregarCrediario();
});

async function carregarCrediario() {
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
    const status = document.getElementById('filtroStatusCred').value;
    let q = window._supabase
      .from('crediario')
      .select('*, clientes(nome, telefone), parcelas_crediario(*)')
      .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data } = await q;
    _crediarios = data || [];
  }

  atualizarKPIs();
  renderCrediarios();
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
    const pct       = Math.round((pagas / parcelas.length) * 100) || 0;

    return `
      <div class="cred-card ${vencidas > 0 ? 'has-vencida' : ''} ${c.status === 'quitado' ? 'quitado' : ''}" style="animation-delay:${idx*0.04}s">
        <div class="cred-card-header">
          <div>
            <div class="cred-cliente">👤 ${c.clientes?.nome || '—'}</div>
            <div class="cred-meta">
              Desde ${Format.date(c.created_at)} · ${parcelas.length}x de ${Format.currency(c.valor_total / parcelas.length)}
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
              <span>${pagas}/${parcelas.length} parcelas pagas</span>
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
        <div class="cred-card-footer">
          <button class="btn btn-primary btn-sm" onclick="verParcelas(${c.id})">
            Ver Parcelas →
          </button>
        </div>
      </div>
    `;
  }).join('');
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
        <td>${p.numero}/${parcelas.length}</td>
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

  document.getElementById('msgPagarParc').textContent =
    `Confirmar recebimento da parcela de ${Format.currency(valor)}?`;
  document.getElementById('valorPagoParc').value = valor.toFixed(2);
  document.getElementById('dataPagarParc').value = new Date().toISOString().split('T')[0];

  document.getElementById('btnConfirmarPagarParc').onclick = async () => {
    const valorPagoRaw = parseFloat(document.getElementById('valorPagoParc').value);
    const forma   = document.getElementById('formaParc').value;
    const dataPag = document.getElementById('dataPagarParc').value;

    if (isNaN(valorPagoRaw) || valorPagoRaw <= 0) { Toast.error('Erro', 'Informe um valor válido.'); return; }

    if (!window._supabase) {
      // Demo logic
      const cred = _crediarios.find(c => c.id === credId);
      const parc = cred?.parcelas_crediario?.find(p => p.id === parcId);
      if (parc) { parc.status = 'pago'; parc.data_pag = dataPag; parc.valor = valorPagoRaw; }
      fecharModal('modalPagarParc'); verParcelas(credId); atualizarKPIs(); renderCrediarios(); Toast.success('Pagamento registrado!'); return;
    }

    try {
      let restante = valorPagoRaw;

      // 1. Busca todas as parcelas pendentes deste crediário
      const { data: pendentes } = await window._supabase
        .from('parcelas_crediario')
        .select('*')
        .eq('crediario_id', credId)
        .or('status.eq.pendente,status.eq.vencido')
        .order('numero');

      if (!pendentes || pendentes.length === 0) throw new Error('Nenhuma parcela pendente.');

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
              valor:           parseFloat(valorEfetivo.toFixed(2))
            }).eq('id', p.id);

            restante -= p.valor;
          } else {
            // Pagamento parcial: reduz o valor da parcela futura
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

      fecharModal('modalPagarParc');
      Toast.success('Pagamento processado com sucesso!');
      carregarCrediario();
      fecharModal('modalParcelas');

    } catch (err) {
      Toast.error('Erro', err.message);
    }
  };

  abrirModal('modalPagarParc');
}

function abrirModal(id){ document.getElementById(id).classList.add('active'); document.body.style.overflow='hidden'; }
function fecharModal(id){ document.getElementById(id).classList.remove('active'); document.body.style.overflow=''; }
function setText(id,t){ const el=document.getElementById(id); if(el) el.textContent=t; }
document.addEventListener('click',e=>{ if(e.target.classList.contains('modal-overlay')) fecharModal(e.target.id); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') document.querySelectorAll('.modal-overlay.active').forEach(m=>fecharModal(m.id)); });
