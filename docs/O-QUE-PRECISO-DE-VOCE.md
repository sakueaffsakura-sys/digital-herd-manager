# O que só você pode fazer

A mudança para a hospedagem nova tem seis coisas que eu não consigo fazer daqui, porque
dependem de contas que são suas. Nenhuma tem pressa: pode fazer na ordem que der.

Se quiser escolher uma só para começar, comece pela **1**: com o banco criado, eu passo a
conferir a migração contra o servidor de verdade, e não só contra um banco de teste.

> **Regra que vale para todas:** senha e chave secreta **nunca** devem ser escritas na
> nossa conversa nem dentro de um arquivo do site. O lugar delas é a tela
> **Setup Node.js App → Environment variables** do cPanel. Lá elas ficam só no servidor.

---

## 1. Criar o banco de dados no cPanel

cPanel → **MySQL Databases**:

1. Crie um banco. O cPanel põe um prefixo; anote o nome completo, algo como `suaconta_pecuaria`.
2. Crie um usuário e **gere uma senha forte pelo próprio botão do cPanel**.
3. Em "Add User To Database", ligue o usuário ao banco com **ALL PRIVILEGES**.

Depois, em **Setup Node.js App → Environment variables**, acrescente:

```
DB_HOST     localhost
DB_PORT     3306
DB_NAME     suaconta_pecuaria
DB_USER     suaconta_pecuaria
DB_PASSWORD (a senha que o cPanel gerou)
```

Me diga só **o nome do banco e do usuário**. A senha não precisa passar por mim.

---

## 2. Levar as contas (é o passo das senhas)

As senhas não saem pela API do site, só por consulta direta ao banco. Fazendo você mesmo,
elas vão do seu banco antigo para o novo **sem passar por mais ninguém**.

1. Painel do Supabase → **SQL Editor**.
2. Cole o conteúdo de [`banco/mysql/exportar-contas.sql`](../banco/mysql/exportar-contas.sql) e rode.
3. O resultado é uma coluna de comandos. Copie a coluna inteira.
4. cPanel → **phpMyAdmin** → escolha o banco novo → aba **SQL** → cole → **Executar**.

A última linha do resultado é uma conferência. Hoje ela deve dizer:
**29 contas · 7 pelo Google · 4 administradores.**

Faça este passo **antes** de importar o resto dos dados: as outras tabelas apontam para
as contas, e o banco recusa um perfil de uma conta que ainda não existe.

Ninguém precisa trocar de senha.

---

## 3. E-mail, para a recuperação de senha funcionar

cPanel → **Email Accounts** → crie uma conta, por exemplo `nao-responda@boooh.sbs`.
Depois, nas variáveis do aplicativo:

```
SMTP_HOST     mail.boooh.sbs      (o cPanel mostra o certo em "Connect Devices")
SMTP_PORT     465
SMTP_USUARIO  nao-responda@boooh.sbs
SMTP_SENHA    (a senha da conta de e-mail)
EMAIL_DE      Pecuária Digital <nao-responda@boooh.sbs>
```

Sem isso, quem esquecer a senha não consegue recuperar sozinho.

---

## 4. Entrada pelo Google (7 contas dependem disso)

Sete pessoas entram no site pelo Google hoje. Para continuarem entrando:

1. Abra o **Google Cloud Console** → **APIs e Serviços** → **Credenciais**.
2. Abra o ID do cliente OAuth que já existe (o que o Supabase usa).
3. Em **URIs de redirecionamento autorizados**, acrescente:
   `https://boooh.sbs/api/conta/google/retorno`
4. Salve.

Me passe o **ID do cliente** (pode mandar aqui, não é segredo — ele aparece no navegador
de quem entra). A **chave secreta** vai só nas variáveis do aplicativo:

```
GOOGLE_CLIENT_ID      (pode me passar)
GOOGLE_CLIENT_SECRET  (só no cPanel)
```

---

## 5. A pasta dos arquivos (uma linha, mas importante onde)

Os eBooks, o APK e as imagens do site saem do Supabase e passam a morar numa pasta do
servidor. **Essa pasta não pode ficar dentro de `public_html`**: o que está ali o Apache
entrega direto a quem souber o endereço, sem passar pelo nosso código — e eBook é pago.

No Gerenciador de Arquivos do cPanel, crie uma pasta **ao lado** de `public_html`, por
exemplo `arquivos-pecuaria`. Depois, nas variáveis do aplicativo:

```
ARQUIVOS_DIR  /home/suaconta/arquivos-pecuaria
```

(O caminho completo aparece no próprio Gerenciador de Arquivos, na barra de cima.)

Me diga o caminho que ficou. Os arquivos que já estão no Supabase eu levo depois, junto
com os dados.

---

## 6. Apontar o domínio (só no fim)

Quando estiver tudo no ar e conferido, o `boooh.sbs` passa a apontar para a hospedagem
nova. Esse é o passo que troca o site de lugar de verdade, então deixe por último — e me
avise antes, para eu conferir que não ficou nada para trás.

---

## Uma decisão sua

O banco tem **414.567 marcas de exclusão** (avisos para o aplicativo apagar o que foi
apagado no site). Quase todas são de 22 a 31 de outubro, dos dados de teste DEMO. Elas já
cumpriram a função: qualquer celular que sincronizou depois disso já as processou.

Por padrão, levo só as dos **últimos 30 dias** e o banco novo nasce limpo. Se preferir
levar todas, é só dizer — o arquivo de importação fica bem maior, mas nada se perde.

Nada é apagado do banco antigo em nenhum dos dois casos.
