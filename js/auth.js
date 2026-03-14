/**
 * TREEMALI ERP — Authentication Module
 * Handles login, session management, and access control.
 *
 * This file is loaded on EVERY page. It only attaches
 * login-form listeners when the form actually exists on the page.
 */

// ============================================================
// SESSION HELPERS  (available globally on all pages)
// ============================================================

const Auth = {

  /** Saves user session to localStorage */
  saveSession(user) {
    localStorage.setItem('treemali_user', JSON.stringify(user));
    localStorage.setItem('treemali_session_at', Date.now().toString());
  },

  /** Returns the current logged-in user object, or null */
  getUser() {
    try {
      const raw = localStorage.getItem('treemali_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  /** True when there is an active session */
  isLoggedIn() {
    return this.getUser() !== null;
  },

  /** True when the logged-in user is master/admin */
  isMaster() {
    const user = this.getUser();
    return user !== null && user.role === 'master';
  },

  /** True when the logged-in user is a seller */
  isSeller() {
    const user = this.getUser();
    return user !== null && user.role === 'vendedor';
  },

  /**
   * Clears session and redirects to login.
   * Works correctly from both /pages/ folder and root.
   */
  logout() {
    localStorage.removeItem('treemali_user');
    localStorage.removeItem('treemali_session_at');
    const inPages = window.location.pathname.includes('/pages/');
    window.location.href = inPages ? 'login.html' : 'pages/login.html';
  },

  /** Redirects to login if not authenticated. */
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },

  /** Redirects to dashboard if not master. */
  requireMaster() {
    if (!this.isMaster()) {
      alert('Acesso restrito. Apenas o administrador pode acessar esta área.');
      window.location.href = 'dashboard.html';
      return false;
    }
    return true;
  }
};

// ============================================================
// LOGIN PAGE LOGIC
// Only runs when the login form is present on the page.
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  const form = document.getElementById('loginForm');
  if (!form) return; // Not the login page — do nothing

  if (Auth.isLoggedIn()) {
    window.location.href = 'dashboard.html';
    return;
  }

  const loginInput    = document.getElementById('login');
  const senhaInput    = document.getElementById('senha');
  const loginError    = document.getElementById('loginError');
  const senhaError    = document.getElementById('senhaError');
  const generalError  = document.getElementById('generalError');
  const generalErrTxt = document.getElementById('generalErrorText');
  const btnLogin      = document.getElementById('btnLogin');
  const btnText       = btnLogin.querySelector('.btn-text');
  const spinner       = document.getElementById('loginSpinner');
  const toggleBtn     = document.getElementById('togglePassword');
  const eyeOpen       = toggleBtn.querySelector('.eye-open');
  const eyeClosed     = toggleBtn.querySelector('.eye-closed');

  toggleBtn.addEventListener('click', () => {
    const isPassword = senhaInput.type === 'password';
    senhaInput.type  = isPassword ? 'text' : 'password';
    eyeOpen.classList.toggle('hidden', isPassword);
    eyeClosed.classList.toggle('hidden', !isPassword);
  });

  loginInput.addEventListener('input', () => {
    loginInput.classList.remove('error');
    loginError.classList.add('hidden');
    generalError.classList.add('hidden');
  });

  senhaInput.addEventListener('input', () => {
    senhaInput.classList.remove('error');
    senhaError.classList.add('hidden');
    generalError.classList.add('hidden');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const loginVal = loginInput.value.trim();
    const senhaVal = senhaInput.value;
    let valid = true;

    if (!loginVal) {
      loginInput.classList.add('error');
      loginError.classList.remove('hidden');
      valid = false;
    }
    if (!senhaVal) {
      senhaInput.classList.add('error');
      senhaError.classList.remove('hidden');
      valid = false;
    }
    if (!valid) return;

    setLoading(true);

    try {
      const user = await loginWithSupabase(loginVal, senhaVal);
      Auth.saveSession(user);
      window.location.href = 'dashboard.html';
    } catch (err) {
      setLoading(false);
      showGeneralError(err.message || 'Usuário ou senha incorretos.');
    }
  });

  function setLoading(isLoading) {
    btnLogin.disabled = isLoading;
    btnText.classList.toggle('hidden', isLoading);
    spinner.classList.toggle('hidden', !isLoading);
  }

  function showGeneralError(msg) {
    generalErrTxt.textContent = msg;
    generalError.classList.remove('hidden');
    generalError.style.animation = 'none';
    generalError.offsetHeight;
    generalError.style.animation = '';
  }
});

// ============================================================
// SUPABASE AUTHENTICATION
// ============================================================

async function loginWithSupabase(login, senha) {
  if (!window._supabase) {
    return loginDemo(login, senha);
  }

  const { data, error } = await window._supabase
    .from('usuarios')
    .select('id, nome, login, role')
    .eq('login', login)
    .eq('senha_hash', btoa(senha))
    .eq('ativo', true)
    .single();

  if (error || !data) {
    throw new Error('Usuário ou senha incorretos.');
  }

  return data;
}

function loginDemo(login, senha) {
  const demoUsers = [
    { id: 1, nome: 'Administrador',   login: 'admin', senha: 'admin123', role: 'master'   },
    { id: 2, nome: 'Maria Vendedora', login: 'maria', senha: 'maria123', role: 'vendedor' },
    { id: 3, nome: 'João Vendedor',   login: 'joao',  senha: 'joao123',  role: 'vendedor' },
  ];
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const user = demoUsers.find(u => u.login === login && u.senha === senha);
      if (user) {
        const { senha: _r, ...safeUser } = user;
        resolve(safeUser);
      } else {
        reject(new Error('Usuário ou senha incorretos.'));
      }
    }, 700);
  });
}
