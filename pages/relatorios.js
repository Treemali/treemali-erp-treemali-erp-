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
      if (btn.dataset.tab === 'cliente') {
        if (_clientesRel.length === 0) carregarClientesRel();
      } else {
        gerarRelatorios();
      }
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
    padrao: {
      thead: '<tr><th>Produto</th><th>Descrição</th><th>Situação Estoque</th></tr>',
      colspan: 3,
      row: (p, baixo, zerado) => `
        <tr>
          <td><strong>${p.nome}</strong></td>
          <td style="color:var(--color-gray-500);font-size:var(--text-sm)">${p.descricao||'—'}</td>
          <td>
            <span style="
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 4px 10px;
              border-radius: 20px;
              font-weight: 700;
              font-size: 14px;
              background: ${zerado ? 'rgba(176,85,85,0.1)' : baixo ? 'rgba(212,166,94,0.1)' : 'rgba(85,123,94,0.1)'};
              color: ${zerado ? 'var(--color-danger)' : baixo ? 'var(--color-warning)' : 'var(--color-success)'}
            ">
              ${zerado ? '🔴 Zerado' : baixo ? '🟡 Baixo ('+p.estoque_atual+')' : '🟢 Normal ('+p.estoque_atual+')'}
            </span>
          </td>
        </tr>`
    },
    completo: {
      thead: '<tr><th>SKU</th><th>Produto</th><th>Descrição</th><th>Categoria</th><th>Mínimo</th><th>Estoque</th><th>Custo</th><th>À Vista</th><th>A Prazo</th><th>Valor Estoque</th></tr>',
      colspan: 10,
      row: (p, baixo, zerado) => `
        <tr>
          <td>${p.sku||'—'}</td>
          <td><strong>${p.nome}</strong></td>
          <td style="color:var(--color-gray-500);font-size:var(--text-sm)">${p.descricao||'—'}</td>
          <td>${p.categorias?.nome||'—'}</td>
          <td>${p.estoque_minimo}</td>
          <td>
            <span style="
              display: inline-flex;
              align-items: center;
              gap: 4px;
              padding: 2px 8px;
              border-radius: 12px;
              font-weight: 700;
              font-size: 13px;
              background: ${zerado ? 'rgba(176,85,85,0.1)' : baixo ? 'rgba(212,166,94,0.1)' : 'rgba(85,123,94,0.1)'};
              color: ${zerado ? 'var(--color-danger)' : baixo ? 'var(--color-warning)' : 'var(--color-success)'}
            ">
              ${zerado ? '🔴' : baixo ? '🟡' : '🟢'} ${p.estoque_atual}
            </span>
          </td>
          <td>${Format.currency(p.custo)}</td>
          <td><strong>${Format.currency(p.preco_avista||0)}</strong></td>
          <td>${Format.currency(p.preco_venda||0)}</td>
          <td>${Format.currency(p.custo * p.estoque_atual)}</td>
        </tr>`
    },
  };

  const cfg = configs[layout] || configs.padrao;
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

// ══════════════════════════════════════════════
// EXTRATO DO CLIENTE
// ══════════════════════════════════════════════

let _clientesRel = [];

async function carregarClientesRel() {
  if (!window._supabase) return;
  const { data } = await window._supabase
    .from('clientes')
    .select('id, nome, telefone, cidade')
    .eq('ativo', true)
    .order('nome');
  _clientesRel = data || [];
}

// Dropdown de busca
function _getDropdownClienteRel() {
  let dd = document.getElementById('dropdownClienteRel');
  if (!dd) {
    dd = document.createElement('div');
    dd.id = 'dropdownClienteRel';
    dd.style.cssText = [
      'display:none','position:fixed','background:#fff',
      'border:1px solid #ddd','border-radius:8px',
      'box-shadow:0 6px 20px rgba(0,0,0,0.15)',
      'max-height:240px','overflow-y:auto','z-index:99999','min-width:260px'
    ].join(';');
    document.body.appendChild(dd);
  }
  return dd;
}

function _posicionarDropdownClienteRel() {
  const input = document.getElementById('buscaClienteRel');
  const dd = _getDropdownClienteRel();
  const rect = input.getBoundingClientRect();
  dd.style.top  = (rect.bottom + 4) + 'px';
  dd.style.left = rect.left + 'px';
  dd.style.width = rect.width + 'px';
}

function filtrarClientesRel(termo) {
  const dd = _getDropdownClienteRel();
  document.getElementById('clienteIdRel').value = '';
  if (!termo.trim()) { dd.style.display = 'none'; return; }

  const filtrados = _clientesRel.filter(c =>
    c.nome.toLowerCase().includes(termo.toLowerCase().trim())
  );
  _posicionarDropdownClienteRel();

  if (!filtrados.length) {
    dd.innerHTML = '<div style="padding:10px 14px;color:#888;font-size:14px;">Nenhum cliente encontrado</div>';
    dd.style.display = 'block';
    return;
  }

  dd.innerHTML = filtrados.map(c => {
    const nomeEsc = c.nome.replace(/'/g, "\\'");
    return `<div onmousedown="selecionarClienteRel(${c.id}, '${nomeEsc}')"
      style="padding:10px 14px;cursor:pointer;font-size:14px;border-bottom:1px solid #f0f0f0;"
      onmouseover="this.style.background='#f5f5f5'"
      onmouseout="this.style.background=''">
      <div style="font-weight:500">${c.nome}</div>
      ${c.cidade ? `<div style="font-size:12px;color:#888">${c.cidade}</div>` : ''}
    </div>`;
  }).join('');
  dd.style.display = 'block';
}

function selecionarClienteRel(id, nome) {
  document.getElementById('clienteIdRel').value = id;
  document.getElementById('buscaClienteRel').value = nome;
  const dd = document.getElementById('dropdownClienteRel');
  if (dd) dd.style.display = 'none';
}

function mostrarDropdownClienteRel() {
  const termo = document.getElementById('buscaClienteRel').value;
  if (termo.trim()) { _posicionarDropdownClienteRel(); filtrarClientesRel(termo); }
}

function esconderDropdownClienteRel() {
  setTimeout(() => {
    const dd = document.getElementById('dropdownClienteRel');
    if (dd) dd.style.display = 'none';
  }, 180);
}

window.addEventListener('scroll', () => {
  const dd = document.getElementById('dropdownClienteRel');
  if (dd && dd.style.display !== 'none') _posicionarDropdownClienteRel();
}, true);

// Gerar extrato
async function gerarExtratoCliente() {
  const clienteId = document.getElementById('clienteIdRel').value;
  const nomeCliente = document.getElementById('buscaClienteRel').value;
  const container = document.getElementById('relExtratoCliente');
  const btnImprimir = document.getElementById('btnImprimirExtrato');

  if (!clienteId) {
    container.innerHTML = '<p style="color:var(--danger);text-align:center;padding:20px">Selecione um cliente primeiro.</p>';
    return;
  }

  container.innerHTML = '<div class="rel-loading">Carregando extrato...</div>';
  btnImprimir.style.display = 'none';

  try {
    // Pega período e status selecionados
    const { inicio, fim } = getPeriodoDatas();
    const statusFiltro = document.getElementById('statusFiltroExtrato')?.value || 'todos';

    // Busca dados do cliente
    const { data: cliente } = await window._supabase
      .from('clientes')
      .select('id, nome, telefone, email, cidade, estado, data_nascimento')
      .eq('id', clienteId).single();

    // Busca vendas do cliente NO PERÍODO
    const { data: vendas } = await window._supabase
      .from('vendas')
      .select('id, created_at, tipo, forma_pagamento, valor_total, status, itens_venda(quantidade, preco_vend, produtos(nome, descricao))')
      .eq('cliente_id', clienteId)
      .neq('status', 'cancelada')
      .gte('created_at', inicio)
      .lte('created_at', fim)
      .order('created_at', { ascending: true });

    // Busca crediários do período
    const { data: crediariosRaw } = await window._supabase
      .from('crediario')
      .select('id, valor_total, parcelas, status, created_at, venda_id, parcelas_crediario(id, numero, valor, status, vencimento, data_pag, forma_pagamento, parcelas)')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: true });

    let crediarios = crediariosRaw || [];
    let vendasLista = vendas || [];

    // Aplica filtro de status
    if (statusFiltro === 'aberto') {
      // Só crediários com parcelas pendentes/vencidas
      crediarios = crediarios.filter(c =>
        (c.parcelas_crediario || []).some(p => ['pendente','vencido'].includes(p.status))
      );
      // Só vendas vinculadas a esses crediários em aberto
      const idsComAberto = new Set(crediarios.map(c => c.venda_id));
      vendasLista = vendasLista.filter(v => idsComAberto.has(v.id));
    } else if (statusFiltro === 'quitado') {
      // Só crediários totalmente pagos
      crediarios = crediarios.filter(c =>
        c.status === 'quitado' ||
        (c.parcelas_crediario || []).every(p => p.status === 'pago')
      );
      // Só vendas vinculadas a esses crediários quitados
      const idsQuitados = new Set(crediarios.map(c => c.venda_id));
      vendasLista = vendasLista.filter(v => idsQuitados.has(v.id));
    }

    // Totais gerais
    const totalCompras = vendasLista.reduce((s, v) => s + (v.valor_total || 0), 0);
    const totalPago = crediarios.reduce((s, c) => {
      const pago = (c.parcelas_crediario || [])
        .filter(p => p.status === 'pago')
        .reduce((sp, p) => sp + (p.valor || 0), 0);
      return s + pago;
    }, 0);
    const totalPendente = crediarios.reduce((s, c) => {
      const pend = (c.parcelas_crediario || [])
        .filter(p => ['pendente','vencido'].includes(p.status))
        .reduce((sp, p) => sp + (p.valor || 0), 0);
      return s + pend;
    }, 0);

    const fmt = v => 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

    // Render KPIs
    let html = `
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px">
        <div style="background:#f5f5f5;border-radius:8px;padding:12px 16px;min-width:140px">
          <div style="font-size:11px;color:#666;margin-bottom:4px">Total em Compras</div>
          <div style="font-size:18px;font-weight:700">${fmt(totalCompras)}</div>
        </div>
        <div style="background:#e8f5e9;border-radius:8px;padding:12px 16px;min-width:140px">
          <div style="font-size:11px;color:#666;margin-bottom:4px">Total Pago</div>
          <div style="font-size:18px;font-weight:700;color:#2e7d32">${fmt(totalPago)}</div>
        </div>
        <div style="background:#${totalPendente > 0 ? 'fff3e0' : 'f5f5f5'};border-radius:8px;padding:12px 16px;min-width:140px">
          <div style="font-size:11px;color:#666;margin-bottom:4px">Saldo Devedor</div>
          <div style="font-size:18px;font-weight:700;color:${totalPendente > 0 ? '#e65100' : '#333'}">${fmt(totalPendente)}</div>
        </div>
        <div style="background:#f5f5f5;border-radius:8px;padding:12px 16px;min-width:140px">
          <div style="font-size:11px;color:#666;margin-bottom:4px">Compras Realizadas</div>
          <div style="font-size:18px;font-weight:700">${vendasLista.length}</div>
        </div>
      </div>`;

    // Render cada venda com seus itens e parcelas
    if (!vendasLista.length) {
      html += '<p style="color:#888;text-align:center;padding:20px">Nenhuma compra encontrada para este cliente.</p>';
    } else {
      vendasLista.forEach(v => {
        const cred = crediarios.find(c => c.venda_id === v.id);
        const dataVenda = new Date(v.created_at).toLocaleDateString('pt-BR');
        const formaPag = v.forma_pagamento === 'crediario' ? 'Crediário' :
                         v.forma_pagamento === 'dinheiro'  ? 'Dinheiro'  :
                         v.forma_pagamento === 'pix'       ? 'PIX'       :
                         v.forma_pagamento === 'debito'    ? 'Débito'    :
                         v.forma_pagamento === 'credito'   ? 'Crédito'   : v.forma_pagamento;

        html += `
          <div style="border:1px solid #e0e0e0;border-radius:8px;margin-bottom:16px;overflow:hidden">
            <div style="background:#f8f8f8;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
              <div>
                <span style="font-weight:600">Venda #${v.id}</span>
                <span style="color:#888;font-size:13px;margin-left:8px">${dataVenda}</span>
                <span style="background:#e3f2fd;color:#1565c0;border-radius:4px;padding:2px 8px;font-size:12px;margin-left:8px">${formaPag}</span>
              </div>
              <div style="font-weight:700;font-size:15px">${fmt(v.valor_total)}</div>
            </div>`;

        // Itens da venda
        if (v.itens_venda?.length) {
          html += '<div style="padding:8px 14px;border-bottom:1px solid #f0f0f0">';
          html += '<div style="font-size:12px;color:#888;margin-bottom:6px">PRODUTOS</div>';
          v.itens_venda.forEach(item => {
            html += `<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0">
              <span>${item.produtos?.nome || '—'} ${item.produtos?.descricao ? '· ' + item.produtos.descricao : ''} (${item.quantidade}x)</span>
              <span style="color:#555">${fmt(item.preco_vend * item.quantidade)}</span>
            </div>`;
          });
          html += '</div>';
        }

        // Parcelas do crediário desta venda
        if (cred) {
          const todasParcelas = (cred.parcelas_crediario || []).sort((a,b) => a.numero - b.numero || a.id - b.id);
          html += '<div style="padding:8px 14px">';
          html += '<div style="font-size:12px;color:#888;margin-bottom:6px">PARCELAS DO CREDIÁRIO</div>';
          const fmtForma = f => f === 'dinheiro' ? '💵 Dinheiro' : f === 'pix' ? '⚡ PIX' :
                                f === 'debito' ? '💳 Débito' : f === 'credito' ? '💳 Crédito' : f || '';
          todasParcelas.forEach(p => {
            const statusColor = p.status === 'pago' ? '#2e7d32' : p.status === 'vencido' ? '#c62828' : '#e65100';
            const statusLabel = p.status === 'pago' ? 'PAGO' : p.status === 'vencido' ? 'VENCIDO' : 'PENDENTE';
            html += `<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:4px 0;border-bottom:1px solid #f5f5f5">
              <div>
                <span style="font-weight:500">${p.numero}/${cred.parcelas}</span>
                <span style="color:#888;margin:0 8px">·</span>
                <span>Venc: ${fmtDate(p.vencimento)}</span>
                ${p.status === 'pago' ? `<span style="color:#888;margin-left:8px">· Pago em: ${fmtDate(p.data_pag)}</span>` : ''}
                ${p.status === 'pago' && p.forma_pagamento ? `<span style="color:#555;margin-left:6px">· ${fmtForma(p.forma_pagamento)}</span>` : ''}
              </div>
              <div style="display:flex;align-items:center;gap:10px">
                <span style="font-weight:600">${fmt(p.valor)}</span>
                <span style="background:${statusColor}22;color:${statusColor};border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600">${statusLabel}</span>
              </div>
            </div>`;
          });
          html += '</div>';
        }

        html += '</div>';
      });
    }

    container.innerHTML = html;
    btnImprimir.style.display = '';

    // Salva dados para impressão
    window._extratoAtual = { cliente, vendasLista, crediarios, totalCompras, totalPago, totalPendente, fmt, fmtDate };

  } catch(err) {
    container.innerHTML = `<p style="color:var(--danger);text-align:center;padding:20px">Erro ao carregar extrato: ${err.message}</p>`;
  }
}

// Impressão do extrato
function imprimirExtratoCliente() {
  const d = window._extratoAtual;
  if (!d) return;

  const { cliente, vendasLista, crediarios, totalCompras, totalPago, totalPendente, fmt, fmtDate } = d;
  const dataImpressao = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

  let tbody = '';
  vendasLista.forEach(v => {
    const cred = crediarios.find(c => c.venda_id === v.id);
    const dataVenda = new Date(v.created_at).toLocaleDateString('pt-BR');
    const formaPag = v.forma_pagamento === 'crediario' ? 'Crediário' :
                     v.forma_pagamento === 'dinheiro'  ? 'Dinheiro'  :
                     v.forma_pagamento === 'pix'       ? 'PIX'       :
                     v.forma_pagamento === 'debito'    ? 'Débito'    :
                     v.forma_pagamento === 'credito'   ? 'Crédito'   : v.forma_pagamento;

    // Linha da venda
    tbody += `<tr style="background:#f0f0f0;font-weight:bold">
      <td colspan="5">Venda #${v.id} — ${dataVenda} — ${formaPag} — Total: ${fmt(v.valor_total)}</td>
    </tr>`;

    // Itens
    (v.itens_venda || []).forEach(item => {
      tbody += `<tr>
        <td style="padding-left:16px">📦 ${item.produtos?.nome || '—'} ${item.produtos?.descricao ? '(' + item.produtos.descricao + ')' : ''}</td>
        <td style="text-align:center">${item.quantidade}x</td>
        <td></td><td></td>
        <td style="text-align:right">${fmt(item.preco_vend * item.quantidade)}</td>
      </tr>`;
    });

    // Parcelas
    if (cred) {
      const todasParcelas = (cred.parcelas_crediario || []).sort((a,b) => a.numero - b.numero || a.id - b.id);
      const fmtForma = f => f === 'dinheiro' ? 'Dinheiro' : f === 'pix' ? 'PIX' :
                           f === 'debito' ? 'Débito' : f === 'credito' ? 'Crédito' : f || '';
      todasParcelas.forEach(p => {
        const statusLabel = p.status === 'pago' ? 'PAGO' : p.status === 'vencido' ? 'VENCIDO' : 'PENDENTE';
        const cor = p.status === 'pago' ? '#2e7d32' : p.status === 'vencido' ? '#c62828' : '#e65100';
        const formaPag = p.status === 'pago' && p.forma_pagamento ? ' · ' + fmtForma(p.forma_pagamento) : '';
        tbody += `<tr>
          <td style="padding-left:16px;color:#555">💳 Parcela ${p.numero}/${cred.parcelas}${formaPag}</td>
          <td></td>
          <td style="text-align:center">Venc: ${fmtDate(p.vencimento)}</td>
          <td style="text-align:center">${p.data_pag ? 'Pago: ' + fmtDate(p.data_pag) : '—'}</td>
          <td style="text-align:right;color:${cor};font-weight:600">${statusLabel} ${fmt(p.valor)}</td>
        </tr>`;
      });
    }
  });

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Extrato — ${cliente.nome}</title>
<style>
  @media print { @page { size: A4 portrait; margin: 10mm; } }
  * { font-family: Arial, sans-serif; font-size: 9pt; box-sizing: border-box; margin:0; padding:0; }
  body { padding: 14px; }
  h1 { font-size: 14pt; margin-bottom: 2px; }
  .sub { font-size: 8pt; color: #666; margin-bottom: 10px; }
  .kpis { display:flex; gap:12px; margin-bottom:12px; flex-wrap:wrap; }
  .kpi { background:#f5f5f5; border-radius:4px; padding:6px 12px; }
  .kpi strong { display:block; font-size:11pt; }
  table { width:100%; border-collapse:collapse; margin-top:4px; }
  th { background:#333; color:#fff; padding:4px 6px; text-align:left; font-size:8pt; }
  td { padding:3px 6px; border-bottom:1px solid #eee; font-size:8pt; }
  .footer { margin-top:16px; font-size:8pt; color:#888; border-top:1px solid #ddd; padding-top:8px; }
</style>
</head><body>
<h1>Extrato do Cliente — ${cliente.nome}</h1>
<div class="sub">
  ${cliente.telefone ? 'Tel: ' + cliente.telefone + ' · ' : ''}
  ${cliente.cidade ? cliente.cidade + ' · ' : ''}
  Gerado em ${dataImpressao}
</div>
<div class="kpis">
  <div class="kpi"><strong>${fmt(totalCompras)}</strong>Total em Compras</div>
  <div class="kpi"><strong style="color:#2e7d32">${fmt(totalPago)}</strong>Total Pago</div>
  <div class="kpi"><strong style="color:${totalPendente > 0 ? '#e65100' : '#333'}">${fmt(totalPendente)}</strong>Saldo Devedor</div>
  <div class="kpi"><strong>${vendasLista.length}</strong>Compras</div>
</div>
<table>
  <thead><tr><th>Descrição</th><th>Qtd</th><th>Vencimento</th><th>Pagamento</th><th style="text-align:right">Valor</th></tr></thead>
  <tbody>${tbody}</tbody>
</table>
<div class="footer">Treemali ERP · Extrato gerado em ${dataImpressao}</div>
<script>window.print();<\/script>
</body></html>`);
  win.document.close();
}
