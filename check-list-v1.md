# Plano de Implementação — Boilerplate v1.0

## Sequência de Implementação

```
0. Dev Experience           → webhook Stripe sobe junto com npm run dev
1. Páginas de Erro          → independente, sem dependências
2. Busca e Filtro Produtos  → independente, sem dependências  
3. Activity Log             → alimenta o Dashboard
4. Gestão de Projetos       → alimenta o Dashboard
5. Email Transacional       → consome dados de Projetos, Pedidos, Convites
6. Dashboard com Dados Reais → consome tudo acima
```

---

## Módulo 0 — Dev Experience: Stripe Webhook Local

### Checklist
- [x] Instalar `concurrently` como devDependency
- [x] Atualizar script `dev` em `package.json` para subir `stripe listen` junto com `next dev`
- [ ] Confirmar que a variável `STRIPE_WEBHOOK_SECRET` está atualizada no `.env.local` com o secret gerado pelo `stripe listen` (o secret muda a cada novo processo)

### Observação
O comando `stripe listen` gera um webhook signing secret temporário a cada execução. O valor exibido no terminal (`whsec_...`) deve ser copiado para `STRIPE_WEBHOOK_SECRET` no `.env.local`. Em produção, o secret vem do dashboard da Stripe e não muda.

---

## Módulo 1 — Páginas de Erro e Error Boundaries

### Checklist
- [ ] Criar `app/not-found.tsx` global com layout consistente ao da aplicação
- [ ] Criar `app/error.tsx` global como Client Component com boundary de erro
- [ ] Criar `app/(dashboard)/error.tsx` para erros dentro do painel admin
- [ ] Criar `app/(marketing)/error.tsx` para erros nas páginas públicas
- [ ] Garantir que todos os `error.tsx` exponham botão de retry e link para home
- [ ] Testar acesso a rotas inexistentes em todas as áreas (marketing, dashboard, admin)

### Histórias de Usuário

**US1.1** — Eu como visitante, quando acesso uma URL inexistente, quero ver uma página de erro clara que me permita voltar ao início.

Critérios de aceitação:
- A página 404 deve seguir o padrão Untitled, conforme referência do link https://untitledui.com/react/iframe/404-sections/not-found-simple-05
- A página 404 utiliza o mesmo branding do projeto
- Exibe mensagem clara indicando que a página não foi encontrada
- Contém link para a página inicial
- Funciona para todas as áreas: marketing, dashboard e admin

**US1.2** — Eu como usuário autenticado, quando ocorre um erro inesperado numa página, quero ver uma mensagem amigável sem perder o contexto de navegação.

Critérios de aceitação:
- A página de erro captura a exceção sem quebrar toda a aplicação
- Exibe mensagem genérica amigável (sem expor stack trace para o usuário)
- Oferece botão "Tentar novamente" que chama `reset()` do error boundary
- Oferece link para voltar ao dashboard ou home, conforme contexto

---

## Módulo 2 — Busca e Filtro de Produtos

### Checklist
- [ ] Adicionar campo de busca por nome na página de catálogo (`/products`)
- [ ] Implementar filtro por categoria (dropdown ou sidebar)
- [ ] Implementar filtro por tag
- [ ] Adicionar ordenação: por nome (A-Z, Z-A), por preço (menor/maior)
- [ ] Garantir que os filtros funcionem via URL params (search params), permitindo compartilhamento de URL filtrada
- [ ] Implementar estado de "nenhum resultado encontrado" com componente `EmptyState`
- [ ] Garantir que a busca funcione via server-side (query no Supabase), não client-side

### Histórias de Usuário

**US2.1** — Eu como visitante, quero buscar produtos pelo nome para encontrar rapidamente o que procuro.

Critérios de aceitação:
- Campo de busca visível na página do catálogo
- A busca filtra os resultados em tempo real ou ao submeter (mínimo ao submeter)
- A busca é case-insensitive e aceita buscas parciais
- A URL reflete o termo buscado (ex: `/products?q=camisa`)
- Quando não há resultados, exibe componente `EmptyState` com mensagem contextual

**US2.2** — Eu como visitante, quero filtrar produtos por categoria e/ou tag para navegar o catálogo com mais precisão.

Critérios de aceitação:
- Lista de categorias disponíveis exibida como opções de filtro
- Lista de tags disponíveis exibida como opções de filtro
- Filtros de categoria e tag podem ser combinados com a busca por nome
- Filtros selecionados ficam refletidos na URL (ex: `/products?category=xyz&tag=abc`)
- Limpar filtros retorna ao catálogo completo

**US2.3** — Eu como visitante, quero ordenar os produtos por preço ou nome para facilitar minha navegação.

Critérios de aceitação:
- Select de ordenação com opções: relevância (padrão), nome A-Z, nome Z-A, menor preço, maior preço
- Ordenação é aplicada combinada com filtros ativos
- A ordenação selecionada é refletida na URL

---

## Módulo 3 — Activity Log (Registro de Eventos)

### Checklist
- [ ] Revisar schema da tabela `activity_logs` e garantir campos: `id`, `organization_id`, `actor_id`, `action`, `entity_type`, `entity_id`, `metadata` (JSON), `created_at`
- [ ] Criar função utilitária `lib/activity-log.ts` para registrar eventos
- [ ] Registrar eventos nas actions de autenticação: login, logout
- [ ] Registrar eventos nas actions de organização: criação, atualização, exclusão
- [ ] Registrar eventos nas actions de convites: enviado, aceito, cancelado
- [ ] Registrar eventos nas actions de usuários: role alterado, membro removido
- [ ] Registrar eventos nas actions de pedidos: pedido criado, status alterado, cancelado
- [ ] Registrar eventos nas actions de projetos: projeto criado, atualizado, arquivado
- [ ] Registrar eventos nas actions de tarefas: tarefa criada, status alterado, concluída
- [ ] Implementar UI de listagem de activity log no admin (`/admin/activity`)
- [ ] Implementar filtros na listagem: por tipo de evento, por ator, por período
- [ ] Garantir RLS: membros veem apenas eventos da sua organização; super admins veem tudo

### Histórias de Usuário

**US3.1** — Eu como administrador da organização, quero ver um registro cronológico de todas as ações relevantes realizadas na minha organização.

Critérios de aceitação:
- Listagem paginada de eventos com: data/hora, ator (nome + avatar), descrição da ação e entidade afetada
- Eventos registrados cobrem: mudanças de pedidos, convites, alterações de membros, projetos e tarefas
- Somente eventos da organização do administrador são exibidos

**US3.2** — Eu como administrador, quero filtrar o activity log por tipo de evento ou período para investigar uma ação específica.

Critérios de aceitação:
- Filtro por tipo de entidade: `orders`, `invitations`, `members`, `projects`, `tasks`
- Filtro por período: hoje, últimos 7 dias, últimos 30 dias, personalizado
- Filtros combinam entre si
- Resultado exibido em ordem decrescente por data

**US3.3** — Eu como super admin, quero ver o activity log de todas as organizações para auditoria da plataforma.

Critérios de aceitação:
- No painel super admin, o activity log exibe eventos de todas as organizações
- Inclui coluna/filtro de organização na listagem
- Acesso restrito ao papel `super_admin`

---

## Módulo 4 — Gestão de Projetos (v1 completa)

### Checklist
- [ ] Completar página de detalhes do projeto: header com nome, descrição, status e datas
- [ ] Implementar listagem de tarefas dentro do projeto com status visual (kanban simples ou lista agrupada por status)
- [ ] Implementar criação de tarefa via modal/drawer: nome, descrição, responsável, prioridade, prazo
- [ ] Implementar edição de tarefa inline ou via modal
- [ ] Implementar exclusão de tarefa com confirmação
- [ ] Implementar alteração de status da tarefa: `todo`, `in_progress`, `done`
- [ ] Implementar adição e listagem de notas em uma tarefa
- [ ] Garantir que projetos e tarefas sejam escopados à organização ativa
- [ ] Implementar página de listagem de projetos com status, contagem de tarefas e progresso
- [ ] Garantir RLS: membros veem apenas projetos/tarefas da sua organização

### Histórias de Usuário

**US4.1** — Eu como membro da organização, quero ver a listagem de projetos com informações de progresso para ter uma visão geral do trabalho.

Critérios de aceitação:
- Listagem exibe: nome do projeto, descrição curta, status, data de criação e contagem de tarefas (total e concluídas)
- Exibe indicador visual de progresso (ex: `3/8 tarefas concluídas`)
- Projetos são escopados à organização ativa
- Estado vazio exibe `EmptyState` com call to action para criar o primeiro projeto

**US4.2** — Eu como membro da organização, quero criar um novo projeto para organizar um conjunto de tarefas.

Critérios de aceitação:
- Formulário com campos: nome (obrigatório), descrição, status inicial
- Projeto criado é associado à organização ativa
- Após criação, redireciona para a página de detalhes do projeto

**US4.3** — Eu como membro da organização, quero ver os detalhes de um projeto e gerenciar suas tarefas.

Critérios de aceitação:
- Página de detalhe exibe: nome, descrição, status, datas e lista de tarefas
- Tarefas são agrupadas ou sinalizadas por status: `A fazer`, `Em andamento`, `Concluída`
- Possível criar nova tarefa diretamente na página de detalhes
- Possível alterar o status de uma tarefa diretamente na listagem

**US4.4** — Eu como membro da organização, quero criar e editar tarefas dentro de um projeto.

Critérios de aceitação:
- Formulário com campos: título (obrigatório), descrição, responsável (membro da org), prioridade (`low`, `medium`, `high`), prazo
- Edição disponível via modal ou inline
- Exclusão de tarefa exige confirmação

**US4.5** — Eu como membro da organização, quero adicionar notas a uma tarefa para registrar contexto, bloqueios ou decisões.

Critérios de aceitação:
- Seção de notas visível na tarefa expandida ou na página de detalhes da tarefa
- Notas exibem: conteúdo, autor e data de criação
- Notas são ordenadas do mais recente para o mais antigo
- Notas não podem ser editadas após salvas (apenas excluídas pelo autor)

---

## Módulo 5 — Email Transacional

### Checklist
- [ ] Avaliar e escolher provedor: Resend (DX superior, SDK TypeScript nativo), Brevo ou SMTP
- [ ] Instalar SDK do provedor escolhido e configurar variáveis de ambiente
- [ ] Criar utilitário `lib/email.ts` com função `sendEmail(to, subject, template, data)`
- [ ] Criar templates HTML de email (mínimo inline CSS, responsivos):
  - [ ] Template base (wrapper com logo e footer)
  - [ ] Convite para organização
  - [ ] Confirmação de pedido
  - [ ] Pedido cancelado / estorno iniciado
- [ ] Disparar email de convite ao criar/reenviar convite (`invitations.ts`)
- [ ] Disparar email de confirmação ao criar pedido (webhook `payment_intent.succeeded`)
- [ ] Disparar email de cancelamento ao cancelar pedido (`orders.ts`)
- [ ] Garantir que falhas no envio de email não quebrem o fluxo principal (try/catch isolado)
- [ ] Configurar domínio de envio no provedor (DNS: SPF, DKIM)

> **Recomendação de provedor:** Resend — SDK TypeScript nativo, excelente DX, suporte a React Email para templates, plano gratuito de 3.000 emails/mês. Ideal para boilerplate educacional.

### Histórias de Usuário

**US5.1** — Eu como pessoa convidada para uma organização, quero receber um email com o link de convite para conseguir aceitar mesmo se fechar o navegador.

Critérios de aceitação:
- Email enviado automaticamente ao criar um convite
- Email contém: nome da organização, nome de quem convidou, link de aceitação com token
- Link de aceitação expira conforme configuração da organização
- Email reenviado ao usar a opção "Reenviar convite"

**US5.2** — Eu como cliente, quero receber um email de confirmação após realizar uma compra para ter o comprovante do meu pedido.

Critérios de aceitação:
- Email enviado após confirmação de pagamento (`payment_intent.succeeded`)
- Email contém: número do pedido, lista de itens com quantidades e preços, valor total, data do pedido
- Email enviado para o endereço cadastrado no checkout

**US5.3** — Eu como cliente, quando meu pedido é cancelado, quero receber um email informando sobre o cancelamento e o estorno.

Critérios de aceitação:
- Email enviado ao cancelar um pedido (pelo cliente ou pelo admin)
- Email informa: número do pedido, motivo (quando informado), prazo estimado para estorno no cartão
- Email enviado para o endereço do cliente

---

## Módulo 6 — Dashboard com Dados Reais

### Checklist
- [ ] Definir quais indicadores serão exibidos por papel (admin vs. membro)
- [ ] Criar server actions para buscar dados agregados do dashboard:
  - [ ] Total de pedidos (período atual vs. anterior)
  - [ ] Receita total (período atual vs. anterior)
  - [ ] Pedidos por status
  - [ ] Total de membros ativos na organização
  - [ ] Total de projetos ativos
  - [ ] Total de tarefas por status
  - [ ] Eventos recentes do activity log (últimos 5-10)
- [ ] Implementar cards de KPI com variação percentual (ex: `+12% em relação ao mês anterior`)
- [ ] Implementar gráfico de pedidos por período (linha ou barra — Recharts já instalado)
- [ ] Implementar gráfico de distribuição de status de pedidos (pie/donut)
- [ ] Implementar widget de atividade recente (últimos eventos do activity log)
- [ ] Implementar widget de projetos ativos com barra de progresso
- [ ] Garantir que todos os dados respeitam o escopo da organização ativa
- [ ] Adicionar skeleton loading states durante carregamento dos dados

### Histórias de Usuário

**US6.1** — Eu como administrador da organização, quero ver indicadores de desempenho no dashboard para acompanhar a saúde do negócio.

Critérios de aceitação:
- Cards de KPI exibem: total de pedidos, receita total, membros ativos e projetos ativos
- Cada KPI exibe variação percentual em relação ao período anterior (mês anterior ou semana anterior)
- Variação positiva exibida em verde, negativa em vermelho
- Dados são escopados à organização ativa

**US6.2** — Eu como administrador, quero visualizar a evolução de pedidos e receita ao longo do tempo para identificar tendências.

Critérios de aceitação:
- Gráfico de linha ou barra exibindo pedidos e/ou receita por dia/semana/mês
- Seletor de período: últimos 7 dias, 30 dias, 3 meses
- Gráfico responsivo e com tooltip ao passar o mouse

**US6.3** — Eu como administrador, quero ver a distribuição atual dos pedidos por status para entender o backlog operacional.

Critérios de aceitação:
- Gráfico de rosca (donut) exibindo proporção de pedidos por status
- Legenda com quantidade absoluta por status
- Clicável: ao clicar num status, redireciona para `/admin/orders?status=<status>`

**US6.4** — Eu como membro da organização, quero ver um resumo dos projetos e tarefas no dashboard para acompanhar o andamento do trabalho.

Critérios de aceitação:
- Widget listando projetos ativos com: nome, progresso de tarefas e status
- Widget de tarefas: total a fazer, em andamento e concluídas
- Link direto para a página de projetos

**US6.5** — Eu como administrador, quero ver as atividades recentes no dashboard para ter contexto rápido sobre o que aconteceu na organização.

Critérios de aceitação:
- Widget exibe os últimos 5-10 eventos do activity log
- Cada item mostra: avatar do ator, descrição da ação e tempo relativo (ex: "há 3 horas")
- Link "Ver tudo" aponta para a página completa do activity log

---

## Dependências Entre Módulos

```
Módulo 1 (Erros)      ──── sem dependências
Módulo 2 (Produtos)   ──── sem dependências
Módulo 3 (Log)        ──── sem dependências na implementação; alimenta Módulo 6
Módulo 4 (Projetos)   ──── sem dependências na implementação; alimenta Módulos 5 e 6
Módulo 5 (Emails)     ──── consome Módulos 3 e 4 (eventos de projetos, pedidos)
Módulo 6 (Dashboard)  ──── consome Módulos 3 e 4 obrigatoriamente
```