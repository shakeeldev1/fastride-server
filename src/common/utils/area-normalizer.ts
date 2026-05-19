export function normalizeAreaText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isGenericLocationString(location: string): boolean {
  const normalized = normalizeAreaText(location);
  const genericPatterns = [
    'current location',
    'my location',
    'current position',
    'my address',
    'my place',
    'here',
    'home',
  ];

  return genericPatterns.some((pattern) => normalized === pattern || normalized.includes(pattern));
}

export function resolveAreaFromLocationText(location: string): string {
  const commaParts = location
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  // Prefer the most specific area part that is not a country/state token.
  // For example: "Some Street, Bahawalpur, Pakistan" -> prefer "Bahawalpur" over "Pakistan".
  const stopTokens = new Set([
    'pakistan',
    'india',
    'usa',
    'united states',
    'united kingdom',
    'uk',
    'state',
    'province',
    'county',
  ]);

  if (commaParts.length > 0) {
    // Walk parts from last to first and pick first non-stop token
    for (let i = commaParts.length - 1; i >= 0; i--) {
      const candidate = normalizeAreaText(commaParts[i]);
      if (!candidate) continue;
      if (candidate.length <= 2) continue;
      if (stopTokens.has(candidate)) continue;
      return candidate;
    }

    // Fallback to last part if nothing better found
    return normalizeAreaText(commaParts[commaParts.length - 1]);
  }

  const words = location
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length > 0) {
    return normalizeAreaText(words[words.length - 1]);
  }

  return '';
}
