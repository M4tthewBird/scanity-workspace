export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function sameText(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

export function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const needle = normalize(query);
  return fields.some((field) => field && normalize(field).includes(needle));
}

// Rychlý zápis kontaktu: „Jan Novák, Firma s.r.o., jan@firma.cz, 777 123 456“.
export function parseContact(text: string): { name: string; companyName: string; email: string; phone: string } {
  const email = text.match(/[^\s,;]+@[^\s,;]+\.[^\s,;]+/)?.[0] ?? '';
  const phone = text.match(/\+?\d[\d ]{7,}\d/)?.[0]?.trim() ?? '';
  const rest = text
    .replace(email, '')
    .replace(phone, '')
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return { name: rest[0] ?? '', companyName: rest[1] ?? '', email, phone };
}
