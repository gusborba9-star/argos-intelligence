/**
 * Normaliza nomes de times pra uma chave canônica — resolve o fato de que
 * a própria PropLine já é inconsistente entre eventos ("Lanus" vs "Atlético
 * Lanús", "CA Aldosivi" vs "Aldosivi") e permite casar times do OpenFootball
 * (nomes formais: "SC Internacional") com os nomes curtos da PropLine.
 *
 * Validado manualmente contra pares reais observados em produção antes de
 * ser usado — ver histórico de commits. Erra sempre pro lado seguro: na
 * dúvida, NÃO junta (mantém times separados) em vez de arriscar juntar
 * dois times diferentes.
 */
const STOPWORDS = new Set([
  "ca", "cd", "sc", "ec", "cr", "ac", "fc", "cf", "afc", "club", "atletico",
  "fbpa", "esporte", "clube", "futebol", "esgrima", "aa", "ass", "associacao",
  "de", "del", "da", "do", "dos", "das", "la", "las", "el", "y", "e",
  "rj", "sp", "ba", "rs", "pa", "mg", "go", "pr", "ce", "pe", "rn", "pb",
  "al", "se", "pi", "ma", "to", "mt", "ms", "ro", "am", "rr", "ap", "df", "es",
  // Códigos de país que o OpenFootball prefixa/sufixa em jogos da Libertadores/
  // Sul-Americana (ex: "bra flamengo", "arg boca juniors", "deportivo tachira
  // ven") — sem isso, esses times nunca batem com o nome puro da PropLine.
  "bra", "arg", "col", "per", "ecu", "uru", "bol", "ven", "chi", "par", "mex",
]);

export function normalizeTeamName(name: string): string {
  if (!name) return "";
  const stripped = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "");

  const tokens = stripped
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t));

  return tokens.sort().join(" ");
}
