/**
 * Settings-card save logic — pure and unit-tested. The card must NEVER claim
 * success without verified writes: a settings form that refuses (entry not
 * persisted / not writable) is surfaced as a hard failure.
 *
 * `settingsAccess` additionally decides, up front, whether the card may edit
 * at all: the harness keeps the configuration plane local, so a page served
 * beyond loopback (LAN / tunnel) or an unwritable entry renders read-only
 * with the saved values echoed back.
 */
import { isLoopbackHostname } from '../loopback.js'

/** Save states the settings card can render. */
export const SAVE_STATE = {
  idle: 'idle',
  saving: 'saving',
  saved: 'saved',
  failed: 'failed',
}

/**
 * Resolve the save outcome from the per-field write results.
 * @param results - booleans returned by ConfigForm.set (or 'skipped' for fields left empty).
 * @returns 'saved' when every attempted write reported success, else 'failed'.
 */
export function saveOutcome(results) {
  const attempted = results.filter((result) => result !== 'skipped')
  if (attempted.length === 0) return SAVE_STATE.failed
  return attempted.every((result) => result === true) ? SAVE_STATE.saved : SAVE_STATE.failed
}

/**
 * The write plan for one save: which fields to attempt given the draft.
 * An unavailable form always fails; empty hostname/token fields are skipped
 * (keeping the stored values — the token is redacted on read-back anyway).
 * @param form - the bound ConfigForm or undefined.
 * @param draft - `{ publicHostname, tunnelToken, autoTunnel, gateHost }`.
 * @returns array of `{ field, value }` writes to attempt.
 */
export function savePlan(form, draft) {
  if (form === undefined) return []
  const writes = []
  // 域名/监听地址：空值也写入（= 真正清空）；Token 例外——空表示保留已存密钥
  // （secret 在回显时被隐藏，空不代表用户想清掉它）。
  if (typeof draft?.publicHostname === 'string') {
    writes.push({ field: 'publicHostname', value: draft.publicHostname.trim() })
  }
  if (typeof draft?.tunnelToken === 'string' && draft.tunnelToken.trim() !== '') {
    writes.push({ field: 'tunnelToken', value: draft.tunnelToken.trim() })
  }
  writes.push({ field: 'autoTunnel', value: draft?.autoTunnel === true })
  if (typeof draft?.gateHost === 'string') {
    writes.push({ field: 'gateHost', value: draft.gateHost.trim() })
  }
  return writes
}

/**
 * Name the fields whose writes failed — the card shows them so a partial
 * save (e.g. a rejected secret) is identifiable at a glance.
 * @param writes - the planned writes.
 * @param results - the per-write booleans returned by ConfigForm.set.
 * @returns the failed field names, in plan order.
 */
export function failedFields(writes, results) {
  return writes.filter((_, index) => results[index] !== true).map((write) => write.field)
}

/**
 * Decide the settings card's access mode before rendering any controls.
 * @param form - the bound ConfigForm (or undefined when the service is absent).
 * @param page - the page identity: a `location`-like `{ hostname, protocol }`
 *   (the desktop shell serves `file:`/`dsh-app:` — those are LOCAL by
 *   definition), or a plain hostname string (an http page, back-compat).
 * @returns `{ mode: 'unavailable' | 'loading' | 'readonly' | 'editable', value? }`
 *   — `value` echoes the saved settings for the read-only display.
 */
export function settingsAccess(form, page) {
  if (form === undefined) return { mode: 'unavailable' }
  const loc = typeof page === 'string' ? { hostname: page, protocol: 'http:' } : (page ?? {})
  const protocol = typeof loc.protocol === 'string' ? loc.protocol.toLowerCase() : 'http:'
  // Non-http(s) protocols are the desktop shell (file:/dsh-app:) — the local
  // machine by definition.
  const local = (protocol !== 'http:' && protocol !== 'https:') || isLoopbackHostname(loc.hostname ?? '')
  const snapshot = form?.getSnapshot?.()
  // The config plane is local-only: a page served beyond loopback never gets
  // a writable form — and its snapshot may never reach 'ready'. Read-only
  // immediately, whatever the snapshot says.
  if (!local) return { mode: 'readonly', value: snapshot?.value ?? {} }
  if (snapshot?.status !== 'ready') return { mode: 'loading' }
  if (snapshot.writable === false) {
    return { mode: 'readonly', value: snapshot.value ?? {} }
  }
  return { mode: 'editable', value: snapshot.value ?? {} }
}
