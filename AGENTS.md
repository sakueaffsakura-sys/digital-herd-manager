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
- Request rate limiting is in-memory per worker in `src/start.ts` — why: cheap abuse protection; volumetric DDoS is handled by the hosting edge.
- Security events (rate-limit blocks, global spikes) are aggregated per worker in `src/lib/security-events.server.ts` and flushed to `eventos_seguranca` at most every 15s; admins read them via `admin_alertas` — why: attack visibility without the logger adding load during an attack.
- Yui support chat streams via server route `/api/yui` (`src/lib/yui.server.ts`, bearer-verified, per-user rate limit) and persists messages in `suporte_mensagens`; the guided tour preloads AI speech through the authenticated `/api/yui/voz` route with browser speech synthesis as fallback — why: keys stay server-side while the tour remains audible when AI speech fails.
- Yui's single-function lessons reuse filtered steps of the full guided tour — why: the same narration and target hints remain consistent without maintaining duplicate lesson scripts.
- Yui's optional chat wallpaper stores its active path in `configuracoes_sistema` and media in a private bucket readable and writable only by admins — why: private media and settings must not be exposed to other accounts.
- Site creator credits are stored as validated structured text in `configuracoes_sistema` and read into the About dialog only for admins — why: credits remain editable without exposing private settings to other accounts.
