/**
 * TREEMALI ERP — Financeiro (visão geral)
 */

document.addEventListener('DOMContentLoaded', () => {
  carregarFinanceiro();
});

async function carregarFinanceiro() {
  const periodo = document.getElementById('filtroPeriodo').value;
  const periodoResult = getPeriodo(periodo);
  if (!periodoResult) return; // personalizado sem datas preenchidas
  const { inicio, fim } = periodoResult;

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
    const inicioStr = inicio.split('T')[0];
    const fimStr    = fim.split('T')[0];

    const [vendasRes, despParcelasRes, despSimplesRes, saidasRes] = await Promise.all([
      window._supabase.from('vendas').select('valor_total, valor_taxa, valor_liquido, custo_total, bandeira_id, forma_pagamento').gte('created_at', inicio).lte('created_at', fim).eq('status', 'concluida'),
      // Despesas parceladas: só parcelas pagas no período
      window._supabase.from('parcelas_despesa').select('valor, data_pag').eq('status', 'pago'),
      // Despesas não parceladas: só pagas
      window._supabase.from('despesas').select('valor, data_lancamento, vencimento, created_at').eq('status', 'pago').eq('parcelado', false),
      // Saídas não comerciais (dízimo, pró-labore, reserva, sangria) do período
      window._supabase.from('saidas_nao_comerciais').select('custo_total, data').gte('data', inicioStr).lte('data', fimStr),
    ]);

    const vendas = vendasRes.data || [];

    // Filtra parcelas pagas no período pela data de pagamento
    const despParcelas = (despParcelasRes.data || []).filter(d => {
      const dataRef = d.data_pag || '';
      return dataRef >= inicioStr && dataRef <= fimStr;
    });

    // Filtra despesas simples pagas pelo período usando data_lancamento ou vencimento ou created_at
    const despSimples = (despSimplesRes.data || []).filter(d => {
      const dataRef = d.data_lancamento || d.vencimento || (d.created_at||'').split('T')[0];
      return dataRef >= inicioStr && dataRef <= fimStr;
    });

    const faturamento  = vendas.reduce((s,v) => s + (v.valor_total||0), 0);
    const custoMerc    = vendas.reduce((s,v) => s + (v.custo_total||0), 0);
    // Só soma taxa de vendas com bandeira (cartão) — dinheiro/PIX não tem taxa
    const taxas        = vendas.reduce((s,v) => s + (v.bandeira_id ? (v.valor_taxa||0) : 0), 0);
    const despOperac   = despParcelas.reduce((s,d) => s + (d.valor||0), 0)
                       + despSimples.reduce((s,d) => s + (d.valor||0), 0);
    const saidasNaoComerciais = (saidasRes.data||[]).reduce((s,d) => s + (d.custo_total||0), 0);
    const despesas     = despOperac + saidasNaoComerciais;
    const lucroOp      = faturamento - custoMerc - taxas - despesas;

    setText('kpiFaturamento', Format.currency(faturamento));
    setText('kpiDespesas',    Format.currency(despesas));
    setText('kpiTaxas',       Format.currency(taxas));
    setText('kpiCusto',       Format.currency(custoMerc));
    setText('kpiLucroOp',     Format.currency(lucroOp));

    renderResultado({ faturamento, custoMerc, taxas, despOperac, saidasNaoComerciais, despesas, lucroOp });
    renderDistribuicao(lucroOp);

    // Fluxo recente — filtrado pelo período, valor líquido para vendas com cartão
    const { data: vendasRec } = await window._supabase
      .from('vendas').select('created_at, valor_total, valor_liquido, valor_taxa, bandeira_id, clientes(nome), forma_pagamento')
      .eq('status', 'concluida')
      .gte('created_at', inicio).lte('created_at', fim)
      .order('created_at', { ascending:false }).limit(10);
    const { data: despRec } = await window._supabase
      .from('despesas').select('created_at, descricao, valor')
      .eq('status', 'pago')
      .gte('created_at', inicio).lte('created_at', fim)
      .order('created_at', { ascending:false }).limit(5);
    const { data: saidasRec } = await window._supabase
      .from('saidas_nao_comerciais').select('created_at, tipo, custo_total')
      .gte('data', inicioStr).lte('data', fimStr)
      .order('created_at', { ascending:false }).limit(5);

    const fluxo = [
      ...(vendasRec||[]).map(v => ({
        data:  v.created_at,
        descricao: `Venda — ${v.clientes?.nome||'Cliente'}`,
        tipo:  'entrada',
        // Mostra valor líquido (já descontada a taxa da maquininha)
        valor: v.bandeira_id ? (v.valor_liquido || v.valor_total) : v.valor_total,
      })),
      ...(despRec||[]).map(d => ({ data:d.created_at, descricao:d.descricao, tipo:'saida', valor:d.valor })),
      ...(saidasRec||[]).map(s => ({ data:s.created_at, descricao:s.tipo||'Saída N. Comercial', tipo:'saida', valor:s.custo_total })),
    ].sort((a,b) => new Date(b.data) - new Date(a.data)).slice(0,15);

    renderFluxo(fluxo);
  } catch(e) { console.error(e); }
}

function renderResultado(d) {
  setText('kpiFaturamento', Format.currency(d.faturamento));
  setText('kpiDespesas',    Format.currency(d.despesas));
  setText('kpiTaxas',       Format.currency(d.taxas));
  setText('kpiCusto',       Format.currency(d.custoMerc));
  setText('kpiLucroOp',     Format.currency(d.lucroOp));

  const saidasLinha = (d.saidasNaoComerciais > 0)
    ? `<div class="resultado-row saida"><span>🏦 Saídas N. Comerciais</span><strong>— ${Format.currency(d.saidasNaoComerciais)}</strong></div>`
    : '';

  document.getElementById('resultadoLista').innerHTML = `
    <div class="resultado-row entrada"><span>💰 Faturamento Bruto</span><strong>${Format.currency(d.faturamento)}</strong></div>
    <div class="resultado-row saida"><span>📦 Custo das Mercadorias</span><strong>— ${Format.currency(d.custoMerc)}</strong></div>
    <div class="resultado-row saida"><span>🏦 Taxas Maquininha</span><strong>— ${Format.currency(d.taxas)}</strong></div>
    <div class="resultado-row saida"><span>💸 Despesas Operacionais</span><strong>— ${Format.currency(d.despOperac !== undefined ? d.despOperac : d.despesas)}</strong></div>
    ${saidasLinha}
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
    { label:`Pró-labore (${pct.proLabore}%)`,    valor:valorPL,  cor:'var(--color-taupe)',   pct: valorPL/total*100  },
    { label:`Dízimo (${pct.dizimo}%)`,            valor:valorDiz, cor:'var(--color-info)',    pct: valorDiz/total*100 },
    { label:`Reserva de Caixa (${pct.reserva}%)`, valor:valorRes, cor:'var(--color-warning)', pct: valorRes/total*100 },
    { label:'💰 Lucro Líquido',                   valor:valorLiq, cor:'var(--color-success)', pct: valorLiq/total*100 },
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
      <td data-privado-nome>${f.descricao}</td>
      <td><span class="badge ${f.tipo==='entrada'?'badge-success':'badge-danger'}">${f.tipo==='entrada'?'Entrada':'Saída'}</span></td>
      <td style="font-weight:500;color:${f.tipo==='entrada'?'var(--color-success)':'var(--color-danger)'}">${f.tipo==='entrada'?'+':'—'} ${Format.currency(f.valor)}</td>
    </tr>
  `).join('');
}

function onChangePeriodo() {
  const periodo = document.getElementById('filtroPeriodo').value;
  const customDiv = document.getElementById('filtroDatasCustom');
  if (periodo === 'personalizado') {
    customDiv.style.display = 'flex';
    // Preenche datas padrão se vazias
    const hoje = new Date();
    if (!document.getElementById('filtroDataInicio').value) {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      document.getElementById('filtroDataInicio').value = inicio.toISOString().split('T')[0];
    }
    if (!document.getElementById('filtroDataFim').value) {
      document.getElementById('filtroDataFim').value = hoje.toISOString().split('T')[0];
    }
  } else {
    customDiv.style.display = 'none';
    carregarFinanceiro();
  }
}

function getPeriodo(periodo) {
  const agora = new Date();
  let inicio, fim;

  if (periodo === 'hoje') {
    inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).toISOString();
    fim    = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59).toISOString();
  } else if (periodo === 'semana') {
    const d = new Date(); d.setDate(d.getDate() - 7);
    inicio = d.toISOString();
    fim    = agora.toISOString();
  } else if (periodo === 'mes') {
    inicio = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
    fim    = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59).toISOString();
  } else if (periodo === 'mes_passado') {
    inicio = new Date(agora.getFullYear(), agora.getMonth() - 1, 1).toISOString();
    fim    = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59).toISOString();
  } else if (periodo === 'ano') {
    inicio = new Date(agora.getFullYear(), 0, 1).toISOString();
    fim    = new Date(agora.getFullYear(), 11, 31, 23, 59, 59).toISOString();
  } else if (periodo === 'personalizado') {
    const dataInicio = document.getElementById('filtroDataInicio').value;
    const dataFim    = document.getElementById('filtroDataFim').value;
    if (!dataInicio || !dataFim) return null;
    inicio = new Date(dataInicio + 'T00:00:00').toISOString();
    fim    = new Date(dataFim    + 'T23:59:59').toISOString();
  } else {
    inicio = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
    fim    = agora.toISOString();
  }

  return { inicio, fim };
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
