# Perfil, Propriedade e Plano Premium

Sistema de **perfil do usuário**, **perfil visual da propriedade** e **plano
Premium** com ativação por *modo de demonstração* (sem cobrança). Implementado
na migração `20260923000006_contas_premium.sql` e no módulo
`src/components/app/account.tsx`.

## Conceitos

- **Perfil do usuário** (`profiles` + colunas novas `nome_exibicao`, `cargo`,
  `biografia`) com **foto de perfil** disponível em **todos os planos**.
- **Perfil visual da propriedade** (`propriedade_perfil`) com dados de contato
  e apresentação (gratuitos) e **logo/banner/foto** (Premium).
- **Plano e assinatura**: tabela `assinaturas` (plano/status/origem/início/
  expiração) + `plano_auditoria` para rastrear cada alteração.
- **Modo de demonstração**: um administrador ativa o Premium **sem cobrança**
  através das funções `setar_plano_demonstracao`/`cancelar_plano_demonstracao`.
  A cobrança real (Pagar.me/Stripe) fica prevista, mas **não é implementada de
  forma falsa**: os botões de cartão ficam desabilitados com o aviso "em breve".

## Regra de negócio (fonte da verdade no banco)

O cliente **nunca decide** se está Premium: a RPC `public.minha_assinatura`
retorna `premium_ativo`, que considera:

```
plano = 'premium' AND status IN ('ativo','trial') AND (data_expiracao IS NULL OR data_expiracao > now())
```

A UI apenas consome esse retorno. A função client `evaluarPlano`/`premiumAtivo`
em `src/lib/plan.ts` é usada **somente para pré-visualização otimista** e é
testada com vitest.

## Recursos atrás do Premium

| Recurso | Onde é liberado |
| --- | --- |
| Importação em massa | botão "Importar" dos módulos (`CrudModule`) |
| Exportação CSV | Relatórios (`Reports.tsx`) |
| Logo / banner / foto da propriedade | página "Perfil da Propriedade" |

Foto de perfil do usuário e todos os cadastros/relatórios continuam no plano
gratuito.

## Segurança

- **RLS**: `propriedade_perfil`, `assinaturas` e `plano_auditoria` com policies
  próprias (`private.tem_acesso_propriedade` / `private.pode_administrar_propriedade`).
  Escrita em `assinaturas`/`plano_auditoria` **somente via funções**; a UI não
  insere/atualiza diretamente.
- **Funções `SECURITY INVOKER`**: `minha_assinatura`, `pode_gerenciar_planos`.
- **Funções `SECURITY DEFINER`** (restritas): `setar_plano_demonstracao` e
  `cancelar_plano_demonstracao` checam o JWT: `service_role` **ou** admin global
  (`user_roles.role='administrador'`) **ou** gestor da propriedade
  (`propriedade_membros` com role `proprietario`/`administrador`).
- **Storage privado**: buckets `profile-avatars`, `property-logos`,
  `property-banners` (`public=false`, máx 5 MB, apenas `image/jpeg|png|webp`).
  Policies em `storage.objects` por pasta:
  - avatares → pasta `{auth.uid()}`
  - logo/banner → pasta `{propriedade_id}` via `private.tem_acesso_propriedade`
- Exibição sempre por **URL assinada** (`createSignedUrl`, cache em módulo de
  1h). Upload via XHR com barra de progresso.

## Validação de imagem

`src/lib/image.ts` (testável):

- só JPG/PNG/WebP; máx 5 MB; extensão permitida;
- **magic bytes** (JPEG `FF D8 FF`, PNG, WebP `RIFF..WEBP`) para não aceitar
  arquivos mascarados;
- conversão automática para **WebP** com `createImageBitmap`/canvas e cover-crop
  (avatar 400×400, logo 500×500, banner 1600×500).

## Telas novas (menu lateral)

1. **Meu Perfil** (`/app/perfil`) — foto, dados pessoais, nome de exibição,
   cargo, biografia.
2. **Perfil da Propriedade** (`/app/perfil-propriedade`) — descrição/contato/
   apresentação + identidade visual (Premium).
3. **Plano e Assinatura** (`/app/assinatura`) — situação do plano, lista de
   recursos, painel do administrador (modo demonstração com confirmação e
   auditoria) e histórico de alterações.

## Ligados ao header e dashboard

- Header: avatar + nome de exibição + selo Premium (leva ao Meu Perfil).
- Dashboard: o banner da propriedade (se existir) substitui a imagem hero;
  senão mantém a imagem padrão. O asset `public/assets/property-banner-default.svg`
  é o fallback nas previews da página de perfil.

## Fluxo de publicação (Lovable)

1. Publicar o projeto no Lovable: a migração `20260923000006_contas_premium.sql`
   é aplicada em ordem após as migrações M1–M5.
2. Fazer login, abrir **Meu Perfil** e enviar a foto (gratuito).
3. Como proprietário, abrir **Plano e Assinatura** → painel de administração →
   "Ativar Premium (demo)" (confirmação).
4. Recursos Premium ficam liberados (importação, CSV, logo/banner/foto da
   propriedade). O selo "Premium de demonstração" permanece visível.

## Testes

```
npx vitest run src/lib/__tests__/plan.test.ts src/lib/__tests__/image.test.ts
```

- `plan.test.ts`: lógica de `premiumAtivo`/`avaliarPlano`/rótulos/expiração.
- `image.test.ts`: sniffing de magic bytes, validação, tamanho e extensões.

## Limitações conhecidas

- Sem `node`/`bun` no ambiente local e sem CLI do Supabase: o build/lint/testeres
  e o `supabase db push` rodam apenas no Lovable/Supabase cloud; a validação
  local é revisão estática.
- Pagamento (Pagar.me/Stripe) **não** é implementado: os botões de cartão estão
  desabilitados e a ativação é por demonstração auditada.
- Antes da publicação inicial da migração M6 existirem telas que dependem do
  banco (perfis/plano) operam em modo degradado (assumem "gratuito").