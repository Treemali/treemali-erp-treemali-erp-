/**
 * TREEMALI ERP — Alertas
 * Estoque baixo, condicionais vencidas, parcelas vencidas de crediário
 */

document.addEventListener('DOMContentLoaded', () => {
  carregarAlertas();
});

async function carregarAlertas() {
  const container = document.getElementById('alertasContainer');
  container.innerHTML = '<div style="text-align:center;color:var(--color-gray-400);padding:3rem">Carregando...</div>';

  const hoje   = new Date().toISOString().split('T')[0];
  const alertaDias = 2; // padrão — poderia ler de configuracoes
  const dataLimite = new Date(Date.now() + alertaDias * 86400000).toISOString().split('T')[0];

  let grupos = {
    critico: [],
    atencao: [],
    info:    [],
  };

  if (!window._supabase) {
    // Demo
    grupos.critico = [
      { icone:'📦', titulo:'Blusa Floral M — Estoque ZERADO', desc:'Produto sem estoque disponível', link:'estoque.html', linkLabel:'Ver Estoque' },
      { icone:'⏰', titulo:'Condicional de Pedro Souza — VENCIDA', desc:'Prazo de devolução expirado há 2 dias', link:'condicionais.html', linkLabel:'Ver Condicional' },
      { icone:'💳', titulo:'Parcela crediário de Pedro Souza — VENCIDA', desc:'Parcela 1/3 de R$ 300,00 vencida', link:'contas-receber.html', linkLabel:'Ver Parcela' },
    ];
    grupos.atencao = [
      { icone:'📦', titulo:'Calça Jeans 38 — Estoque Baixo', desc:'3 unidades (mínimo: 5)', link:'estoque.html', linkLabel:'Ver Estoque' },
      { icone:'⏰', titulo:'Condicional de Ana Silva — vence hoje', desc:'Prazo: hoje', link:'condicionais.html', linkLabel:'Ver Condicional' },
      { icone:'💸', titulo:'Conta a pagar vencendo em 2 dias', desc:'Energia Elétrica — R$ 280,00', link:'contas-pagar.html', linkLabel:'Ver Conta' },
    ];
    grupos.info = [
      { icone:'🎂', titulo:'Ana Silva faz aniversário hoje!', desc:'Clique para ver o cadastro', link:'cadastros.html', linkLabel:'Ver Cliente' },
    ];
  } else {
    // Estoque zerado
    const { data: zerados } = await window._supabase
      .from('produtos').select('nome').eq('ativo', true).eq('estoque_atual', 0);
    (zerados||[]).forEach(p => grupos.critico.push({
      icone:'📦', titulo:`${p.nome} — Estoque ZERADO`,
      desc:'Produto sem estoque disponível', link:'estoque.html', linkLabel:'Ver Estoque'
    }));

    // Estoque baixo
    const { data: todos } = await window._supabase
      .from('produtos').select('nome, estoque_atual, estoque_minimo').eq('ativo', true).gt('estoque_atual', 0);
    (todos||[]).filter(p => p.estoque_atual <= p.estoque_minimo).forEach(p => grupos.atencao.push({
      icone:'📦', titulo:`${p.nome} — Estoque Baixo`,
      desc:`${p.estoque_atual} unidades (mínimo: ${p.estoque_minimo})`,
      link:'estoque.html', linkLabel:'Ver Estoque'
    }));

    // Condicionais vencidas
    const { data: condVencidas } = await window._supabase
      .from('condicionais').select('id, prazo_devolucao, clientes(nome)')
      .eq('status','em_condicional').lt('prazo_devolucao', hoje);
    (condVencidas||[]).forEach(c => grupos.critico.push({
      icone:'⏰', titulo:`Condicional de ${c.clientes?.nome||'?'} — VENCIDA`,
      desc:`Prazo: ${Format.date(c.prazo_devolucao)}`,
      link:'condicionais.html', linkLabel:'Ver Condicional'
    }));

    // Condicionais vencendo
    const { data: condVencendo } = await window._supabase
      .from('condicionais').select('id, prazo_devolucao, clientes(nome)')
      .eq('status','em_condicional').gte('prazo_devolucao', hoje).lte('prazo_devolucao', dataLimite);
    (condVencendo||[]).forEach(c => grupos.atencao.push({
      icone:'⏰', titulo:`Condicional de ${c.clientes?.nome||'?'} — vence em breve`,
      desc:`Prazo: ${Format.date(c.prazo_devolucao)}`,
      link:'condicionais.html', linkLabel:'Ver Condicional'
    }));

    // Parcelas crediário vencidas
    const { data: parcVencidas } = await window._supabase
      .from('parcelas_crediario')
      .select('numero, valor, crediario(clientes(nome))')
      .eq('status','vencido');
    (parcVencidas||[]).forEach(p => grupos.critico.push({
      icone:'💳', titulo:`Parcela crediário de ${p.crediario?.clientes?.nome||'?'} — VENCIDA`,
      desc:`Parcela ${p.numero} — ${Format.currency(p.valor)}`,
      link:'contas-receber.html', linkLabel:'Ver Parcela'
    }));

    // Contas a pagar vencendo
    const { data: contasVenc } = await window._supabase
      .from('parcelas_despesa')
      .select('numero, valor, despesas(descricao)')
      .eq('status','pendente').gte('vencimento', hoje).lte('vencimento', dataLimite);
    (contasVenc||[]).forEach(c => grupos.atencao.push({
      icone:'💸', titulo:`${c.despesas?.descricao||'Conta'} — vence em breve`,
      desc:`Parcela ${c.numero} — ${Format.currency(c.valor)}`,
      link:'contas-pagar.html', linkLabel:'Ver Conta'
    }));

    // Aniversariantes do dia
    const mes = String(new Date().getMonth()+1).padStart(2,'0');
    const dia = String(new Date().getDate()).padStart(2,'0');
    const { data: aniv } = await window._supabase
      .from('clientes').select('nome, data_nascimento')
      .eq('ativo', true).not('data_nascimento','is',null);
    (aniv||[]).filter(c => {
      if (!c.data_nascimento) return false;
      const p = c.data_nascimento.split('-');
      return p[1] === mes && p[2] === dia;
    }).forEach(c => grupos.info.push({
      icone:'🎂', titulo:`${c.nome} faz aniversário hoje!`,
      desc:'', link:'cadastros.html', linkLabel:'Ver Cliente'
    }));
  }

  // KPIs
  setText('kpiCriticos', grupos.critico.length);
  setText('kpiAtencao',  grupos.atencao.length);
  setText('kpiInfo',     grupos.info.length);

  const total = grupos.critico.length + grupos.atencao.length + grupos.info.length;

  if (total === 0) {
    container.innerHTML = `
      <div class="alerta-vazio">
        <div class="alerta-vazio-icon">✅</div>
        <p>Nenhum alerta no momento. Tudo em ordem!</p>
      </div>
    `;
    return;
  }

  let html = '';

  if (grupos.critico.length) {
    html += `<div class="alerta-grupo">
      <div class="alerta-grupo-titulo">🔴 Críticos (${grupos.critico.length})</div>
      ${grupos.critico.map((a, i) => renderAlerta(a, 'critico', i)).join('')}
    </div>`;
  }

  if (grupos.atencao.length) {
    html += `<div class="alerta-grupo">
      <div class="alerta-grupo-titulo">🟡 Atenção (${grupos.atencao.length})</div>
      ${grupos.atencao.map((a, i) => renderAlerta(a, 'atencao', i)).join('')}
    </div>`;
  }

  if (grupos.info.length) {
    html += `<div class="alerta-grupo">
      <div class="alerta-grupo-titulo">ℹ️ Informativos (${grupos.info.length})</div>
      ${grupos.info.map((a, i) => renderAlerta(a, 'info', i)).join('')}
    </div>`;
  }

  container.innerHTML = html;
}

function renderAlerta(a, tipo, idx) {
  return `
    <div class="alerta-card ${tipo}" style="animation-delay:${idx * 0.05}s">
      <span class="alerta-icone">${a.icone}</span>
      <div class="alerta-corpo">
        <div class="alerta-titulo">${a.titulo}</div>
        ${a.desc ? `<div class="alerta-desc">${a.desc}</div>` : ''}
      </div>
      ${a.link ? `
        <div class="alerta-acao">
          <a href="${a.link}" class="btn btn-ghost btn-sm">${a.linkLabel}</a>
        </div>
      ` : ''}
    </div>
  `;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
