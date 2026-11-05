# Chaves pelo painel administrativo

Nova aba "Chaves" no painel Admin onde você cola, troca ou apaga:
- **Mercado Pago:** token de acesso e segredo do aviso de pagamento.
- **Chave de resgate:** permite sair da manutenção se o painel ficar inacessível.

Depois de salva, a chave nunca volta inteira: o painel mostra só os 4 últimos caracteres (ex.: ••••a1b2), quem alterou e quando. Para mudar, cola uma nova.

## Como funciona
- Só administradores veem e alteram; conferido no servidor.
- A chave vai guardada criptografada no banco; o navegador nunca recebe o valor.
- O site usa primeiro a chave do painel; se não houver, usa a configurada hoje (nada quebra).
- Botão "Testar" no Mercado Pago confirma se o token funciona.
- Resgate: abrir `/resgate`, colar a chave, e a manutenção é desligada (com registro no histórico e limite de tentativas; erros repetidos bloqueiam o IP).
- Toda troca fica no histórico de segurança.

## Detalhes técnicos
- Migração aditiva: tabela `chaves_sistema` (nome, valor cifrado, final, alterado_por, alterado_em), RLS sem acesso direto; GRANT só para service_role. Cifragem AES-GCM com chave mestra gerada via `generate_secret` (`CHAVES_MESTRA`).
- Server functions com `requireSupabaseAuth` + checagem `private.has_role('administrador')` antes de usar o admin client.
- `assinatura.server.ts`: helper `lerChave(nome)` com fallback para `process.env`, cache curto por worker.
- Resgate: rota server `/api/public/resgate` com comparação em tempo constante, rate limit e registro em `seg_registrar_incidente`.
- Testes: fallback de chave, máscara do final, rejeição de não-admin, resgate com chave errada.
