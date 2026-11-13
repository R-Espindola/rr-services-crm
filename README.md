This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Portal do trabalhador

Antes de disponibilizar o controlo de turnos, fotografias de ocorrências ou notificações push, aplique a migration `supabase/migrations/20261113000000_worker_shift_incident_push.sql` no projeto Supabase.

As notificações push requerem HTTPS (exceto em `localhost`) e chaves VAPID. Gere um par de chaves com `npx web-push generate-vapid-keys` e configure:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: chave pública, disponível no browser.
- `VAPID_PRIVATE_KEY`: chave privada, apenas no servidor.
- `VAPID_SUBJECT`: endereço de contacto VAPID, por exemplo `mailto:suporte@exemplo.pt`.

Nunca publiques a chave privada nem a coloques numa variável `NEXT_PUBLIC_*`. Os trabalhadores ativam as notificações no painel; os avisos são enviados quando uma limpeza lhes é atribuída, alterada, cancelada ou removida. Lembretes com hora marcada exigem um serviço agendador e não são enviados por esta implementação. Em iPhone/iPad, o portal deve estar adicionado ao ecrã principal para permitir notificações push.
