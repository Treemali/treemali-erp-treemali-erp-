# Treemali ERP

Sistema web de gestão comercial completo para a Treemali.

## Módulos
- Login com controle de acesso (Master / Vendedor)
- Dashboard com KPIs em tempo real
- Vendas (normal, condicional, crediário)
- Controle de estoque por localização
- Pontos de venda com comissão
- Financeiro: despesas, contas a pagar/receber
- Crediário próprio com parcelas
- Relatórios gerenciais e comprovantes

## Stack
- **Frontend:** HTML, CSS, JavaScript puro (sem frameworks)
- **Banco de dados:** [Supabase](https://supabase.com)
- **Hospedagem:** [Render](https://render.com)

## Como rodar localmente

Abra o arquivo `pages/login.html` diretamente no navegador.  
Em modo demo (sem Supabase configurado) use: `admin` / `admin123`

## Configuração do Supabase

Edite `js/config.js` e preencha:
```js
const SUPABASE_URL      = 'https://seu-projeto.supabase.co';
const SUPABASE_ANON_KEY = 'sua-anon-key';
```

Consulte o **GUIA_IMPLANTACAO.md** para o passo a passo completo.
