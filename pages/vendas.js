/**
 * TREEMALI ERP — Módulo de Vendas
 * Venda normal, condicional e crediário
 * Com cálculo de taxa, autorização de desconto e comprovante
 */

// ── Estado da venda atual
let _estado = {
  tipo:       'normal',
  forma:      'dinheiro',
  itens:      [],       // { produto, qtd, precoUnitario, custoUnitario, precoAlterado }
  bandeira:   null,
  parcelas:   1,
  taxa:       0,
  desconto:   0,
  subtotal:   0,
  total:      0,
  liquido:    0,
  lucro:      0,
};

let _produtos    = [];
let _clientes    = [];
let _bandeiras   = [];
let _taxas       = [];

// Callback de autorização pendente
let _pendingAuthCallback = null;

// ══════════════════════════════════════════════
// INICIALIZAÇÃO
// ══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([
    carregarProdutos(),
    carregarClientes(),
    carregarBandeiras(),
    carregarPontosVenda(),
  ]);
  recalcularTotais();
});

// ══════════════════════════════════════════════
// CARREGAR DADOS
// ══════════════════════════════════════════════

async function carregarPontosVenda() {
  const sel = document.getElementById('vendaPontoVenda');
  if (!sel) return;

  if (!window._supabase) {
    sel.innerHTML = `
      <option value="">Estoque Central</option>
      <option value="1">Loja Matriz</option>
      <option value="2">Loja Shopping</option>`;
    return;
  }

  const { data } = await window._supabase
    .from('pontos_venda')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome');

  sel.innerHTML = '<option value="">Estoque Central</option>' +
    (data || []).map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
}

async function atualizarEstoquePonto() {
  // Quando muda o ponto, recarrega os produtos com o estoque correto
  await carregarProdutos();
  // Limpa itens já adicionados para evitar vender do estoque errado
  if (_estado.itens.length > 0) {
    _estado.itens = [];
    renderItens();
    recalcularTotais();
    Toast.warning('Ponto de venda alterado', 'Os produtos foram removidos. Adicione novamente.');
  }
}

async function carregarProdutos() {
  const pontoId = parseInt(document.getElementById('vendaPontoVenda')?.value) || null;

  if (!window._supabase) {
    _produtos = [
      { id:1, nome:'Camiseta Preta P',  sku:'CAM-001', descricao:'Tecido 100% algodão, tam P', custo:30,  preco_venda:79.90,  preco_avista:69.90,  estoque_atual:15 },
      { id:2, nome:'Calça Jeans 38',    sku:'CAL-001', descricao:'Jeans slim fit, cintura alta', custo:80, preco_venda:189.90, preco_avista:169.90, estoque_atual:3  },
      { id:3, nome:'Blusa Floral M',    sku:'BLU-001', descricao:'Viscose, estampa floral',      custo:45, preco_venda:119.90, preco_avista:99.90,  estoque_atual:8  },
      { id:4, nome:'Vestido Midi Bege', sku:'VES-001', descricao:'Linho bege, tam único',        custo:90, preco_venda:229.90, preco_avista:199.90, estoque_atual:5  },
    ];
  } else if (pontoId) {
    // Busca produtos com estoque do ponto selecionado
    const { data } = await window._supabase
      .from('estoque_ponto')
      .select('quantidade, produtos(id, nome, sku, descricao, custo, preco_venda, preco_avista)')
      .eq('ponto_id', pontoId)
      .gt('quantidade', 0);

    _produtos = (data || []).map(ep => ({
      ...ep.produtos,
      estoque_atual: ep.quantidade,
    }));
  } else {
    // Estoque central
    const { data } = await window._supabase
      .from('produtos')
      .select('id, nome, sku, descricao, custo, preco_venda, preco_avista, estoque_atual')
      .eq('ativo', true).order('nome');
    _produtos = data || [];
  }

  const inp = document.getElementById('inputBuscaProduto');
  if (inp) inp.value = '';
  document.getElementById('selectProduto').value = '';
}

// ── Busca de produto com dropdown
function filtrarProdutosBusca() {
  const termo = (document.getElementById('inputBuscaProduto').value || '').toLowerCase().trim();
  mostrarListaProdutos(termo);
}

function mostrarListaProdutos(termo = '') {
  const lista = document.getElementById('listaProdutos');
  if (!lista) return;

  let filtrados = _produtos;
  if (termo) {
    filtrados = _produtos.filter(p =>
      p.nome?.toLowerCase().includes(termo) ||
      p.sku?.toLowerCase().includes(termo) ||
      p.descricao?.toLowerCase().includes(termo)
    );
  }

  if (!filtrados.length) {
    lista.innerHTML = '<div class="produto-dropdown-empty">Nenhum produto encontrado</div>';
    lista.classList.remove('hidden');
    return;
  }

  lista.innerHTML = filtrados.map(p => `
    <div class="produto-dropdown-item ${p.estoque_atual === 0 ? 'produto-estoque-zero' : ''}"
      onclick="selecionarProduto(${p.id})">
      <div class="produto-dropdown-nome">${p.nome}${p.sku ? ' — ' + p.sku : ''}</div>
      <div class="produto-dropdown-detalhe">
        Estoque: ${p.estoque_atual} · À Vista: ${Format.currency(p.preco_avista||0)} · Prazo: ${Format.currency(p.preco_venda)}
      </div>
      ${p.descricao ? `<div class="produto-dropdown-descricao">${p.descricao}</div>` : ''}
    </div>
  `).join('');
  lista.classList.remove('hidden');
}

function selecionarProduto(id) {
  const p = _produtos.find(x => x.id === id);
  if (!p) return;
  document.getElementById('selectProduto').value = id;
  document.getElementById('inputBuscaProduto').value = `${p.nome}${p.sku ? ' — ' + p.sku : ''}`;
  fecharListaProdutos();
  document.getElementById('inputQtd').focus();
}

function fecharListaProdutos() {
  const lista = document.getElementById('listaProdutos');
  if (lista) lista.classList.add('hidden');
}

// Fecha dropdown ao clicar fora
document.addEventListener('click', e => {
  if (!e.target.closest('.produto-search-wrap')) fecharListaProdutos();
});

async function carregarClientes() {
  if (!window._supabase) {
    _clientes = [
      { id:1, nome:'Ana Silva'   },
      { id:2, nome:'Pedro Souza' },
      { id:3, nome:'— Sem cadastro —', id: 0 },
    ];
  } else {
    const { data } = await window._supabase
      .from('clientes').select('id, nome').eq('ativo', true).order('nome');
    _clientes = data || [];
  }
  const opts = _clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
  document.getElementById('vendaCliente').innerHTML =
    '<option value="">Selecione o cliente...</option>' + opts;
}

async function carregarBandeiras() {
  if (!window._supabase) {
    _bandeiras = [
      { id:1, nome:'Visa / Mastercard' },
      { id:2, nome:'Elo / Amex'        },
    ];
    _taxas = [
      { bandeira_id:1, tipo:'debito',            parcelas:1,  taxa:1.37  },
      { bandeira_id:1, tipo:'credito_vista',      parcelas:1,  taxa:3.15  },
      { bandeira_id:1, tipo:'credito_parcelado',  parcelas:2,  taxa:5.39  },
      { bandeira_id:1, tipo:'credito_parcelado',  parcelas:3,  taxa:6.12  },
      { bandeira_id:1, tipo:'credito_parcelado',  parcelas:4,  taxa:6.85  },
      { bandeira_id:1, tipo:'credito_parcelado',  parcelas:5,  taxa:7.57  },
      { bandeira_id:1, tipo:'credito_parcelado',  parcelas:6,  taxa:8.28  },
      { bandeira_id:1, tipo:'credito_parcelado',  parcelas:7,  taxa:8.99  },
      { bandeira_id:1, tipo:'credito_parcelado',  parcelas:8,  taxa:9.69  },
      { bandeira_id:1, tipo:'credito_parcelado',  parcelas:9,  taxa:10.38 },
      { bandeira_id:1, tipo:'credito_parcelado',  parcelas:10, taxa:11.06 },
      { bandeira_id:1, tipo:'credito_parcelado',  parcelas:11, taxa:11.74 },
      { bandeira_id:1, tipo:'credito_parcelado',  parcelas:12, taxa:12.40 },
      { bandeira_id:2, tipo:'debito',            parcelas:1,  taxa:2.58  },
      { bandeira_id:2, tipo:'credito_vista',      parcelas:1,  taxa:4.91  },
      { bandeira_id:2, tipo:'credito_parcelado',  parcelas:2,  taxa:6.47  },
      { bandeira_id:2, tipo:'credito_parcelado',  parcelas:3,  taxa:7.20  },
      { bandeira_id:2, tipo:'credito_parcelado',  parcelas:4,  taxa:7.92  },
      { bandeira_id:2, tipo:'credito_parcelado',  parcelas:5,  taxa:8.63  },
      { bandeira_id:2, tipo:'credito_parcelado',  parcelas:6,  taxa:9.33  },
      { bandeira_id:2, tipo:'credito_parcelado',  parcelas:7,  taxa:10.03 },
      { bandeira_id:2, tipo:'credito_parcelado',  parcelas:8,  taxa:10.72 },
      { bandeira_id:2, tipo:'credito_parcelado',  parcelas:9,  taxa:11.41 },
      { bandeira_id:2, tipo:'credito_parcelado',  parcelas:10, taxa:12.08 },
      { bandeira_id:2, tipo:'credito_parcelado',  parcelas:11, taxa:12.75 },
      { bandeira_id:2, tipo:'credito_parcelado',  parcelas:12, taxa:13.41 },
    ];
  } else {
    const [b, t] = await Promise.all([
      window._supabase.from('bandeiras').select('*').order('nome'),
      window._supabase.from('taxas_pagamento').select('*'),
    ]);
    _bandeiras = b.data || [];
    _taxas     = t.data || [];
  }

  const opts = _bandeiras.map(b => `<option value="${b.id}">${b.nome}</option>`).join('');
  document.getElementById('vendaBandeira').innerHTML =
    '<option value="">Selecione a bandeira...</option>' + opts;
}

// ══════════════════════════════════════════════
// TIPO DE VENDA
// ══════════════════════════════════════════════

function setTipo(tipo) {
  _estado.tipo = tipo;
  document.querySelectorAll('.tipo-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tipo === tipo);
  });

  // Condicional — mostra prazo, esconde pagamento
  document.getElementById('rowPrazo').classList.toggle('hidden', tipo !== 'condicional');
  document.getElementById('cardPagamento').style.display = tipo === 'condicional' ? 'none' : '';
  document.getElementById('rowParcelasCrediario').classList.toggle('hidden', tipo !== 'crediario');
  document.getElementById('rowVencimentoCrediario').classList.toggle('hidden', tipo !== 'crediario');

  // Preenche data padrão = 30 dias a partir de hoje
  if (tipo === 'crediario') {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    document.getElementById('vendaVencimentoCrediario').value = d.toISOString().split('T')[0];
  }

  // Label do botão
  const labels = { normal: 'Finalizar Venda', condicional: 'Registrar Condicional', crediario: 'Finalizar Crediário' };
  document.getElementById('btnFinalizarLabel').textContent = labels[tipo];

  // Lucro só aparece em venda normal
  document.getElementById('resumoLinhaLucro').style.display = tipo === 'normal' ? 'flex' : 'none';

  recalcularTotais();
}

// ══════════════════════════════════════════════
// FORMA DE PAGAMENTO
// ══════════════════════════════════════════════

function setForma(forma) {
  _estado.forma    = forma;
  _estado.bandeira = null;
  _estado.parcelas = 1;
  _estado.taxa     = 0;

  document.querySelectorAll('.forma-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.forma === forma);
  });

  const rowBandeira = document.getElementById('rowBandeira');
  const rowParcelas = document.getElementById('rowParcelasCredito');

  if (forma === 'debito' || forma === 'credito') {
    rowBandeira.classList.remove('hidden');
    rowParcelas.style.display = forma === 'credito' ? 'block' : 'none';
  } else {
    rowBandeira.classList.add('hidden');
    rowParcelas.style.display = 'none';
  }

  calcularTaxa();
}

function calcularTaxa() {
  const bandeiraId = parseInt(document.getElementById('vendaBandeira').value) || null;
  const parcelas   = parseInt(document.getElementById('vendaParcelas').value) || 1;

  _estado.bandeira = bandeiraId;
  _estado.parcelas = parcelas;
  _estado.taxa     = 0;

  if (!bandeiraId) { recalcularTotais(); return; }

  let tipo;
  if (_estado.forma === 'debito') {
    tipo = 'debito';
  } else if (_estado.forma === 'credito') {
    tipo = parcelas === 1 ? 'credito_vista' : 'credito_parcelado';
  } else {
    recalcularTotais();
    return;
  }

  const taxaObj = _taxas.find(t =>
    t.bandeira_id === bandeiraId &&
    t.tipo === tipo &&
    t.parcelas === parcelas
  );

  _estado.taxa = taxaObj ? parseFloat(taxaObj.taxa) : 0;
  recalcularTotais();
}

// ══════════════════════════════════════════════
// ITENS DA VENDA
// ══════════════════════════════════════════════

function adicionarProduto() {
  const prodId = parseInt(document.getElementById('selectProduto').value);
  const qtd    = parseInt(document.getElementById('inputQtd').value) || 1;

  if (!prodId) { Toast.warning('Selecione um produto da lista.'); return; }

  const produto = _produtos.find(p => p.id === prodId);
  if (!produto) return;

  // Verifica se já está na lista — soma a quantidade
  const existente = _estado.itens.findIndex(i => i.produto.id === prodId);
  if (existente >= 0) {
    _estado.itens[existente].qtd += qtd;
    renderItens();
    recalcularTotais();
    // Limpa busca
    document.getElementById('inputBuscaProduto').value = '';
    document.getElementById('selectProduto').value = '';
    document.getElementById('inputQtd').value = 1;
    return;
  }

  _estado.itens.push({
    produto,
    qtd,
    precoUnitario: produto.preco_venda,
    custoUnitario: produto.custo,
    precoAlterado: false,
    tipoPreco:     'prazo',
  });

  // Limpa busca
  document.getElementById('inputBuscaProduto').value = '';
  document.getElementById('selectProduto').value = '';
  document.getElementById('inputQtd').value = 1;
  renderItens();
  recalcularTotais();
}

function renderItens() {
  const container = document.getElementById('itensVenda');
  const empty     = document.getElementById('itensEmpty');

  if (!_estado.itens.length) {
    empty.style.display = 'flex';
    container.querySelectorAll('.item-venda').forEach(el => el.remove());
    return;
  }

  empty.style.display = 'none';
  container.querySelectorAll('.item-venda').forEach(el => el.remove());

  _estado.itens.forEach((item, idx) => {
    const temAvista = item.produto.preco_avista > 0;
    const div = document.createElement('div');
    div.className = 'item-venda';
    div.innerHTML = `
      <div class="item-venda-info">
        <div class="item-venda-nome">${item.produto.nome}${item.produto.sku ? ' <span style="color:var(--color-gray-400);font-weight:400;font-size:var(--text-xs)">— ' + item.produto.sku + '</span>' : ''}</div>
        ${item.produto.descricao ? `<div style="font-size:var(--text-xs);color:var(--color-taupe);font-style:italic;margin-bottom:2px">${item.produto.descricao}</div>` : ''}
        <div class="item-venda-sub">
          ${Auth.isMaster() ? `Custo: ${Format.currency(item.custoUnitario)} · ` : ''}${temAvista ? `À vista: ${Format.currency(item.produto.preco_avista)} · Prazo: ${Format.currency(item.produto.preco_venda)}` : `Preço: ${Format.currency(item.produto.preco_venda)}`}
        </div>
        ${temAvista ? `
        <div class="item-preco-btns">
          <button class="item-preco-btn ${item.tipoPreco==='prazo'?'active':''}"
            onclick="setTipoPreco(${idx},'prazo')">
            A Prazo ${Format.currency(item.produto.preco_venda)}
          </button>
          <button class="item-preco-btn ${item.tipoPreco==='avista'?'active avista':''}"
            onclick="setTipoPreco(${idx},'avista')">
            À Vista ${Format.currency(item.produto.preco_avista)}
          </button>
        </div>` : ''}
      </div>
      <div class="item-qtd-ctrl">
        <button class="btn-qtd" onclick="alterarQtd(${idx}, -1)">−</button>
        <span class="item-qtd-num">${item.qtd}</span>
        <button class="btn-qtd" onclick="alterarQtd(${idx}, 1)">+</button>
      </div>
      <div class="item-venda-preco ${item.tipoPreco==='outro'?'alterado':''}">
        ${Format.currency(item.precoUnitario * item.qtd)}
        ${item.tipoPreco==='outro'?'<br><small style="font-size:10px">preço personalizado</small>':''}
      </div>
      <button class="btn-item-edit" onclick="solicitarAlteracaoPreco(${idx})" title="Outro valor">✎</button>
      <button class="btn-item-remove" onclick="removerItem(${idx})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    container.appendChild(div);
  });
}

function alterarQtd(idx, delta) {
  _estado.itens[idx].qtd = Math.max(1, _estado.itens[idx].qtd + delta);
  renderItens();
  recalcularTotais();
}

function removerItem(idx) {
  _estado.itens.splice(idx, 1);
  renderItens();
  recalcularTotais();
}

// Troca entre preço à vista e prazo — livre, sem senha
function setTipoPreco(idx, tipo) {
  const item = _estado.itens[idx];
  if (tipo === 'prazo') {
    item.precoUnitario = item.produto.preco_venda;
    item.tipoPreco     = 'prazo';
    item.precoAlterado = false;
  } else if (tipo === 'avista') {
    item.precoUnitario = item.produto.preco_avista;
    item.tipoPreco     = 'avista';
    item.precoAlterado = false;
  }
  renderItens();
  recalcularTotais();
}

// ══════════════════════════════════════════════
// CÁLCULO DE TOTAIS
// ══════════════════════════════════════════════

function recalcularTotais() {
  const subtotal  = _estado.itens.reduce((s, i) => s + (i.precoUnitario * i.qtd), 0);
  const desconto  = parseFloat(document.getElementById('vendaDesconto')?.value) || 0;
  const totalBruto = Math.max(0, subtotal - desconto);
  const valorTaxa  = _estado.tipo === 'normal' && _estado.taxa > 0
    ? totalBruto * (_estado.taxa / 100)
    : 0;
  const liquido    = totalBruto - valorTaxa;
  const custTotal  = _estado.itens.reduce((s, i) => s + (i.custoUnitario * i.qtd), 0);
  const lucro      = liquido - custTotal;

  _estado.subtotal = subtotal;
  _estado.desconto = desconto;
  _estado.total    = totalBruto;
  _estado.liquido  = liquido;
  _estado.lucro    = lucro;

  // Atualiza resumo
  setText('resumoSubtotal', Format.currency(subtotal));
  setText('resumoQtdItens', `${_estado.itens.reduce((s,i) => s+i.qtd, 0)} item(s)`);

  // Rentabilidade real sobre custo (já deduzida a taxa)
  const rentabilidade = custTotal > 0 ? ((lucro / custTotal) * 100).toFixed(1) : 0;
  const rentColor = parseFloat(rentabilidade) >= 80 ? 'var(--color-success)' :
                    parseFloat(rentabilidade) >= 40 ? 'var(--color-warning)' : 'var(--color-danger)';
  const resumoLucroEl = document.getElementById('resumoLucro');
  if (resumoLucroEl) {
    resumoLucroEl.innerHTML = `${Format.currency(lucro)} <span style="font-size:var(--text-xs);color:${rentColor};font-weight:600">(${rentabilidade}% s/ custo)</span>`;
  }

  const linhaDesc = document.getElementById('resumoLinhaDesconto');
  if (desconto > 0) {
    linhaDesc.style.display = 'flex';
    setText('resumoDesconto', `— ${Format.currency(desconto)}`);
  } else {
    linhaDesc.style.display = 'none';
  }

  const linhaTaxa = document.getElementById('resumoLinhaTaxa');
  if (valorTaxa > 0) {
    linhaTaxa.style.display = 'flex';
    setText('resumoTaxaLabel', `Taxa maquininha (${_estado.taxa}%)`);
    setText('resumoTaxa', `— ${Format.currency(valorTaxa)}`);
  } else {
    linhaTaxa.style.display = 'none';
  }

  setText('resumoTotal', Format.currency(totalBruto));

  const linhaLiq = document.getElementById('resumoLinhaLiquido');
  if (valorTaxa > 0) {
    linhaLiq.style.display = 'flex';
    setText('resumoLiquido', Format.currency(liquido));
  } else {
    linhaLiq.style.display = 'none';
  }
}

// ══════════════════════════════════════════════
// AUTORIZAÇÃO DE PREÇO
// ══════════════════════════════════════════════

function solicitarAlteracaoPreco(idx) {
  // Vendedor precisa de autorização do master
  if (Auth.isMaster()) {
    abrirModalEditarPreco(idx);
    return;
  }
  // Vendedor — pede senha
  _pendingAuthCallback = () => abrirModalEditarPreco(idx);
  document.getElementById('senhaAutorizacao').value = '';
  esconderErro('erroAutorizacao');
  abrirModal('modalAutorizacao');
}

async function confirmarAutorizacao() {
  const senha = document.getElementById('senhaAutorizacao').value.trim();
  if (!senha) { mostrarErroModal('erroAutorizacao', 'Digite a senha.'); return; }

  esconderErro('erroAutorizacao');

  // ── 1. Senha rápida via Supabase
  if (window._supabase) {
    try {
      const { data, error } = await window._supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'senha_rapida_atual')
        .single();

      if (!error && data?.valor && data.valor !== '{}' && data.valor !== '{"teste":true}') {
        const sr = JSON.parse(data.valor);
        if (sr.codigo && !sr.usada && sr.expiraEm > Date.now()) {
          if (String(sr.codigo).trim() === String(senha).trim()) {
            // Marca como usada via delete + insert (mais confiável que update)
            sr.usada = true;
            const usado = JSON.stringify(sr);
            await window._supabase.from('configuracoes').delete().eq('chave', 'senha_rapida_atual');
            await window._supabase.from('configuracoes').insert({ chave: 'senha_rapida_atual', valor: usado });
            localStorage.setItem('treemali_senha_rapida', usado);
            fecharModal('modalAutorizacao');
            if (_pendingAuthCallback) { _pendingAuthCallback(); _pendingAuthCallback = null; }
            Toast.success('Autorizado!', 'Senha rápida aceita.');
            return;
          }
        }
      }
    } catch(e) { console.warn('Erro senha rápida:', e); }
  }

  // ── 2. Senha rápida via localStorage (fallback mesmo dispositivo)
  try {
    const salvo = localStorage.getItem('treemali_senha_rapida');
    if (salvo) {
      const sr = JSON.parse(salvo);
      if (sr.codigo && !sr.usada && sr.expiraEm > Date.now()) {
        if (String(sr.codigo).trim() === String(senha).trim()) {
          sr.usada = true;
          localStorage.setItem('treemali_senha_rapida', JSON.stringify(sr));
          fecharModal('modalAutorizacao');
          if (_pendingAuthCallback) { _pendingAuthCallback(); _pendingAuthCallback = null; }
          Toast.success('Autorizado!', 'Senha rápida aceita.');
          return;
        }
      }
    }
  } catch(e) { console.warn('Erro localStorage:', e); }

  // ── 3. Senha do administrador
  if (!window._supabase) {
    // Demo mode
    if (senha === 'admin123') {
      fecharModal('modalAutorizacao');
      if (_pendingAuthCallback) { _pendingAuthCallback(); _pendingAuthCallback = null; }
      return;
    }
    mostrarErroModal('erroAutorizacao', 'Senha incorreta.');
    return;
  }

  // Busca admin pelo login/senha
  const { data: usuario } = await window._supabase
    .from('usuarios')
    .select('id, senha_hash, role')
    .eq('role', 'master')
    .eq('ativo', true);

  const senhaHash = btoa(senha);
  const adminOk   = (usuario || []).some(u => u.senha_hash === senhaHash);

  if (!adminOk) {
    mostrarErroModal('erroAutorizacao', 'Senha incorreta. Use a senha rápida gerada nas Configurações ou a senha do administrador.');
    return;
  }

  fecharModal('modalAutorizacao');
  if (_pendingAuthCallback) {
    _pendingAuthCallback();
    _pendingAuthCallback = null;
  }
}

function abrirModalEditarPreco(idx) {
  const item = _estado.itens[idx];
  const temAvista = item.produto.preco_avista > 0;
  document.getElementById('editarPrecoIndex').value = idx;
  document.getElementById('editarPrecoNome').textContent = item.produto.nome;
  document.getElementById('editarPrecoPadrao').value = temAvista
    ? `À Vista: ${Format.currency(item.produto.preco_avista)} | Prazo: ${Format.currency(item.produto.preco_venda)}`
    : Format.currency(item.produto.preco_venda);
  document.getElementById('editarPrecoNovo').value = item.precoUnitario;
  esconderErro('erroEditarPreco');
  abrirModal('modalEditarPreco');
}

function aplicarNovoPreco() {
  const idx       = parseInt(document.getElementById('editarPrecoIndex').value);
  const novoPreco = parseFloat(document.getElementById('editarPrecoNovo').value);
  if (!novoPreco || novoPreco <= 0) {
    mostrarErroModal('erroEditarPreco', 'Informe um preço válido.');
    return;
  }
  _estado.itens[idx].precoUnitario = novoPreco;
  _estado.itens[idx].precoAlterado = true;
  _estado.itens[idx].tipoPreco     = 'outro';
  fecharModal('modalEditarPreco');
  renderItens();
  recalcularTotais();
  Toast.warning('Preço personalizado aplicado', 'Valor diferente do à vista e prazo.');
}

// ══════════════════════════════════════════════
// FINALIZAR VENDA
// ══════════════════════════════════════════════

async function finalizarVenda() {
  esconderErro('erroVenda');

  if (!_estado.itens.length) {
    mostrarErroModal('erroVenda', 'Adicione pelo menos um produto.');
    return;
  }

  if (_estado.tipo === 'condicional') {
    const prazo = document.getElementById('vendaPrazo').value;
    if (!prazo) { mostrarErroModal('erroVenda', 'Informe o prazo de devolução.'); return; }
  }

  if (_estado.tipo === 'crediario') {
    const venc = document.getElementById('vendaVencimentoCrediario').value;
    if (!venc) { mostrarErroModal('erroVenda', 'Informe o vencimento da 1ª parcela.'); return; }
  }

  if (_estado.tipo === 'normal' && (_estado.forma === 'debito' || _estado.forma === 'credito')) {
    if (!_estado.bandeira) { mostrarErroModal('erroVenda', 'Selecione a bandeira do cartão.'); return; }
  }

  document.getElementById('btnFinalizar').disabled = true;
  document.getElementById('btnFinalizar').textContent = 'Processando...';

  try {
    if (_estado.tipo === 'condicional') {
      await registrarCondicional();
    } else {
      await registrarVenda();
    }
  } catch (err) {
    mostrarErroModal('erroVenda', err.message || 'Erro ao finalizar.');
    document.getElementById('btnFinalizar').disabled = false;
    document.getElementById('btnFinalizarLabel').textContent =
      _estado.tipo === 'condicional' ? 'Registrar Condicional' :
      _estado.tipo === 'crediario'   ? 'Finalizar Crediário' : 'Finalizar Venda';
  }
}

async function registrarVenda() {
  const user       = Auth.getUser();
  const clienteId  = parseInt(document.getElementById('vendaCliente').value) || null;
  const obs        = document.getElementById('vendaObs').value.trim();
  const desconto   = _estado.desconto;
  const valorTaxa  = _estado.taxa > 0 ? _estado.total * (_estado.taxa / 100) : 0;

  const formaPag = _estado.tipo === 'crediario' ? 'crediario' : _estado.forma;

  const vendaDados = {
    cliente_id:      clienteId,
    vendedor_id:     user?.id || null,
    ponto_venda_id:  parseInt(document.getElementById('vendaPontoVenda')?.value) || null,
    tipo:            _estado.tipo,
    forma_pagamento: formaPag,
    bandeira_id:     _estado.bandeira,
    parcelas:        _estado.parcelas,
    taxa_aplicada:   _estado.taxa,
    valor_total:     _estado.total,
    valor_taxa:      valorTaxa,
    valor_liquido:   _estado.liquido,
    custo_total:     _estado.itens.reduce((s,i) => s + (i.custoUnitario * i.qtd), 0),
    lucro:           _estado.lucro,
    status:          'concluida',
    observacao:      obs || null,
  };

  if (!window._supabase) {
    // Demo — simula sucesso
    const vendaFake = { id: Date.now(), ...vendaDados };
    mostrarComprovante(vendaFake, _estado.itens, clienteId);
    return;
  }

  // Insere venda
  const { data: venda, error: errVenda } = await window._supabase
    .from('vendas').insert(vendaDados).select().single();
  if (errVenda) throw new Error(errVenda.message);

  // Insere itens e baixa estoque
  for (const item of _estado.itens) {
    await window._supabase.from('itens_venda').insert({
      venda_id:    venda.id,
      produto_id:  item.produto.id,
      quantidade:  item.qtd,
      custo_unit:  item.custoUnitario,
      preco_unit:  item.produto.preco_venda,
      preco_vend:  item.precoUnitario,
      desconto:    item.precoAlterado ? (item.produto.preco_venda - item.precoUnitario) * item.qtd : 0,
      total:       item.precoUnitario * item.qtd,
    });

    const pontoId = parseInt(document.getElementById('vendaPontoVenda')?.value) || null;

    if (pontoId) {
      // Baixa do estoque do ponto de venda
      const { data: ep } = await window._supabase
        .from('estoque_ponto')
        .select('quantidade')
        .eq('ponto_id', pontoId)
        .eq('produto_id', item.produto.id)
        .single();
      if (ep) {
        await window._supabase.from('estoque_ponto')
          .update({ quantidade: Math.max(0, ep.quantidade - item.qtd), updated_at: new Date().toISOString() })
          .eq('ponto_id', pontoId)
          .eq('produto_id', item.produto.id);
      }
    } else {
      // Baixa do estoque central
      const novoEstoque = (item.produto.estoque_atual || 0) - item.qtd;
      await window._supabase.from('produtos')
        .update({ estoque_atual: Math.max(0, novoEstoque), updated_at: new Date().toISOString() })
        .eq('id', item.produto.id);
    }

    // Registra movimentação
    const nomePonto = document.getElementById('vendaPontoVenda')?.selectedOptions[0]?.text || 'Estoque Central';
    await window._supabase.from('movimentacoes_estoque').insert({
      produto_id: item.produto.id,
      tipo:       'saida_venda',
      quantidade: -item.qtd,
      referencia: `Venda #${venda.id} — ${nomePonto}`,
      usuario_id: user?.id || null,
    });

    // Log se preço foi alterado
    if (item.precoAlterado) {
      await window._supabase.from('log_alteracao_preco').insert({
        venda_id:      venda.id,
        produto_id:    item.produto.id,
        vendedor_id:   user?.id || null,
        preco_padrao:  item.produto.preco_venda,
        preco_vendido: item.precoUnitario,
      });
    }
  }

  // Se crediário, cria parcelas
  if (_estado.tipo === 'crediario') {
    const nParcelas  = parseInt(document.getElementById('vendaParcelasCrediario').value) || 2;
    const valorParc  = _estado.total / nParcelas;
    const dataBase   = document.getElementById('vendaVencimentoCrediario').value;

    const { data: cred } = await window._supabase.from('crediario').insert({
      venda_id:    venda.id,
      cliente_id:  clienteId,
      valor_total: _estado.total,
      parcelas:    nParcelas,
    }).select().single();

    if (cred) {
      for (let i = 0; i < nParcelas; i++) {
        // Primeira parcela = data escolhida, as demais +1 mês cada
        const venc = dataBase ? new Date(dataBase + 'T12:00:00') : new Date();
        venc.setMonth(venc.getMonth() + i);
        await window._supabase.from('parcelas_crediario').insert({
          crediario_id: cred.id,
          numero:       i + 1,
          vencimento:   venc.toISOString().split('T')[0],
          valor:        parseFloat(valorParc.toFixed(2)),
        });
      }
    }
  }

  mostrarComprovante(venda, _estado.itens, clienteId);
}

async function registrarCondicional() {
  const user      = Auth.getUser();
  const clienteId = parseInt(document.getElementById('vendaCliente').value) || null;
  const prazo     = document.getElementById('vendaPrazo').value;
  const obs       = document.getElementById('vendaObs').value.trim();

  if (!window._supabase) {
    Toast.success('Condicional registrada!', 'Os produtos foram reservados.');
    novaVenda();
    return;
  }

  const { data: cond, error } = await window._supabase.from('condicionais').insert({
    cliente_id:      clienteId,
    vendedor_id:     user?.id || null,
    prazo_devolucao: prazo,
    observacao:      obs || null,
    status:          'em_condicional',
  }).select().single();

  if (error) throw new Error(error.message);

  for (const item of _estado.itens) {
    await window._supabase.from('itens_condicional').insert({
      condicional_id:   cond.id,
      produto_id:       item.produto.id,
      quantidade_orig:  item.qtd,
      quantidade_atual: item.qtd,
      preco_unit:       item.precoUnitario,
    });

    // Reserva no estoque (saída como condicional)
    const novoEst = (item.produto.estoque_atual || 0) - item.qtd;
    await window._supabase.from('produtos')
      .update({ estoque_atual: Math.max(0, novoEst), updated_at: new Date().toISOString() })
      .eq('id', item.produto.id);

    await window._supabase.from('movimentacoes_estoque').insert({
      produto_id: item.produto.id,
      tipo:       'saida_condicional',
      quantidade: -item.qtd,
      referencia: `Condicional #${cond.id}`,
      usuario_id: user?.id || null,
    });
  }

  await window._supabase.from('historico_condicional').insert({
    condicional_id: cond.id,
    acao:           'criacao',
    descricao:      `Condicional criada com ${_estado.itens.length} produto(s). Prazo: ${prazo}`,
    usuario_id:     user?.id || null,
  });

  Toast.success('Condicional registrada!', `Prazo de devolução: ${Format.date(prazo)}`);
  novaVenda();
}

// ══════════════════════════════════════════════
// COMPROVANTE
// ══════════════════════════════════════════════

function mostrarComprovante(venda, itens, clienteId) {
  const nomeCliente = clienteId
    ? (_clientes.find(c => c.id === clienteId)?.nome || 'Cliente')
    : 'Sem cadastro';

  const linhaItens = itens.map(i =>
    `  ${i.qtd}x ${i.produto.nome.padEnd(20).substring(0,20)}  ${Format.currency(i.precoUnitario * i.qtd)}`
  ).join('\n');

  const formaPag = {
    dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Débito',
    credito: `Crédito ${_estado.parcelas}x`, crediario: 'Crediário',
  }[_estado.forma] || _estado.forma;

  // Taxa e líquido só aparecem no comprovante do admin
  const isMaster = Auth.isMaster();
  const taxa = (isMaster && venda.valor_taxa > 0) ? `\nTaxa maquininha:   — ${Format.currency(venda.valor_taxa)}` : '';
  const liq  = (isMaster && venda.valor_taxa > 0) ? `\nValor líquido:       ${Format.currency(venda.valor_liquido)}` : '';
  const desc = _estado.desconto > 0  ? `\nDesconto:          — ${Format.currency(_estado.desconto)}` : '';

  const texto = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        TREEMALI
     Comprovante de Venda
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Data: ${new Date().toLocaleString('pt-BR')}
Cliente: ${nomeCliente}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITENS:
${linhaItens}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Subtotal:            ${Format.currency(_estado.subtotal)}${desc}
Total:               ${Format.currency(venda.valor_total)}${taxa}${liq}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pagamento: ${formaPag}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       Obrigado pela compra!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  document.getElementById('comprovante').textContent = texto;
  abrirModal('modalComprovante');

  document.getElementById('btnFinalizar').disabled = false;
  document.getElementById('btnFinalizarLabel').textContent = 'Finalizar Venda';
}

function imprimirComprovante() {
  const conteudo = document.getElementById('comprovante').textContent;
  const win = window.open('', '_blank');
  win.document.write(`<pre style="font-family:monospace;font-size:13px;padding:20px">${conteudo}</pre>`);
  win.print();
  win.close();
}

function copiarComprovante() {
  const texto = document.getElementById('comprovante').textContent;
  navigator.clipboard.writeText(texto).then(() => Toast.success('Copiado!', 'Comprovante copiado para área de transferência.'));
}

function enviarWhatsApp() {
  const texto   = document.getElementById('comprovante').textContent;
  const encoded = encodeURIComponent(texto);
  // Abre WhatsApp Web com o texto do comprovante pronto para enviar
  // Se o cliente tiver telefone cadastrado, poderia abrir direto no contato
  window.open(`https://wa.me/?text=${encoded}`, '_blank');
}

// ══════════════════════════════════════════════
// HISTÓRICO
// ══════════════════════════════════════════════

async function verHistoricoVendas() {
  const isMaster = Auth.isMaster();
  const user     = Auth.getUser();
  const tbody    = document.getElementById('bodyHistorico');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--color-gray-400);font-size:var(--text-sm);padding:var(--space-6)">Carregando...</td></tr>';

  if (!window._supabase) {
    document.getElementById('bodyHistorico').innerHTML = `
      <tr>
        <td>${Format.date(new Date())}</td><td>Ana Silva</td><td>normal</td><td>pix</td>
        <td>${Format.currency(320)}</td>
        <td><span class="badge badge-success">Concluída</span></td>
        <td>
          <button class="btn-table" onclick="reabrirComprovante(1)" title="Ver comprovante">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </button>
          ${isMaster ? `<button class="btn-table danger" onclick="confirmarCancelarVenda(1,'Ana Silva',320)" title="Cancelar"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>` : ''}
        </td>
      </tr>
    `;
    return;
  }

  // Admin vê todas, vendedor vê só as suas
  let query = window._supabase
    .from('vendas')
    .select('*, clientes(nome), itens_venda(quantidade, preco_vend, produtos(nome))')
    .order('created_at', { ascending: false })
    .limit(50);

  if (!isMaster) {
    query = query.eq('vendedor_id', user.id);
  }

  const { data } = await query;

  if (!data?.length) {
    document.getElementById('bodyHistorico').innerHTML =
      `<tr><td colspan="7" class="table-loading">${isMaster ? 'Nenhuma venda registrada' : 'Você ainda não realizou nenhuma venda'}</td></tr>`;
    return;
  }

  document.getElementById('bodyHistorico').innerHTML = data.map(v => {
    const cancelada = v.status === 'cancelada';
    const nomeEsc   = (v.clientes?.nome || 'Cliente').replace(/'/g, "\\'");
    const dataFmt   = Format.date(v.created_at);
    const motivoEsc = (v.observacao || '').replace(/'/g, "\\'");
    return `
      <tr style="${cancelada ? 'opacity:0.6' : ''}">
        <td>${dataFmt}</td>
        <td>${v.clientes?.nome || '—'}</td>
        <td>${v.tipo}</td>
        <td>${v.forma_pagamento}</td>
        <td style="${cancelada ? 'text-decoration:line-through;color:var(--color-gray-400)' : ''}">${Format.currency(v.valor_total)}</td>
        <td>
          ${cancelada
            ? `<span class="badge badge-danger" style="cursor:pointer"
                onclick="verMotivoCancelamento('${nomeEsc}',${v.valor_total},'${dataFmt}','${motivoEsc}')"
                title="Ver motivo">🚫 Cancelada ${v.observacao ? '💬' : ''}</span>`
            : '<span class="badge badge-success">Concluída</span>'}
        </td>
        <td style="display:flex;gap:4px;align-items:center">
          ${!cancelada ? `
            <button class="btn-table" onclick="reabrirComprovante(${v.id})" title="Ver / reenviar comprovante">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </button>` : ''}
          ${isMaster && !cancelada ? `
            <button class="btn-table danger"
              onclick="confirmarCancelarVenda(${v.id},'${nomeEsc}',${v.valor_total})"
              title="Cancelar venda">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              </svg>
            </button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

async function reabrirComprovante(vendaId) {
  if (!window._supabase) {
    // Demo — abre o comprovante atual
    abrirModal('modalComprovante');
    return;
  }

  // Busca a venda e seus itens no banco
  const { data: venda } = await window._supabase
    .from('vendas')
    .select('*, clientes(nome, telefone), itens_venda(quantidade, preco_vend, preco_unit, produtos(nome, sku))')
    .eq('id', vendaId)
    .single();

  if (!venda) { Toast.error('Erro', 'Venda não encontrada.'); return; }

  const linhaItens = (venda.itens_venda || []).map(i =>
    `  ${i.quantidade}x ${(i.produtos?.nome || '').padEnd(20).substring(0,20)}  ${Format.currency((i.preco_vend || i.preco_unit) * i.quantidade)}`
  ).join('\n');

  const isMaster = Auth.isMaster();
  const taxa = (isMaster && venda.valor_taxa > 0) ? `\nTaxa maquininha:   — ${Format.currency(venda.valor_taxa)}` : '';
  const liq  = (isMaster && venda.valor_taxa > 0) ? `\nValor líquido:       ${Format.currency(venda.valor_liquido)}` : '';
  const desc = venda.desconto  > 0  ? `\nDesconto:          — ${Format.currency(venda.desconto)}` : '';

  const texto = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        TREEMALI
     Comprovante de Venda
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Data: ${new Date(venda.created_at).toLocaleString('pt-BR')}
Cliente: ${venda.clientes?.nome || 'Sem cadastro'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITENS:
${linhaItens}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Subtotal:            ${Format.currency(venda.valor_total + (venda.desconto || 0))}${desc}
Total:               ${Format.currency(venda.valor_total)}${taxa}${liq}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pagamento: ${venda.forma_pagamento}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       Obrigado pela compra!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  document.getElementById('comprovante').textContent = texto;
  fecharModal('modalHistorico');
  abrirModal('modalComprovante');
}

function confirmarCancelarVenda(vendaId, nomeCliente, valorTotal) {
  document.getElementById('msgCancelarVenda').innerHTML =
    `Deseja cancelar a venda de <strong>${nomeCliente}</strong> — ${Format.currency(valorTotal)}?`;
  document.getElementById('motivoCancelamento').value = '';
  document.getElementById('erroMotivo').classList.add('hidden');

  document.getElementById('btnConfirmarCancelarVenda').onclick = () => {
    const motivo = document.getElementById('motivoCancelamento').value.trim();
    if (!motivo) {
      const el = document.getElementById('erroMotivo');
      el.textContent = 'O motivo do cancelamento é obrigatório.';
      el.classList.remove('hidden');
      return;
    }
    cancelarVenda(vendaId, motivo);
  };

  abrirModal('modalCancelarVenda');
}

async function cancelarVenda(vendaId, motivo) {
  if (!window._supabase) {
    fecharModal('modalCancelarVenda');
    Toast.success('Venda cancelada!', 'Estoque revertido.');
    verHistoricoVendas();
    return;
  }

  try {
    // 1. Busca os itens da venda para reverter estoque
    const { data: itens } = await window._supabase
      .from('itens_venda')
      .select('produto_id, quantidade')
      .eq('venda_id', vendaId);

    // 2. Reverte estoque de cada produto
    for (const item of (itens || [])) {
      const { data: prod } = await window._supabase
        .from('produtos').select('estoque_atual').eq('id', item.produto_id).single();
      if (prod) {
        await window._supabase.from('produtos')
          .update({ estoque_atual: prod.estoque_atual + item.quantidade, updated_at: new Date().toISOString() })
          .eq('id', item.produto_id);
      }
      await window._supabase.from('movimentacoes_estoque').insert({
        produto_id:  item.produto_id,
        tipo:        'estorno_venda',
        quantidade:   item.quantidade,
        referencia:  `Cancelamento venda #${vendaId} — ${motivo}`,
        usuario_id:   Auth.getUser()?.id || null,
      });
    }

    // 3. Marca venda como cancelada com o motivo
    await window._supabase.from('vendas')
      .update({
        status:     'cancelada',
        observacao: motivo,
        updated_at: new Date().toISOString()
      })
      .eq('id', vendaId);

    fecharModal('modalCancelarVenda');
    Toast.success('Venda cancelada!', 'Estoque revertido e venda removida dos relatórios.');
    verHistoricoVendas();

  } catch (err) {
    fecharModal('modalCancelarVenda');
    Toast.error('Erro ao cancelar', err.message);
  }
}

function verMotivoCancelamento(nomeCliente, valorTotal, data, motivo) {
  document.getElementById('bodyMotivoCancelamento').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--space-3)">
      <div style="background:var(--color-gray-100);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4)">
        <div style="font-size:var(--text-xs);color:var(--color-gray-400);text-transform:uppercase;letter-spacing:0.05em">Cliente</div>
        <div style="font-weight:600;color:var(--color-gray-800)">${nomeCliente}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
        <div style="background:var(--color-gray-100);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4)">
          <div style="font-size:var(--text-xs);color:var(--color-gray-400);text-transform:uppercase;letter-spacing:0.05em">Valor</div>
          <div style="font-weight:600;color:var(--color-danger)">${Format.currency(valorTotal)}</div>
        </div>
        <div style="background:var(--color-gray-100);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4)">
          <div style="font-size:var(--text-xs);color:var(--color-gray-400);text-transform:uppercase;letter-spacing:0.05em">Data</div>
          <div style="font-weight:600;color:var(--color-gray-800)">${data}</div>
        </div>
      </div>
      <div style="background:var(--color-danger-light);border:1px solid rgba(176,85,85,0.2);border-radius:var(--radius-md);padding:var(--space-4)">
        <div style="font-size:var(--text-xs);color:var(--color-danger);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:var(--space-2)">Motivo do Cancelamento</div>
        <div style="font-size:var(--text-sm);color:var(--color-gray-700);font-style:italic">"${motivo}"</div>
      </div>
    </div>
  `;
  abrirModal('modalMotivoCancelamento');
}

// ══════════════════════════════════════════════
// LIMPAR / NOVA VENDA
// ══════════════════════════════════════════════

function novaVenda() {
  _estado = { tipo:'normal', forma:'dinheiro', itens:[], bandeira:null, parcelas:1, taxa:0, desconto:0, subtotal:0, total:0, liquido:0, lucro:0 };
  document.getElementById('vendaCliente').value = '';
  document.getElementById('vendaObs').value = '';
  document.getElementById('vendaDesconto').value = '';
  document.getElementById('vendaPrazo').value = '';
  document.getElementById('inputBuscaProduto').value = '';
  document.getElementById('selectProduto').value = '';
  document.getElementById('inputQtd').value = 1;
  setTipo('normal');
  setForma('dinheiro');
  renderItens();
  recalcularTotais();
  carregarProdutos();
}
function limparVenda() {
  if (_estado.itens.length && !confirm('Deseja limpar todos os itens?')) return;
  novaVenda();
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

function abrirModal(id) {
  document.getElementById(id).classList.add('active');
  document.body.style.overflow = 'hidden';
}

function fecharModal(id) {
  document.getElementById(id).classList.remove('active');
  document.body.style.overflow = '';
}

function mostrarErroModal(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function esconderErro(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) fecharModal(e.target.id);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape')
    document.querySelectorAll('.modal-overlay.active').forEach(m => fecharModal(m.id));
});
