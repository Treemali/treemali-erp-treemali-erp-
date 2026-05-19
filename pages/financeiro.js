/**
 * TREEMALI ERP — Financeiro (visão geral)
 */

document.addEventListener('DOMContentLoaded', () => {
  carregarFinanceiro();
});

function onChangePeriodo() {
  const val = document.getElementById('filtroPeriodo').value;
  const customEl = document.getElementById('filtroDatasCustom');
  if (val === 'personalizado') {
    customEl.style.display = 'flex';
  } else {
    customEl.style.display = 'none';
    carregarFinanceiro();
  }
}

async function carregarFinanceiro() {
  const periodo = document.getElementById('filtroPeriodo').value;
  const { inicioTS, fimTS, inicioData, fimData } = getPeriodo(periodo);

  if (!window._supabase) {
    renderResultado({ faturamento:24750, custoMerc:9800, taxas:620, despesas:3200, lucroOp:11130 });
    renderDistribuicao(11130);
    renderFluxo([
      { data: new Date(), descricao:'Venda — Ana Silva',  tipo:'entrada', valor:320  },
      { data: new Date(), descricao:'Aluguel Maio',       tipo:'saida',   valor:1200 },
      { data: new Date(), descricao:'Venda — Pedro Souza',tipo:'entrada', valor:185.50 },
      { data: new Date(), descricao:'Energia Elétrica',   tipo:'saida',   valor:280  },
    ]);
    return;
  }

  try {
    const [vendasRes, despesasParcRes, despesasSimplesRes, saidasNaoComRes, parcelasCrediarioRes] = await Promise.all([
      window._supabase
        .from('vendas')
        .select('valor_total, valor_taxa, custo_total, lucro, forma_pagamento')
        .gte('created_at', inicioTS)
        .lte('created_at', fimTS)
        .eq('status', 'concluida'),
      window._supabase
        .from('parcelas_despesa')
        .select('valor, despesas(categoria, parcelado)')
        .eq('status', 'pago')
        .gte('data_pag', inicioData)
        .lte('data_pag', fimData),
      window._supabase
        .from('despesas')
        .select('valor, categoria')
        .eq('status', 'pago')
        .eq('parcelado', false)
        .gte('created_at', inicioTS)
        .lte('created_at', fimTS),
      window._supabase
        .from('saidas_nao_comerciais')
        .select('custo_total, data, lancou_despesa')
        .gte('data', inicioData)
        .lte('data', fimData),
      window._supabase
        .from('parcelas_crediario')
        .select('valor, valor_taxa')
        .eq('status', 'pago')
        .gte('data_pag', inicioData)
        .lte('data_pag', fimData)
    ]);

    const vendas    = vendasRes.data  || [];
    const despParc  = despesasParcRes.data || [];
    const despSimp  = despesasSimplesRes.data || [];
    const saidasNC  = saidasNaoComRes.data || [];
    const parcCred  = parcelasCrediarioRes.data || [];

    // 1. Faturamento (Competência — tudo o que foi vendido)
    const faturamento = vendas.reduce((s,v) => s + (v.valor_total||0), 0);
    const custoMerc   = vendas.reduce((s,v) => s + (v.custo_total||0), 0);

    // 2. Entradas Reais (Caixa — o que entrou de fato)
    // Filtramos apenas o que não é crediário (ou seja: Dinheiro, Pix, Cartão)
    const entradasVendasReais = vendas
      .filter(v => v.forma_pagamento !== 'crediario')
      .reduce((s,v) => s + (v.valor_total || 0), 0);
      
    const entradasParcelas = parcCred.reduce((s,p) => s + (p.valor || 0), 0);
    const entradasReais    = entradasVendasReais + entradasParcelas;
    
    // Soma as taxas das vendas à vista + parcelas pagas do crediário
    const taxasVendas = vendas.reduce((s,v) => s + (v.valor_taxa||0), 0);
    const taxasCred   = parcCred.reduce((s,t) => s + (t.valor_taxa||0), 0);
    const taxas       = taxasVendas + taxasCred;
    
    // Filtra saídas operacionais para evitar duplicidade e duplo abatimento do Custo
    // 1. Despesas parceladas: ignora categoria 'Fornecedor' e garante que a despesa pai é parcelada
    const despParcFiltered = despParc.filter(d => 
      d.despesas?.categoria !== 'Fornecedor' && 
      d.despesas?.parcelado === true
    );
    
    // 2. Despesas simples: ignora categoria 'Fornecedor'
    const despSimpFiltered = despSimp.filter(d => d.categoria !== 'Fornecedor');
    
    // 3. Saídas não comerciais: ignora o que já gerou despesa e as saídas financeiras (Dízimo, Pró-labore, etc)
    const saidasNCFiltered = saidasNC.filter(d => 
      !d.lancou_despesa && 
      !['dizimo', 'pro_labore', 'reserva_caixa', 'sangria'].includes(d.categoria)
    );

    const despesas = despParcFiltered.reduce((s,d) => s + (d.valor||0), 0)
                   + despSimpFiltered.reduce((s,d) => s + (d.valor||0), 0)
                   + saidasNCFiltered
                      .filter(s => s.lancou_despesa === false) // Só soma aqui se NÃO foi para a tabela de despesas
                      .reduce((s,d) => s + (d.custo_total||0), 0);
                   
    const lucroOp     = faturamento - custoMerc - taxas - despesas;
    const saldoCaixa  = entradasReais - despesas - taxas - custoMerc; // Lucro Real no Bolso (já descontando o que custou o produto)

    setText('kpiFaturamento', Format.currency(faturamento));
    setText('kpiEntradas',    Format.currency(entradasReais));
    setText('kpiDespesas',    Format.currency(despesas));
    setText('kpiTaxas',       Format.currency(taxas));
    setText('kpiCusto',       Format.currency(custoMerc));

    renderResultado({ faturamento, entradasReais, custoMerc, taxas, despesas, lucroOp, saldoCaixa });
    renderDistribuicao(saldoCaixa);
    carregarPrevisao();

    // Fluxo recente — últimas vendas + despesas sem filtro de período
    const { data: vendasRec } = await window._supabase
      .from('vendas')
      .select('created_at, valor_total, clientes(nome)')
      .eq('status', 'concluida')
      .order('created_at', { ascending: false })
      .limit(30);

    const { data: despRec } = await window._supabase
      .from('despesas')
      .select('created_at, descricao, valor')
      .eq('status', 'pago')
      .order('created_at', { ascending: false })
      .limit(30);

    const fluxo = [
      ...(vendasRec||[]).map(v => ({ data:v.created_at, descricao:`Venda — ${v.clientes?.nome||'Cliente'}`, tipo:'entrada', valor:v.valor_total })),
      ...(despRec||[]).map(d => ({ data:d.created_at, descricao:d.descricao, tipo:'saida', valor:d.valor })),
    ].sort((a,b) => new Date(b.data) - new Date(a.data)).slice(0,15);

    renderFluxo(fluxo);
  } catch(e) { console.error('Erro financeiro:', e); }
}

function renderResultado(d) {
  document.getElementById('resultadoLista').innerHTML = `
    <div class="resultado-row neutro"><span>📈 Faturamento (Vendas)</span><strong>${Format.currency(d.faturamento)}</strong></div>
    <div class="resultado-row entrada" style="background:var(--color-info-light);color:var(--color-info)"><span>🏧 Entradas (Caixa Real)</span><strong>${Format.currency(d.entradasReais)}</strong></div>
    <div class="resultado-row saida"><span>📦 Custo das Mercadorias</span><strong>— ${Format.currency(d.custoMerc)}</strong></div>
    <div class="resultado-row saida"><span>🏦 Taxas Maquininha</span><strong>— ${Format.currency(d.taxas)}</strong></div>
    <div class="resultado-row saida"><span>💸 Despesas Operacionais</span><strong>— ${Format.currency(d.despesas)}</strong></div>
    <div class="resultado-row destaque" style="background:var(--color-success-light);color:var(--color-success);border-color:var(--color-success)"><span>💰 Saldo Líquido (Caixa)</span><strong>${Format.currency(d.saldoCaixa)}</strong></div>
  `;
}

async function renderDistribuicao(lucroOp) {
  let pct = { proLabore:20, dizimo:10, reserva:30 };

  if (window._supabase) {
    const { data } = await window._supabase
      .from('configuracoes').select('chave, valor')
      .in('chave', ['pro_labore_pct','dizimo_pct','reserva_caixa_pct']);
    (data||[]).forEach(c => {
      if (c.chave==='pro_labore_pct')    pct.proLabore = parseFloat(c.valor);
      if (c.chave==='dizimo_pct')        pct.dizimo    = parseFloat(c.valor);
      if (c.chave==='reserva_caixa_pct') pct.reserva   = parseFloat(c.valor);
    });
  }

  const valorPL  = lucroOp * (pct.proLabore / 100);
  const valorDiz = lucroOp * (pct.dizimo    / 100);
  const valorRes = lucroOp * (pct.reserva   / 100);
  const valorLiq = lucroOp - valorPL - valorDiz - valorRes;
  const total    = Math.max(lucroOp, 1);

  const items = [
    { label:`Pró-labore (${pct.proLabore}%)`,     valor:valorPL,  cor:'var(--color-taupe)',   pct: valorPL/total*100  },
    { label:`Dízimo (${pct.dizimo}%)`,             valor:valorDiz, cor:'var(--color-info)',    pct: valorDiz/total*100 },
    { label:`Reserva de Caixa (${pct.reserva}%)`,  valor:valorRes, cor:'var(--color-warning)', pct: valorRes/total*100 },
    { label:'💰 Lucro Líquido',                    valor:valorLiq, cor:'var(--color-success)', pct: valorLiq/total*100 },
  ];

  document.getElementById('distribuicaoLista').innerHTML = items.map(i => `
    <div class="dist-row">
      <span class="dist-label">${i.label}</span>
      <div class="dist-bar-wrap"><div class="dist-bar" style="width:${Math.max(0,i.pct)}%;background:${i.cor}"></div></div>
      <span class="dist-valor">${Format.currency(i.valor)}</span>
    </div>
  `).join('');
}

function renderFluxo(lista) {
  const tbody = document.getElementById('bodyFluxo');
  if (!lista.length) { tbody.innerHTML = '<tr><td colspan="4" class="table-loading">Sem movimentações no período</td></tr>'; return; }
  tbody.innerHTML = lista.map(f => `
    <tr>
      <td>${Format.date(f.data)}</td>
      <td>${f.descricao}</td>
      <td><span class="badge ${f.tipo==='entrada'?'badge-success':'badge-danger'}">${f.tipo==='entrada'?'Entrada':'Saída'}</span></td>
      <td style="font-weight:500;color:${f.tipo==='entrada'?'var(--color-success)':'var(--color-danger)'}">${f.tipo==='entrada'?'+':'—'} ${Format.currency(f.valor)}</td>
    </tr>
  `).join('');
}

function getPeriodo(periodo) {
  const agora = new Date();
  const y = agora.getFullYear();
  const m = agora.getMonth();
  
  let inicioData, fimData;
  const hoje = new Date().toISOString().split('T')[0];

  if (periodo === 'hoje') {
    inicioData = hoje;
    fimData = hoje;
  } else if (periodo === 'semana') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    inicioData = d.toISOString().split('T')[0];
    fimData = hoje;
  } else if (periodo === 'mes') {
    inicioData = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    fimData = hoje;
  } else if (periodo === 'mes_passado') {
    const d = new Date(y, m - 1, 1);
    const dFim = new Date(y, m, 0);
    inicioData = d.toISOString().split('T')[0];
    fimData    = dFim.toISOString().split('T')[0];
  } else if (periodo === 'ano') {
    inicioData = `${y}-01-01`;
    fimData = hoje;
  } else if (periodo === 'personalizado') {
    inicioData = document.getElementById('filtroDataInicio').value || hoje;
    fimData    = document.getElementById('filtroDataFim').value || hoje;
  } else {
    inicioData = `${y}-01-01`;
    fimData = hoje;
  }

  // Para queries com timestamp (ISO para created_at) e data string (YYYY-MM-DD para data_pag)
  const inicioTS = `${inicioData}T00:00:00Z`;
  const fimTS    = `${fimData}T23:59:59Z`;

  return { inicioTS, fimTS, inicioData, fimData };
}

async function carregarPrevisao() {
  if (!window._supabase) return;

  try {
    const hojeStr = new Date().toISOString().split('T')[0];
    const daqui30Dias = new Date();
    daqui30Dias.setDate(daqui30Dias.getDate() + 30);
    const daqui30DiasStr = daqui30Dias.toISOString().split('T')[0];

    // 1. SALDO ATUAL (Lógica exata do dashboard para bater o valor)
    const [vendasSaldoRes, despParcTotalRes, despSimpTotalRes, saidasTotalRes, ajustesTotalRes, pTotalRes] = await Promise.all([
      window._supabase.from('vendas').select('valor_liquido, forma_pagamento').eq('status','concluida'),
      window._supabase.from('parcelas_despesa').select('valor, despesas(parcelado)').eq('status','pago'),
      window._supabase.from('despesas').select('valor').eq('status','pago').eq('parcelado',false),
      window._supabase.from('saidas_nao_comerciais').select('custo_total, categoria'),
      window._supabase.from('ajustes_caixa').select('valor'),
      window._supabase.from('parcelas_crediario').select('valor, valor_liquido').eq('status','pago')
    ]);

    // 2. BUSCA O QUE VAI VENCER EM 30 DIAS (Com filtro de venda cancelada)
    const [credFutureRes, despParcFutureRes, despSimpFutureRes] = await Promise.all([
      window._supabase.from('parcelas_crediario').select('valor, crediario(vendas(status))').eq('status','pendente').gte('vencimento', hojeStr).lte('vencimento', daqui30DiasStr),
      window._supabase.from('parcelas_despesa').select('valor').eq('status','pendente').gte('vencimento', hojeStr).lte('vencimento', daqui30DiasStr),
      window._supabase.from('despesas').select('valor').eq('status','pendente').eq('parcelado',false).gte('vencimento', hojeStr).lte('vencimento', daqui30DiasStr)
    ]);
    
    // Filtra parcelas de vendas que NÃO foram canceladas
    const credFuture = (credFutureRes.data || []).filter(p => p.crediario?.vendas?.status !== 'cancelada');
    const despParcFuture = despParcFutureRes.data || [];
    const despSimpFuture = despSimpFutureRes.data || [];

    // Cálculo do Saldo Hoje (Idêntico ao Dashboard)
    const vTotal = (vendasSaldoRes.data||[]).filter(v => v.forma_pagamento !== 'crediario').reduce((s,v) => s+(v.valor_liquido||0), 0);
    const pTotal = pTotalRes.data || [];
    // No Dashboard, o saldo total de crediário usa o valor bruto (p.valor) como critério principal
    const entradasTotal = vTotal + pTotal.reduce((s,p) => s+(p.valor || 0), 0);
    
    const sTotal = (despParcTotalRes.data||[]).filter(d => d.despesas?.parcelado === true).reduce((s,d) => s+(d.valor||0), 0)
                 + (despSimpTotalRes.data||[]).reduce((s,d) => s+(d.valor||0), 0)
                 + (saidasTotalRes.data||[]).filter(d => ['dizimo', 'pro_labore', 'reserva_caixa', 'sangria'].includes(d.categoria)).reduce((s,d) => s+(d.custo_total||0), 0);
    const aTotal = (ajustesTotalRes.data||[]).reduce((s,a) => s+(a.valor||0), 0);
    
    const saldoHoje = entradasTotal - sTotal + aTotal;

    // Cálculo do Futuro
    const entradasFuturas = credFuture.reduce((s,p) => s + (p.valor||0), 0);
    const saidasFuturas   = despParcFuture.reduce((s,d) => s + (d.valor||0), 0) + despSimpFuture.reduce((s,d) => s + (d.valor||0), 0);
    const saldoProjetado  = saldoHoje + entradasFuturas - saidasFuturas;

    // Renderiza
    const container = document.getElementById('previsaoContainer');
    if (container) container.style.display = 'grid';
    
    setText('prevSaldoHoje', Format.currency(saldoHoje));
    setText('prevEntradas',  `+ ${Format.currency(entradasFuturas)}`);
    setText('prevSaidas',    `— ${Format.currency(saidasFuturas)}`);
    setText('prevTotal',     Format.currency(saldoProjetado));

  } catch(e) { console.error('Erro na previsão:', e); }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ══════════════════════════════════════════════
// AJUSTE DE CAIXA
// ══════════════════════════════════════════════

function abrirModalAjuste() {
  document.getElementById('ajusteValor').value = '';
  document.getElementById('erroAjuste').classList.add('hidden');
  abrirModal('modalAjuste');
}

async function salvarAjusteCaixa() {
  const valor  = parseFloat(document.getElementById('ajusteValor').value);
  const erroEl = document.getElementById('erroAjuste');
  const btn    = document.getElementById('btnSalvarAjuste');

  if (!valor || isNaN(valor)) { erroEl.textContent = 'Informe um valor válido.'; erroEl.classList.remove('hidden'); return; }
  erroEl.classList.add('hidden');

  btn.disabled = true;
  btn.textContent = 'Salvando...';

  if (!window._supabase) {
    Toast.success('Ajuste Salvo!', 'Saldo atualizado (Modo Demo).');
    fecharModal('modalAjuste');
    btn.disabled = false;
    btn.textContent = 'Confirmar Ajuste';
    return;
  }

  const { error } = await window._supabase.from('ajustes_caixa').insert({
    valor: valor,
    data: new Date().toISOString()
  });

  if (error) {
    erroEl.textContent = 'Erro ao salvar: ' + error.message;
    erroEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Confirmar Ajuste';
  } else {
    fecharModal('modalAjuste');
    Toast.success('Saldo Ajustado!', 'O ajuste foi aplicado ao saldo total.');
    btn.disabled = false;
    btn.textContent = 'Confirmar Ajuste';
    carregarFinanceiro(); // Atualiza a tela na hora
  }
}

// ══════════════════════════════════════════════
// HELPERS MODAL
// ══════════════════════════════════════════════

function abrirModal(id)  { document.getElementById(id)?.classList.add('active'); document.body.style.overflow = 'hidden'; }
function fecharModal(id) { document.getElementById(id)?.classList.remove('active'); document.body.style.overflow = ''; }

document.addEventListener('click', e => { 
  if (e.target.classList.contains('modal-overlay')) fecharModal(e.target.id); 
});


