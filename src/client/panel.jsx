/**
 * The tunnel-gate panel: the sidebar trigger beside the settings button and
 * its popover — the rotating 6-digit pairing code with its countdown, the
 * tunnel status with restart, the paired-device roster with per-device
 * revocation, and the settings card (Cloudflare hostname + token).
 *
 * Plain React over the platform module table; all state is component-local
 * per the client stack rules. Text is zh-CN with a tiny built-in dictionary
 * (the locale seat's `t` wins when the shell supplies one).
 */
import { Component, createElement, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { fetchStatus, postAction, copyText } from './api.js'
import { countdownLabel, lastSeenLabel, tunnelBadge } from './format.js'
import { SAVE_STATE, saveOutcome, savePlan, failedFields, settingsAccess } from './save-state.js'

/** Built-in dictionary (zh wins at runtime via the locale seat when present). */
export const REPO_URL = 'https://github.com/12624841/dsh-tunnel-gate'

const DICT = {
  title: '远程隧道',
  disclaimer: '公网暴露有风险：请保管好配对码，及时断开不用的设备',
  github: 'GitHub',
  pairCard: '设备配对',
  codeHint: '在手机上打开配对链接并输入此码；配对码每 60 秒轮换。',
  scanHint: '扫码打开配对页（已带上配对码）',
  refresh: '刷新',
  copyLink: '复制链接',
  copied: '已复制',
  copy: '复制',
  tunnelCard: 'Cloudflare 隧道',
  restart: '重启隧道',
  cfHint: 'Cloudflare 控制台里把公共主机名的服务指向 http://localhost:16177。',
  devicesCard: '已配对设备',
  noDevices: '还没有设备配对',
  disconnect: '断开',
  disconnectAll: '全部断开',
  settingsCard: '设置（域名 / Token）',
  enabled: '启用远程访问',
  hostname: '固定域名',
  gateBind: '监听地址',
  readonlyHint: '远程页面为只读：请在电脑本机 (localhost) 的面板修改设置',
  loadingHint: '加载中…',
  hostnamePh: 'https://dsh.example.com',
  token: '隧道 Token',
  tokenPh: 'Cloudflare 命名隧道 Token',
  autoTunnel: '没有固定域名时用快速隧道',
  save: '保存设置',
  saved: '已保存',
  saveFailed: '保存失败：配置条目不可写',
  settingsUnavailable: '设置不可用：插件条目未持久化。重启一次 dsh web 后即可保存。',
  gateBindPh: '监听地址 127.0.0.1 / 0.0.0.0 / 192.0.2.22',
  gateRestart: '重启 16177',
  lan: '内网',
  unreachable: '无法连接主机端（插件未运行？）',
  online: '在线',
  offline: '离线',
  expire: '有效期',
  cooldown: '冷却中',
  close: '关闭',
  disabledBanner: '远程访问当前已关闭',
  reEnable: '重新启用',
}

/** Small helper: localized text with fallback. */
function makeT(propsT) {
  return (key) => {
    const viaProps = typeof propsT === 'function' ? propsT(key) : undefined
    return typeof viaProps === 'string' && viaProps !== '' ? viaProps : (DICT[key] ?? key)
  }
}

/**
 * The settings form the entry renders with — provided once by the plugin's
 * apply(): the shell instantiates slot components with only their seat props,
 * so the form rides a module-level reference.
 */
let activeSettingsForm = undefined

/** The host half (client apply) hands the bound config form over here. */
export function provideSettingsForm(form) {
  activeSettingsForm = form
}

/** The settings form in effect for this panel (explicit arg wins). */
const formOf = (form) => form ?? activeSettingsForm

/** Whether the settings snapshot carries a stored (possibly redacted) token. */
function snapshotHasToken(form) {
  const snapshot = formOf(form)?.getSnapshot?.()
  return snapshot?.status === 'ready' && snapshot.value?.tunnelToken !== undefined
}

/** Read the enabled flag from the settings form (defaults true). */
function formEnabled(form) {
  const snapshot = formOf(form)?.getSnapshot?.()
  if (snapshot?.status !== 'ready') return true
  return snapshot.value?.enabled !== false
}

/** The globe-with-link trigger icon. */
function GateIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3.6 9h16.8M3.6 15h16.8" />
      <path d="M12 3a13.5 13.5 0 0 1 0 18 13.5 13.5 0 0 1 0-18z" />
    </svg>
  )
}

/** Error boundary: a render error inside the panel is CONTAINED — shown as
 * text inside the popover, never taking the sidebar globe down with it. */
class PanelBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: undefined }
  }

  static getDerivedStateFromError(error) {
    console.error('[tunnel-gate] BOUNDARY CAUGHT:', error?.message ?? error)
    return { error }
  }

  componentDidCatch(error) {
    console.error('[tunnel-gate] panel render error:', error)
  }

  render() {
    if (this.state.error !== undefined) {
      const message = this.state.error?.message ?? String(this.state.error)
      return createElement('div', {
        style: { fontSize: 11, color: 'var(--dsw-alias-state-error-primary)', whiteSpace: 'pre-wrap', padding: 8 },
      }, `⚠ ${message}`)
    }
    return this.props.children
  }
}

/**
 * Shared inline styles. Colors come exclusively from the DSH shell's design
 * tokens (`--dsw-alias-*`), so the panel follows the active theme; shape and
 * layout stay inline. Interactive affordances (hover/active/focus) are
 * component classes from the injected stylesheet.
 */
const S = {
  card: {
    border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 12,
    background: 'var(--dsw-alias-bg-layer-1)', padding: '10px 12px', marginBottom: 10,
  },
  cardTitle: { fontSize: 12, fontWeight: 600, color: 'var(--dsw-alias-label-secondary)', marginBottom: 8, letterSpacing: '0.02em' },
  code: {
    fontFamily: 'var(--dsw-font-mono)', fontSize: 28, fontWeight: 700,
    letterSpacing: '0.22em', textAlign: 'center', color: 'var(--dsw-alias-label-primary)',
    fontVariantNumeric: 'tabular-nums', margin: '2px 0 2px 0.22em',
  },
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  spacer: { flex: 1 },
  input: {
    width: '100%', border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-base)',
    color: 'var(--dsw-alias-label-primary)', borderRadius: 8, padding: '6px 9px', fontSize: 13,
    outline: 'none', marginBottom: 8,
  },
  inputFocus: { borderColor: 'var(--dsw-alias-brand-primary)' },
  hint: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', lineHeight: 1.5, marginTop: 6 },
  badge: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999 },
  url: { fontSize: 12, wordBreak: 'break-all', color: 'var(--dsw-alias-brand-primary)' },
}

/** One device row. */
function DeviceRow({ device, t, onRevoke }) {
  return (
    <div style={{ ...S.row, justifyContent: 'space-between', padding: '5px 0' }}>
      <span style={{ ...S.row, fontSize: 13, minWidth: 0, color: 'var(--dsw-alias-label-primary)' }}>
        <span
          aria-label={device.online ? t('online') : t('offline')}
          style={{
            width: 7, height: 7, borderRadius: 999, flex: 'none',
            background: device.online ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-label-tertiary)',
          }}
        />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{device.name}</span>
        <span style={{ color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, flex: 'none' }}>{lastSeenLabel(device.lastSeenAt, Date.now())}</span>
      </span>
      <button type="button" className="tg-btn tg-btn-danger" onClick={() => onRevoke(device.id)}>{t('disconnect')}</button>
    </div>
  )
}

/** The popover body: status polling + actions + settings form. */
function Panel({ t, onClose }) {
  const settingsForm = formOf(undefined)
  const [status, setStatus] = useState(undefined)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedTemp, setCopiedTemp] = useState(false)
  const [tick, setTick] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [draft, setDraft] = useState({ publicHostname: '', tunnelToken: '', autoTunnel: false, gateHost: '' })
  const [saveState, setSaveState] = useState(SAVE_STATE.idle)
  const [failed, setFailed] = useState([])

  const refresh = useCallback(async () => {
    try {
      const snapshot = await fetchStatus()
      setStatus(snapshot)
      setError(false)
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const poll = setInterval(() => void refresh(), 5_000)
    const ticker = setInterval(() => setTick((value) => value + 1), 1_000)
    return () => {
      clearInterval(poll)
      clearInterval(ticker)
    }
  }, [refresh])

  // Settings draft mirrors the host snapshot once it is ready (the token is
  // redacted server-side; the empty draft means "keep the stored secret").
  useEffect(() => {
    const syncDraft = () => {
      const snapshot = settingsForm?.getSnapshot?.()
      if (snapshot?.status !== 'ready') return
      setDraft((current) => ({
        ...current,
        publicHostname: typeof snapshot.value?.publicHostname === 'string' ? snapshot.value.publicHostname : current.publicHostname,
        gateHost: typeof snapshot.value?.gateHost === 'string' ? snapshot.value.gateHost : current.gateHost,
        autoTunnel: snapshot.value?.autoTunnel === true,
      }))
    }
    syncDraft()
    return settingsForm?.subscribe?.(syncDraft)
  }, [settingsForm])

  /** Run one field write through the shared save-state machine. */
  const writeField = useCallback(async (field, value) => {
    const form = formOf(undefined)
    setBusy(true)
    try {
      let ok = false
      try {
        ok = (await form?.set?.(field, value)) === true
      } catch {
        ok = false
      }
      setSaveState(ok ? SAVE_STATE.saved : SAVE_STATE.failed)
      if (ok) setTimeout(() => setSaveState(SAVE_STATE.idle), 2_500)
      return ok
    } finally {
      setBusy(false)
    }
  }, [])

  /** The settings 保存 button: planned writes, verified outcome. */
  const saveSettings = useCallback(() => {
    void (async () => {
      const form = formOf(undefined)
      const writes = savePlan(form, draft)
      setBusy(true)
      try {
        const results = []
        for (const write of writes) {
          try {
            results.push((await form.set(write.field, write.value)) === true)
          } catch {
            results.push(false)
          }
        }
        const outcome = saveOutcome(results)
        setSaveState(outcome)
        setFailed(outcome === SAVE_STATE.saved ? [] : failedFields(writes, results))
        if (outcome === SAVE_STATE.saved) {
          setDraft((current) => ({ ...current, tunnelToken: '' }))
          setTimeout(() => setSaveState(SAVE_STATE.idle), 2_500)
        }
      } finally {
        setBusy(false)
      }
    })()
  }, [draft])

  const act = useCallback(async (fn) => {
    setBusy(true)
    try {
      await fn()
      await refresh()
    } catch (actionError) {
      setError(true)
    } finally {
      setBusy(false)
    }
  }, [refresh])

  const expiry = status === undefined ? undefined : countdownLabel(status.codeExpiresAt, Date.now())
  void tick // re-render each second for the countdown

  const badge = tunnelBadge(status?.tunnel?.state)
  /** The origin to click-test: the configured fixed domain, else the live tunnel URL. */
  const publicUrl = status?.publicUrl ?? status?.tunnel?.publicUrl ?? undefined
  /** Brute-force cooldown: the whole gate refuses pairing while this runs. */
  const cooling = status?.cooldownUntil !== undefined && Date.now() < status.cooldownUntil
  const coolingLeft = cooling ? countdownLabel(status.cooldownUntil, Date.now()) : ''
  /** Up-front access decision: the harness keeps the config plane local. */
  const access = settingsAccess(settingsForm, window.location)
  /** The config echo: host-side truth wins over the (possibly unavailable) form snapshot. */
  const cfgEcho = { ...(access.value ?? {}), ...(status?.config ?? {}) }

  return (
    <div style={{ width: 330, maxHeight: '72vh', overflowY: 'auto' }} role="dialog" aria-label={t('title')}>
      <div style={{ ...S.row, marginBottom: 10 }}>
        <strong style={{ fontSize: 14 }}>{t('title')}</strong>
        <span style={S.spacer} />
        <button type="button" className='tg-btn' onClick={onClose} aria-label={t('close')}>✕</button>
      </div>

      {!formEnabled(settingsForm) && (
        <div style={{ ...S.row, marginBottom: 8, padding: '8px 10px', border: '1px solid var(--dsw-alias-state-warn-primary)', borderRadius: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--dsw-alias-state-warn-primary)', flex: 1 }}>{t('disabledBanner')}</span>
          <button type="button" className='tg-btn' onClick={() => void writeField('enabled', true)}>{t('reEnable')}</button>
        </div>
      )}

      {error && <div style={{ ...S.hint, color: 'var(--dsw-alias-state-error-primary)', marginBottom: 8 }}>{t('unreachable')}</div>}

      <div style={S.card}>
        <div style={S.cardTitle}>{t('pairCard')}</div>
        {/* 固定布局：码/倒计时/二维码槽始终占位，数据到达不产生任何跳动 */}
        <div style={{ ...S.code, color: status ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-tertiary)' }}>
          {status?.code ?? '······'}
        </div>
        <div style={{ ...S.row, justifyContent: 'center', fontSize: 11, height: 18, marginBottom: 8, color: cooling ? 'var(--dsw-alias-state-warn-primary)' : 'var(--dsw-alias-label-secondary)' }}>
          {cooling ? `${t('cooldown')} ${coolingLeft}` : status ? `${t('expire')} ${expiry}` : t('loadingHint')}
        </div>
        <div data-tunnel-gate-qr-slot style={{ ...S.row, justifyContent: 'center', marginBottom: 10, height: 160 }}>
          {status?.pairUrl ? (
            <a
              href={status.pairUrl}
              target="_blank"
              rel="noreferrer"
              title={t('scanHint')}
              style={{ background: '#ffffff', borderRadius: 10, padding: 8, display: 'inline-block', lineHeight: 0 }}
            >
              <QRCodeSVG value={status.pairUrl} size={144} bgColor="#ffffff" fgColor="#000000" level="M" />
            </a>
          ) : (
            <div
              style={{
                width: 160, height: 160, borderRadius: 10,
                border: '1px dashed var(--dsw-alias-border-l2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: 'var(--dsw-alias-label-tertiary)',
              }}
            >
              {t('loadingHint')}
            </div>
          )}
        </div>
        <div style={{ ...S.row, justifyContent: 'center', gap: 8 }}>
          <button type="button" className='tg-btn' disabled={busy || !status} onClick={() => void act(() => postAction('rotate'))}>{t('refresh')}</button>
          <button
            type="button"
            className='tg-btn'
            disabled={busy || !status?.pairUrl}
            onClick={() => {
              void copyText(status.pairUrl ?? '').then((ok) => {
                if (ok) {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1_500)
                }
              })
            }}
          >
            {copied ? t('copied') : t('copyLink')}
          </button>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ ...S.row, marginBottom: 6 }}>
          <span style={S.cardTitle}>{t('tunnelCard')}</span>
          <span style={S.spacer} />
          <span style={{ ...S.badge, background: `color-mix(in srgb, ${badge.color} 15%, transparent)`, color: badge.color }}>{badge.text}</span>
        </div>
        {status?.tunnel?.publicUrl && status.tunnel.mode === 'quick' && (
          <div style={{ ...S.row, marginTop: 2 }}>
            <span style={{ fontSize: 11, color: 'var(--dsw-alias-state-warn-primary)', flex: 'none' }}>{t('tempLabel')}</span>
            <a
              href={status.tunnel.publicUrl}
              target="_blank"
              rel="noreferrer"
              title={status.tunnel.publicUrl}
              style={{ ...S.url, textDecoration: 'none' }}
            >
              {status.tunnel.publicUrl.replace(/^https?:\/\//, '')}
            </a>
            <span style={S.spacer} />
            <button
              type="button"
              className="tg-btn"
              disabled={copiedTemp}
              onClick={() => {
                void copyText(status.tunnel.publicUrl).then((ok) => {
                  if (ok) {
                    setCopiedTemp(true)
                    setTimeout(() => setCopiedTemp(false), 1_500)
                  }
                })
              }}
            >
              {copiedTemp ? t('copied') : t('copy')}
            </button>
          </div>
        )}
        {status?.publicUrl ? (
          <div style={{ ...S.row, marginTop: 2 }}>
            <span style={{ fontSize: 11, color: 'var(--dsw-alias-label-secondary)', flex: 'none' }}>{t('fixedLabel')}</span>
            <a
              href={status.publicUrl}
              target="_blank"
              rel="noreferrer"
              title={status.publicUrl}
              style={{ ...S.url, textDecoration: 'none' }}
            >
              {status.publicUrl.replace(/^https?:\/\//, '')}
            </a>
            <span style={S.spacer} />
            <button
              type="button"
              className="tg-btn"
              disabled={copiedUrl}
              onClick={() => {
                void copyText(status.publicUrl).then((ok) => {
                  if (ok) {
                    setCopiedUrl(true)
                    setTimeout(() => setCopiedUrl(false), 1_500)
                  }
                })
              }}
            >
              {copiedUrl ? t('copied') : t('copy')}
            </button>
          </div>
        ) : !status?.tunnel?.publicUrl ? (
          <div style={S.hint}>{t('cfHint')}</div>
        ) : null}
        {(status?.gate?.lanUrls ?? []).length > 0 && (
          <div style={{ marginTop: 6 }}>
            {(status?.gate?.lanUrls ?? []).map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                style={{ ...S.url, display: 'block', fontSize: 11, textDecoration: 'none' }}
              >
                {t('lan')}: {url.replace(/^https?:\/\//, '')} ↗
              </a>
            ))}
          </div>
        )}
        {status?.tunnel?.error && <div style={{ ...S.hint, color: 'var(--dsw-alias-state-error-primary)' }}>{status.tunnel.error}</div>}
        <div style={{ ...S.row, marginTop: 8 }}>
          <span style={S.spacer} />
          <button type="button" className='tg-btn' disabled={busy} onClick={() => void act(() => postAction('gate/restart'))} title={t('gateBindPh')}>
            {t('gateRestart')}
          </button>
          <button type="button" className='tg-btn' disabled={busy} onClick={() => void act(() => postAction('tunnel/restart'))}>{t('restart')}</button>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>{t('devicesCard')}</div>
        {(status?.devices ?? []).length === 0 ? (
          <div style={S.hint}>{t('noDevices')}</div>
        ) : (
          <>
            {(status?.devices ?? []).map((device) => (
              <DeviceRow key={device.id} device={device} t={t} onRevoke={(id) => void act(() => postAction('devices/revoke', { id }))} />
            ))}
            <div style={{ ...S.row, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" className='tg-btn tg-btn-danger' disabled={busy} onClick={() => void act(() => postAction('devices/revoke-all'))}>{t('disconnectAll')}</button>
            </div>
          </>
        )}
      </div>

      <div style={S.card}>
        <button
          type="button"
          style={{ ...S.btn, border: 0, background: 'transparent', padding: 0, opacity: 0.65, fontWeight: 600, fontSize: 12 }}
          onClick={() => setShowSettings((value) => !value)}
        >
          {showSettings ? '▾ ' : '▸ '}{t('settingsCard')}
        </button>
        {showSettings && (
          <div style={{ marginTop: 10 }}>
            {access.mode === 'unavailable' ? (
              <div style={{ ...S.hint, color: 'var(--dsw-alias-state-error-primary)' }}>
                {t('settingsUnavailable')}
              </div>
            ) : access.mode === 'loading' ? (
              <div style={S.hint}>{t('loadingHint')}</div>
            ) : access.mode === 'readonly' ? (
              <>
                <div style={{ fontSize: 12, lineHeight: 2 }}>
                  <div>{t('hostname')}: <strong>{cfgEcho.publicHostname || '—'}</strong></div>
                  <div>{t('gateBind')}: <strong>{cfgEcho.gateHost || '127.0.0.1'}</strong></div>
                  <div>{t('autoTunnel')}: {cfgEcho.autoTunnel === true ? '✓' : '—'}</div>
                  <div>{t('enabled')}: {cfgEcho.enabled !== false ? '✓' : '—'}</div>
                </div>
                <div style={{ ...S.hint, color: 'var(--dsw-alias-state-warn-primary)', marginTop: 6 }}>{t('readonlyHint')}</div>
              </>
            ) : (
              <>
                <label style={{ fontSize: 11, opacity: 0.7, display: 'block', marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={formEnabled(settingsForm)}
                    style={{ marginRight: 6, verticalAlign: '-2px' }}
                    onChange={(event) => void writeField('enabled', event.target.checked)}
                  />
                  {t('enabled')}
                </label>
                <input
                  style={S.input}
                  placeholder={t('hostnamePh')}
                  value={draft.publicHostname}
                  onChange={(event) => setDraft((current) => ({ ...current, publicHostname: event.target.value }))}
                />
                <div style={{ ...S.row, marginBottom: 8 }}>
                  <input
                    style={{ ...S.input, marginBottom: 0, flex: 1 }}
                    type="password"
                    placeholder={t('tokenPh')}
                    value={draft.tunnelToken}
                    onChange={(event) => setDraft((current) => ({ ...current, tunnelToken: event.target.value }))}
                  />
                  {snapshotHasToken(settingsForm) && (
                    <button
                      type="button"
                      className="tg-btn"
                      title={t('clearToken')}
                      onClick={() => void writeField('tunnelToken', '')}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <input
                  style={S.input}
                  placeholder={t('gateBindPh')}
                  value={draft.gateHost}
                  onChange={(event) => setDraft((current) => ({ ...current, gateHost: event.target.value }))}
                />
                <label style={{ fontSize: 11, opacity: 0.7, display: 'block', marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={draft.autoTunnel}
                    style={{ marginRight: 6, verticalAlign: '-2px' }}
                    onChange={(event) => setDraft((current) => ({ ...current, autoTunnel: event.target.checked }))}
                  />
                  {t('autoTunnel')}
                </label>
                <div style={{ ...S.row }}>
                  <button type="button" className='tg-btn tg-btn-primary' disabled={busy} onClick={saveSettings}>
                    {saveState === SAVE_STATE.saved ? t('saved') : t('save')}
                  </button>
                  {saveState === SAVE_STATE.saved && (
                    <span style={{ fontSize: 11, color: 'var(--dsw-alias-state-success-primary)' }}>✓ {t('saved')}</span>
                  )}
                  {saveState === SAVE_STATE.failed && (
                    <span style={{ fontSize: 11, color: 'var(--dsw-alias-state-error-primary)' }}>
                      ✗ {t('saveFailed')}{failed.length > 0 ? `：${failed.join('、')}` : ''}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        <div style={{ ...S.row, justifyContent: 'center', marginTop: 10, fontSize: 10, color: 'var(--dsw-alias-label-tertiary)', gap: 6 }}>
          <span style={{ textAlign: 'center' }}>{t('disclaimer')}</span>
          <span style={{ flex: 'none', opacity: 0.6 }}>·</span>
          <a href={REPO_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--dsw-alias-brand-primary)', textDecoration: 'none', flex: 'none' }}>
            {t('github')}
          </a>
        </div>
      </div>
    </div>
  )
}

/**
 * The sidebar footer entry: the trigger button plus the popover portal.
 * @param props.wide - whether the sidebar renders the wide column.
 * @param props.t - the locale seat translate (optional; built-in dict falls back).
 */
export function FooterEntry(props = {}) {
  const t = makeT(props.t)
  const [open, setOpen] = useState(false)
  const buttonRef = useRef(undefined)
  const [pos, setPos] = useState(undefined)

  const openPanel = () => {
    const rect = buttonRef.current?.getBoundingClientRect?.()
    if (rect !== undefined) {
      setPos({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 350)),
        bottom: Math.max(8, window.innerHeight - rect.top + 8),
      })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onDown = (event) => {
      if (event.target instanceof Element && event.target.closest?.('[data-tunnel-gate-panel]') === null && event.target.closest?.('[data-tunnel-gate-trigger]') === null) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown, true)
    }
  }, [open])

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        ref={buttonRef}
        type="button"
        data-tunnel-gate-trigger
        title={t('title')}
        aria-label={t('title')}
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPanel())}
      >
        <GateIcon />
      </button>
      {open && pos !== undefined && createPortal(
        <div
          data-tunnel-gate-panel
          style={{
            position: 'fixed', left: pos.left, bottom: pos.bottom, zIndex: 10_000,
            background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)',
            border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 16,
            boxShadow: 'var(--dsw-shadow-lv3)', padding: 14,
          }}
        >
          <PanelBoundary>
            <Panel t={t} onClose={() => setOpen(false)} />
          </PanelBoundary>
        </div>,
        document.body,
      )}
    </span>
  )
}
