/**
 * TREEMALI ERP — Autenticação e Gestão de Sessão
 * Integração direta com Supabase (tabela 'usuarios')
 */

const Auth = {
  // Chave usada no localStorage para persistência
  STORAGE_KEY: 'treemali_auth_user',

  /**
   * Tenta realizar o login no Supabase
   * @param {string} login 
   * @param {string} senha 
   * @returns {Promise<{ok: boolean, msg: string}>}
   */
  async login(login, senha) {
    if (!window._supabase) {
      // Modo Demo
      if (login === 'admin' && senha === 'admin123') {
        const demoUser = { id: 0, nome: 'Administrador Demo', login: 'admin', role: 'master' };
        this.saveSession(demoUser);
        return { ok: true };
      }
      return { ok: false, msg: 'Modo demo: use admin / admin123' };
    }

    try {
      // Converte senha para Base64 (padrão do projeto Treemali)
      const senhaHash = btoa(senha);

      const { data: usuario, error } = await window._supabase
        .from('usuarios')
        .select('id, nome, login, senha_hash, role, ativo')
        .eq('login', login)
        .eq('ativo', true)
        .single();

      if (error || !usuario) {
        return { ok: false, msg: 'Usuário não encontrado ou inativo.' };
      }

      if (usuario.senha_hash !== senhaHash) {
        return { ok: false, msg: 'Senha incorreta.' };
      }

      // Login bem-sucedido
      this.saveSession(usuario);
      return { ok: true };

    } catch (err) {
      console.error('Erro no login:', err);
      return { ok: false, msg: 'Erro técnico ao conectar ao servidor.' };
    }
  },

  /**
   * Salva os dados do usuário no localStorage
   */
  saveSession(user) {
    // Removemos a senha antes de salvar localmente por segurança
    const sessionData = { ...user };
    delete sessionData.senha_hash;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessionData));
  },

  /**
   * Retorna os dados do usuário logado
   */
  getUser() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Verifica se existe uma sessão ativa
   */
  isLoggedIn() {
    return !!this.getUser();
  },

  /**
   * Verifica se o usuário é Administrador (Master)
   */
  isMaster() {
    const user = this.getUser();
    return user && user.role === 'master';
  },

  /**
   * Verifica se o usuário é Vendedor
   */
  isSeller() {
    const user = this.getUser();
    return user && user.role === 'vendedor';
  },

  /**
   * Finaliza a sessão e redireciona
   */
  logout() {
    localStorage.removeItem(this.STORAGE_KEY);
    // Redireciona para o login (ajusta o path se estiver em subpasta)
    const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
    window.location.href = prefix + 'login.html';
  }
};

// Expõe globalmente
window.Auth = Auth;
