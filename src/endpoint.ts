export type EndpointResult =
  | { kind: 'missing' }
  | { kind: 'invalid'; message: string }
  | { kind: 'valid'; url: string };

/** Validate without echoing input: malformed URLs may contain credentials. */
export function parseEndpoint(value: unknown): EndpointResult {
  if (value === undefined || value === '') return { kind: 'missing' };
  if (typeof value !== 'string') {
    return { kind: 'invalid', message: 'The MCP endpoint must be a URL string.' };
  }

  const input = value.trim();
  if (!input) return { kind: 'missing' };
  const authority = input.slice(input.indexOf('://') + 3).split('/')[0];
  // Do not let WHATWG URL silently repair ambiguous URLs or strip embedded whitespace.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: explicitly reject hidden URL controls
  if (!authority || !/^https?:\/\//i.test(input) || /[\s\\\u0000-\u001f\u007f]/u.test(input)) {
    return { kind: 'invalid', message: 'Enter a complete HTTP or HTTPS URL without whitespace.' };
  }
  if (/%(?![\da-f]{2})/i.test(input)) {
    return { kind: 'invalid', message: 'The MCP endpoint contains invalid percent encoding.' };
  }
  if (input.includes('?') || input.includes('#')) {
    return {
      kind: 'invalid',
      message: 'Remove query strings and fragments. Authentication is handled through OAuth.',
    };
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { kind: 'invalid', message: 'Enter a valid absolute MCP endpoint URL.' };
  }
  if (url.username || url.password || authority?.includes('@')) {
    return {
      kind: 'invalid',
      message: 'Remove URL credentials. Authentication is handled through OAuth.',
    };
  }
  // Match exact loopback hosts, not suffixes (e.g. localhost.example.com).
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    return {
      kind: 'invalid',
      message: 'Use HTTPS. HTTP is allowed only on localhost, 127.0.0.1 or [::1].',
    };
  }
  return { kind: 'valid', url: url.href };
}
