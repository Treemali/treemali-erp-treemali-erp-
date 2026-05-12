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
    const inicio = new Date(); inicio.setHours(0,0,0,0);
    const fim    = new Date(); fim.setHours(23,59,59,999);
    return { inicio: inicio.toISOString(), fim: fim.toISOString() };
  }
  if (_periodo === 'mes') {
    const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
    return { inicio: inicio.toISOString(), fim: agora.toISOString() };
  }
  if (_periodo === 'ano') {
    const inicio = new Date(agora.getFullYear(), 0, 1, 0, 0, 0, 0);
    return { inicio: inicio.toISOString(), fim: agora.toISOString() };
  }
  // custom
  return {
    inicio: document.getElementById('dataInicio').value + 'T00:00:00.000',
    fim:    document.getElementById('dataFim').value    + 'T23:59:59.999',
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
  try {
    let faturamento=0, custoMerc=0, taxasVendas=0, taxasCred=0, despesas=0, saidasNaoComerciais=0;
    let taxasPorBandeira = [];

    if (!window._supabase) {
      faturamento = 24750; custoMerc = 9800; taxasVendas = 620; despesas = 3200;
      taxasPorBandeira = [
        { bandeira:'Visa / Mastercard', total:15200, taxa:479, liquido:14721 },
        { bandeira:'Elo / Amex',        total:6400,  taxa:314, liquido:6086  },
        { bandeira:'Dinheiro / PIX',    total:3150,  taxa:0,   liquido:3150  },
      ];
    } else {
      const inicioStr = inicio.split('T')[0];
      const fimStr    = fim.split('T')[0];

      const [vendasRes, despParcRes, despSimplesRes, saidasRes, parcCredRes] = await Promise.all([
        window._supabase.from('vendas')
          .select('valor_total, valor_taxa, custo_total, bandeira_id, bandeiras(nome), forma_pagamento')
          .gte('created_at', inicio).lte('created_at', fim).eq('status', 'concluida'),
        
        window._supabase.from('parcelas_despesa')
          .select('valor, data_pag, despesas(categoria, parcelado)')
          .eq('status', 'pago').gte('data_pag', inicioStr).lte('data_pag', fimStr),
        
        window._supabase.from('despesas')
          .select('valor, categoria, created_at')
          .eq('status', 'pago').eq('parcelado', false)
          .gte('created_at', inicio).lte('created_at', fim),
        
        window._supabase.from('saidas_nao_comerciais')
          .select('custo_total, lancou_despesa, categoria, data')
          .gte('data', inicioStr).lte('data', fimStr),

        window._supabase.from('parcelas_crediario')
          .select('valor_taxa, data_pag')
          .eq('status', 'pago').gte('data_pag', inicioStr).lte('data_pag', fimStr)
      ]);

      if (vendasRes.error) throw vendasRes.error;

      const vendas = vendasRes.data || [];
      faturamento  = vendas.reduce((s,v) => s + (v.valor_total||0), 0);
      custoMerc    = vendas.reduce((s,v) => s + (v.custo_total||0), 0);
      taxasVendas  = vendas.reduce((s,v) => s + (v.valor_taxa||0), 0);
      taxasCred    = (parcCredRes.data || []).reduce((s,t) => s + (t.valor_taxa||0), 0);

      // ── Filtragem de Despesas (Lógica Financeiro.js)
      const despParcFiltered = (despParcRes.data || []).filter(d => 
        d.despesas?.categoria !== 'Fornecedor' && d.despesas?.parcelado === true
      );
      const despSimpFiltered = (despSimplesRes.data || []).filter(d => d.categoria !== 'Fornecedor');
      const saidasNCFiltered = (saidasRes.data || []).filter(d => 
        !d.lancou_despesa && !['dizimo', 'pro_labore', 'reserva_caixa', 'sangria'].includes(d.categoria)
      );

      saidasNaoComerciais = saidasNCFiltered.reduce((s,d) => s + (d.custo_total||0), 0);
      const despOperacTotal = despParcFiltered.reduce((s,d) => s + (d.valor||0), 0)
                            + despSimpFiltered.reduce((s,d) => s + (d.valor||0), 0);
      
      despesas = despOperacTotal + saidasNaoComerciais;

      const grupos = {};
      vendas.forEach(v => {
        let nome = v.bandeira_id ? (v.bandeiras?.nome || 'Cartão') : (v.forma_pagamento === 'crediario' ? 'Crediário' : 'Dinheiro / PIX');
        if (!grupos[nome]) grupos[nome] = { total:0, taxa:0 };
        grupos[nome].total += v.valor_total||0;
        grupos[nome].taxa  += v.valor_taxa||0;
      });
      taxasPorBandeira = Object.entries(grupos).map(([b,d]) => ({
        bandeira: b, total: d.total, taxa: d.taxa, liquido: d.total - d.taxa
      }));
    }

    const taxasTotais = taxasVendas + taxasCred;
    const lucroOp     = faturamento - custoMerc - taxasTotais - despesas;

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

    const vPL = lucroOp * pct.proLabore / 100;
    const vDiz = lucroOp * pct.dizimo / 100;
    const vRes = lucroOp * pct.reserva / 100;
    const vLiq = lucroOp - vPL - vDiz - vRes;

    document.getElementById('relResultado').innerHTML = `
      <div class="resultado-item entrada"><span>💰 Faturamento Bruto</span><strong>${Format.currency(faturamento)}</strong></div>
      <div class="resultado-item saida"><span>📦 Custo das Mercadorias (CMV)</span><strong>— ${Format.currency(custoMerc)}</strong></div>
      <div class="resultado-item saida"><span>🏦 Taxas (Vendas + Crediário)</span><strong>— ${Format.currency(taxasTotais)}</strong></div>
      <div class="resultado-item saida"><span>💸 Despesas Operacionais</span><strong>— ${Format.currency(despesas - saidasNaoComerciais)}</strong></div>
      ${saidasNaoComerciais > 0 ? `<div class="resultado-item saida"><span>🏦 Saídas N. Comerciais</span><strong>— ${Format.currency(saidasNaoComerciais)}</strong></div>` : ''}
      <div class="resultado-item destaque"><span>📈 Lucro Operacional</span><strong>${Format.currency(lucroOp)}</strong></div>
    `;

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

    document.getElementById('relTaxas').innerHTML = taxasPorBandeira.length
      ? taxasPorBandeira.map(t => `
          <tr><td>${t.bandeira}</td><td>${Format.currency(t.total)}</td><td style="color:var(--color-danger)">— ${Format.currency(t.taxa)}</td><td style="color:var(--color-success)">${Format.currency(t.liquido)}</td></tr>
        `).join('')
      : '<tr><td colspan="4" class="rel-loading">Sem vendas no período</td></tr>';

  } catch (err) {
    console.error('Erro ao gerar relatório de lucro:', err);
    document.getElementById('relResultado').innerHTML = '<div class="rel-loading">Erro ao carregar dados.</div>';
  }
}

// ══════════════════════════════════════════════
// RELATÓRIO VENDAS
// ══════════════════════════════════════════════

async function gerarRelVendas(inicio, fim) {
  let vendas = [];
  if (!window._supabase) {
    vendas = [
      { created_at:new Date().toISOString(), clientes:{nome:'Ana Silva'}, tipo:'normal', forma_pagamento:'pix', valor_total:320, lucro:140 },
      { created_at:new Date().toISOString(), clientes:{nome:'Pedro Souza'}, tipo:'normal', forma_pagamento:'debito', valor_total:185.5, lucro:82 },
    ];
  } else {
    const { data } = await window._supabase
      .from('vendas').select('*,clientes(nome),usuarios(nome)')
      .gte('created_at',inicio).lte('created_at',fim)
      .eq('status','concluida')
      .order('created_at', { ascending:false });
    vendas = data || [];
  }

  const totalFat = vendas.reduce((s,v) => s + (v.valor_total||0), 0);
  const totalLuc = vendas.reduce((s,v) => s + (v.lucro||0), 0);
  const ticketMed = vendas.length ? totalFat/vendas.length : 0;

  document.getElementById('relVendasKpis').innerHTML = [
    { label:'Total de Vendas', valor:vendas.length, isCurrency:false },
    { label:'Faturamento', valor:totalFat, isCurrency:true },
    { label:'Lucro Total', valor:totalLuc, isCurrency:true },
    { label:'Ticket Médio', valor:ticketMed, isCurrency:true },
  ].map(k => `<div class="rkpi"><span class="rkpi-label">${k.label}</span><span class="rkpi-value">${k.isCurrency ? Format.currency(k.valor) : k.valor}</span></div>`).join('');

  document.getElementById('relVendasTabela').innerHTML = vendas.length
    ? vendas.map(v => `
        <tr>
          <td>${Format.date(v.created_at)}</td>
          <td data-privado-nome>${v.clientes?.nome||'—'}</td>
          <td>${v.usuarios?.nome||'—'}</td>
          <td><span class="badge badge-neutral">${v.tipo}</span></td>
          <td>${v.forma_pagamento}</td>
          <td><strong>${Format.currency(v.valor_total)}</strong></td>
          <td style="color:var(--color-success)">${Format.currency(v.lucro||0)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="7" class="rel-loading">Sem vendas no período</td></tr>';
}

// ══════════════════════════════════════════════
// RELATÓRIO PRODUTOS
// ══════════════════════════════════════════════

async function gerarRelProdutos(inicio, fim) {
  let itens = [];
  if (!window._supabase) {
    itens = [{ produtos:{nome:'Produto Demo'}, quantidade:10, preco_vend:100, custo_unit:50 }];
  } else {
    const { data } = await window._supabase
      .from('itens_venda')
      .select('*, produtos(nome,sku,custo), vendas!inner(created_at, taxa_aplicada)')
      .gte('vendas.created_at', inicio)
      .lte('vendas.created_at', fim)
      .not('vendas.status', 'eq', 'cancelada');
    itens = data || [];
  }

  const mapa = {};
  itens.forEach(i => {
    const nome = i.produtos?.nome || '—';
    const taxa = parseFloat(i.vendas?.taxa_aplicada || i.taxa_venda || 0);
    const preco = parseFloat(i.preco_vend || i.preco_unit || 0);
    const custo = parseFloat(i.custo_unit || i.produtos?.custo || 0);
    const qtd = parseInt(i.quantidade || 0);
    const receita = preco * qtd;
    const taxaVal = receita * (taxa / 100);
    const lucroItem = (receita - taxaVal) - (custo * qtd);

    if (!mapa[nome]) mapa[nome] = { nome, sku: i.produtos?.sku || '', qtd: 0, receita: 0, custo: 0, taxaTotal: 0, lucro: 0 };
    mapa[nome].qtd += qtd;
    mapa[nome].receita += receita;
    mapa[nome].custo += custo * qtd;
    mapa[nome].taxaTotal += taxaVal;
    mapa[nome].lucro += lucroItem;
  });

  const lista = Object.values(mapa).sort((a,b) => b.qtd - a.qtd);
  document.getElementById('relProdutosMaisVendidos').innerHTML = lista.slice(0,5).map((p,i) => `
    <div class="rank-item"><span class="rank-num">${i+1}</span><div class="rank-info"><div class="rank-nome">${p.nome}</div><div class="rank-sub">${p.qtd} unidades</div></div><span class="rank-valor">${Format.currency(p.receita)}</span></div>
  `).join('');

  document.getElementById('relMargemProdutos').innerHTML = lista.map(p => {
    const rent = p.custo > 0 ? ((p.lucro / p.custo) * 100).toFixed(1) : 0;
    return `<tr><td><strong>${p.nome}</strong></td><td>${Format.currency(p.custo/Math.max(p.qtd,1))}</td><td>${Format.currency(p.receita/Math.max(p.qtd,1))}</td><td>${p.qtd}</td><td style="color:var(--color-danger)">— ${Format.currency(p.taxaTotal)}</td><td><span class="badge">${rent}%</span></td><td style="color:var(--color-success)">${Format.currency(p.lucro)}</td></tr>`;
  }).join('');
}

// ══════════════════════════════════════════════
// RELATÓRIO VENDEDORES
// ══════════════════════════════════════════════

async function gerarRelVendedores(inicio, fim) {
  try {
    let vendas = [];
    if (!window._supabase) {
      vendas = [{ usuarios:{nome:'Admin'}, valor_total:1000, lucro:400, itens_venda:[] }];
    } else {
      const { data, error } = await window._supabase
        .from('vendas')
        .select('valor_total, lucro, usuarios(nome), itens_venda(desconto)')
        .gte('created_at', inicio).lte('created_at', fim)
        .eq('status', 'concluida');
      if (error) throw error;
      vendas = data || [];
    }

    const mapa = {};
    vendas.forEach(v => {
      const nome = v.usuarios?.nome || 'Sem vendedor';
      if (!mapa[nome]) mapa[nome] = { nome, qtd:0, total:0, desconto:0, lucro:0 };
      mapa[nome].qtd++;
      mapa[nome].total += v.valor_total || 0;
      mapa[nome].lucro += v.lucro || 0;
      
      // Soma o desconto de cada item daquela venda
      const descTotalVenda = (v.itens_venda || []).reduce((s, i) => s + (i.desconto || 0), 0);
      mapa[nome].desconto += descTotalVenda;
    });

    const lista = Object.values(mapa).sort((a,b) => b.total - a.total);
    document.getElementById('relVendedores').innerHTML = lista.map(v => `
      <tr>
        <td><strong>${v.nome}</strong></td>
        <td>${v.qtd}</td>
        <td>${Format.currency(v.total)}</td>
        <td style="color:${v.desconto>0?'var(--color-warning)':'var(--color-gray-400)'}">${Format.currency(v.desconto)}</td>
        <td>${Format.currency(v.qtd>0?v.total/v.qtd:0)}</td>
      </tr>
    `).join('') || '<tr><td colspan="5" class="rel-loading">Sem vendas no período</td></tr>';
  } catch (err) { console.error('Erro vendedores:', err); }
}

// ══════════════════════════════════════════════
// RELATÓRIO ESTOQUE
// ══════════════════════════════════════════════

async function gerarRelEstoque() {
  let produtos = [];

  if (!window._supabase) {
    produtos = [
      { nome:'Camiseta Preta P',  sku:'CAM-001', descricao:'100% algodão', categorias:{nome:'Camisetas'}, estoque_atual:15, estoque_minimo:5,  custo:30,  preco_venda:79.90,  preco_avista:69.90  },
      { nome:'Calça Jeans 38',    sku:'CAL-001', descricao:'Slim fit',     categorias:{nome:'Calças'},    estoque_atual:3,  estoque_minimo:5,  custo:80,  preco_venda:189.90, preco_avista:169.90 },
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
  const thead = document.getElementById('theadRelEstoque')?.innerHTML || '';
  const tbody = document.getElementById('relEstoqueTabela')?.innerHTML || '';
  const kpis  = document.getElementById('relEstoqueKpis')?.innerHTML || '';

  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>Relatório de Estoque</title>
    <style>
      body { font-family: sans-serif; font-size: 12px; padding: 20px; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th { background: #f4f4f4; padding: 10px; border: 1px solid #ddd; text-align: left; }
      td { padding: 8px; border: 1px solid #ddd; }
      .rkpi { display: inline-block; margin-right: 20px; padding: 10px; background: #f9f9f9; border-radius: 5px; }
    </style>
    </head><body>
    <h1>Relatório de Estoque</h1>
    <div class="kpis">${kpis}</div>
    <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
    <script>window.print();<\/script>
    </body></html>
  `);
  win.document.close();
}

function imprimirRelatorio() { window.print(); }
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
