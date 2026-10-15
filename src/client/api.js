/**
 * Panel API client: thin fetch wrappers for the `/api/tunnel-gate/*` surface
 * served by the host half on the DSH webserver (same origin, loopback).
 */

/** Fetch the full status snapshot; throws on non-2xx. */
export async function fetchStatus() {
  const response = await fetch('/api/tunnel-gate/status', { cache: 'no-store' })
  if (!response.ok) throw new Error(`status ${String(response.status)}`)
  return response.json()
}

/**
 * POST one panel action.
 * @param action - path segment below /api/tunnel-gate/ (rotate, devices/revoke, …).
 * @param body - optional JSON payload.
 */
export async function postAction(action, body) {
  const response = await fetch(`/api/tunnel-gate/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload?.reason ?? String(response.status))
    error.payload = payload
    throw error
  }
  return payload
}

/** Clipboard write with a textarea fallback (non-secure origins). */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}
