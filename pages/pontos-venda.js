/**
 * TREEMALI ERP — Módulo de Pontos de Venda
 * Cadastro de pontos, estoque por local e transferências
 */

let _pontos   = [];
let _produtos = [];
let _estoquePontos = [];
let _transferencias = [];

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

  // Busca
  document.getElementById('searchPontos')
    .addEventListener('input', e => filtrarPontos(e.target.value));
  document.getElementById('searchEstoquePonto')
    .addEventListener('input', () => renderEstoquePontos());

  // Preview transferência
  document.getElementById('transfOrigem').addEventListener('change', atualizarEstoqueOrigem);
  document.getElementById('transfProduto').addEventListener('change', atualizarEstoqueOrigem);
  document.getElementById('transfQtd').addEventListener('input', atualizarPreviewTransf);

  // Carregar dados
  Promise.all([carregarPontos(), carregarProdutos()]).then(() => {
    carregarEstoquePontos();
    carregarTransferencias();
  });
});

// ══════════════════════════════════════════════
// PONTOS DE VENDA
// ══════════════════════════════════════════════

async function carregarPontos() {
  if (!window._supabase) {
    _pontos = [
      { id:1, nome:'Loja Shopping Norte', responsavel:'Maria',  comissao:10, ativo:true },
      { id:2, nome:'Revenda Bairro Sul',  responsavel:'Carlos', comissao:8,  ativo:true },
    ];
  } else {
    const { data } = await window._supabase
      .from('pontos_venda').select('*').order('nome');
    _pontos = data || [];
  }
  renderPontos(_pontos);
  preencherSelectsPontos();
}

function renderPontos(lista) {
  const grid = document.getElementById('pontosGrid');
  if (!lista.length) {
    grid.innerHTML = '<div class="table-loading">Nenhum ponto de venda cadastrado</div>';
    return;
  }
  grid.innerHTML = lista.map((p, i) => `
    <div class="ponto-card" style="animation-delay:${i * 0.05}s">
      <div class="ponto-card-header">
        <div class="ponto-icon">🏪</div>
        <div class="ponto-card-actions">
          <button class="btn-table" onclick="editarPonto(${p.id})" title="Editar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-table danger" onclick="desativarPonto(${p.id}, '${p.nome.replace(/'/g,"\\'")}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </div>
      <div class="ponto-nome">${p.nome}</div>
      <div class="ponto-responsavel">${p.responsavel ? 'Responsável: ' + p.responsavel : 'Sem responsável definido'}</div>
      <div class="ponto-stats">
        <div class="ponto-stat">
          <span class="ponto-stat-label">Comissão</span>
          <span class="ponto-stat-value">${p.comissao || 0}%</span>
        </div>
        <div class="ponto-stat">
          <span class="ponto-stat-label">Status</span>
          <span class="ponto-stat-value">
            <span class="badge ${p.ativo ? 'badge-success' : 'badge-neutral'}">${p.ativo ? 'Ativo' : 'Inativo'}</span>
          </span>
        </div>
      </div>
    </div>
  `).join('');
}

function filtrarPontos(termo) {
  if (!termo.trim()) { renderPontos(_pontos); return; }
  const t = termo.toLowerCase();
  renderPontos(_pontos.filter(p =>
    p.nome?.toLowerCase().includes(t) ||
    p.responsavel?.toLowerCase().includes(t)
  ));
}

function preencherSelectsPontos() {
  const opts = _pontos
    .filter(p => p.ativo)
    .map(p => `<option value="${p.id}">${p.nome}</option>`)
    .join('');

  // Filtro estoque
  const filtro = document.getElementById('filtroPontoEstoque');
  filtro.innerHTML = '<option value="">Todos os locais</option><option value="central">🏠 Estoque Central</option>' + opts;

  // Selects de transferência
  const origemOpts = '<option value="">Selecione a origem...</option><option value="central">🏠 Estoque Central</option>' + opts;
  const destinoOpts = '<option value="">Selecione o destino...</option><option value="central">🏠 Estoque Central</option>' + opts;
  document.getElementById('transfOrigem').innerHTML = origemOpts;
  document.getElementById('transfDestino').innerHTML = destinoOpts;
}

function abrirNovoPonto() {
  document.getElementById('pontoId').value = '';
  document.getElementById('pontoNome').value = '';
  document.getElementById('pontoResponsavel').value = '';
  document.getElementById('pontoComissao').value = '';
  document.getElementById('pontoAtivo').value = 'true';
  document.getElementById('tituloModalPonto').textContent = 'Novo Ponto de Venda';
  esconderErro('erroPonto');
  abrirModal('modalPonto');
}

function editarPonto(id) {
  const p = _pontos.find(x => x.id === id);
  if (!p) return;
  document.getElementById('pontoId').value = p.id;
  document.getElementById('pontoNome').value = p.nome || '';
  document.getElementById('pontoResponsavel').value = p.responsavel || '';
  document.getElementById('pontoComissao').value = p.comissao || '';
  document.getElementById('pontoAtivo').value = String(p.ativo);
  document.getElementById('tituloModalPonto').textContent = 'Editar Ponto de Venda';
  esconderErro('erroPonto');
  abrirModal('modalPonto');
}

async function salvarPonto() {
  const nome = document.getElementById('pontoNome').value.trim();
  if (!nome) { mostrarErroModal('erroPonto', 'O nome é obrigatório.'); return; }

  const id    = document.getElementById('pontoId').value;
  const dados = {
    nome,
    responsavel: document.getElementById('pontoResponsavel').value.trim() || null,
    comissao:    parseFloat(document.getElementById('pontoComissao').value) || 0,
    ativo:       document.getElementById('pontoAtivo').value === 'true',
  };

  setBtnLoading('btnSalvarPonto', true);

  if (!window._supabase) {
    if (id) {
      const i = _pontos.findIndex(x => x.id === Number(id));
      if (i >= 0) _pontos[i] = { ..._pontos[i], ...dados };
    } else {
      _pontos.push({ id: Date.now(), ...dados });
    }
    renderPontos(_pontos);
    preencherSelectsPontos();
    fecharModal('modalPonto');
    Toast.success('Ponto salvo!');
    setBtnLoading('btnSalvarPonto', false);
    return;
  }

  let error;
  if (id) {
    ({ error } = await window._supabase.from('pontos_venda').update(dados).eq('id', id));
  } else {
    ({ error } = await window._supabase.from('pontos_venda').insert(dados));
  }

  setBtnLoading('btnSalvarPonto', false);
  if (error) { mostrarErroModal('erroPonto', error.message); return; }
  fecharModal('modalPonto');
  Toast.success('Ponto de venda salvo!');
  carregarPontos();
}

function desativarPonto(id, nome) {
  document.getElementById('msgConfirmar').textContent = `Deseja desativar "${nome}"?`;
  document.getElementById('btnConfirmar').onclick = async () => {
    if (!window._supabase) {
      const i = _pontos.findIndex(x => x.id === id);
      if (i >= 0) _pontos[i].ativo = false;
      renderPontos(_pontos);
      fecharModal('modalConfirmar');
      Toast.success('Ponto desativado.');
      return;
    }
    await window._supabase.from('pontos_venda').update({ ativo: false }).eq('id', id);
    fecharModal('modalConfirmar');
    Toast.success('Ponto desativado.');
    carregarPontos();
  };
  abrirModal('modalConfirmar');
}

// ══════════════════════════════════════════════
// ESTOQUE POR LOCAL
// ══════════════════════════════════════════════

async function carregarProdutos() {
  if (!window._supabase) {
    _produtos = [
      { id:1, nome:'Camiseta Preta P',  sku:'CAM-001', estoque_atual:15 },
      { id:2, nome:'Calça Jeans 38',    sku:'CAL-001', estoque_atual:3  },
      { id:3, nome:'Blusa Floral M',    sku:'BLU-001', estoque_atual:8  },
    ];
  } else {
    const { data } = await window._supabase
      .from('produtos').select('id, nome, sku, estoque_atual').eq('ativo', true).order('nome');
    _produtos = data || [];
  }

  const opts = _produtos.map(p =>
    `<option value="${p.id}">${p.nome}${p.sku ? ' — ' + p.sku : ''}</option>`
  ).join('');
  document.getElementById('transfProduto').innerHTML =
    '<option value="">Selecione o produto...</option>' + opts;
}

async function carregarEstoquePontos() {
  if (!window._supabase) {
    _estoquePontos = _pontos.map(p => ({
      ponto_id: p.id,
      ponto_nome: p.nome,
      itens: _produtos.map(prod => ({
        produto_id: prod.id,
        quantidade: Math.floor(Math.random() * 5),
      }))
    }));
  } else {
    const { data } = await window._supabase
      .from('estoque_ponto')
      .select('*, pontos_venda(nome), produtos(nome, sku)');
    _estoquePontos = data || [];
  }
  renderEstoquePontos();
}

function renderEstoquePontos() {
  const tbody  = document.getElementById('bodyEstoquePontos');
  const filtro = document.getElementById('filtroPontoEstoque').value;
  const busca  = document.getElementById('searchEstoquePonto').value.toLowerCase();

  let produtosFiltrados = _produtos;
  if (busca) produtosFiltrados = produtosFiltrados.filter(p =>
    p.nome?.toLowerCase().includes(busca) || p.sku?.toLowerCase().includes(busca)
  );

  if (!produtosFiltrados.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-loading">Nenhum produto encontrado</td></tr>';
    return;
  }

  tbody.innerHTML = produtosFiltrados.map(prod => {
    const central = prod.estoque_atual || 0;

    // Estoque em cada ponto
    const pontosCols = _pontos.filter(p => p.ativo).map(ponto => {
      let qtd = 0;
      if (window._supabase) {
        const reg = _estoquePontos.find(e => e.produto_id === prod.id && e.ponto_venda_id === ponto.id);
        qtd = reg?.quantidade || 0;
      } else {
        const reg = _estoquePontos.find(e => e.ponto_id === ponto.id);
        qtd = reg?.itens?.find(i => i.produto_id === prod.id)?.quantidade || 0;
      }
      return `<td style="text-align:center">${qtd}</td>`;
    }).join('');

    const totalPontos = _pontos.filter(p => p.ativo).reduce((s, ponto) => {
      if (!window._supabase) {
        const reg = _estoquePontos.find(e => e.ponto_id === ponto.id);
        return s + (reg?.itens?.find(i => i.produto_id === prod.id)?.quantidade || 0);
      }
      const reg = _estoquePontos.find(e => e.produto_id === prod.id && e.ponto_venda_id === ponto.id);
      return s + (reg?.quantidade || 0);
    }, 0);

    const total = central + totalPontos;

    return `
      <tr>
        <td><strong>${prod.nome}</strong></td>
        <td>${prod.sku || '—'}</td>
        <td style="text-align:center"><strong>${central}</strong></td>
        ${pontosCols}
        <td style="text-align:center"><strong>${total}</strong></td>
      </tr>
    `;
  }).join('');

  // Atualiza cabeçalho com nomes dos pontos
  const pontosAtivos = _pontos.filter(p => p.ativo);
  if (pontosAtivos.length) {
    document.getElementById('thPontosHeader').colSpan = pontosAtivos.length;
    document.getElementById('thPontosHeader').textContent = pontosAtivos.map(p => p.nome).join(' | ');
  }
}

// ══════════════════════════════════════════════
// TRANSFERÊNCIA
// ══════════════════════════════════════════════

function atualizarEstoqueOrigem() {
  const prodId  = parseInt(document.getElementById('transfProduto').value) || null;
  const origem  = document.getElementById('transfOrigem').value;
  const preview = document.getElementById('transfPreview');

  if (!prodId || !origem) { preview.classList.add('hidden'); return; }

  const produto = _produtos.find(p => p.id === prodId);
  if (!produto) return;

  let disponivel = 0;
  if (origem === 'central') {
    disponivel = produto.estoque_atual || 0;
  } else {
    if (!window._supabase) {
      const reg = _estoquePontos.find(e => e.ponto_id === Number(origem));
      disponivel = reg?.itens?.find(i => i.produto_id === prodId)?.quantidade || 0;
    } else {
      const reg = _estoquePontos.find(e =>
        e.produto_id === prodId && e.ponto_venda_id === Number(origem)
      );
      disponivel = reg?.quantidade || 0;
    }
  }

  document.getElementById('prevDisponivel').textContent = disponivel;
  preview.classList.remove('hidden');
  atualizarPreviewTransf();
}

function atualizarPreviewTransf() {
  const qtd       = parseInt(document.getElementById('transfQtd').value) || 0;
  const dispEl    = document.getElementById('prevDisponivel');
  const aposEl    = document.getElementById('prevApos');
  const disponivel = parseInt(dispEl.textContent) || 0;
  const apos      = disponivel - qtd;
  aposEl.textContent = apos;
  aposEl.style.color = apos < 0
    ? 'var(--color-danger)'
    : 'var(--color-success)';
}

async function realizarTransferencia() {
  const prodId  = parseInt(document.getElementById('transfProduto').value) || null;
  const origem  = document.getElementById('transfOrigem').value;
  const destino = document.getElementById('transfDestino').value;
  const qtd     = parseInt(document.getElementById('transfQtd').value) || 0;
  const obs     = document.getElementById('transfObs').value.trim();

  esconderErro('erroTransf');

  if (!prodId)         { mostrarErroModal('erroTransf', 'Selecione o produto.'); return; }
  if (!origem)         { mostrarErroModal('erroTransf', 'Selecione a origem.'); return; }
  if (!destino)        { mostrarErroModal('erroTransf', 'Selecione o destino.'); return; }
  if (origem === destino) { mostrarErroModal('erroTransf', 'Origem e destino não podem ser iguais.'); return; }
  if (qtd <= 0)        { mostrarErroModal('erroTransf', 'Informe uma quantidade maior que zero.'); return; }

  const disponivel = parseInt(document.getElementById('prevDisponivel').textContent) || 0;
  if (qtd > disponivel) {
    mostrarErroModal('erroTransf', `Quantidade maior que o disponível na origem (${disponivel}).`);
    return;
  }

  const produto = _produtos.find(p => p.id === prodId);
  const user    = Auth.getUser();

  if (!window._supabase) {
    Toast.success('Transferência realizada!', `${qtd}x ${produto?.nome} transferido com sucesso.`);
    limparTransferencia();
    return;
  }

  try {
    // Baixa da origem
    if (origem === 'central') {
      const novoEst = Math.max(0, (produto.estoque_atual || 0) - qtd);
      await window._supabase.from('produtos')
        .update({ estoque_atual: novoEst, updated_at: new Date().toISOString() })
        .eq('id', prodId);
    } else {
      const { data: reg } = await window._supabase
        .from('estoque_ponto')
        .select('id, quantidade')
        .eq('produto_id', prodId)
        .eq('ponto_venda_id', Number(origem))
        .single();
      if (reg) {
        await window._supabase.from('estoque_ponto')
          .update({ quantidade: Math.max(0, reg.quantidade - qtd) })
          .eq('id', reg.id);
      }
    }

    // Adiciona no destino
    if (destino === 'central') {
      const novoEst = (produto.estoque_atual || 0) + qtd;
      await window._supabase.from('produtos')
        .update({ estoque_atual: novoEst, updated_at: new Date().toISOString() })
        .eq('id', prodId);
    } else {
      const { data: reg } = await window._supabase
        .from('estoque_ponto')
        .select('id, quantidade')
        .eq('produto_id', prodId)
        .eq('ponto_venda_id', Number(destino))
        .single();

      if (reg) {
        await window._supabase.from('estoque_ponto')
          .update({ quantidade: reg.quantidade + qtd })
          .eq('id', reg.id);
      } else {
        await window._supabase.from('estoque_ponto').insert({
          produto_id:     prodId,
          ponto_venda_id: Number(destino),
          quantidade:     qtd,
        });
      }
    }

    // Registra movimentação
    const nomeOrigem  = origem === 'central' ? 'Estoque Central' : (_pontos.find(p => p.id === Number(origem))?.nome || origem);
    const nomeDestino = destino === 'central' ? 'Estoque Central' : (_pontos.find(p => p.id === Number(destino))?.nome || destino);

    await window._supabase.from('movimentacoes_estoque').insert({
      produto_id:  prodId,
      tipo:        'transferencia',
      quantidade:  qtd,
      referencia:  `${nomeOrigem} → ${nomeDestino}${obs ? ' | ' + obs : ''}`,
      usuario_id:  user?.id || null,
    });

    Toast.success('Transferência realizada!', `${qtd}x ${produto?.nome} transferido de ${nomeOrigem} para ${nomeDestino}.`);
    limparTransferencia();
    await Promise.all([carregarProdutos(), carregarEstoquePontos(), carregarTransferencias()]);

  } catch (err) {
    mostrarErroModal('erroTransf', err.message || 'Erro ao realizar transferência.');
  }
}

function limparTransferencia() {
  document.getElementById('transfProduto').value = '';
  document.getElementById('transfOrigem').value = '';
  document.getElementById('transfDestino').value = '';
  document.getElementById('transfQtd').value = '';
  document.getElementById('transfObs').value = '';
  document.getElementById('transfPreview').classList.add('hidden');
  esconderErro('erroTransf');
}

async function carregarTransferencias() {
  if (!window._supabase) {
    _transferencias = [
      { created_at: new Date().toISOString(), produto:'Camiseta Preta P', origem:'Estoque Central', destino:'Loja Shopping Norte', qtd:5, obs:'' },
    ];
    renderTransferencias(_transferencias);
    return;
  }

  const { data } = await window._supabase
    .from('movimentacoes_estoque')
    .select('*, produtos(nome)')
    .eq('tipo', 'transferencia')
    .order('created_at', { ascending: false })
    .limit(50);

  _transferencias = data || [];
  renderTransferencias(_transferencias);
}

function renderTransferencias(lista) {
  const tbody = document.getElementById('bodyTransferencias');
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Nenhuma transferência registrada</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(t => {
    const ref   = t.referencia || '';
    const partes = ref.split('→');
    const origem  = partes[0]?.trim() || '—';
    const destObs = partes[1]?.trim() || '—';
    const destParts = destObs.split('|');
    const destino = destParts[0]?.trim() || '—';
    const obs     = destParts[1]?.trim() || '—';

    return `
      <tr>
        <td>${Format.date(t.created_at)}</td>
        <td>${t.produtos?.nome || t.produto || '—'}</td>
        <td>${origem}</td>
        <td>${destino}</td>
        <td><strong>${t.quantidade || t.qtd}</strong></td>
        <td>${obs !== '—' ? obs : '—'}</td>
      </tr>
    `;
  }).join('');
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

function setBtnLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Salvando...' : 'Salvar';
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) fecharModal(e.target.id);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape')
    document.querySelectorAll('.modal-overlay.active').forEach(m => fecharModal(m.id));
});
