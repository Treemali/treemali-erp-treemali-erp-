/**
 * TREEMALI ERP — Módulo de Cadastros
 * CRUD completo: Clientes, Fornecedores, Vendedores
 */

// ── Dados em memória para busca rápida
let _clientes     = [];
let _fornecedores = [];
let _vendedores   = [];

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

  // Buscas em tempo real
  document.getElementById('searchClientes')
    .addEventListener('input', e => filtrarTabela(e.target.value, _clientes, renderClientes));
  document.getElementById('searchFornecedores')
    .addEventListener('input', e => filtrarTabela(e.target.value, _fornecedores, renderFornecedores));
  document.getElementById('searchVendedores')
    .addEventListener('input', e => filtrarTabela(e.target.value, _vendedores, renderVendedores));

  // Máscaras
  document.getElementById('clienteCpf')
    .addEventListener('input', e => { e.target.value = mascaraCpf(e.target.value); });
  document.getElementById('clienteTelefone')
    .addEventListener('input', e => { e.target.value = mascaraTelefone(e.target.value); });
  document.getElementById('fornecedorCnpj')
    .addEventListener('input', e => { e.target.value = mascaraCnpj(e.target.value); });
  document.getElementById('fornecedorTelefone')
    .addEventListener('input', e => { e.target.value = mascaraTelefone(e.target.value); });

  // Carregar dados
  carregarClientes();
  carregarFornecedores();
  carregarVendedores();
});

// ══════════════════════════════════════════════
// CLIENTES
// ══════════════════════════════════════════════

async function carregarClientes() {
  if (!window._supabase) {
    _clientes = [
      { id:1, nome:'Ana Silva',   cpf:'123.456.789-00', telefone:'(44) 99999-0001', cidade:'Umuarama', ativo:true },
      { id:2, nome:'Pedro Souza', cpf:'987.654.321-00', telefone:'(44) 99999-0002', cidade:'Maringá',  ativo:true },
    ];
    renderClientes(_clientes);
    return;
  }
  const { data, error } = await window._supabase
    .from('clientes').select('*').order('nome');
  if (error) { mostrarErroTabela('bodyClientes', 6, error.message); return; }
  _clientes = data || [];
  renderClientes(_clientes);
}

function renderClientes(lista) {
  const tbody = document.getElementById('bodyClientes');
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Nenhum cliente cadastrado</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(c => `
    <tr>
      <td><strong>${c.nome}</strong></td>
      <td>${c.cpf || '—'}</td>
      <td>${c.telefone || '—'}</td>
      <td>${formatarAniversario(c.data_nascimento)}</td>
      <td>${c.cidade || '—'}</td>
      <td><span class="badge ${c.ativo ? 'badge-success' : 'badge-neutral'}">${c.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td>
        <button class="btn-table" onclick="editarCliente(${c.id})" title="Editar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-table danger" onclick="desativarRegistro('clientes', ${c.id}, '${c.nome}', carregarClientes)" title="Desativar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
      </td>
    </tr>
  `).join('');
}

function abrirNovoCliente() {
  document.getElementById('clienteId').value = '';
  document.getElementById('clienteNome').value = '';
  document.getElementById('clienteCpf').value = '';
  document.getElementById('clienteTelefone').value = '';
  document.getElementById('clienteEmail').value = '';
  document.getElementById('clienteEndereco').value = '';
  document.getElementById('clienteCidade').value = '';
  document.getElementById('clienteNascimento').value = '';
  document.getElementById('clienteAtivo').value = 'true';
  document.getElementById('tituloModalCliente').textContent = 'Novo Cliente';
  esconderErro('erroCliente');
  abrirModal('modalCliente');
}

function editarCliente(id) {
  const c = _clientes.find(x => x.id === id);
  if (!c) return;
  document.getElementById('clienteId').value = c.id;
  document.getElementById('clienteNome').value = c.nome || '';
  document.getElementById('clienteCpf').value = c.cpf || '';
  document.getElementById('clienteTelefone').value = c.telefone || '';
  document.getElementById('clienteEmail').value = c.email || '';
  document.getElementById('clienteEndereco').value = c.endereco || '';
  document.getElementById('clienteCidade').value = c.cidade || '';
  document.getElementById('clienteNascimento').value = c.data_nascimento || '';
  document.getElementById('clienteAtivo').value = String(c.ativo);
  document.getElementById('tituloModalCliente').textContent = 'Editar Cliente';
  esconderErro('erroCliente');
  abrirModal('modalCliente');
}

async function salvarCliente() {
  const nome = document.getElementById('clienteNome').value.trim();
  if (!nome) { mostrarErroModal('erroCliente', 'O nome é obrigatório.'); return; }

  const id    = document.getElementById('clienteId').value;
  const dados = {
    nome,
    cpf:              document.getElementById('clienteCpf').value.trim() || null,
    telefone:         document.getElementById('clienteTelefone').value.trim() || null,
    email:            document.getElementById('clienteEmail').value.trim() || null,
    endereco:         document.getElementById('clienteEndereco').value.trim() || null,
    cidade:           document.getElementById('clienteCidade').value.trim() || null,
    data_nascimento:  document.getElementById('clienteNascimento').value || null,
    ativo:            document.getElementById('clienteAtivo').value === 'true',
  };

  setBtnLoading('btnSalvarCliente', true);

  if (!window._supabase) {
    // Demo
    if (id) {
      const i = _clientes.findIndex(x => x.id === Number(id));
      if (i >= 0) _clientes[i] = { ..._clientes[i], ...dados };
    } else {
      _clientes.push({ id: Date.now(), ...dados });
    }
    renderClientes(_clientes);
    fecharModal('modalCliente');
    Toast.success('Cliente salvo com sucesso!');
    setBtnLoading('btnSalvarCliente', false);
    return;
  }

  let error;
  if (id) {
    ({ error } = await window._supabase.from('clientes').update(dados).eq('id', id));
  } else {
    ({ error } = await window._supabase.from('clientes').insert(dados));
  }

  setBtnLoading('btnSalvarCliente', false);

  if (error) { mostrarErroModal('erroCliente', error.message); return; }
  fecharModal('modalCliente');
  Toast.success('Cliente salvo com sucesso!');
  carregarClientes();
}

// ══════════════════════════════════════════════
// FORNECEDORES
// ══════════════════════════════════════════════

async function carregarFornecedores() {
  if (!window._supabase) {
    _fornecedores = [
      { id:1, nome:'Distribuidora ABC', cnpj:'00.000.000/0001-00', telefone:'(11) 3333-4444', contato:'João', ativo:true },
    ];
    renderFornecedores(_fornecedores);
    return;
  }
  const { data, error } = await window._supabase
    .from('fornecedores').select('*').order('nome');
  if (error) { mostrarErroTabela('bodyFornecedores', 6, error.message); return; }
  _fornecedores = data || [];
  renderFornecedores(_fornecedores);
}

function renderFornecedores(lista) {
  const tbody = document.getElementById('bodyFornecedores');
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Nenhum fornecedor cadastrado</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(f => `
    <tr>
      <td><strong>${f.nome}</strong></td>
      <td>${f.cnpj || '—'}</td>
      <td>${f.telefone || '—'}</td>
      <td>${f.contato || '—'}</td>
      <td><span class="badge ${f.ativo ? 'badge-success' : 'badge-neutral'}">${f.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td>
        <button class="btn-table" onclick="editarFornecedor(${f.id})" title="Editar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-table danger" onclick="desativarRegistro('fornecedores', ${f.id}, '${f.nome}', carregarFornecedores)" title="Desativar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </td>
    </tr>
  `).join('');
}

function abrirNovoFornecedor() {
  document.getElementById('fornecedorId').value = '';
  document.getElementById('fornecedorNome').value = '';
  document.getElementById('fornecedorCnpj').value = '';
  document.getElementById('fornecedorTelefone').value = '';
  document.getElementById('fornecedorEmail').value = '';
  document.getElementById('fornecedorContato').value = '';
  document.getElementById('fornecedorAtivo').value = 'true';
  document.getElementById('tituloModalFornecedor').textContent = 'Novo Fornecedor';
  esconderErro('erroFornecedor');
  abrirModal('modalFornecedor');
}

function editarFornecedor(id) {
  const f = _fornecedores.find(x => x.id === id);
  if (!f) return;
  document.getElementById('fornecedorId').value = f.id;
  document.getElementById('fornecedorNome').value = f.nome || '';
  document.getElementById('fornecedorCnpj').value = f.cnpj || '';
  document.getElementById('fornecedorTelefone').value = f.telefone || '';
  document.getElementById('fornecedorEmail').value = f.email || '';
  document.getElementById('fornecedorContato').value = f.contato || '';
  document.getElementById('fornecedorAtivo').value = String(f.ativo);
  document.getElementById('tituloModalFornecedor').textContent = 'Editar Fornecedor';
  esconderErro('erroFornecedor');
  abrirModal('modalFornecedor');
}

async function salvarFornecedor() {
  const nome = document.getElementById('fornecedorNome').value.trim();
  if (!nome) { mostrarErroModal('erroFornecedor', 'O nome é obrigatório.'); return; }

  const id    = document.getElementById('fornecedorId').value;
  const dados = {
    nome,
    cnpj:     document.getElementById('fornecedorCnpj').value.trim() || null,
    telefone: document.getElementById('fornecedorTelefone').value.trim() || null,
    email:    document.getElementById('fornecedorEmail').value.trim() || null,
    contato:  document.getElementById('fornecedorContato').value.trim() || null,
    ativo:    document.getElementById('fornecedorAtivo').value === 'true',
  };

  setBtnLoading('btnSalvarFornecedor', true);

  if (!window._supabase) {
    if (id) {
      const i = _fornecedores.findIndex(x => x.id === Number(id));
      if (i >= 0) _fornecedores[i] = { ..._fornecedores[i], ...dados };
    } else {
      _fornecedores.push({ id: Date.now(), ...dados });
    }
    renderFornecedores(_fornecedores);
    fecharModal('modalFornecedor');
    Toast.success('Fornecedor salvo com sucesso!');
    setBtnLoading('btnSalvarFornecedor', false);
    return;
  }

  let error;
  if (id) {
    ({ error } = await window._supabase.from('fornecedores').update(dados).eq('id', id));
  } else {
    ({ error } = await window._supabase.from('fornecedores').insert(dados));
  }

  setBtnLoading('btnSalvarFornecedor', false);
  if (error) { mostrarErroModal('erroFornecedor', error.message); return; }
  fecharModal('modalFornecedor');
  Toast.success('Fornecedor salvo com sucesso!');
  carregarFornecedores();
}

// ══════════════════════════════════════════════
// VENDEDORES
// ══════════════════════════════════════════════

async function carregarVendedores() {
  if (!window._supabase) {
    _vendedores = [
      { id:1, nome:'Administrador', login:'jhony.admin', role:'master',   ativo:true },
    ];
    renderVendedores(_vendedores);
    return;
  }
  const { data, error } = await window._supabase
    .from('usuarios').select('id, nome, login, role, ativo').order('nome');
  if (error) { mostrarErroTabela('bodyVendedores', 5, error.message); return; }
  _vendedores = data || [];
  renderVendedores(_vendedores);
}

function renderVendedores(lista) {
  const tbody = document.getElementById('bodyVendedores');
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-loading">Nenhum usuário cadastrado</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(v => `
    <tr>
      <td><strong>${v.nome}</strong></td>
      <td>${v.login}</td>
      <td><span class="badge ${v.role === 'master' ? 'badge-info' : 'badge-neutral'}">${v.role === 'master' ? 'Admin' : 'Vendedor'}</span></td>
      <td><span class="badge ${v.ativo ? 'badge-success' : 'badge-neutral'}">${v.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td>
        <button class="btn-table" onclick="editarVendedor(${v.id})" title="Editar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-table danger" onclick="desativarRegistro('usuarios', ${v.id}, '${v.nome}', carregarVendedores)" title="Desativar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </td>
    </tr>
  `).join('');
}

function abrirNovoVendedor() {
  document.getElementById('vendedorId').value = '';
  document.getElementById('vendedorNome').value = '';
  document.getElementById('vendedorLogin').value = '';
  document.getElementById('vendedorSenha').value = '';
  document.getElementById('vendedorRole').value = 'vendedor';
  document.getElementById('vendedorAtivo').value = 'true';
  document.getElementById('tituloModalVendedor').textContent = 'Novo Vendedor';
  esconderErro('erroVendedor');
  abrirModal('modalVendedor');
}

function editarVendedor(id) {
  const v = _vendedores.find(x => x.id === id);
  if (!v) return;
  document.getElementById('vendedorId').value = v.id;
  document.getElementById('vendedorNome').value = v.nome || '';
  document.getElementById('vendedorLogin').value = v.login || '';
  document.getElementById('vendedorSenha').value = '';
  document.getElementById('vendedorRole').value = v.role || 'vendedor';
  document.getElementById('vendedorAtivo').value = String(v.ativo);
  document.getElementById('tituloModalVendedor').textContent = 'Editar Vendedor';
  esconderErro('erroVendedor');
  abrirModal('modalVendedor');
}

async function salvarVendedor() {
  const nome  = document.getElementById('vendedorNome').value.trim();
  const login = document.getElementById('vendedorLogin').value.trim();
  const senha = document.getElementById('vendedorSenha').value;
  const id    = document.getElementById('vendedorId').value;

  if (!nome)  { mostrarErroModal('erroVendedor', 'O nome é obrigatório.'); return; }
  if (!login) { mostrarErroModal('erroVendedor', 'O login é obrigatório.'); return; }
  if (!id && !senha) { mostrarErroModal('erroVendedor', 'A senha é obrigatória para novo usuário.'); return; }

  const dados = {
    nome,
    login,
    role:  document.getElementById('vendedorRole').value,
    ativo: document.getElementById('vendedorAtivo').value === 'true',
  };

  // Só atualiza senha_hash se uma nova senha foi informada
  if (senha) {
    dados.senha_hash = btoa(senha);
  }

  setBtnLoading('btnSalvarVendedor', true);

  if (!window._supabase) {
    if (id) {
      const i = _vendedores.findIndex(x => x.id === Number(id));
      if (i >= 0) _vendedores[i] = { ..._vendedores[i], ...dados };
    } else {
      _vendedores.push({ id: Date.now(), ...dados });
    }
    renderVendedores(_vendedores);
    fecharModal('modalVendedor');
    Toast.success('Vendedor salvo com sucesso!');
    setBtnLoading('btnSalvarVendedor', false);
    return;
  }

  let error;
  if (id) {
    ({ error } = await window._supabase.from('usuarios').update(dados).eq('id', id));
  } else {
    ({ error } = await window._supabase.from('usuarios').insert(dados));
  }

  setBtnLoading('btnSalvarVendedor', false);
  if (error) { mostrarErroModal('erroVendedor', error.message); return; }
  fecharModal('modalVendedor');
  Toast.success('Vendedor salvo com sucesso!');
  carregarVendedores();
}

// ══════════════════════════════════════════════
// DESATIVAR REGISTRO (comum a todos)
// ══════════════════════════════════════════════

function desativarRegistro(tabela, id, nome, callbackRecarregar) {
  document.getElementById('msgConfirmar').textContent =
    `Deseja desativar "${nome}"? O registro não será excluído, apenas marcado como inativo.`;

  const btnConfirmar = document.getElementById('btnConfirmar');
  btnConfirmar.onclick = async () => {
    if (!window._supabase) {
      Toast.success('Registro desativado.');
      fecharModal('modalConfirmar');
      callbackRecarregar();
      return;
    }
    const { error } = await window._supabase
      .from(tabela).update({ ativo: false }).eq('id', id);
    if (error) { Toast.error('Erro ao desativar.', error.message); return; }
    fecharModal('modalConfirmar');
    Toast.success('Registro desativado com sucesso.');
    callbackRecarregar();
  };

  abrirModal('modalConfirmar');
}

// ══════════════════════════════════════════════
// FILTRO DE BUSCA
// ══════════════════════════════════════════════

function filtrarTabela(termo, lista, renderFn) {
  if (!termo.trim()) { renderFn(lista); return; }
  const t = termo.toLowerCase();
  renderFn(lista.filter(item =>
    Object.values(item).some(v => v && String(v).toLowerCase().includes(t))
  ));
}

// ══════════════════════════════════════════════
// HELPERS DE MODAL E UI
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
  el.textContent = msg;
  el.classList.remove('hidden');
}

function esconderErro(id) {
  document.getElementById(id).classList.add('hidden');
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

// Fecha modal ao clicar no fundo
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) fecharModal(e.target.id);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active')
      .forEach(m => fecharModal(m.id));
  }
});

// ══════════════════════════════════════════════
// FORMATAÇÃO DE ANIVERSÁRIO
// ══════════════════════════════════════════════

function formatarAniversario(data) {
  if (!data) return '—';
  // data vem como YYYY-MM-DD, exibe DD/MM
  const partes = data.split('-');
  if (partes.length < 3) return '—';
  return `${partes[2]}/${partes[1]}`;
}

// ══════════════════════════════════════════════
// MÁSCARAS
// ══════════════════════════════════════════════

function mascaraCpf(v) {
  v = v.replace(/\D/g,'');
  v = v.replace(/(\d{3})(\d)/,'$1.$2');
  v = v.replace(/(\d{3})(\d)/,'$1.$2');
  v = v.replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  return v;
}

function mascaraCnpj(v) {
  v = v.replace(/\D/g,'');
  v = v.replace(/^(\d{2})(\d)/,'$1.$2');
  v = v.replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3');
  v = v.replace(/\.(\d{3})(\d)/,'.$1/$2');
  v = v.replace(/(\d{4})(\d)/,'$1-$2');
  return v;
}

function mascaraTelefone(v) {
  v = v.replace(/\D/g,'');
  if (v.length <= 10) {
    v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3');
  } else {
    v = v.replace(/^(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3');
  }
  return v;
}
