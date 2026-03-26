/**
 * TREEMALI ERP — Relatórios
 * Lucro real, vendas, produtos, vendedores, estoque
 */

let _periodo = 'mes';
let _dados   = {};

// ══════════════════════════════════════════════
// INICIALIZAÇÃO
// ══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

  // Abas
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      gerarRelatorios();
    });
  });

  // Datas default
  const hoje = new Date().toISOString().split('T')[0];
  const mes1 = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  document.getElementById('dataInicio').value = mes1;
  document.getElementById('dataFim').value    = hoje;

  gerarRelatorios();
});

function setPeriodo(p) {
  _periodo = p;
  document.querySelectorAll('.periodo-btn').forEach(b => b.classList.toggle('active', b.dataset.p === p));
  document.getElementById('customDatas').style.display = p === 'custom' ? 'flex' : 'none';
  if (p !== 'custom') gerarRelatorios();
}

function getPeriodoDatas() {
  const agora = new Date();
  if (_periodo === 'hoje') {
    const d = new Date(); d.setHours(0,0,0,0);
    return { inicio: d.toISOString(), fim: new Date().toISOString() };
  }
  if (_periodo === 'mes') {
    return {
      inicio: new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString(),
      fim:    agora.toISOString()
    };
  }
  if (_periodo === 'ano') {
    return {
      inicio: new Date(agora.getFullYear(), 0, 1).toISOString(),
      fim:    agora.toISOString()
    };
  }
  // custom
  return {
    inicio: document.getElementById('dataInicio').value + 'T00:00:00.000Z',
    fim:    document.getElementById('dataFim').value    + 'T23:59:59.999Z',
  };
}

async function gerarRelatorios() {
  const { inicio, fim } = getPeriodoDatas();
  const abaAtiva = document.querySelector('.tab-btn.active')?.dataset.tab || 'lucro';

  if (abaAtiva === 'lucro')      await gerarRelLucro(inicio, fim);
  if (abaAtiva === 'vendas')     await gerarRelVendas(inicio, fim);
  if (abaAtiva === 'produtos')   await gerarRelProdutos(inicio, fim);
  if (abaAtiva === 'vendedores') await gerarRelVendedores(inicio, fim);
  if (abaAtiva === 'estoque')    await gerarRelEstoque();
}

// ══════════════════════════════════════════════
// RELATÓRIO LUCRO REAL
// ══════════════════════════════════════════════

async function gerarRelLucro(inicio, fim) {
  let faturamento=0, custoMerc=0, taxas=0, despesas=0, saidasNaoComerciais=0;
  let taxasPorBandeira = [];

  if (!window._supabase) {
    faturamento = 24750; custoMerc = 9800; taxas = 620; despesas = 3200;
    taxasPorBandeira = [
      { bandeira:'Visa / Mastercard', total:15200, taxa:479, liquido:14721 },
      { bandeira:'Elo / Amex',        total:6400,  taxa:314, liquido:6086  },
      { bandeira:'Dinheiro / PIX',    total:3150,  taxa:0,   liquido:3150  },
    ];
  } else {
    const inicioStr = inicio.split('T')[0];
    const fimStr    = fim.split('T')[0];

    const [vendasRes, despRes, despSimplesRes, taxasRes, saidasRes] = await Promise.all([
      window._supabase.from('vendas').select('valor_total,valor_taxa,custo_total,bandeira_id,bandeiras(nome),forma_pagamento').gte('created_at',inicio).lte('created_at',fim).eq('status','concluida'),
      window._supabase.from('parcelas_despesa').select('valor, data_pag').eq('status','pago'),
      window._supabase.from('despesas').select('valor, data_lancamento, vencimento, created_at').eq('status','pago').eq('parcelado',false),
      window._supabase.from('vendas').select('bandeira_id,valor_total,valor_taxa,bandeiras(nome),forma_pagamento').gte('created_at',inicio).lte('created_at',fim).eq('status','concluida'),
      // Saídas não comerciais do período
      window._supabase.from('saidas_nao_comerciais').select('custo_total, data').gte('data',inicioStr).lte('data',fimStr),
    ]);

    const vendas = vendasRes.data || [];
    faturamento  = vendas.reduce((s,v) => s+(v.valor_total||0), 0);
    custoMerc    = vendas.reduce((s,v) => s+(v.custo_total||0), 0);
    // Só soma taxa de vendas com bandeira (cartão) — dinheiro/PIX não tem taxa
    taxas        = vendas.reduce((s,v) => s+(v.bandeira_id ? (v.valor_taxa||0) : 0), 0);
    // Filtra parcelas pagas no período pela data de pagamento
    const despParcelasFiltradas = (despRes.data||[]).filter(d => {
      const dataRef = d.data_pag || '';
      return dataRef >= inicioStr && dataRef <= fimStr;
    });
    // Filtra despesas simples pagas pelo período
    const despSimpFiltradas = (despSimplesRes.data||[]).filter(d => {
      const dataRef = d.data_lancamento || d.vencimento || (d.created_at||'').split('T')[0];
      return dataRef >= inicioStr && dataRef <= fimStr;
    });
    const _saidasNaoComerciais = (saidasRes.data||[]).reduce((s,d) => s+(d.custo_total||0), 0);
    saidasNaoComerciais = _saidasNaoComerciais;
    despesas = despParcelasFiltradas.reduce((s,d) => s+(d.valor||0), 0)
             + despSimpFiltradas.reduce((s,d) => s+(d.valor||0), 0)
             + saidasNaoComerciais;

    // Agrupando por bandeira — crediário vai em grupo próprio, não em Dinheiro/PIX
    const grupos = {};
    (taxasRes.data||[]).forEach(v => {
      let nome;
      if (v.bandeira_id) {
        nome = v.bandeiras?.nome || 'Outros Cartões';
      } else if (v.forma_pagamento === 'crediario') {
        nome = 'Crediário';
      } else {
        nome = 'Dinheiro / PIX';
      }
      if (!grupos[nome]) grupos[nome] = { total:0, taxa:0 };
      grupos[nome].total += v.valor_total||0;
      // Só soma taxa se tiver bandeira (cartão)
      if (v.bandeira_id) grupos[nome].taxa += v.valor_taxa||0;
    });
    taxasPorBandeira = Object.entries(grupos).map(([b,d]) => ({
      bandeira: b, total: d.total, taxa: d.taxa, liquido: d.total - d.taxa
    }));
  }

  const lucroOp = faturamento - custoMerc - taxas - despesas;

  // Busca percentuais configurados
  let pct = { proLabore:20, dizimo:10, reserva:30 };
  if (window._supabase) {
    const { data } = await window._supabase.from('configuracoes').select('chave,valor')
      .in('chave',['pro_labore_pct','dizimo_pct','reserva_caixa_pct']);
    (data||[]).forEach(c => {
      if (c.chave==='pro_labore_pct')    pct.proLabore = parseFloat(c.valor);
      if (c.chave==='dizimo_pct')        pct.dizimo    = parseFloat(c.valor);
      if (c.chave==='reserva_caixa_pct') pct.reserva   = parseFloat(c.valor);
    });
  }

  const vPL  = lucroOp * pct.proLabore / 100;
  const vDiz = lucroOp * pct.dizimo    / 100;
  const vRes = lucroOp * pct.reserva   / 100;
  const vLiq = lucroOp - vPL - vDiz - vRes;

  // Resultado
  const despOperac = despesas - saidasNaoComerciais;
  const saidasLinha = saidasNaoComerciais > 0
    ? `<div class="resultado-item saida"><span>🏦 Saídas N. Comerciais</span><strong>— ${Format.currency(saidasNaoComerciais)}</strong></div>`
    : '';
  document.getElementById('relResultado').innerHTML = `
    <div class="resultado-item entrada"><span>💰 Faturamento Bruto</span><strong>${Format.currency(faturamento)}</strong></div>
    <div class="resultado-item saida"><span>📦 Custo das Mercadorias</span><strong>— ${Format.currency(custoMerc)}</strong></div>
    <div class="resultado-item saida"><span>🏦 Taxas da Maquininha</span><strong>— ${Format.currency(taxas)}</strong></div>
    <div class="resultado-item saida"><span>💸 Despesas Operacionais</span><strong>— ${Format.currency(despOperac)}</strong></div>
    ${saidasLinha}
    <div class="resultado-item destaque"><span>📈 Lucro Operacional</span><strong>${Format.currency(lucroOp)}</strong></div>
  `;

  // Distribuição
  const maxVal = Math.max(vPL, vDiz, vRes, vLiq, 1);
  document.getElementById('relDistribuicao').innerHTML = [
    { label:`Pró-labore (${pct.proLabore}%)`,    valor:vPL,  cor:'var(--color-taupe)'   },
    { label:`Dízimo (${pct.dizimo}%)`,            valor:vDiz, cor:'var(--color-info)'    },
    { label:`Reserva de Caixa (${pct.reserva}%)`, valor:vRes, cor:'var(--color-warning)' },
    { label:'💰 Lucro Líquido',                   valor:vLiq, cor:'var(--color-success)' },
  ].map(i => `
    <div class="dist-item">
      <span class="dist-item-label">${i.label}</span>
      <div class="dist-bar-wrap"><div class="dist-bar-fill" style="width:${Math.max(0,(i.valor/maxVal)*100)}%;background:${i.cor}"></div></div>
      <span class="dist-item-valor" style="color:${i.cor}">${Format.currency(i.valor)}</span>
    </div>
  `).join('');

  // Taxas por bandeira
  document.getElementById('relTaxas').innerHTML = taxasPorBandeira.length
    ? taxasPorBandeira.map(t => `
        <tr>
          <td>${t.bandeira}</td>
          <td>${Format.currency(t.total)}</td>
          <td style="color:var(--color-danger)">— ${Format.currency(t.taxa)}</td>
          <td style="color:var(--color-success)">${Format.currency(t.liquido)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4" class="rel-loading">Sem vendas no período</td></tr>';
}

// ══════════════════════════════════════════════
// RELATÓRIO VENDAS
// ══════════════════════════════════════════════

async function gerarRelVendas(inicio, fim) {
  let vendas = [];

  if (!window._supabase) {
    vendas = [
      { created_at:new Date().toISOString(), clientes:{nome:'Ana Silva'},   tipo:'normal', forma_pagamento:'pix',    valor_total:320,  lucro:140 },
      { created_at:new Date().toISOString(), clientes:{nome:'Pedro Souza'}, tipo:'normal', forma_pagamento:'debito', valor_total:185.5,lucro:82  },
      { created_at:new Date().toISOString(), clientes:{nome:'Maria Lima'},  tipo:'crediario',forma_pagamento:'crediario',valor_total:740,lucro:310},
    ];
  } else {
    const { data } = await window._supabase
      .from('vendas').select('*,clientes(nome),usuarios(nome)')
      .gte('created_at',inicio).lte('created_at',fim)
      .eq('status','concluida')
      .order('created_at', { ascending:false });
    vendas = data || [];
  }

  const totalFat  = vendas.reduce((s,v) => s+(v.valor_total||0), 0);
  const totalLuc  = vendas.reduce((s,v) => s+(v.lucro||0), 0);
  const ticketMed = vendas.length ? totalFat/vendas.length : 0;

  document.getElementById('relVendasKpis').innerHTML = [
    { label:'Total de Vendas', valor:vendas.length, isCurrency:false },
    { label:'Faturamento',     valor:totalFat,      isCurrency:true  },
    { label:'Lucro Total',     valor:totalLuc,      isCurrency:true  },
    { label:'Ticket Médio',    valor:ticketMed,     isCurrency:true  },
  ].map(k => `
    <div class="rkpi">
      <span class="rkpi-label">${k.label}</span>
      <span class="rkpi-value">${k.isCurrency ? Format.currency(k.valor) : k.valor}</span>
    </div>
  `).join('');

  document.getElementById('relVendasTabela').innerHTML = vendas.length
    ? vendas.map(v => `
        <tr>
          <td>${Format.date(v.created_at)}</td>
          <td data-privado-nome>${v.clientes?.nome||'—'}</td>
          <td><span class="badge badge-neutral">${v.tipo}</span></td>
          <td>${v.forma_pagamento}</td>
          <td><strong>${Format.currency(v.valor_total)}</strong></td>
          <td style="color:var(--color-success)">${Format.currency(v.lucro||0)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="6" class="rel-loading">Sem vendas no período</td></tr>';
}

// ══════════════════════════════════════════════
// RELATÓRIO PRODUTOS
// ══════════════════════════════════════════════

async function gerarRelProdutos(inicio, fim) {
  let itens = [];

  if (!window._supabase) {
    itens = [
      { produtos:{nome:'Camiseta Preta P',  sku:'CAM-001'}, quantidade:24, preco_vend:79.90,  custo_unit:30,  taxa_venda:0    },
      { produtos:{nome:'Calça Jeans 38',    sku:'CAL-001'}, quantidade:18, preco_vend:189.90, custo_unit:80,  taxa_venda:6.12 },
      { produtos:{nome:'Blusa Floral M',    sku:'BLU-001'}, quantidade:15, preco_vend:119.90, custo_unit:45,  taxa_venda:3.15 },
      { produtos:{nome:'Vestido Midi Bege', sku:'VES-001'}, quantidade:11, preco_vend:229.90, custo_unit:90,  taxa_venda:0    },
      { produtos:{nome:'Tênis Casual 39',   sku:'TEN-001'}, quantidade:8,  preco_vend:299.90, custo_unit:120, taxa_venda:1.37 },
    ];
  } else {
    // Busca itens com a taxa da venda correspondente
    const { data } = await window._supabase
      .from('itens_venda')
      .select('*, produtos(nome,sku,custo), vendas!inner(created_at, taxa_aplicada)')
      .gte('vendas.created_at', inicio)
      .lte('vendas.created_at', fim)
      .not('vendas.status', 'eq', 'cancelada');
    itens = data || [];
  }

  // Agrupa por produto — lucro real = (preço × qtd) × (1 - taxa%) - custo
  const mapa = {};
  itens.forEach(i => {
    const nome     = i.produtos?.nome || '—';
    const taxa     = parseFloat(i.vendas?.taxa_aplicada || i.taxa_venda || 0);
    const preco    = parseFloat(i.preco_vend || i.preco_unit || 0);
    const custo    = parseFloat(i.custo_unit || i.produtos?.custo || 0);
    const qtd      = parseInt(i.quantidade || 0);
    const receita  = preco * qtd;
    const taxaVal  = receita * (taxa / 100);
    const liquido  = receita - taxaVal;
    const lucroItem = liquido - (custo * qtd);

    if (!mapa[nome]) mapa[nome] = {
      nome, sku: i.produtos?.sku || '', qtd: 0, receita: 0, custo: 0, taxaTotal: 0, lucro: 0
    };
    mapa[nome].qtd      += qtd;
    mapa[nome].receita  += receita;
    mapa[nome].custo    += custo * qtd;
    mapa[nome].taxaTotal += taxaVal;
    mapa[nome].lucro    += lucroItem;
  });

  const lista = Object.values(mapa);
  const porQtd    = [...lista].sort((a,b) => b.qtd - a.qtd);
  const porLucro  = [...lista].sort((a,b) => b.lucro - a.lucro);

  // Mais vendidos
  document.getElementById('relProdutosMaisVendidos').innerHTML = porQtd.slice(0,5).map((p,i) => `
    <div class="rank-item">
      <span class="rank-num">${i+1}</span>
      <div class="rank-info">
        <div class="rank-nome">${p.nome}</div>
        <div class="rank-sub">${p.qtd} unidades vendidas</div>
      </div>
      <span class="rank-valor">${Format.currency(p.receita)}</span>
    </div>
  `).join('') || '<div class="rel-loading">Sem dados</div>';

  // Mais lucrativos — por rentabilidade sobre custo
  document.getElementById('relProdutosMaisLucrativos').innerHTML = porLucro.slice(0,5).map((p,i) => `
    <div class="rank-item">
      <span class="rank-num">${i+1}</span>
      <div class="rank-info">
        <div class="rank-nome">${p.nome}</div>
        <div class="rank-sub">Rentabilidade: ${p.custo > 0 ? ((p.lucro/p.custo)*100).toFixed(1) : 0}% s/ custo</div>
      </div>
      <span class="rank-valor" style="color:var(--color-success)">${Format.currency(p.lucro)}</span>
    </div>
  `).join('') || '<div class="rel-loading">Sem dados</div>';

  // Rentabilidade por produto — lucro já com taxa deduzida
  document.getElementById('relMargemProdutos').innerHTML = lista.length
    ? lista.map(p => {
        const rent     = p.custo > 0 ? ((p.lucro / p.custo) * 100).toFixed(1) : 0;
        const precoMed = p.qtd > 0 ? p.receita / p.qtd : 0;
        return `
          <tr>
            <td><strong>${p.nome}</strong></td>
            <td>${Format.currency(p.custo / Math.max(p.qtd,1))}</td>
            <td>${Format.currency(precoMed)}</td>
            <td>${p.qtd}</td>
            <td style="color:var(--color-danger);font-size:var(--text-xs)">— ${Format.currency(p.taxaTotal)}</td>
            <td><span class="badge ${parseFloat(rent)>=100?'badge-success':parseFloat(rent)>=50?'badge-warning':'badge-danger'}">${rent}% s/ custo</span></td>
            <td style="color:var(--color-success);font-weight:600">${Format.currency(p.lucro)}</td>
          </tr>
        `;
      }).join('')
    : '<tr><td colspan="7" class="rel-loading">Sem vendas no período</td></tr>';
}

// ══════════════════════════════════════════════
// RELATÓRIO VENDEDORES
// ══════════════════════════════════════════════

async function gerarRelVendedores(inicio, fim) {
  let vendas = [];

  if (!window._supabase) {
    vendas = [
      { usuarios:{nome:'Administrador'}, valor_total:18500, desconto:0,   lucro:7400 },
      { usuarios:{nome:'Maria Vendedora'}, valor_total:6250, desconto:150, lucro:2500 },
    ];
  } else {
    const { data } = await window._supabase
      .from('vendas')
      .select('valor_total, lucro, usuarios(nome), itens_venda(desconto)')
      .gte('created_at', inicio).lte('created_at', fim)
      .eq('status', 'concluida');
    vendas = data || [];
  }

  // Agrupa por vendedor
  const mapa = {};
  vendas.forEach(v => {
    const nome = v.usuarios?.nome || 'Sem vendedor';
    if (!mapa[nome]) mapa[nome] = { nome, qtd:0, total:0, desconto:0, lucro:0 };
    mapa[nome].qtd++;
    mapa[nome].total   += v.valor_total||0;
    mapa[nome].lucro   += v.lucro||0;
    mapa[nome].desconto += (v.itens_venda||[]).reduce((s,i) => s+(i.desconto||0), 0);
  });

  const lista = Object.values(mapa).sort((a,b) => b.total-a.total);

  document.getElementById('relVendedores').innerHTML = lista.length
    ? lista.map(v => `
        <tr>
          <td><strong>${v.nome}</strong></td>
          <td>${v.qtd}</td>
          <td>${Format.currency(v.total)}</td>
          <td style="color:${v.desconto>0?'var(--color-warning)':'var(--color-gray-400)'}">${Format.currency(v.desconto)}</td>
          <td>${Format.currency(v.qtd>0?v.total/v.qtd:0)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="5" class="rel-loading">Sem vendas no período</td></tr>';
}

// ══════════════════════════════════════════════
// RELATÓRIO ESTOQUE
// ══════════════════════════════════════════════

async function gerarRelEstoque() {
  let produtos = [];

  if (!window._supabase) {
    produtos = [
      { nome:'Camiseta Preta P',  sku:'CAM-001', descricao:'Tecido 100% algodão, tam P', categorias:{nome:'Camisetas'}, estoque_atual:15, estoque_minimo:5,  custo:30,  preco_venda:79.90,  preco_avista:69.90  },
      { nome:'Calça Jeans 38',    sku:'CAL-001', descricao:'Jeans slim fit',              categorias:{nome:'Calças'},    estoque_atual:3,  estoque_minimo:5,  custo:80,  preco_venda:189.90, preco_avista:169.90 },
      { nome:'Blusa Floral M',    sku:'BLU-001', descricao:'Viscose, estampa floral',     categorias:{nome:'Blusas'},    estoque_atual:0,  estoque_minimo:3,  custo:45,  preco_venda:119.90, preco_avista:99.90  },
      { nome:'Vestido Midi Bege', sku:'VES-001', descricao:'Linho bege, tam único',       categorias:{nome:'Vestidos'},  estoque_atual:8,  estoque_minimo:3,  custo:90,  preco_venda:229.90, preco_avista:199.90 },
      { nome:'Tênis Casual 39',   sku:'TEN-001', descricao:'Couro sintético',             categorias:{nome:'Calçados'},  estoque_atual:5,  estoque_minimo:5,  custo:120, preco_venda:299.90, preco_avista:269.90 },
    ];
  } else {
    const { data } = await window._supabase
      .from('produtos')
      .select('*, categorias(nome)')
      .eq('ativo', true)
      .order('nome');
    produtos = data || [];
  }

  const filtro = document.getElementById('filtroRelEstoque').value;
  const layout = document.getElementById('layoutRelEstoque')?.value || 'gerencial';
  let lista = produtos;
  if (filtro === 'baixo') lista = lista.filter(p => p.estoque_atual > 0 && p.estoque_atual <= p.estoque_minimo);
  if (filtro === 'zero')  lista = lista.filter(p => p.estoque_atual === 0);

  const totalItens   = lista.reduce((s,p) => s + p.estoque_atual, 0);
  const valorTotal   = lista.reduce((s,p) => s + (p.custo * p.estoque_atual), 0);
  const emBaixo      = lista.filter(p => p.estoque_atual <= p.estoque_minimo && p.estoque_atual > 0).length;
  const zerados      = lista.filter(p => p.estoque_atual === 0).length;

  document.getElementById('relEstoqueKpis').innerHTML = [
    { label:'Total de Itens',    valor:totalItens,        isCurrency:false },
    { label:'Valor em Estoque',  valor:valorTotal,        isCurrency:true  },
    { label:'Estoque Baixo 🟡',  valor:emBaixo,           isCurrency:false },
    { label:'Zerados 🔴',        valor:zerados,           isCurrency:false },
  ].map(k => `
    <div class="rkpi">
      <span class="rkpi-label">${k.label}</span>
      <span class="rkpi-value">${k.isCurrency ? Format.currency(k.valor) : k.valor}</span>
    </div>
  `).join('');

  // Define colunas por layout
  const configs = {
    gerencial: {
      thead: '<tr><th>Produto</th><th>SKU</th><th>Categoria</th><th>Estoque</th><th>Mínimo</th><th>Custo Unit.</th><th>Valor Total</th></tr>',
      colspan: 7,
      row: (p, baixo, zerado) => `
        <tr>
          <td><strong>${p.nome}</strong></td>
          <td>${p.sku||'—'}</td>
          <td>${p.categorias?.nome||'—'}</td>
          <td style="color:${zerado?'var(--color-danger)':baixo?'var(--color-warning)':'var(--color-success)'};font-weight:600">${zerado?'🔴':baixo?'🟡':'🟢'} ${p.estoque_atual}</td>
          <td>${p.estoque_minimo}</td>
          <td>${Format.currency(p.custo)}</td>
          <td>${Format.currency(p.custo * p.estoque_atual)}</td>
        </tr>`
    },
    preco: {
      thead: '<tr><th>Produto</th><th>Descrição</th><th>SKU</th><th>Estoque</th><th>Preço à Vista</th><th>Preço a Prazo</th></tr>',
      colspan: 6,
      row: (p, baixo, zerado) => `
        <tr>
          <td><strong>${p.nome}</strong></td>
          <td style="color:var(--color-gray-500);font-size:var(--text-sm)">${p.descricao||'—'}</td>
          <td>${p.sku||'—'}</td>
          <td style="color:${zerado?'var(--color-danger)':baixo?'var(--color-warning)':'var(--color-success)'};font-weight:600">${zerado?'🔴':baixo?'🟡':'🟢'} ${p.estoque_atual}</td>
          <td><strong>${Format.currency(p.preco_avista||0)}</strong></td>
          <td>${Format.currency(p.preco_venda||0)}</td>
        </tr>`
    },
    completo: {
      thead: '<tr><th>Produto</th><th>Descrição</th><th>SKU</th><th>Categoria</th><th>Estoque</th><th>Mínimo</th><th>Custo</th><th>À Vista</th><th>A Prazo</th><th>Valor Estoque</th></tr>',
      colspan: 10,
      row: (p, baixo, zerado) => `
        <tr>
          <td><strong>${p.nome}</strong></td>
          <td style="color:var(--color-gray-500);font-size:var(--text-sm)">${p.descricao||'—'}</td>
          <td>${p.sku||'—'}</td>
          <td>${p.categorias?.nome||'—'}</td>
          <td style="color:${zerado?'var(--color-danger)':baixo?'var(--color-warning)':'var(--color-success)'};font-weight:600">${zerado?'🔴':baixo?'🟡':'🟢'} ${p.estoque_atual}</td>
          <td>${p.estoque_minimo}</td>
          <td>${Format.currency(p.custo)}</td>
          <td><strong>${Format.currency(p.preco_avista||0)}</strong></td>
          <td>${Format.currency(p.preco_venda||0)}</td>
          <td>${Format.currency(p.custo * p.estoque_atual)}</td>
        </tr>`
    },
  };

  const cfg = configs[layout] || configs.gerencial;
  document.getElementById('theadRelEstoque').innerHTML = cfg.thead;
  document.getElementById('relEstoqueTabela').innerHTML = lista.length
    ? lista.map(p => {
        const baixo  = p.estoque_atual > 0 && p.estoque_atual <= p.estoque_minimo;
        const zerado = p.estoque_atual === 0;
        return cfg.row(p, baixo, zerado);
      }).join('')
    : `<tr><td colspan="${cfg.colspan}" class="rel-loading">Nenhum produto encontrado</td></tr>`;
}

function imprimirRelatorioEstoque() {
  const layout   = document.getElementById('layoutRelEstoque')?.value || 'gerencial';
  const filtro   = document.getElementById('filtroRelEstoque')?.value || '';
  const filtroTxt = filtro === 'baixo' ? 'Estoque Baixo' : filtro === 'zero' ? 'Zerados' : 'Todos';
  const layoutTxt = layout === 'preco' ? 'Produto / Preços' : layout === 'completo' ? 'Completo' : 'Gerencial';

  const thead = document.getElementById('theadRelEstoque')?.innerHTML || '';
  const tbody = document.getElementById('relEstoqueTabela')?.innerHTML || '';
  const kpis  = document.getElementById('relEstoqueKpis')?.innerText  || '';

  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html><html lang="pt-BR"><head>
    <meta charset="UTF-8"/>
    <title>Treemali — Estoque</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #333; padding: 20px; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; border-bottom:2px solid #9E8E82; padding-bottom:12px; }
      .header h1 { font-size:18px; color:#3D3530; }
      .header p  { font-size:10px; color:#888; margin-top:3px; }
      .meta { text-align:right; font-size:10px; color:#888; }
      .kpis { display:flex; gap:16px; margin-bottom:16px; flex-wrap:wrap; }
      .kpi  { background:#F5F2EF; padding:8px 14px; border-radius:6px; }
      .kpi-label { font-size:9px; color:#888; display:block; }
      .kpi-value { font-size:14px; font-weight:bold; color:#3D3530; }
      table { width:100%; border-collapse:collapse; margin-top:8px; }
      th { background:#9E8E82; color:white; padding:7px 8px; text-align:left; font-size:10px; }
      td { padding:6px 8px; border-bottom:1px solid #EEE; font-size:10px; vertical-align:top; }
      tr:nth-child(even) td { background:#FAFAFA; }
      @media print {
        body { padding:10px; }
        button { display:none; }
      }
    </style>
    </head><body>
    <div class="header">
      <div>
        <h1>TREEMALI — Relatório de Estoque</h1>
        <p>Layout: ${layoutTxt} &nbsp;|&nbsp; Filtro: ${filtroTxt}</p>
      </div>
      <div class="meta">
        Gerado em: ${new Date().toLocaleString('pt-BR')}
      </div>
    </div>
    <div class="kpis">
      ${[...document.getElementById('relEstoqueKpis').querySelectorAll('.rkpi')].map(k =>
        `<div class="kpi"><span class="kpi-label">${k.querySelector('.rkpi-label')?.textContent}</span><span class="kpi-value">${k.querySelector('.rkpi-value')?.textContent}</span></div>`
      ).join('')}
    </div>
    <table>
      <thead>${thead}</thead>
      <tbody>${tbody}</tbody>
    </table>
    <script>window.onload = () => { window.print(); }<\/script>
    </body></html>
  `);
  win.document.close();
}

// ══════════════════════════════════════════════
// IMPRIMIR / COPIAR
// ══════════════════════════════════════════════

function imprimirRelatorio() {
  window.print();
}

function copiarRelatorio() {
  const abaAtiva = document.querySelector('.tab-btn.active')?.textContent || 'Relatório';
  const tabelas  = document.querySelectorAll('.tab-panel.active table');
  let texto      = `TREEMALI ERP — ${abaAtiva}\n`;
  texto         += `Período: ${document.querySelector('.periodo-btn.active')?.textContent || ''}\n`;
  texto         += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n\n`;

  tabelas.forEach(t => {
    const linhas = t.querySelectorAll('tr');
    linhas.forEach(l => {
      const cels = [...l.querySelectorAll('th, td')].map(c => c.textContent.trim().padEnd(20)).join(' | ');
      texto += cels + '\n';
    });
    texto += '\n';
  });

  navigator.clipboard.writeText(texto).then(() =>
    Toast.success('Copiado!', 'Relatório copiado para a área de transferência.')
  );
}
