/**
 * Regras de senha do site (cadastro, troca e redefinição).
 * Mínimo de 10 caracteres, com letra e número, sem ser uma senha comum nem o próprio e-mail.
 * Lógica pura: testada em src/lib/__tests__/senha.test.ts.
 */

export const SENHA_MINIMO = 10;
export const SENHA_MAXIMO = 72; // limite do bcrypt usado pelo Supabase Auth

/**
 * Senhas mais usadas (no Brasil e no mundo) e as bases que viram senha com números no fim.
 * Comparação sem maiúsculas e sem acentos.
 */
const COMUNS = new Set(
  `123456 123456789 12345678 1234567890 12345 1234567 123123 123321 654321 111111 000000 222222 333333 444444 555555 666666 777777 888888 999999 121212 112233 102030 101010 147258 147258369 159753 159357 753951 852456 456789 987654321 0123456789 1q2w3e4r 1q2w3e4r5t 1qaz2wsx qwerty qwerty123 qwertyuiop asdfgh asdfghjkl zxcvbnm abc123 abcd1234 a1b2c3 a123456 aa123456 password password1 password123 passw0rd senha senha123 senha1234 senha12345 minhasenha mudar123 trocar123 admin admin123 administrador root toor iloveyou teamo teamo123 amor amor123 meuamor princesa princesa123 florzinha anjinho gatinha gatinho bebezinho docinho benfica flamengo flamengo123 corinthians corinthians123 palmeiras palmeiras123 saopaulo santos santos123 gremio gremio123 internacional cruzeiro cruzeiro123 atletico vasco vasco123 botafogo fluminense bahia vitoria sport fortaleza ceara brasil brasil123 brasil2014 jesus jesus123 jesuscristo deus deus123 deusefiel gloria aleluia familia familia123 mae123 pai123 maria maria123 joao jose jose123 ana ana123 carlos pedro lucas gabriel rafael daniel bruno felipe juliana camila amanda bruna fernanda leticia patricia vanessa beatriz mariana larissa isabela sofia julia alice laura helena valentina fazenda fazenda123 pecuaria pecuaria123 boi boi123 vaca vaca123 gado gado123 leite leite123 cavalo cavalo123 agro agro123 sitio sitio123 roca chacara trator nelore girolando holandesa curral pasto pastagem rebanho bezerro novilha touro boiada vaqueiro peao rodeio cowboy sertanejo sertao caipira roceiro dragon dragon123 monkey letmein football baseball welcome welcome1 login master hello freedom whatever shadow sunshine superman batman batman123 starwars pokemon naruto goku minecraft charlie michael jordan23 jennifer hunter killer soccer tigger buster ginger summer winter computer internet google facebook instagram whatsapp samsung iphone android windows microsoft 1234qwer qwer1234 q1w2e3r4 zaq12wsx 1qazxsw2 asd123 asdasd asdasd123 qweqwe qwe123 qazwsx abcabc aaaaaa abcdef abcdefg abcdefgh 11223344 12341234 123412345 1122334455 147852 147852369 963852741 789456123 123654 321654 0102030405 01020304 010203 aaaaaaaaaa 1234554321 0987654321 9876543210 1231231234 abc12345 abcd12345 senha12 senha2020 senha2021 senha2022 senha2023 senha2024 senha2025 senha2026 brasil2022 natal2024 janeiro fevereiro marco abril maio junho julho agosto setembro outubro novembro dezembro segunda domingo sabado futebol futebol123 cerveja cachaca chocolate morango banana abacaxi laranja limao ferrari porsche mercedes toyota honda chevrolet volkswagen fiat ford hilux ranger amarok saveiro strada toro`.split(/\s+/),
);

/** Bases muito comuns que as pessoas completam com números ("flamengo2024", "senha10"). */
const BASES = ["senha", "password", "flamengo", "corinthians", "palmeiras", "brasil", "fazenda", "gado", "leite", "teamo", "jesus", "qwerty", "admin", "mudar", "trocar", "abc", "nelore", "pecuaria"];

const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export type RegraSenha = { id: "tamanho" | "letra" | "numero" | "comum" | "email"; texto: string; ok: boolean };

export function avaliarSenha(senha: string, email?: string | null): { ok: boolean; regras: RegraSenha[] } {
  const s = normalizar(senha);
  const semNumerosNoFim = s.replace(/[\d\W_]+$/, "");
  const usuario = normalizar(email ?? "").split("@")[0] ?? "";
  const ehComum = COMUNS.has(s) || COMUNS.has(semNumerosNoFim) || BASES.some((b) => semNumerosNoFim === b) || /^(.)\1*$/.test(semNumerosNoFim) || /^(\d+)$/.test(s);
  const ehEmail = !!usuario && usuario.length >= 4 && (s === normalizar(email ?? "") || s.includes(usuario));
  const regras: RegraSenha[] = [
    { id: "tamanho", texto: `Pelo menos ${SENHA_MINIMO} caracteres`, ok: senha.length >= SENHA_MINIMO && senha.length <= SENHA_MAXIMO },
    { id: "letra", texto: "Pelo menos uma letra", ok: /\p{L}/u.test(senha) },
    { id: "numero", texto: "Pelo menos um número", ok: /\d/.test(senha) },
    { id: "comum", texto: "Não ser uma senha fácil de adivinhar", ok: !!senha && !ehComum },
    { id: "email", texto: "Não usar o seu e-mail", ok: !!senha && !ehEmail },
  ];
  return { ok: regras.every((r) => r.ok), regras };
}

/** Primeira regra que falhou, em uma frase (para mensagens de erro). */
export function motivoSenhaFraca(senha: string, email?: string | null): string | null {
  const falha = avaliarSenha(senha, email).regras.find((r) => !r.ok);
  if (!falha) return null;
  if (falha.id === "tamanho") return senha.length > SENHA_MAXIMO ? `A senha pode ter no máximo ${SENHA_MAXIMO} caracteres.` : `A senha precisa ter pelo menos ${SENHA_MINIMO} caracteres.`;
  if (falha.id === "letra") return "A senha precisa ter pelo menos uma letra.";
  if (falha.id === "numero") return "A senha precisa ter pelo menos um número.";
  if (falha.id === "comum") return "Essa senha é muito comum e fácil de adivinhar. Escolha outra.";
  return "A senha não pode conter o seu e-mail.";
}
