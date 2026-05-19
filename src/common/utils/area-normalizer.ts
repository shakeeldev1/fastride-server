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

  if (commaParts.length > 0) {
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
