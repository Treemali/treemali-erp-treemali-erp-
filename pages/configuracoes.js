/**
 * TREEMALI ERP — Configurações
 * Minha conta, regras financeiras, taxas da maquininha, categorias
 */

let _bandeiras  = [];
let _taxas      = [];
let _categorias = [];

// ══════════════════════════════════════════════
// INICIALIZAÇÃO
// ══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

  // Abas — carrega log de preços ao abrir aba senha-rapida
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'senha-rapida') carregarLogPrecos();
    });
  });

  // Preview distribuição ao digitar
  ['cfgProLabore','cfgDizimo','cfgReserva'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', atualizarPreviewDist);
  });

  // Carregar dados
  carregarConta();
  carregarRegrasFinanceiras();
  carregarBandeiras();
  carregarCategorias();
});

// ══════════════════════════════════════════════
// MINHA CONTA
// ══════════════════════════════════════════════

function carregarConta() {
  const user = Auth.getUser();
  if (!user) return;
  document.getElementById('contaNome').value  = user.nome  || '';
  document.getElementById('contaLogin').value = user.login || '';
}

async function salvarConta() {
  const nome      = document.getElementById('contaNome').value.trim();
  const login     = document.getElementById('contaLogin').value.trim();
  const senhaNova = document.getElementById('contaSenhaNova').value;
  const senhaConf = document.getElementById('contaSenhaConf').value;

  esconderErro('erroConta');

  if (!nome)  { mostrarErro('erroConta', 'O nome é obrigatório.'); return; }
  if (!login) { mostrarErro('erroConta', 'O login é obrigatório.'); return; }
  if (senhaNova && senhaNova !== senhaConf) {
    mostrarErro('erroConta', 'As senhas não coincidem.'); return;
  }

  const user   = Auth.getUser();
  const dados  = { nome, login };
  if (senhaNova) dados.senha_hash = btoa(senhaNova);

  if (!window._supabase) {
    // Demo — atualiza sessão local
    Auth.saveSession({ ...user, nome, login });
    document.getElementById('contaSenhaNova').value = '';
    document.getElementById('contaSenhaConf').value = '';
    Toast.success('Dados atualizados com sucesso!');
    return;
  }

  const { error } = await window._supabase
    .from('usuarios').update(dados).eq('id', user.id);

  if (error) { mostrarErro('erroConta', error.message); return; }

  // Atualiza sessão local
  Auth.saveSession({ ...user, nome, login });
  document.getElementById('contaSenhaNova').value = '';
  document.getElementById('contaSenhaConf').value = '';
  Toast.success('Dados atualizados com sucesso!');
}

// ══════════════════════════════════════════════
// REGRAS FINANCEIRAS
// ══════════════════════════════════════════════

async function carregarRegrasFinanceiras() {
  let cfg = { pro_labore_pct:'20', dizimo_pct:'10', reserva_caixa_pct:'30', estoque_alerta_dias:'2' };

  if (window._supabase) {
    const { data } = await window._supabase.from('configuracoes').select('*');
    (data||[]).forEach(c => { cfg[c.chave] = c.valor; });
  }

  setValue('cfgProLabore',   cfg.pro_labore_pct);
  setValue('cfgDizimo',      cfg.dizimo_pct);
  setValue('cfgReserva',     cfg.reserva_caixa_pct);
  setValue('cfgAlertaDias',  cfg.estoque_alerta_dias);
  atualizarPreviewDist();
}

// Lucro operacional real do mês — carregado uma vez e reutilizado
let _lucroRealMes = null;

async function carregarLucroRealMes() {
  if (_lucroRealMes !== null) return _lucroRealMes;

  if (!window._supabase) {
    // Demo: simula um lucro operacional realista
    _lucroRealMes = 8350.00;
    return _lucroRealMes;
  }

  try {
    const inicio = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const fim    = new Date().toISOString();

    const [vendasRes, despesasRes] = await Promise.all([
      window._supabase
        .from('vendas')
        .select('valor_total, valor_taxa, custo_total')
        .gte('created_at', inicio)
        .lte('created_at', fim),
      window._supabase
        .from('parcelas_despesa')
        .select('valor')
        .eq('status', 'pago')
        .gte('data_pag', inicio.split('T')[0])
        .lte('data_pag', fim.split('T')[0]),
    ]);

    const vendas    = vendasRes.data  || [];
    const despPagas = despesasRes.data || [];

    const faturamento = vendas.reduce((s, v) => s + (v.valor_total  || 0), 0);
    const custoMerc   = vendas.reduce((s, v) => s + (v.custo_total  || 0), 0);
    const taxas       = vendas.reduce((s, v) => s + (v.valor_taxa   || 0), 0);
    const despesas    = despPagas.reduce((s, d) => s + (d.valor     || 0), 0);

    _lucroRealMes = faturamento - custoMerc - taxas - despesas;
  } catch {
    _lucroRealMes = 0;
  }

  return _lucroRealMes;
}

async function atualizarPreviewDist() {
  const lucro = await carregarLucroRealMes();
  const pl    = parseFloat(document.getElementById('cfgProLabore').value) || 0;
  const diz   = parseFloat(document.getElementById('cfgDizimo').value)    || 0;
  const res   = parseFloat(document.getElementById('cfgReserva').value)   || 0;
  const total = pl + diz + res;
  const liq   = 100 - total;

  const vPl  = lucro * pl  / 100;
  const vDiz = lucro * diz / 100;
  const vRes = lucro * res / 100;
  const vLiq = lucro * liq / 100;

  // Atualiza o título do preview com o lucro real
  const tituloEl = document.getElementById('distPreviewTitle');
  if (tituloEl) {
    tituloEl.textContent = lucro > 0
      ? `Preview baseado no lucro operacional do mês: ${Format.currency(lucro)}`
      : `Preview (sem vendas registradas no mês)`;
  }

  document.getElementById('distPreviewItems').innerHTML = `
    <div class="dist-prev-row"><span>Faturamento Bruto</span><span style="color:var(--color-success)">${Format.currency(lucro)}</span></div>
    <div style="height:1px;background:var(--color-gray-200);margin:var(--space-2) 0"></div>
    <div class="dist-prev-row"><span>Pró-labore (${pl}%)</span><span>${Format.currency(vPl)}</span></div>
    <div class="dist-prev-row"><span>Dízimo (${diz}%)</span><span>${Format.currency(vDiz)}</span></div>
    <div class="dist-prev-row"><span>Reserva de Caixa (${res}%)</span><span>${Format.currency(vRes)}</span></div>
    <div class="dist-prev-row destaque"><span>💰 Lucro Líquido (${liq >= 0 ? liq : 0}%)</span><span>${Format.currency(Math.max(0, vLiq))}</span></div>
    ${total > 100 ? `<div style="color:var(--color-danger);font-size:var(--text-xs);margin-top:var(--space-2)">⚠ A soma dos percentuais ultrapassa 100%!</div>` : ''}
  `;
}

async function salvarRegrasFinanceiras() {
  const pl  = document.getElementById('cfgProLabore').value;
  const diz = document.getElementById('cfgDizimo').value;
  const res = document.getElementById('cfgReserva').value;

  esconderErro('erroFinanceiro');

  if ((parseFloat(pl)+parseFloat(diz)+parseFloat(res)) > 100) {
    mostrarErro('erroFinanceiro', 'A soma dos percentuais não pode ultrapassar 100%.'); return;
  }

  if (!window._supabase) {
    Toast.success('Regras salvas!');
    return;
  }

  const updates = [
    { chave:'pro_labore_pct',    valor: pl  },
    { chave:'dizimo_pct',        valor: diz },
    { chave:'reserva_caixa_pct', valor: res },
  ];

  for (const u of updates) {
    await window._supabase.from('configuracoes')
      .upsert({ chave: u.chave, valor: u.valor }, { onConflict: 'chave' });
  }

  Toast.success('Regras financeiras salvas com sucesso!');
}

async function salvarAlertaDias() {
  const dias = document.getElementById('cfgAlertaDias').value;
  if (!dias || parseInt(dias) < 1) { Toast.warning('Informe um número válido de dias.'); return; }

  if (!window._supabase) { Toast.success('Configuração salva!'); return; }

  await window._supabase.from('configuracoes')
    .upsert({ chave:'estoque_alerta_dias', valor: dias }, { onConflict: 'chave' });

  Toast.success('Configuração de alerta salva!');
}

// ══════════════════════════════════════════════
// TAXAS DA MAQUININHA
// ══════════════════════════════════════════════

async function carregarBandeiras() {
  if (!window._supabase) {
    _bandeiras = [
      { id:1, nome:'Visa / Mastercard' },
      { id:2, nome:'Elo / Amex'        },
    ];
  } else {
    const { data } = await window._supabase.from('bandeiras').select('*').order('nome');
    _bandeiras = data || [];
  }

  const sel  = document.getElementById('seletorBandeira');
  const opts = _bandeiras.map(b => `<option value="${b.id}">${b.nome}</option>`).join('');
  sel.innerHTML = '<option value="">Selecione a bandeira...</option>' + opts;
}

async function carregarTaxasBandeira() {
  const bandeiraId = parseInt(document.getElementById('seletorBandeira').value);
  const container  = document.getElementById('taxasContainer');

  if (!bandeiraId) {
    container.innerHTML = '<div style="color:var(--color-gray-400);font-size:var(--text-sm)">Selecione uma bandeira.</div>';
    return;
  }

  if (!window._supabase) {
    _taxas = [
      { id:1,  bandeira_id:1, tipo:'pix',               parcelas:1,  taxa:0.00  },
      { id:2,  bandeira_id:1, tipo:'debito',             parcelas:1,  taxa:1.37  },
      { id:3,  bandeira_id:1, tipo:'credito_vista',      parcelas:1,  taxa:3.15  },
      { id:4,  bandeira_id:1, tipo:'credito_parcelado',  parcelas:2,  taxa:5.39  },
      { id:5,  bandeira_id:1, tipo:'credito_parcelado',  parcelas:3,  taxa:6.12  },
      { id:6,  bandeira_id:1, tipo:'credito_parcelado',  parcelas:4,  taxa:6.85  },
      { id:7,  bandeira_id:1, tipo:'credito_parcelado',  parcelas:5,  taxa:7.57  },
      { id:8,  bandeira_id:1, tipo:'credito_parcelado',  parcelas:6,  taxa:8.28  },
      { id:9,  bandeira_id:1, tipo:'credito_parcelado',  parcelas:7,  taxa:8.99  },
      { id:10, bandeira_id:1, tipo:'credito_parcelado',  parcelas:8,  taxa:9.69  },
      { id:11, bandeira_id:1, tipo:'credito_parcelado',  parcelas:9,  taxa:10.38 },
      { id:12, bandeira_id:1, tipo:'credito_parcelado',  parcelas:10, taxa:11.06 },
      { id:13, bandeira_id:1, tipo:'credito_parcelado',  parcelas:11, taxa:11.74 },
      { id:14, bandeira_id:1, tipo:'credito_parcelado',  parcelas:12, taxa:12.40 },
    ];
  } else {
    const { data } = await window._supabase
      .from('taxas_pagamento')
      .select('*')
      .eq('bandeira_id', bandeiraId)
      .order('tipo').order('parcelas');
    _taxas = data || [];
  }

  const taxasFiltradas = _taxas.filter(t => t.bandeira_id === bandeiraId);
  renderTaxas(taxasFiltradas, bandeiraId);
}

function renderTaxas(taxas, bandeiraId) {
  const container = document.getElementById('taxasContainer');

  const nomeBandeira = _bandeiras.find(b => b.id === bandeiraId)?.nome || '';

  const tiposFixos = [
    { tipo:'pix',           label:'PIX',             parcelas:1 },
    { tipo:'debito',        label:'Débito',           parcelas:1 },
    { tipo:'credito_vista', label:'Crédito à Vista',  parcelas:1 },
  ];

  const parcelasOpts = [2,3,4,5,6,7,8,9,10,11,12];

  const getTaxa = (tipo, parcelas) => {
    const t = taxas.find(x => x.tipo === tipo && x.parcelas === parcelas);
    return t ? t.taxa : 0;
  };

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span style="font-weight:500">${nomeBandeira}</span>
        <button class="btn btn-primary btn-sm" onclick="salvarTaxas(${bandeiraId})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Salvar Taxas
        </button>
      </div>
      <div class="card-body" style="padding:0">
        <table class="taxas-table">
          <thead><tr><th>Tipo</th><th>Taxa (%)</th></tr></thead>
          <tbody>
            ${tiposFixos.map(t => `
              <tr>
                <td>${t.label}</td>
                <td><input type="number" step="0.01" min="0" max="100"
                  id="taxa_${t.tipo}_${t.parcelas}"
                  value="${getTaxa(t.tipo, t.parcelas)}" /> %</td>
              </tr>
            `).join('')}
            <tr><td colspan="2" style="background:var(--color-gray-100);font-size:var(--text-xs);color:var(--color-gray-500);text-transform:uppercase;letter-spacing:0.05em;padding:var(--space-2) var(--space-4)">Crédito Parcelado</td></tr>
            ${parcelasOpts.map(p => `
              <tr>
                <td>${p}x</td>
                <td><input type="number" step="0.01" min="0" max="100"
                  id="taxa_credito_parcelado_${p}"
                  value="${getTaxa('credito_parcelado', p)}" /> %</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function salvarTaxas(bandeiraId) {
  const tiposFixos = [
    { tipo:'pix',           parcelas:1 },
    { tipo:'debito',        parcelas:1 },
    { tipo:'credito_vista', parcelas:1 },
  ];
  const parcelasOpts = [2,3,4,5,6,7,8,9,10,11,12];

  const toUpdate = [
    ...tiposFixos,
    ...parcelasOpts.map(p => ({ tipo:'credito_parcelado', parcelas:p })),
  ];

  if (!window._supabase) {
    Toast.success('Taxas salvas com sucesso!');
    return;
  }

  for (const t of toUpdate) {
    const el   = document.getElementById(`taxa_${t.tipo}_${t.parcelas}`);
    const taxa = parseFloat(el?.value) || 0;
    await window._supabase.from('taxas_pagamento').upsert({
      bandeira_id: bandeiraId,
      tipo:        t.tipo,
      parcelas:    t.parcelas,
      taxa,
    }, { onConflict: 'bandeira_id,tipo,parcelas' });
  }

  Toast.success('Taxas salvas com sucesso!', 'Novas vendas usarão as taxas atualizadas.');
}

function abrirNovaBandeira() {
  document.getElementById('nomeBandeira').value = '';
  esconderErro('erroBandeira');
  abrirModal('modalBandeira');
}

async function salvarBandeira() {
  const nome = document.getElementById('nomeBandeira').value.trim();
  if (!nome) { mostrarErro('erroBandeira', 'Informe o nome da bandeira.'); return; }

  if (!window._supabase) {
    _bandeiras.push({ id: Date.now(), nome });
    const opts = _bandeiras.map(b => `<option value="${b.id}">${b.nome}</option>`).join('');
    document.getElementById('seletorBandeira').innerHTML =
      '<option value="">Selecione a bandeira...</option>' + opts;
    fecharModal('modalBandeira');
    Toast.success('Bandeira criada!');
    return;
  }

  const { error } = await window._supabase.from('bandeiras').insert({ nome });
  if (error) { mostrarErro('erroBandeira', error.message); return; }
  fecharModal('modalBandeira');
  Toast.success('Bandeira criada com sucesso!');
  carregarBandeiras();
}

// ══════════════════════════════════════════════
// CATEGORIAS
// ══════════════════════════════════════════════

async function carregarCategorias() {
  if (!window._supabase) {
    _categorias = [
      {id:1,nome:'Camisetas'},{id:2,nome:'Calças'},{id:3,nome:'Vestidos'},
      {id:4,nome:'Blusas'},{id:5,nome:'Acessórios'},{id:6,nome:'Calçados'},{id:7,nome:'Outros'},
    ];
  } else {
    const { data } = await window._supabase.from('categorias').select('*').order('nome');
    _categorias = data || [];
  }
  renderCategorias();
}

function renderCategorias() {
  const grid = document.getElementById('categoriasGrid');
  if (!_categorias.length) {
    grid.innerHTML = '<div style="color:var(--color-gray-400);font-size:var(--text-sm)">Nenhuma categoria cadastrada.</div>';
    return;
  }
  grid.innerHTML = _categorias.map(c => `
    <div class="categoria-chip">
      📦 ${c.nome}
      <button class="btn-chip-edit" onclick="editarCategoria(${c.id})" title="Editar">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    </div>
  `).join('');
}

function abrirNovaCategoria() {
  document.getElementById('categoriaId').value = '';
  document.getElementById('nomeCategoria').value = '';
  document.getElementById('tituloModalCat').textContent = 'Nova Categoria';
  esconderErro('erroCategoria');
  abrirModal('modalCategoria');
}

function editarCategoria(id) {
  const c = _categorias.find(x => x.id === id);
  if (!c) return;
  document.getElementById('categoriaId').value = c.id;
  document.getElementById('nomeCategoria').value = c.nome;
  document.getElementById('tituloModalCat').textContent = 'Editar Categoria';
  esconderErro('erroCategoria');
  abrirModal('modalCategoria');
}

async function salvarCategoria() {
  const nome = document.getElementById('nomeCategoria').value.trim();
  const id   = document.getElementById('categoriaId').value;
  if (!nome) { mostrarErro('erroCategoria', 'Informe o nome da categoria.'); return; }

  if (!window._supabase) {
    if (id) {
      const i = _categorias.findIndex(x => x.id === Number(id));
      if (i >= 0) _categorias[i].nome = nome;
    } else {
      _categorias.push({ id: Date.now(), nome });
    }
    renderCategorias();
    fecharModal('modalCategoria');
    Toast.success('Categoria salva!');
    return;
  }

  let error;
  if (id) {
    ({ error } = await window._supabase.from('categorias').update({ nome }).eq('id', id));
  } else {
    ({ error } = await window._supabase.from('categorias').insert({ nome }));
  }

  if (error) { mostrarErro('erroCategoria', error.message); return; }
  fecharModal('modalCategoria');
  Toast.success('Categoria salva com sucesso!');
  carregarCategorias();
}

// ══════════════════════════════════════════════
// SENHA RÁPIDA
// ══════════════════════════════════════════════

let _senhaAtiva    = null;
let _timerInterval = null;

function gerarSenhaRapida() {
  const codigo   = String(Math.floor(100000 + Math.random() * 900000));
  const expiraEm = Date.now() + 5 * 60 * 1000;
  _senhaAtiva = { codigo, expiraEm, usada: false };
  localStorage.setItem('treemali_senha_rapida', JSON.stringify(_senhaAtiva));

  document.getElementById('senhaRapidaInicial').style.display = 'none';
  document.getElementById('senhaRapidaDisplay').style.display = 'block';
  document.getElementById('senhaRapidaAcoes').style.display   = 'flex';
  document.getElementById('senhaRapidaCodigo').textContent    = codigo;
  document.getElementById('senhaRapidaCodigo').style.opacity  = '1';
  document.getElementById('senhaRapidaStatus').textContent    = 'Aguardando uso...';
  document.getElementById('senhaRapidaStatus').className      = 'senha-rapida-status';

  if (_timerInterval) clearInterval(_timerInterval);
  atualizarTimer();
  _timerInterval = setInterval(atualizarTimer, 1000);
}

function atualizarTimer() {
  if (!_senhaAtiva) return;

  const salva = localStorage.getItem('treemali_senha_rapida');
  if (salva) {
    try {
      const dados = JSON.parse(salva);
      if (dados.usada) {
        clearInterval(_timerInterval);
        document.getElementById('senhaRapidaTimer').textContent = 'Código utilizado ✓';
        document.getElementById('senhaRapidaTimer').className   = 'senha-rapida-timer';
        document.getElementById('senhaRapidaStatus').textContent = '✅ Senha utilizada com sucesso!';
        document.getElementById('senhaRapidaStatus').className  = 'senha-rapida-status usada';
        document.getElementById('senhaRapidaCodigo').style.opacity = '0.4';
        return;
      }
    } catch {}
  }

  const restante = _senhaAtiva.expiraEm - Date.now();
  if (restante <= 0) {
    clearInterval(_timerInterval);
    localStorage.removeItem('treemali_senha_rapida');
    document.getElementById('senhaRapidaTimer').textContent = 'Expirada';
    document.getElementById('senhaRapidaTimer').className   = 'senha-rapida-timer urgente';
    document.getElementById('senhaRapidaStatus').textContent = '❌ Senha expirada. Gere uma nova.';
    document.getElementById('senhaRapidaStatus').className  = 'senha-rapida-status expirada';
    document.getElementById('senhaRapidaCodigo').style.opacity = '0.3';
    return;
  }

  const min = Math.floor(restante / 60000);
  const seg = Math.floor((restante % 60000) / 1000);
  document.getElementById('senhaRapidaTimer').textContent =
    `Válida por ${min}:${String(seg).padStart(2,'0')}`;
  document.getElementById('senhaRapidaTimer').className =
    restante < 60000 ? 'senha-rapida-timer urgente' : 'senha-rapida-timer';
}

function copiarSenhaRapida() {
  if (!_senhaAtiva) return;
  navigator.clipboard.writeText(_senhaAtiva.codigo).then(() =>
    Toast.success('Copiado!', `Código ${_senhaAtiva.codigo} copiado.`)
  );
}

function enviarSenhaWhatsApp() {
  if (!_senhaAtiva) return;
  const min = Math.max(1, Math.floor((_senhaAtiva.expiraEm - Date.now()) / 60000));
  const msg = encodeURIComponent(
    `🔑 *Autorização Treemali*\n\nCódigo: *${_senhaAtiva.codigo}*\n\nUso único — válido por ${min} minuto${min !== 1 ? 's' : ''}.\nDigite na tela de venda para autorizar alteração de preço.`
  );
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}

async function carregarLogPrecos() {
  if (!window._supabase) {
    document.getElementById('bodyLogPrecos').innerHTML =
      '<tr><td colspan="5" style="text-align:center;padding:var(--space-6);color:var(--color-gray-400);font-size:var(--text-sm)">Nenhuma alteração registrada</td></tr>';
    return;
  }
  const { data } = await window._supabase
    .from('log_alteracao_preco')
    .select('created_at, usuarios!log_alteracao_preco_vendedor_id_fkey(nome), produtos(nome), preco_padrao, preco_vendido')
    .order('created_at', { ascending: false })
    .limit(20);

  if (!data?.length) {
    document.getElementById('bodyLogPrecos').innerHTML =
      '<tr><td colspan="5" style="text-align:center;padding:var(--space-6);color:var(--color-gray-400);font-size:var(--text-sm)">Nenhuma alteração de preço registrada</td></tr>';
    return;
  }
  document.getElementById('bodyLogPrecos').innerHTML = data.map(l => `
    <tr>
      <td>${Format.datetime(l.created_at)}</td>
      <td>${l.usuarios?.nome || '—'}</td>
      <td>${l.produtos?.nome || '—'}</td>
      <td>${Format.currency(l.preco_padrao)}</td>
      <td style="color:var(--color-warning);font-weight:500">${Format.currency(l.preco_vendido)}</td>
    </tr>
  `).join('');
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

function abrirModal(id){ document.getElementById(id).classList.add('active'); document.body.style.overflow='hidden'; }
function fecharModal(id){ document.getElementById(id).classList.remove('active'); document.body.style.overflow=''; }
function mostrarErro(id,msg){ const el=document.getElementById(id); if(!el)return; el.textContent=msg; el.classList.remove('hidden'); }
function esconderErro(id){ const el=document.getElementById(id); if(el) el.classList.add('hidden'); }
function setValue(id,val){ const el=document.getElementById(id); if(el) el.value=val; }

document.addEventListener('click',e=>{ if(e.target.classList.contains('modal-overlay')) fecharModal(e.target.id); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') document.querySelectorAll('.modal-overlay.active').forEach(m=>fecharModal(m.id)); });
