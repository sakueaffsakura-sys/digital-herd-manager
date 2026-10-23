type Reference = { id: string; nome: string | null; numero_brinco?: string };
const normalize = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

/** Resolve typed names without ever storing text in a foreign-key column. */
export function resolveNoteReference(text: string, rows: readonly Reference[]): { id: string | null; error?: string } {
  const value = normalize(text);
  if (!value) return { id: null };
  const matches = rows.filter((row) => [row.id, row.nome, row.numero_brinco, row.nome && row.numero_brinco ? `${row.nome} · ${row.numero_brinco}` : null]
    .some((label) => label && normalize(label) === value));
  if (matches.length === 1) return { id: matches[0].id };
  return { id: null, error: matches.length ? "Há mais de um cadastro com esse nome. Digite o brinco ou o identificador." : "Cadastro não encontrado. Confira o nome ou deixe o campo vazio." };
}