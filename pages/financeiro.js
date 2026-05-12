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
    const [vendasRes, despesasParcRes, despesasSimplesRes, saidasNaoComRes] = await Promise.all([
      window._supabase
        .from('vendas')
        .select('valor_total, valor_taxa, custo_total, lucro')
        .gte('created_at', inicioTS)
        .lte('created_at', fimTS)
        .eq('status', 'concluida'),
      window._supabase
        .from('parcelas_despesa')
        .select('valor')
        .eq('status', 'pago')
        .gte('data_pag', inicioData)
        .lte('data_pag', fimData),
      window._supabase
        .from('despesas')
        .select('valor')
        .eq('status', 'pago')
        .eq('parcelado', false)
        .gte('created_at', inicioTS)
        .lte('created_at', fimTS),
      window._supabase
        .from('saidas_nao_comerciais')
        .select('custo_total')
        .gte('data', inicioData)
        .lte('data', fimData)
    ]);

    const vendas    = vendasRes.data  || [];
    const despParc  = despesasParcRes.data || [];
    const despSimp  = despesasSimplesRes.data || [];
    const saidasNC  = saidasNaoComRes.data || [];

    const faturamento = vendas.reduce((s,v) => s + (v.valor_total||0), 0);
    const custoMerc   = vendas.reduce((s,v) => s + (v.custo_total||0), 0);
    const taxas       = vendas.reduce((s,v) => s + (v.valor_taxa||0), 0);
    
    // Soma todas as saídas operacionais
    const despesas = despParc.reduce((s,d) => s + (d.valor||0), 0)
                   + despSimp.reduce((s,d) => s + (d.valor||0), 0)
                   + saidasNC.reduce((s,d) => s + (d.custo_total||0), 0);
    const lucroOp     = faturamento - custoMerc - taxas - despesas;

    setText('kpiFaturamento', Format.currency(faturamento));
    setText('kpiDespesas',    Format.currency(despesas));
    setText('kpiTaxas',       Format.currency(taxas));
    setText('kpiCusto',       Format.currency(custoMerc));
    setText('kpiLucroOp',     Format.currency(lucroOp));

    renderResultado({ faturamento, custoMerc, taxas, despesas, lucroOp });
    renderDistribuicao(lucroOp);

    // Fluxo recente — últimas vendas + despesas sem filtro de período
    const { data: vendasRec } = await window._supabase
      .from('vendas')
      .select('created_at, valor_total, clientes(nome)')
      .eq('status', 'concluida')
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: despRec } = await window._supabase
      .from('despesas')
      .select('created_at, descricao, valor')
      .order('created_at', { ascending: false })
      .limit(5);

    const fluxo = [
      ...(vendasRec||[]).map(v => ({ data:v.created_at, descricao:`Venda — ${v.clientes?.nome||'Cliente'}`, tipo:'entrada', valor:v.valor_total })),
      ...(despRec||[]).map(d => ({ data:d.created_at, descricao:d.descricao, tipo:'saida', valor:d.valor })),
    ].sort((a,b) => new Date(b.data) - new Date(a.data)).slice(0,15);

    renderFluxo(fluxo);
  } catch(e) { console.error('Erro financeiro:', e); }
}

function renderResultado(d) {
  setText('kpiFaturamento', Format.currency(d.faturamento));
  setText('kpiDespesas',    Format.currency(d.despesas));
  setText('kpiTaxas',       Format.currency(d.taxas));
  setText('kpiCusto',       Format.currency(d.custoMerc));
  setText('kpiLucroOp',     Format.currency(d.lucroOp));

  document.getElementById('resultadoLista').innerHTML = `
    <div class="resultado-row entrada"><span>💰 Faturamento Bruto</span><strong>${Format.currency(d.faturamento)}</strong></div>
    <div class="resultado-row saida"><span>📦 Custo das Mercadorias</span><strong>— ${Format.currency(d.custoMerc)}</strong></div>
    <div class="resultado-row saida"><span>🏦 Taxas Maquininha</span><strong>— ${Format.currency(d.taxas)}</strong></div>
    <div class="resultado-row saida"><span>💸 Despesas Operacionais</span><strong>— ${Format.currency(d.despesas)}</strong></div>
    <div class="resultado-row destaque"><span>📈 Lucro Operacional</span><strong>${Format.currency(d.lucroOp)}</strong></div>
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

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
