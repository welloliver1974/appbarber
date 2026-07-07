# AppBarber — Contexto do Projeto

## Stack
- **Frontend:** Vite + React 18 + TypeScript
- **UI:** TailwindCSS + shadcn/ui + dark mode (padrão escuro)
- **Backend:** Supabase (Auth, PostgreSQL, Storage)
- **Notificações:** Evolution API (WhatsApp, self-hosted)
- **Deploy:** Vercel
- **Timezone:** UTC-3 (Brasília)

## Convenções

### Código
- TypeScript estrito, sem `any`
- Componentes em `src/components/` com subpastas por domínio
- Páginas em `src/pages/`
- Hooks customizados em `src/hooks/`
- Utilitários em `src/lib/`
- Tipos em `src/types/`

### Commits
- `feat:` nova funcionalidade
- `fix:` correção
- `chore:` setup, config, deps
- `refactor:` refatoração sem mudança de comportamento

### shadcn/ui
- Componentes em `src/components/ui/`
- Nono-shadowing: não modificar componentes do shadcn diretamente
- Preferir composição via `className` e `asChild`

## Regras
1. Não modificar componentes do shadcn/ui
2. Dark mode ativado por padrão
3. Todos horários exibidos em UTC-3 (Brasília)
4. Zod schemas sempre tipados com inferência
5. React Hook Form + Zod para formulários
6. Supabase client singleton via contexto
7. Auth state gerenciado via provider

## Estrutura
```
src/
├── components/
│   ├── ui/          # shadcn/ui components
│   └── ...          # components do app
├── pages/
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Barbers.tsx
│   ├── Services.tsx
│   ├── Appointments.tsx
│   └── Booking.tsx
├── hooks/
│   └── useTheme.ts
├── lib/
│   ├── supabase.ts
│   └── utils.ts
├── providers/
│   ├── ThemeProvider.tsx
│   └── AuthProvider.tsx
├── types/
│   └── database.ts
└── App.tsx
```
