/**
 * TREEMALI ERP — Módulo de Estoque
 * Produtos, entrada de mercadoria e movimentações
 */

let _produtos      = [];
let _categorias    = [];
let _fornecedores  = [];
let _movimentacoes = [];

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
    });
  });

  // Busca em tempo real
  document.getElementById('searchProdutos')
    .addEventListener('input', e => filtrarProdutos(e.target.value));
  document.getElementById('filtroCategoriaEstoque')
    .addEventListener('change', () => filtrarProdutos(document.getElementById('searchProdutos').value));
  document.getElementById('searchMovimentacoes')
    .addEventListener('input', () => filtrarMovimentacoes());
  document.getElementById('filtroTipoMov')
    .addEventListener('change', () => filtrarMovimentacoes());

  // Calcula margem ao digitar preços no modal
  document.getElementById('produtoCusto')
    .addEventListener('input', calcularMargem);
  document.getElementById('produtoPrecoVenda')
    .addEventListener('input', calcularMargem);

  // Preview de entrada ao selecionar produto ou digitar qtd/custo
  document.getElementById('entradaProduto')
    .addEventListener('change', atualizarPreviewEntrada);
  document.getElementById('entradaQtd')
    .addEventListener('input', atualizarPreviewEntrada);
  document.getElementById('entradaCusto')
    .addEventListener('input', atualizarPreviewEntrada);

  // Data padrão = hoje
  document.getElementById('entradaData').value = new Date().toISOString().split('T')[0];

  // Carregar tudo
  Promise.all([
    carregarCategorias(),
    carregarFornecedores(),
  ]).then(() => {
    carregarProdutos();
    carregarMovimentacoes();
  });
});

// ══════════════════════════════════════════════
// CARREGAR CATEGORIAS E FORNECEDORES
// ══════════════════════════════════════════════

async function carregarCategorias() {
  if (!window._supabase) {
    _categorias = [
      { id:1, nome:'Camisetas' }, { id:2, nome:'Calças' },
      { id:3, nome:'Vestidos'  }, { id:4, nome:'Blusas' },
      { id:5, nome:'Acessórios'}, { id:6, nome:'Calçados'},
    ];
  } else {
    const { data } = await window._supabase.from('categorias').select('*').order('nome');
    _categorias = data || [];
  }
  // Preenche selects
  const opts = _categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
  document.getElementById('produtoCategoria').innerHTML = '<option value="">Selecione...</option>' + opts;
  document.getElementById('filtroCategoriaEstoque').innerHTML = '<option value="">Todas as categorias</option>' + opts;
}

async function carregarFornecedores() {
  if (!window._supabase) {
    _fornecedores = [{ id:1, nome:'Distribuidora ABC' }];
  } else {
    const { data } = await window._supabase
      .from('fornecedores').select('id, nome').eq('ativo', true).order('nome');
    _fornecedores = data || [];
  }
  const opts = _fornecedores.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
  const sempl = '<option value="">Selecione...</option>' + opts;
  document.getElementById('produtoFornecedor').innerHTML = sempl;
  document.getElementById('entradaFornecedor').innerHTML = sempl;
}

// ══════════════════════════════════════════════
// PRODUTOS
// ══════════════════════════════════════════════

async function carregarProdutos() {
  if (!window._supabase) {
    _produtos = [
      { id:1, nome:'Camiseta Preta P',  sku:'CAM-001', categoria_id:1, custo:30,  preco_venda:79.90,  estoque_atual:15, estoque_minimo:5, ativo:true  },
      { id:2, nome:'Calça Jeans 38',    sku:'CAL-001', categoria_id:2, custo:80,  preco_venda:189.90, estoque_atual:3,  estoque_minimo:5, ativo:true  },
      { id:3, nome:'Blusa Floral M',    sku:'BLU-001', categoria_id:4, custo:45,  preco_venda:119.90, estoque_atual:0,  estoque_minimo:3, ativo:true  },
      { id:4, nome:'Vestido Midi Bege', sku:'VES-001', categoria_id:3, custo:90,  preco_venda:229.90, estoque_atual:8,  estoque_minimo:3, ativo:true  },
    ];
  } else {
    const { data, error } = await window._supabase
      .from('produtos')
      .select('*, categorias(nome), fornecedores(nome)')
      .order('nome');
    if (error) { mostrarErroTabela('bodyProdutos', 9, error.message); return; }
    _produtos = data || [];
  }
  renderProdutos(_produtos);
  atualizarKPIs();
  preencherSelectProdutos();
}

function renderProdutos(lista) {
  const tbody = document.getElementById('bodyProdutos');
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="table-loading">Nenhum produto cadastrado</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(p => {
    const nomeCategoria = p.categorias?.nome || nomeCategoriaPorId(p.categoria_id);
    const estoqueClass  = p.estoque_atual === 0
      ? 'estoque-zero'
      : p.estoque_atual <= p.estoque_minimo
        ? 'estoque-baixo'
        : 'estoque-ok';
    const estoqueIcon = p.estoque_atual === 0
      ? '🔴'
      : p.estoque_atual <= p.estoque_minimo
        ? '🟡'
        : '🟢';

    return `
      <tr>
        <td><strong>${p.nome}</strong>${p.descricao ? `<br><small style="color:var(--color-gray-400)">${p.descricao}</small>` : ''}</td>
        <td>${p.sku || '—'}</td>
        <td>${nomeCategoria || '—'}</td>
        <td>${Format.currency(p.custo)}</td>
        <td>${Format.currency(p.preco_venda)}</td>
        <td class="${estoqueClass}">${estoqueIcon} ${p.estoque_atual}</td>
        <td>${p.estoque_minimo}</td>
        <td><span class="badge ${p.ativo ? 'badge-success' : 'badge-neutral'}">${p.ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td style="white-space:nowrap">
          <button class="btn-table" onclick="editarProduto(${p.id})" title="Editar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-table warning" onclick="abrirAjusteEstoque(${p.id})" title="Ajustar estoque">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button class="btn-table danger" onclick="desativarProduto(${p.id}, '${p.nome.replace(/'/g,"\\'")}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function filtrarProdutos(termo) {
  const cat = document.getElementById('filtroCategoriaEstoque').value;
  let lista = _produtos;
  if (cat) lista = lista.filter(p => String(p.categoria_id) === cat);
  if (termo.trim()) {
    const t = termo.toLowerCase();
    lista = lista.filter(p =>
      p.nome?.toLowerCase().includes(t) ||
      p.sku?.toLowerCase().includes(t) ||
      p.descricao?.toLowerCase().includes(t)
    );
  }
  renderProdutos(lista);
}

function atualizarKPIs() {
  const ativos  = _produtos.filter(p => p.ativo);
  const baixo   = ativos.filter(p => p.estoque_atual <= p.estoque_minimo);
  const valorTotal = ativos.reduce((s, p) => s + (p.custo * p.estoque_atual), 0);

  setText('kpiTotalProdutos',  _produtos.length);
  setText('kpiProdutosAtivos', ativos.length);
  setText('kpiEstoqueBaixo',   baixo.length);
  setText('kpiValorEstoque',   Format.currency(valorTotal));
}

function preencherSelectProdutos() {
  const opts = _produtos
    .filter(p => p.ativo)
    .map(p => `<option value="${p.id}" data-estoque="${p.estoque_atual}" data-custo="${p.custo}">${p.nome}${p.sku ? ' — ' + p.sku : ''}</option>`)
    .join('');
  document.getElementById('entradaProduto').innerHTML =
    '<option value="">Selecione o produto...</option>' + opts;
}

function nomeCategoriaPorId(id) {
  const c = _categorias.find(x => x.id === Number(id));
  return c ? c.nome : '—';
}

// ── Abrir modal novo produto
function abrirNovoProduto() {
  document.getElementById('produtoId').value = '';
  document.getElementById('produtoNome').value = '';
  document.getElementById('produtoSku').value = '';
  document.getElementById('produtoCategoria').value = '';
  document.getElementById('produtoFornecedor').value = '';
  document.getElementById('produtoDescricao').value = '';
  document.getElementById('produtoCusto').value = '';
  document.getElementById('produtoPrecoVenda').value = '';
  document.getElementById('produtoEstoqueAtual').value = '0';
  document.getElementById('produtoEstoqueMin').value = '5';
  document.getElementById('produtoLocalizacao').value = '';
  document.getElementById('produtoAtivo').value = 'true';
  document.getElementById('tituloModalProduto').textContent = 'Novo Produto';
  document.getElementById('margemPreview').style.display = 'none';
  esconderErro('erroProduto');
  abrirModal('modalProduto');
}

function editarProduto(id) {
  const p = _produtos.find(x => x.id === id);
  if (!p) return;
  document.getElementById('produtoId').value = p.id;
  document.getElementById('produtoNome').value = p.nome || '';
  document.getElementById('produtoSku').value = p.sku || '';
  document.getElementById('produtoCategoria').value = p.categoria_id || '';
  document.getElementById('produtoFornecedor').value = p.fornecedor_id || '';
  document.getElementById('produtoDescricao').value = p.descricao || '';
  document.getElementById('produtoCusto').value = p.custo || '';
  document.getElementById('produtoPrecoVenda').value = p.preco_venda || '';
  document.getElementById('produtoEstoqueAtual').value = p.estoque_atual || 0;
  document.getElementById('produtoEstoqueMin').value = p.estoque_minimo || 5;
  document.getElementById('produtoLocalizacao').value = p.localizacao || '';
  document.getElementById('produtoAtivo').value = String(p.ativo);
  document.getElementById('tituloModalProduto').textContent = 'Editar Produto';
  esconderErro('erroProduto');
  calcularMargem();
  abrirModal('modalProduto');
}

async function salvarProduto() {
  const nome = document.getElementById('produtoNome').value.trim();
  if (!nome) { mostrarErroModal('erroProduto', 'O nome do produto é obrigatório.'); return; }

  const id    = document.getElementById('produtoId').value;
  const dados = {
    nome,
    sku:            document.getElementById('produtoSku').value.trim() || null,
    categoria_id:   document.getElementById('produtoCategoria').value || null,
    fornecedor_id:  document.getElementById('produtoFornecedor').value || null,
    descricao:      document.getElementById('produtoDescricao').value.trim() || null,
    custo:          parseFloat(document.getElementById('produtoCusto').value) || 0,
    preco_venda:    parseFloat(document.getElementById('produtoPrecoVenda').value) || 0,
    estoque_atual:  parseInt(document.getElementById('produtoEstoqueAtual').value) || 0,
    estoque_minimo: parseInt(document.getElementById('produtoEstoqueMin').value) || 5,
    localizacao:    document.getElementById('produtoLocalizacao').value.trim() || null,
    ativo:          document.getElementById('produtoAtivo').value === 'true',
    updated_at:     new Date().toISOString(),
  };

  setBtnLoading('btnSalvarProduto', true);

  if (!window._supabase) {
    if (id) {
      const i = _produtos.findIndex(x => x.id === Number(id));
      if (i >= 0) _produtos[i] = { ..._produtos[i], ...dados };
    } else {
      _produtos.push({ id: Date.now(), ...dados });
    }
    renderProdutos(_produtos);
    atualizarKPIs();
    preencherSelectProdutos();
    fecharModal('modalProduto');
    Toast.success('Produto salvo com sucesso!');
    setBtnLoading('btnSalvarProduto', false);
    return;
  }

  let error;
  if (id) {
    ({ error } = await window._supabase.from('produtos').update(dados).eq('id', id));
  } else {
    ({ error } = await window._supabase.from('produtos').insert(dados));
  }

  setBtnLoading('btnSalvarProduto', false);
  if (error) { mostrarErroModal('erroProduto', error.message); return; }
  fecharModal('modalProduto');
  Toast.success('Produto salvo com sucesso!');
  carregarProdutos();
}

function desativarProduto(id, nome) {
  document.getElementById('msgConfirmar').textContent =
    `Deseja desativar o produto "${nome}"?`;
  document.getElementById('btnConfirmar').onclick = async () => {
    if (!window._supabase) {
      const i = _produtos.findIndex(x => x.id === id);
      if (i >= 0) _produtos[i].ativo = false;
      renderProdutos(_produtos);
      atualizarKPIs();
      fecharModal('modalConfirmar');
      Toast.success('Produto desativado.');
      return;
    }
    const { error } = await window._supabase
      .from('produtos').update({ ativo: false }).eq('id', id);
    if (error) { Toast.error('Erro', error.message); return; }
    fecharModal('modalConfirmar');
    Toast.success('Produto desativado.');
    carregarProdutos();
  };
  abrirModal('modalConfirmar');
}

function calcularMargem() {
  const custo = parseFloat(document.getElementById('produtoCusto').value) || 0;
  const venda = parseFloat(document.getElementById('produtoPrecoVenda').value) || 0;
  const preview = document.getElementById('margemPreview');
  if (custo > 0 && venda > 0) {
    const margem = ((venda - custo) / venda * 100).toFixed(1);
    const lucro  = Format.currency(venda - custo);
    document.getElementById('margemValor').textContent = `${lucro} (${margem}%)`;
    preview.style.display = 'flex';
  } else {
    preview.style.display = 'none';
  }
}

// ══════════════════════════════════════════════
// AJUSTE DE ESTOQUE
// ══════════════════════════════════════════════

function abrirAjusteEstoque(id) {
  const p = _produtos.find(x => x.id === id);
  if (!p) return;
  document.getElementById('ajusteProdutoId').value = p.id;
  document.getElementById('ajusteProdutoNome').textContent = p.nome;
  document.getElementById('ajusteNovoEstoque').value = p.estoque_atual;
  document.getElementById('ajusteMotivo').value = '';
  esconderErro('erroAjuste');
  abrirModal('modalAjuste');
}

async function salvarAjuste() {
  const id          = document.getElementById('ajusteProdutoId').value;
  const novaQtd     = parseInt(document.getElementById('ajusteNovoEstoque').value);
  const motivo      = document.getElementById('ajusteMotivo').value.trim();
  const produto     = _produtos.find(x => x.id === Number(id));

  if (isNaN(novaQtd) || novaQtd < 0) {
    mostrarErroModal('erroAjuste', 'Informe uma quantidade válida.'); return;
  }

  setBtnLoading('btnSalvarAjuste', true);

  if (!window._supabase) {
    const i = _produtos.findIndex(x => x.id === Number(id));
    if (i >= 0) _produtos[i].estoque_atual = novaQtd;
    renderProdutos(_produtos);
    atualizarKPIs();
    fecharModal('modalAjuste');
    Toast.success('Estoque ajustado com sucesso!');
    setBtnLoading('btnSalvarAjuste', false);
    return;
  }

  const user = Auth.getUser();
  const diff = novaQtd - (produto?.estoque_atual || 0);

  // Atualiza estoque
  const { error } = await window._supabase
    .from('produtos').update({ estoque_atual: novaQtd, updated_at: new Date().toISOString() }).eq('id', id);

  if (error) { mostrarErroModal('erroAjuste', error.message); setBtnLoading('btnSalvarAjuste', false); return; }

  // Registra movimentação
  await window._supabase.from('movimentacoes_estoque').insert({
    produto_id:  Number(id),
    tipo:        'ajuste',
    quantidade:  diff,
    referencia:  motivo || 'Ajuste manual',
    usuario_id:  user?.id || null,
  });

  setBtnLoading('btnSalvarAjuste', false);
  fecharModal('modalAjuste');
  Toast.success('Estoque ajustado com sucesso!');
  carregarProdutos();
  carregarMovimentacoes();
}

// ══════════════════════════════════════════════
// ENTRADA DE MERCADORIA
// ══════════════════════════════════════════════

function atualizarPreviewEntrada() {
  const select   = document.getElementById('entradaProduto');
  const opt      = select.options[select.selectedIndex];
  const qtd      = parseInt(document.getElementById('entradaQtd').value) || 0;
  const novoCusto = parseFloat(document.getElementById('entradaCusto').value) || 0;
  const preview  = document.getElementById('entradaPreview');

  if (!opt || !opt.value) { preview.style.display = 'none'; return; }

  const estoqueAtual = parseInt(opt.dataset.estoque) || 0;
  const custoAtual   = parseFloat(opt.dataset.custo) || 0;

  setText('prevEstoqueAtual', estoqueAtual);
  setText('prevEstoqueApos',  estoqueAtual + qtd);
  setText('prevCustoAtual',   Format.currency(custoAtual));

  const rowNovoCusto = document.getElementById('prevNovoCustoRow');
  if (novoCusto > 0 && novoCusto !== custoAtual) {
    setText('prevNovoCusto', Format.currency(novoCusto));
    rowNovoCusto.style.display = 'flex';
  } else {
    rowNovoCusto.style.display = 'none';
  }

  preview.style.display = 'flex';
}

async function registrarEntrada() {
  const produtoId  = document.getElementById('entradaProduto').value;
  const qtd        = parseInt(document.getElementById('entradaQtd').value) || 0;
  const novoCusto  = parseFloat(document.getElementById('entradaCusto').value) || 0;
  const fornId     = document.getElementById('entradaFornecedor').value || null;
  const obs        = document.getElementById('entradaObs').value.trim();

  if (!produtoId) { mostrarErroModal('erroEntrada', 'Selecione o produto.'); return; }
  if (qtd <= 0)   { mostrarErroModal('erroEntrada', 'Informe uma quantidade maior que zero.'); return; }

  const produto = _produtos.find(x => x.id === Number(produtoId));
  if (!produto) return;

  if (!window._supabase) {
    const i = _produtos.findIndex(x => x.id === Number(produtoId));
    if (i >= 0) {
      _produtos[i].estoque_atual += qtd;
      if (novoCusto > 0) _produtos[i].custo = novoCusto;
    }
    renderProdutos(_produtos);
    atualizarKPIs();
    preencherSelectProdutos();
    limparEntrada();
    Toast.success('Entrada registrada!', `${qtd} unidades adicionadas ao estoque.`);
    return;
  }

  const user = Auth.getUser();
  const novoEstoque = produto.estoque_atual + qtd;
  const updateDados = { estoque_atual: novoEstoque, updated_at: new Date().toISOString() };
  if (novoCusto > 0) updateDados.custo = novoCusto;
  if (fornId) updateDados.fornecedor_id = fornId;

  const { error } = await window._supabase
    .from('produtos').update(updateDados).eq('id', produtoId);

  if (error) { mostrarErroModal('erroEntrada', error.message); return; }

  // Registra movimentação
  await window._supabase.from('movimentacoes_estoque').insert({
    produto_id:  Number(produtoId),
    tipo:        'entrada',
    quantidade:  qtd,
    referencia:  obs || `Entrada — Fornecedor ID ${fornId || 'N/A'}`,
    usuario_id:  user?.id || null,
  });

  limparEntrada();
  Toast.success('Entrada registrada!', `${qtd} unidades adicionadas ao estoque.`);
  carregarProdutos();
  carregarMovimentacoes();
}

function limparEntrada() {
  document.getElementById('entradaProduto').value = '';
  document.getElementById('entradaQtd').value = '';
  document.getElementById('entradaCusto').value = '';
  document.getElementById('entradaFornecedor').value = '';
  document.getElementById('entradaObs').value = '';
  document.getElementById('entradaPreview').style.display = 'none';
  esconderErro('erroEntrada');
}

// ══════════════════════════════════════════════
// MOVIMENTAÇÕES
// ══════════════════════════════════════════════

async function carregarMovimentacoes() {
  if (!window._supabase) {
    _movimentacoes = [
      { id:1, created_at: new Date().toISOString(), produto_id:1, produtos:{nome:'Camiseta Preta P'}, tipo:'entrada',    quantidade:10, referencia:'Nota fiscal 001' },
      { id:2, created_at: new Date().toISOString(), produto_id:2, produtos:{nome:'Calça Jeans 38'},   tipo:'saida_venda', quantidade:-1, referencia:'Venda #1' },
    ];
    renderMovimentacoes(_movimentacoes);
    return;
  }
  const { data, error } = await window._supabase
    .from('movimentacoes_estoque')
    .select('*, produtos(nome)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) { mostrarErroTabela('bodyMovimentacoes', 5, error.message); return; }
  _movimentacoes = data || [];
  renderMovimentacoes(_movimentacoes);
}

function renderMovimentacoes(lista) {
  const tbody = document.getElementById('bodyMovimentacoes');
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-loading">Nenhuma movimentação registrada</td></tr>';
    return;
  }

  const tipoLabel = {
    entrada:              { label: '⬇ Entrada',            cls: 'mov-entrada'  },
    saida_venda:          { label: '⬆ Saída — Venda',      cls: 'mov-saida'    },
    saida_condicional:    { label: '⬆ Saída — Condicional',cls: 'mov-saida'    },
    retorno_condicional:  { label: '⬇ Retorno Condicional',cls: 'mov-retorno'  },
    transferencia:        { label: '↔ Transferência',       cls: 'mov-ajuste'  },
    ajuste:               { label: '⚙ Ajuste',              cls: 'mov-ajuste'  },
  };

  tbody.innerHTML = lista.map(m => {
    const t = tipoLabel[m.tipo] || { label: m.tipo, cls: '' };
    const qtd = m.quantidade > 0 ? `+${m.quantidade}` : String(m.quantidade);
    return `
      <tr>
        <td>${Format.date(m.created_at)}</td>
        <td>${m.produtos?.nome || '—'}</td>
        <td class="${t.cls}">${t.label}</td>
        <td><strong>${qtd}</strong></td>
        <td>${m.referencia || '—'}</td>
      </tr>
    `;
  }).join('');
}

function filtrarMovimentacoes() {
  const termo = document.getElementById('searchMovimentacoes').value.toLowerCase();
  const tipo  = document.getElementById('filtroTipoMov').value;
  let lista   = _movimentacoes;
  if (tipo)  lista = lista.filter(m => m.tipo === tipo);
  if (termo) lista = lista.filter(m => m.produtos?.nome?.toLowerCase().includes(termo));
  renderMovimentacoes(lista);
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

function mostrarErroTabela(tbodyId, cols, msg) {
  document.getElementById(tbodyId).innerHTML =
    `<tr><td colspan="${cols}" class="table-loading" style="color:var(--color-danger)">${msg}</td></tr>`;
}

function setBtnLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Salvando...' : 'Salvar';
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// Fecha modal ao clicar no fundo
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) fecharModal(e.target.id);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape')
    document.querySelectorAll('.modal-overlay.active').forEach(m => fecharModal(m.id));
});
