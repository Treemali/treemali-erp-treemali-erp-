/**
 * TREEMALI ERP — Supabase Configuration
 *
 * IMPORTANTE: Substitua os valores abaixo pelas suas credenciais do Supabase.
 * Encontre em: Supabase Dashboard → Seu Projeto → Settings → API
 *
 * Enquanto não configurar, o sistema funciona em modo demo com dados de exemplo.
 */

const SUPABASE_URL     = 'https://wvicjdhorighhcwkybfm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2aWNqZGhvcmlnaGhjd2t5YmZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MTAzMTUsImV4cCI6MjA4OTA4NjMxNX0.jJHOXgLaTJgCgAtyUDWr5UkvihQZwwLGmZ0zKFdEtto';

// Inicializa o cliente Supabase globalmente (supabase-js v2)
// Só executa se a URL foi preenchida (evita erros em modo demo)
(function initSupabase() {
  if (
    typeof supabase === 'undefined' ||
    SUPABASE_URL.includes('SEU-PROJETO') ||
    SUPABASE_ANON_KEY.includes('sua-anon-key')
  ) {
    console.info('Treemali: Supabase não configurado — rodando em modo demo.');
    window._supabase = null;
    return;
  }

  try {
    window._supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.info('Treemali: Supabase conectado com sucesso.');
  } catch (e) {
    console.error('Treemali: Erro ao conectar Supabase:', e);
    window._supabase = null;
  }
})();
