<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- System admin = `user_roles.role='administrador'`; admin data only via SECURITY DEFINER `admin_*` RPCs that check `private.has_role` — why: server-side authorization, never client flags.
- Selection lists fetch via `fetchAllRows` (1000-row chunks) — why: PostgREST caps responses at 1000 rows.
- Record forms share `loadFormRefs` and remount when their property/module scope changes — why: one cache contract prevents missing choices and stale editing targets.
- All record forms use typed references resolved to existing IDs before validation; categorical text normalizes to configured values and reference eligibility stays enforced — why: writing must preserve valid relationships and database constraints.
- Mount the shared Sonner Toaster once in the root layout — why: record validation errors and save confirmations must remain visible across every section.
- Tour page setup is separate from narration and waits for mounted targets — why: pausing speech must not reset examples or lose tab navigation.
- Request rate limiting is in-memory per worker in `src/start.ts` — why: cheap abuse protection; volumetric DDoS is handled by the hosting edge.
- Security events (rate-limit blocks, global spikes) are aggregated per worker in `src/lib/security-events.server.ts` and flushed to `eventos_seguranca` at most every 15s; admins read them via `admin_alertas` — why: attack visibility without the logger adding load during an attack.
- Yui support chat streams via server route `/api/yui` (`src/lib/yui.server.ts`, bearer-verified, per-user rate limit) and persists messages in `suporte_mensagens`; the guided tour preloads AI speech through the authenticated `/api/yui/voz` route with browser speech synthesis as fallback — why: keys stay server-side while the tour remains audible when AI speech fails.
- Yui's single-function lessons reuse filtered steps of the full guided tour — why: the same narration and target hints remain consistent without maintaining duplicate lesson scripts.
- Yui's optional chat wallpaper stores its active path in `configuracoes_sistema` and media in a private bucket readable and writable only by admins — why: private media and settings must not be exposed to other accounts.
- Site creator credits are stored as validated structured text in `configuracoes_sistema` and read into the About dialog only for admins — why: credits remain editable without exposing private settings to other accounts.
- Playwright auth restore writes the minted session with `localStorage.setItem(key, JSON.stringify(session))` — never `context.add_cookies`, and never splice the JSON into the script text as a bare object literal (it stores `[object Object]`, which reads as "session expired") — why: broken restore fakes an auth bug.
- Typed references are checked against property-scoped live rows before auto-creation, and unique conflicts re-read the winner; eligibility still applies — why: stale form caches and retries must not duplicate animals, lots or vaccines.
- External/native app API lives under `/api/public/app/*` (`src/lib/app-api.server.ts`), each handler verifies the bearer and acts as the user so RLS applies — why: public prefix bypasses site auth, so authorization must be per-handler.
- Offline app shell uses vite-plugin-pwa registered only via `src/lib/pwa-register.ts` (never in dev/preview/iframe, `?sw=off` kill switch) — why: service workers in preview serve stale builds.
- Shared visual styling lives in src/styles.css; motion targets headings and interactive controls, never entire tables or all rows, and respects reduced motion — why: consistent presentation without adding cost to large datasets.
- Assinatura: o site só cria a cobrança; quem libera o Premium é o aviso do Mercado Pago, com assinatura HMAC conferida em `src/lib/mercadopago.ts` e aplicada por `mp_*` (service role) — why: o navegador nunca pode decidir que um pagamento foi aprovado.
- eBooks: o PDF sai por `/api/ebooks/$id/arquivo`, que confere assinatura, registra o acesso e repassa um link assinado de 60s; o leitor desenha em canvas com marca d'água — why: o arquivo não pode virar link público nem cair no cache do navegador.
- Indicadores e avisos usam uma função SECURITY INVOKER por tela (`indicadores_propriedade`, `central_avisos`, `agenda_periodo`) — why: uma leitura só, com as regras de acesso de quem olha.
- Tudo que o administrador publica (eBook, APK, imagens) vai para bucket privado com política de escrita só para `administrador` e leitura para `authenticated` — why: conteúdo pago ou interno nunca fica em URL pública.
- QR Code é gerado por `src/lib/qr.ts` (versões 1–10, correção M), sem dependência nova — why: o registro npm não está acessível no ambiente de desenvolvimento.
- Visual: nada abaixo de 14px, sem CAIXA ALTA em rótulo, sem cor fixa em hex no JSX (use os tokens de src/styles.css) e sem `dark` preso em diálogo ou menu — why: o site é usado no sol, no celular, e tem tema claro e escuro.
