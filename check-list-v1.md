# Plano de Implementação — Boilerplate v1.0

## Sequência de Implementação

```
0. Dev Experience           → webhook Stripe sobe junto com npm run dev
1. Páginas de Erro          → independente, sem dependências
2. Busca e Filtro Produtos  → independente, sem dependências  
3. Activity Log             → alimenta o Dashboard
4. Gestão de Projetos       → alimenta o Dashboard
5. Email Transacional       → consome dados de Autenticação, Projetos, Pedidos, Convites
6. Dashboard com Dados Reais → consome tudo acima
```
****
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
- [x] Criar `app/not-found.tsx` global com layout consistente ao da aplicação
- [x] Criar `app/error.tsx` global como Client Component com boundary de erro
- [x] Criar `app/(dashboard)/error.tsx` para erros dentro do painel admin
- [x] Criar `app/(marketing)/error.tsx` para erros nas páginas públicas
- [x] Garantir que todos os `error.tsx` exponham botão de retry e link para home
- [x] Testar acesso a rotas inexistentes em todas as áreas (marketing, dashboard, admin)

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
- [x] Adicionar campo de busca por nome na página de catálogo (`/products`)
- [x] Implementar filtro por categoria (dropdown ou sidebar)
- [x] Implementar filtro por tag
- [x] Adicionar ordenação: por nome (A-Z, Z-A), por preço (menor/maior)
- [x] Garantir que os filtros funcionem via URL params (search params), permitindo compartilhamento de URL filtrada
- [x] Implementar estado de "nenhum resultado encontrado" com componente `EmptyState`
- [x] Garantir que a busca funcione via server-side (query no Supabase), não client-side

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
- [x] Revisar schema da tabela `activity_logs` e garantir campos: `id`, `organization_id`, `actor_id`, `action`, `entity_type`, `entity_id`, `metadata` (JSON), `created_at`
- [x] Criar função utilitária `lib/activity-log.ts` para registrar eventos
- [x] Registrar eventos nas actions de autenticação: login, logout
- [x] Registrar eventos nas actions de organização: criação, atualização, exclusão
- [x] Registrar eventos nas actions de convites: enviado, aceito, cancelado
- [x] Registrar eventos nas actions de usuários: role alterado, membro removido
- [x] Registrar eventos nas actions de pedidos: pedido criado, status alterado, cancelado
- [x] Registrar eventos nas actions de projetos: projeto criado, atualizado, arquivado
- [x] Registrar eventos nas actions de tarefas: tarefa criada, status alterado, concluída
- [x] Implementar UI de listagem de activity log no admin (`/admin/activity`)
- [x] Implementar filtros na listagem: por tipo de evento, por ator, por período
- [x] Garantir RLS: membros veem apenas eventos da sua organização; super admins veem tudo
- [x] Implementar visualização estruturada de `metadata` nos eventos do activity log
- [x] Implementar opção de visualizar histórico agrupado de eventos por pedido na listagem global
- [x] Implementar seção de activity log do pedido na página de detalhes do pedido

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

**US3.4** — Eu como administrador, quero visualizar os metadados completos de um evento para entender o contexto exato da ação registrada.

Critérios de aceitação:
- Cada linha do activity log possui um ícone de detalhes na última coluna
- Ao passar o mouse sobre o ícone, é exibido um painel com os `metadata` estruturados do evento
- A visualização suporta valores simples e objetos aninhados
- A ausência de metadados é tratada com uma mensagem clara

**US3.5** — Eu como administrador, quero visualizar o histórico agrupado de eventos de um pedido dentro do activity log global para acompanhar a evolução daquele pedido.

Critérios de aceitação:
- Eventos do tipo `orders` exibem uma ação adicional para visualizar o histórico agrupado do pedido
- O histórico agrupado mostra os principais eventos do pedido em ordem cronológica
- O agrupamento identifica claramente o número curto do pedido
- A visualização funciona sem sair da listagem global

**US3.6** — Eu como administrador, quero ver o histórico de activity log diretamente na página de detalhes do pedido para ter contexto operacional completo.

Critérios de aceitação:
- A página de detalhes do pedido exibe uma seção dedicada ao activity log do pedido
- A seção lista eventos em ordem cronológica com ator, data/hora e detalhes relevantes
- Os metadados do evento podem ser visualizados nessa seção
- O histórico reflete eventos como criação, alteração de status e cancelamento

---

## Módulo 4 — Gestão de Projetos (v1 completa)

### Checklist
- [x] Implementar página de listagem de projetos com status, contagem de tarefas e progresso
- [x] Criação de projeto básica implementada
- [x] Implementar página base de detalhes do projeto
- [x] Implementação básica do módulo de tarefas (criação, edição, exclusão, status)
- [x] Implementar adição e listagem de notas em uma tarefa
- [x] Garantir que projetos e tarefas sejam escopados à organização ativa
- [x] Garantir RLS: membros veem apenas projetos/tarefas da sua organização
- [x] Adicionar suporte a `slug` (parâmetro de URL amigável) nos projetos para identificação e compartilhamento de URL.
- [ ] Implementar associação de um responsável (owner) e membros ao projeto respectivo.
- [ ] Conectar membros de tarefas automaticamente como membros do projeto se a visibilidade for "toda a organização" (habilitar a aba de membros existente).
- [ ] Alimentar os gráficos e indicadores na página de detalhes de projetos com dados reais do Supabase (substituir hard-coded).
- [x] Substituir dados hard-coded na listagem de tarefas da tela principal do projeto para dados reais recuperados do banco de dados.
- [ ] Corrigir e garantir que a associação de um "Responsável" (assignee) funcione ao criar/editar uma tarefa.
- [x] Ocultar o módulo/aba de Arquivos/Anexos das tarefas para a release V1.
- [x] Limpar a UI do módulo de projetos e tarefas, ocultando componentes, abas ou botões não utilizados na V1.

### Histórias de Usuário

**US4.1** — Eu como membro da organização, quero ver a listagem de projetos com informações de progresso para ter uma visão geral do trabalho. *(Concluída)*
Critérios de aceitação:
- Listagem exibe os projetos associados à organização.
- Reflete status, progresso e quantidade.

**US4.2** — Eu como membro da organização, quero criar e configurar um novo projeto, associando equipe e acessos. *(Em andamento)*
Critérios de aceitação:
- Possível criar projeto com uma URL amigável (`slug`).
- Possível atribuir um responsável e outros membros ao projeto.
- Usuários associados a tarefas são adicionados aos membros do projeto automaticamente, se a visibilidade for para a organização.

**US4.3** — Eu como membro da organização, quero ver os detalhes de um projeto através de URLs compartilháveis e acompanhar as suas métricas e tarefas com base na realidade. *(Em andamento)*
Critérios de aceitação:
- Acessível usando o `slug` no lugar do UUID interno.
- A página do projeto exibe dados reais na lista de tarefas.
- Gráficos e indicadores de acompanhamento consultam andamento real.

**US4.4** — Eu como membro da organização, quero criar e editar tarefas dentro de um projeto e atribuí-las corretamente a responsáveis. *(Em andamento)*
Critérios de aceitação:
- Edição funciona corretamente.
- Associação com responsável (assignee) funciona no momento de criação/edição.
- Usuários listados na criação/edição de tarefas são os membros da organização, caso o projeto seja visível para toda organização ou somente os membros pertencentes ao projeto, caso sua visibilidade seja privada.

**US4.5** — Eu como membro da organização, quero adicionar notas a uma tarefa para registrar contexto, bloqueios ou decisões. *(Concluída)*
Critérios de aceitação:
- Notas podem ser inseridas, lidas e excluídas por seus autores.

**US4.6** — Eu como membro da organização, quero interagir com uma interface limpa, focada e sem ruídos (como seções incompletas). *(Concluída)*
Critérios de aceitação:
- Aba de Arquivos/Anexos em Tarefas é ocultada.
- Elementos gráficos, botões ou sub-menus sem funcionalidade imediata removidos ou ocultados.

---

## Módulo 5 — Email Transacional

### Checklist
- [x] Avaliar e escolher provedor: Resend (DX superior, SDK TypeScript nativo), Brevo ou SMTP
- [x] Instalar SDK do provedor escolhido e configurar variáveis de ambiente
- [x] Criar utilitário `lib/email.ts` com função `sendEmail(to, subject, template, data)`
- [x] Criar templates HTML de email (mínimo inline CSS, responsivos):
  - [x] Template base (wrapper com logo e footer)
  - [x] Convite para organização
  - [x] Confirmação de pedido
  - [x] Pedido cancelado / estorno iniciado
  - [x] Solicitação de resgate de senha
  - [x] Projeto atribuído ao usuário
  - [x] Tarefa atribuída ao usuário
  - [x] Confirmação de pagamento para administrador da organização
- [x] Disparar email de convite ao criar/reenviar convite (`invitations.ts`)
- [x] Disparar email de confirmação ao criar pedido (webhook `payment_intent.succeeded`)
- [x] Disparar email ao administrador da organização quando um pedido tiver pagamento confirmado (`payment_intent.succeeded`)
- [x] Disparar email de cancelamento ao cancelar pedido (`orders.ts`)
- [x] Disparar email ao solicitar resgate de senha (`forgot-password` / fluxo de recuperação)
- [x] Disparar email ao atribuir um projeto a um usuário
- [x] Disparar email ao atribuir uma tarefa a um usuário
- [x] Garantir que falhas no envio de email não quebrem o fluxo principal (try/catch isolado)
- [x] Garantir idempotência para evitar emails duplicados em eventos de webhook e reatribuição sem mudança real
- [x] Garantir que o destinatário e o contexto do email respeitam a organização ativa e as permissões do usuário
- [x] Configurar domínio de envio no provedor (DNS: SPF, DKIM)

> **Recomendação de provedor:** Resend — SDK TypeScript nativo, excelente DX, suporte a React Email para templates, plano gratuito de 3.000 emails/mês. Ideal para boilerplate educacional.

### Histórias de Usuário

**US5.1** — Eu como pessoa convidada para uma organização, quero receber um email com o link de convite para conseguir aceitar mesmo se fechar o navegador. *(Concluída)*

Critérios de aceitação:
- Email enviado automaticamente ao criar um convite
- Email contém: nome da organização, nome de quem convidou, link de aceitação com token
- Link de aceitação expira conforme configuração da organização
- Email reenviado ao usar a opção "Reenviar convite"

**US5.2** — Eu como cliente, quero receber um email de confirmação após realizar uma compra para ter o comprovante do meu pedido. *(Concluída)*

Critérios de aceitação:
- Email enviado após confirmação de pagamento (`payment_intent.succeeded`)
- Email contém: número do pedido, lista de itens com quantidades e preços, valor total, data do pedido
- Email enviado para o endereço cadastrado no checkout

**US5.3** — Eu como cliente, quando meu pedido é cancelado, quero receber um email informando sobre o cancelamento e o estorno. *(Concluída)*

Critérios de aceitação:
- Email enviado ao cancelar um pedido (pelo cliente ou pelo admin)
- Email informa: número do pedido, motivo (quando informado), prazo estimado para estorno no cartão
- Email enviado para o endereço do cliente

**US5.4** — Eu como usuário, quando solicito resgate de senha, quero receber um email com instruções seguras para redefinir minha senha. *(Concluída)*

Critérios de aceitação:
- Email enviado ao iniciar o fluxo de recuperação de senha
- Email contém link/token de redefinição com validade limitada
- Email informa de forma clara que a solicitação pode ser ignorada caso não tenha sido feita pelo usuário
- O fluxo não expõe se o email informado existe ou não na base

**US5.5** — Eu como membro da organização, quando um projeto for atribuído ao meu usuário, quero receber um email para saber que passei a ser responsável ou participante daquele projeto. *(Concluída)*

Critérios de aceitação:
- Email enviado quando houver nova atribuição de projeto ao usuário
- Email contém: nome do projeto, organização, papel do usuário no projeto e link direto para a página do projeto
- O email não deve ser reenviado quando o registro for salvo sem mudança de atribuição

**US5.6** — Eu como membro da organização, quando uma tarefa for atribuída ao meu usuário, quero receber um email para agir rapidamente sobre o trabalho pendente. *(Concluída)*

Critérios de aceitação:
- Email enviado quando uma tarefa recebe um novo responsável
- Email contém: título da tarefa, projeto relacionado, status atual, prazo (quando houver) e link direto para a tarefa
- O email não deve ser reenviado quando a edição não alterar o responsável

**US5.7** — Eu como administrador da organização, quero receber um email sempre que um pedido tiver o pagamento confirmado para acompanhar o faturamento e a operação. *(Concluída)*

Critérios de aceitação:
- Email enviado ao administrador da organização após confirmação de pagamento (`payment_intent.succeeded`)
- Se houver mais de um administrador elegível, a regra de destinatário deve ser definida explicitamente na implementação (ex: owner da organização ou todos os admins)
- Email contém: número do pedido, cliente, valor total, data/hora da confirmação e link para detalhes do pedido no admin
- O webhook deve evitar disparos duplicados para o mesmo evento de confirmação

### Plano de Execução

1. Consolidar a infraestrutura do módulo: escolher o provedor, configurar variáveis de ambiente, criar `lib/email.ts` e o template base reutilizável.
2. Implementar os fluxos já existentes e mais críticos de negócio: convite para organização, confirmação de pedido, cancelamento de pedido e notificação ao administrador por pagamento confirmado.
3. Integrar os eventos de autenticação e colaboração: recuperação de senha, atribuição de projeto e atribuição de tarefa, com gatilhos somente quando houver mudança real de estado.
4. Fechar robustez operacional: idempotência para webhooks, `try/catch` isolado, validação de destinatários por organização, observabilidade/logs e testes dos templates e disparos.

---

## Módulo 6 — Dashboard com Dados Reais

### Checklist
- [x] Definir quais indicadores serão exibidos por papel (admin vs. membro)
- [x] Criar server actions para buscar dados agregados do dashboard:
  - [x] Total de pedidos (período atual vs. anterior)
  - [x] Receita total (período atual vs. anterior)
  - [x] Pedidos por status
  - [x] Total de membros ativos na organização
  - [x] Total de projetos ativos
  - [x] Total de tarefas por status
  - [x] Eventos recentes do activity log (últimos 5-10)
- [x] Implementar cards de KPI com variação percentual (ex: `+12% em relação ao mês anterior`)
- [x] Implementar gráfico de pedidos por período (linha ou barra — Recharts já instalado)
- [x] Implementar gráfico de distribuição de status de pedidos (pie/donut)
- [x] Implementar widget de atividade recente (últimos eventos do activity log)
- [x] Implementar widget de projetos ativos com barra de progresso
- [x] Garantir que todos os dados respeitam o escopo da organização ativa
- [x] Adicionar skeleton loading states durante carregamento dos dados

### Histórias de Usuário

**US6.1** — Eu como administrador da organização, quero ver indicadores de desempenho no dashboard para acompanhar a saúde do negócio. *(Concluída)*

Critérios de aceitação:
- Cards de KPI exibem: total de pedidos, receita total, membros ativos e projetos ativos
- Cada KPI exibe variação percentual em relação ao período anterior (mês anterior ou semana anterior)
- Variação positiva exibida em verde, negativa em vermelho
- Dados são escopados à organização ativa

**US6.2** — Eu como administrador, quero visualizar a evolução de pedidos e receita ao longo do tempo para identificar tendências. *(Concluída)*

Critérios de aceitação:
- Gráfico de linha ou barra exibindo pedidos e/ou receita por dia/semana/mês
- Seletor de período: últimos 7 dias, 30 dias, 3 meses
- Gráfico responsivo e com tooltip ao passar o mouse

**US6.3** — Eu como administrador, quero ver a distribuição atual dos pedidos por status para entender o backlog operacional. *(Concluída)*

Critérios de aceitação:
- Gráfico de rosca (donut) exibindo proporção de pedidos por status
- Legenda com quantidade absoluta por status
- Clicável: ao clicar num status, redireciona para `/admin/orders?status=<status>`

**US6.4** — Eu como membro da organização, quero ver um resumo dos projetos e tarefas no dashboard para acompanhar o andamento do trabalho. *(Concluída)*

Critérios de aceitação:
- Widget listando projetos ativos com: nome, progresso de tarefas e status
- Widget de tarefas: total a fazer, em andamento e concluídas
- Link direto para a página de projetos

**US6.5** — Eu como administrador, quero ver as atividades recentes no dashboard para ter contexto rápido sobre o que aconteceu na organização. *(Concluída)*

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
Módulo 5 (Emails)     ──── consome Autenticação, Módulos 3 e 4 (eventos de projetos, tarefas, pedidos)
Módulo 6 (Dashboard)  ──── consome Módulos 3 e 4 obrigatoriamente
```
