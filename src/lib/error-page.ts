/**
 * Página que o servidor mostra quando nem o site consegue carregar.
 * É HTML puro (sem o CSS do site), então as cores do visual "Brinco e pasto" vêm aqui dentro.
 */
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>A página não carregou | Pecuária Digital</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="robots" content="noindex" />
    <meta name="theme-color" content="#12301f" />
    <style>
      :root { color-scheme: light dark; --campo: #f3f5f1; --folha: #fff; --tinta: #15231a; --suave: #4b5b50; --linha: #d9e1d6; --pasto: #1f6b45; }
      @media (prefers-color-scheme: dark) {
        :root { --campo: #0e1712; --folha: #15211a; --tinta: #e7eee5; --suave: #a7b6aa; --linha: #26382c; --pasto: #58c08a; }
        .primario { color: #0e1712 !important; }
      }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1.5rem;
             background: var(--campo); color: var(--tinta);
             font: 17px/1.5 "Atkinson Hyperlegible Next", system-ui, -apple-system, sans-serif; }
      .cartao { max-width: 30rem; width: 100%; text-align: center; padding: 2rem 1.5rem;
                background: var(--folha); border: 1px solid var(--linha); border-radius: 16px; }
      h1 { margin: 0 0 .5rem; font-size: 1.75rem; line-height: 1.1; }
      p { margin: 0 0 1.5rem; color: var(--suave); }
      .acoes { display: flex; gap: .5rem; justify-content: center; flex-wrap: wrap; }
      a, button { min-height: 48px; padding: 0 1.25rem; border-radius: 10px; font: inherit; font-weight: 700;
                  cursor: pointer; text-decoration: none; border: 1px solid transparent;
                  display: inline-flex; align-items: center; }
      .primario { background: var(--pasto); color: #fff; }
      .secundario { background: var(--folha); color: var(--tinta); border-color: var(--linha); }
      a:focus-visible, button:focus-visible { outline: 3px solid var(--pasto); outline-offset: 2px; }
    </style>
  </head>
  <body>
    <main class="cartao">
      <h1>A página não carregou</h1>
      <p>Deu um problema do nosso lado. Tente de novo em instantes — nada do que você já salvou se perdeu.</p>
      <div class="acoes">
        <button class="primario" onclick="location.reload()">Tentar de novo</button>
        <a class="secundario" href="/">Voltar ao início</a>
      </div>
    </main>
  </body>
</html>`;
}
