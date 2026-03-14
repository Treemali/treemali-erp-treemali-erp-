/**
 * TREEMALI ERP — Layout Module
 * Handles sidebar, header, navigation, and shared UI behavior
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Auth guard: redirect if not logged in
  if (!Auth.isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }

  const user = Auth.getUser();

  // ── Populate user info in sidebar
  const userAvatar = document.getElementById('userAvatar');
  const userName   = document.getElementById('userName');
  const userRole   = document.getElementById('userRole');

  if (userAvatar && user) {
    userAvatar.textContent = (user.nome || user.login || 'U')[0].toUpperCase();
  }
  if (userName && user) {
    userName.textContent = user.nome || user.login;
  }
  if (userRole && user) {
    userRole.textContent = user.role === 'master' ? 'Administrador' : 'Vendedor';
  }

  // ── Logout button
  document.getElementById('btnLogout')?.addEventListener('click', () => {
    Auth.logout();
  });

  // ── Sidebar toggle (collapse/expand on desktop)
  const sidebar      = document.getElementById('sidebar');
  const toggleBtn    = document.getElementById('btnSidebarToggle');
  const overlay      = document.getElementById('sidebarOverlay');

  const isMobile = () => window.innerWidth <= 768;

  toggleBtn?.addEventListener('click', () => {
    if (isMobile()) {
      sidebar.classList.toggle('mobile-open');
      overlay?.classList.toggle('active');
    } else {
      sidebar.classList.toggle('collapsed');
      localStorage.setItem('sidebar_collapsed', sidebar.classList.contains('collapsed'));
    }
  });

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('active');
  });

  // Restore sidebar collapsed state on desktop
  if (!isMobile()) {
    const wasCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (wasCollapsed) sidebar.classList.add('collapsed');
  }

  // ── Highlight active nav item
  const currentPage = window.location.pathname.split('/').pop();
  document.querySelectorAll('.nav-item').forEach(item => {
    const href = item.getAttribute('href') || '';
    if (href === currentPage || href.endsWith(currentPage)) {
      item.classList.add('active');
    }
  });

  // ── Update header date
  const headerDate = document.getElementById('headerDate');
  if (headerDate) {
    const now = new Date();
    headerDate.textContent = now.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  // ── Hide master-only nav items for sellers
  if (Auth.isSeller()) {
    document.querySelectorAll('[data-role="master"]').forEach(el => {
      el.style.display = 'none';
    });
  }

  // ── Alert bell — load alert count
  loadAlertCount();
});

// ============================================================
// ALERT COUNT
// ============================================================

async function loadAlertCount() {
  // This will be connected to Supabase queries in full implementation
  // For now it reads from a global state set by each page
  const count = window._alertCount || 0;
  const dot = document.querySelector('.alert-dot');
  if (dot) {
    dot.style.display = count > 0 ? 'block' : 'none';
  }
}

// ============================================================
// TOAST NOTIFICATION SYSTEM
// ============================================================

const Toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(title, message = '', type = 'default', duration = 4000) {
    this.init();

    const icons = {
      success: '✓',
      warning: '⚠',
      error:   '✕',
      default: 'ℹ'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.default}</span>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
    `;

    this.container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  },

  success(title, message) { this.show(title, message, 'success'); },
  warning(title, message) { this.show(title, message, 'warning'); },
  error(title, message)   { this.show(title, message, 'error');   },
};

// ============================================================
// MODAL SYSTEM
// ============================================================

const Modal = {
  open(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  },

  close(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  closeAll() {
    document.querySelectorAll('.modal-overlay.active').forEach(el => {
      el.classList.remove('active');
    });
    document.body.style.overflow = '';
  }
};

// Close modal when clicking overlay backdrop
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    Modal.closeAll();
  }
});

// Close on ESC key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') Modal.closeAll();
});

// ============================================================
// FORMAT HELPERS
// ============================================================

const Format = {
  currency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  },

  percent(value) {
    return `${Number(value).toFixed(2).replace('.', ',')}%`;
  },

  date(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  },

  datetime(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('pt-BR');
  },

  number(value) {
    return new Intl.NumberFormat('pt-BR').format(value || 0);
  }
};

// ============================================================
// SUPABASE DATA HELPERS
// ============================================================

const DB = {
  // Use a getter so we always pick up window._supabase after it's initialized
  get supabase() { return window._supabase || null; },

  async query(table, options = {}) {
    if (!this.supabase) {
      console.warn('Supabase not configured. Using demo data.');
      return { data: [], error: null };
    }

    let q = this.supabase.from(table).select(options.select || '*');

    if (options.filters) {
      options.filters.forEach(([col, val]) => { q = q.eq(col, val); });
    }

    if (options.order) {
      q = q.order(options.order.col, { ascending: options.order.asc ?? true });
    }

    if (options.limit) q = q.limit(options.limit);

    return await q;
  },

  async insert(table, data) {
    if (!this.supabase) return { error: 'No Supabase connection' };
    return await this.supabase.from(table).insert(data).select().single();
  },

  async update(table, id, data) {
    if (!this.supabase) return { error: 'No Supabase connection' };
    return await this.supabase.from(table).update(data).eq('id', id).select().single();
  },

  async remove(table, id) {
    if (!this.supabase) return { error: 'No Supabase connection' };
    return await this.supabase.from(table).delete().eq('id', id);
  }
};
