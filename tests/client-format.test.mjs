/**
 * Panel display formatting: countdown, relative time, tunnel badge — the
 * pure helpers the browser half renders with.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { secondsRemaining, countdownLabel, lastSeenLabel, tunnelBadge } from '../src/client/format.js'

test('secondsRemaining counts whole seconds down and clamps at zero', () => {
  assert.equal(secondsRemaining(100_000, 40_000), 60)
  assert.equal(secondsRemaining(100_001, 40_000), 61, 'rounds up so a fresh window never shows 0:00')
  assert.equal(secondsRemaining(40_000, 100_000), 0, 'an expired window clamps to zero')
  assert.equal(secondsRemaining(undefined, 40_000), 0)
})

test('countdownLabel renders mm:ss', () => {
  assert.equal(countdownLabel(100_000, 40_000), '1:00')
  assert.equal(countdownLabel(41_000, 40_000), '0:01')
  assert.equal(countdownLabel(40_000, 40_000), '0:00')
})

test('lastSeenLabel speaks human-relative Chinese time', () => {
  const now = 1_000_000_000
  assert.equal(lastSeenLabel(now - 5_000, now), '刚刚')
  assert.equal(lastSeenLabel(now - 5 * 60_000, now), '5 分钟前')
  assert.equal(lastSeenLabel(now - 3 * 3_600_000, now), '3 小时前')
  assert.equal(lastSeenLabel(now - 2 * 86_400_000, now), '2 天前')
  assert.equal(lastSeenLabel(now + 5_000, now), '刚刚', 'future timestamps are just now')
  assert.equal(lastSeenLabel(undefined, now), '刚刚')
})

test('tunnelBadge maps states to label and color', () => {
  assert.equal(tunnelBadge('running').text, '运行中')
  assert.equal(tunnelBadge('starting').text, '启动中')
  assert.equal(tunnelBadge('error').text, '出错')
  assert.equal(tunnelBadge('stopped').text, '已停止')
  assert.equal(tunnelBadge(undefined).text, '已停止')
  assert.match(tunnelBadge('running').color, /var\(--dsw-alias-state-success-primary\)/)
  assert.match(tunnelBadge('error').color, /var\(--dsw-alias-state-error-primary\)/)
  assert.match(tunnelBadge('stopped').color, /var\(--dsw-alias-label-tertiary\)/)
})
