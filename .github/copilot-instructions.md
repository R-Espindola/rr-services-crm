# Instruções do projeto R&R Services

## Stack e configuração

- Aplicação web em **Next.js 16 (App Router)**, **React 19** e **TypeScript 5** com `strict: true`.
- **Tailwind CSS 4** para estilos e **Lucide React** para ícones; a fonte da aplicação é Geist.
- **Supabase** para autenticação e persistência, usando `@supabase/ssr` e `@supabase/supabase-js`.
- **Web Push** no servidor via `web-push`, com service worker e chaves VAPID configuradas por ambiente.
- O alias `@/*` aponta para `src/*`. Mantém as importações existentes com este alias.
- `next.config.ts` configura o loader CSS do Tailwind via Turbopack.
- Scripts disponíveis: `npm run dev`, `npm run build`, `npm run start` e `npm run lint`. Não existe atualmente um script de testes no `package.json`.

## Estrutura do projeto

- `src/app/`: rotas, layouts, páginas e componentes associados às funcionalidades (App Router).
  - `admin/`: painel e gestão de serviços, agenda, clientes, funcionários, orçamentos, loja, extras e configurações.
  - `cliente/`: portal do cliente, incluindo pedidos, perfil, serviços extra e loja; `client-theme.ts` gere os temas do portal.
  - `trabalhador/`: portal do trabalhador, agenda, registo de horas por limpeza, controlo de turno/pausas, perfil e ativação de notificações push.
  - `api/`: Route Handlers, incluindo orçamentos, webhooks e gestão autenticada de subscrições push do trabalhador.
  - `auth/callback/`: callback de autenticação.
  - As páginas públicas e legais incluem `page.tsx`, `login/`, `termos/` e `privacidade/`.
- `src/lib/`: integrações reutilizáveis. `supabase.ts` cria o cliente de browser; `supabase-server.ts` cria o cliente de servidor com cookies; `admin-auth.ts` valida a sessão e a autorização administrativa; `worker-push-server.ts` envia notificações push apenas no servidor; `push-endpoint.ts` valida endpoints de serviços push autorizados.
- `src/middleware.ts`: atualiza a sessão Supabase e encaminha utilizadores conforme o papel e a rota.
- `supabase/migrations/` e `database/migrations/`: alterações versionadas à base de dados e às políticas/funcionalidades associadas.
- `public/`: recursos estáticos, incluindo `sw.js`, `manifest.webmanifest` e o ícone da aplicação usados pelo Web Push.
- Atualmente não existe uma pasta `src/components/`: os componentes estão junto das rotas que os usam. Mantém essa proximidade e extrai componentes partilhados apenas quando houver reutilização real.

## Arquitetura e padrões de código

- Usa o App Router e mantém cada página, layout, Route Handler, Server Action e componente na área funcional correspondente.
- Prefere **Server Components** por omissão; adiciona `"use client"` apenas quando a interface precisa de estado, efeitos, eventos ou APIs do browser.
- Mantém os componentes pequenos e focados. Extrai UI, lógica ou tipos quando isso melhora a reutilização ou a leitura, sem criar camadas genéricas prematuramente.
- Segue o estilo do ficheiro que estás a alterar; o código existente contém convenções de formatação variadas. Evita reformatações alheias à tarefa.
- Usa tipos explícitos para dados e resultados, unions discriminadas para sucesso/erro quando adequadas e `unknown` com validação para dados externos. Evita `any` e casts sem validação.
- Valida no servidor todos os dados recebidos por formulários, Server Actions e APIs; não confies na validação do cliente.
- Expõe erros de forma clara e compatível com o padrão da funcionalidade. Não ocultes falhas nem devolvas sucesso fictício.
- Em Server Actions, mantém a validação de sessão/permissões no servidor e revalida as rotas afetadas após alterações persistidas, quando necessário.
- Usa `@/lib/supabase` no browser e `@/lib/supabase-server` no servidor, respeitando o contexto de execução.

## Segurança e autorização

- O middleware encaminha e restringe o acesso às áreas por papel, mas **não substitui autorização no servidor nem políticas RLS**.
- Preserva e respeita RLS em todas as consultas. Não desatives políticas nem alargues permissões para contornar um problema de UI; confirma as migrations e o modelo de autorização antes de alterar acessos.
- Valida a identidade e o papel no servidor para cada operação protegida. Reutiliza `getAdminSession()` para operações administrativas em vez de confiar apenas no middleware ou no cliente.
- A chave `SUPABASE_SERVICE_ROLE_KEY` é exclusivamente de servidor; nunca a exponhas em componentes de cliente, respostas HTTP, logs ou variáveis `NEXT_PUBLIC_*`.
- `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` também são exclusivamente de servidor. A chave `NEXT_PUBLIC_VAPID_PUBLIC_KEY` pode ser exposta ao browser. Valida endpoints push contra a lista de serviços autorizados antes de enviar notificações.
- Mantém segredos em variáveis de ambiente. Não incluas credenciais, tokens ou dados pessoais em código, commits ou mensagens de erro.
- Para dados de utilizador, restringe consultas ao utilizador autenticado e não uses valores fornecidos pelo cliente para escolher ou aceder à conta de terceiros.

## Estilo visual e interface

- A identidade base usa azul-marinho `#0B192C`, ciano `#00D4FF`, fundo claro `#F5F7FA`, superfícies brancas e bordas cinza-azuladas. Confirma `src/app/globals.css` antes de alterar tokens ou estilos globais.
- Usa Tailwind CSS e segue os padrões existentes: cartões claros com cantos arredondados, hierarquia tipográfica marcada, fundos/navs escuros em áreas de destaque e estados de interação discretos.
- A interface é **mobile-first**: começa pelo layout estreito e acrescenta breakpoints (`sm:`, `md:`, `lg:`, `xl:`) para ecrãs maiores. Considera navegação inferior móvel e áreas seguras do dispositivo onde já usadas.
- O portal do cliente pode usar temas próprios (`Padrão`, `Atlântico`, `Minimal`, `Solar`); não substituas as suas cores por tokens globais nem uniformizes os temas sem requisito explícito.
- Usa formatação portuguesa (`pt-PT`) para datas, números e valores monetários, e vocabulário de português de Portugal na interface.
- Preserva acessibilidade: HTML semântico, labels associados a campos, nomes acessíveis para controlos, estados `aria-*` quando necessários, foco visível, alvos táteis adequados e respeito por `prefers-reduced-motion`.
- Trata estados de carregamento, vazio, sucesso e erro de forma explícita e coerente com as páginas existentes.

## Forma de trabalhar

- Responde sempre em **português de Portugal**.
- Antes de uma alteração grande que envolva vários ficheiros, propõe um plano curto e claro.
- Ao criar ou alterar lógica complexa, explica resumidamente a razão das principais decisões técnicas.
- Faz alterações cirúrgicas, preserva o comportamento existente e atualiza documentação diretamente relacionada quando necessário.
- Valida as alterações com o comando mais específico disponível; usa `npm run lint` e/ou `npm run build` quando forem adequados.
