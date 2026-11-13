const PUSH_SERVICE_HOSTS = new Set([
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
])

export function isAllowedPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const endpoint = new URL(value)
    return endpoint.protocol === 'https:'
      && !endpoint.username
      && !endpoint.password
      && !endpoint.port
      && PUSH_SERVICE_HOSTS.has(endpoint.hostname.toLowerCase())
  } catch {
    return false
  }
}
