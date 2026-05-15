const CACHE_NAME = 'treemali-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/pages/login.html',
  '/pages/dashboard.html',
  '/pages/vendas.html',
  '/css/global.css',
  '/css/variables.css',
  '/js/auth.js',
  '/js/config.js',
  '/js/layout.js',
  '/pages/vendas.js',
  '/assets/logo.png'
];

// Instalação: Cacheia os arquivos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Ativação: Limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

// Intercepta requisições: Tenta rede, se falhar vai pro cache
self.addEventListener('fetch', (event) => {
  // Ignora requisições do Supabase (essas tratamos no código)
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
