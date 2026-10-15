/**
 * Panel display formatting — pure functions, unit-tested.
 */

/**
 * Seconds remaining until a deadline, clamped at zero.
 * @param expiresAt - absolute deadline (ms epoch).
 * @param now - current time (ms epoch).
 * @returns whole seconds, >= 0 (ceil, so a fresh window never shows 0:00).
 */
export function secondsRemaining(expiresAt, now) {
  if (typeof expiresAt !== 'number' || typeof now !== 'number') return 0
  return Math.max(0, Math.ceil((expiresAt - now) / 1000))
}

/**
 * Render the mm:ss countdown label.
 * @param expiresAt - absolute deadline (ms epoch).
 * @param now - current time (ms epoch).
 * @returns e.g. "1:00".
 */
export function countdownLabel(expiresAt, now) {
  const seconds = secondsRemaining(expiresAt, now)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * Relative "last seen" label in Chinese, matching the panel's tone.
 * @param timestamp - the lastSeenAt (ms epoch).
 * @param now - current time (ms epoch).
 * @returns e.g. "刚刚" / "5 分钟前" / "3 小时前" / "2 天前".
 */
export function lastSeenLabel(timestamp, now) {
  if (typeof timestamp !== 'number' || typeof now !== 'number' || now < timestamp) return '刚刚'
  const seconds = Math.floor((now - timestamp) / 1000)
  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

/** Tunnel state → panel badge text and color (DSH design tokens). */
export function tunnelBadge(state) {
  switch (state) {
    case 'running':
      return { text: '运行中', color: 'var(--dsw-alias-state-success-primary)' }
    case 'starting':
      return { text: '启动中', color: 'var(--dsw-alias-state-warn-primary)' }
    case 'error':
      return { text: '出错', color: 'var(--dsw-alias-state-error-primary)' }
    default:
      return { text: '已停止', color: 'var(--dsw-alias-label-tertiary)' }
  }
}
