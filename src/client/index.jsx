/**
 * tunnel-gate — browser half. Registers the locale dictionaries, the
 * sidebar-foot entry (tunnel trigger + pairing panel), and the settings form
 * the panel edits. Everything renders from the plugin lifecycle, so a
 * disabled plugin row leaves the DOM untouched.
 */
import { FooterEntry, provideSettingsForm } from './panel.jsx'

/** Locale namespace — also the entry id spelled by cordis.patch.yml. */
const NS = 'tunnel-gate'

/** The zh-CN dictionary (the primary surface language). */
const zh = {
  title: '远程隧道',
  disclaimer: '公网暴露有风险：请保管好配对码，及时断开不用的设备',
  github: 'GitHub',
  pairCard: '设备配对',
  codeHint: '在手机上打开配对链接并输入此码；配对码每 60 秒轮换。',
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
  hostnamePh: 'https://dsh.example.com（可带 https:// 或 http://）',
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

/** English fallback dictionary. */
const en = {
  title: 'Remote tunnel',
  disclaimer: 'Exposing to the internet has risks: guard your pairing code and unpair idle devices',
  github: 'GitHub',
  pairCard: 'Pair a device',
  codeHint: 'Open the pairing link on your phone and enter this code; it rotates every 60s.',
  refresh: 'Refresh',
  copyLink: 'Copy link',
  copied: 'Copied',
  copy: 'Copy',
  tunnelCard: 'Cloudflare tunnel',
  restart: 'Restart tunnel',
  cfHint: 'Point the public hostname service at http://localhost:16177 in the Cloudflare dashboard.',
  devicesCard: 'Paired devices',
  noDevices: 'No device has paired yet',
  disconnect: 'Unpair',
  disconnectAll: 'Unpair all',
  settingsCard: 'Settings (hostname / token)',
  enabled: 'Enable remote access',
  hostname: 'Fixed hostname',
  gateBind: 'Bind address',
  readonlyHint: 'Read-only on remote pages: edit settings from the local (localhost) panel',
  loadingHint: 'Loading…',
  hostnamePh: 'https://dsh.example.com (https:// or http://)',
  token: 'Tunnel token',
  tokenPh: 'Cloudflare named tunnel token',
  autoTunnel: 'Use a quick tunnel when no hostname is set',
  save: 'Save settings',
  saved: 'Saved',
  saveFailed: 'Save failed: the config entry is not writable',
  settingsUnavailable: 'Settings unavailable: the plugin entry is not persisted. Restart dsh web once to enable saving.',
  gateBindPh: 'Bind address 127.0.0.1 / 0.0.0.0 / 192.0.2.22',
  gateRestart: 'Restart 16177',
  lan: 'LAN',
  unreachable: 'Host unreachable (plugin not running?)',
  online: 'online',
  offline: 'offline',
  expire: 'expires in',
  cooldown: 'Cooling down',
  close: 'Close',
  disabledBanner: 'Remote access is currently off',
  reEnable: 'Re-enable',
}

/** Services required by this plugin. */
export const inject = ['slots', 'locale', 'configForms']

/** One injected stylesheet — component classes over the DSH design tokens
 * (`--dsw-alias-*`), so every surface follows the active shell theme. */
const STYLE_ID = 'dsh-tunnel-gate-styles'
const STYLE_TEXT = `
[data-tunnel-gate-trigger] {
  width: 36px; height: 36px; border: none; border-radius: 50%; padding: 0;
  background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background-color 120ms ease, color 120ms ease, box-shadow 120ms ease;
}
[data-tunnel-gate-trigger]:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary);
}
[data-tunnel-gate-trigger]:active:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-active);
}
[data-tunnel-gate-trigger][aria-expanded='true'] {
  background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary);
}
[data-tunnel-gate-trigger]:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--dsw-alias-bg-layer-2), 0 0 0 4px var(--dsw-alias-brand-primary);
}
.tg-btn {
  border: none; border-radius: 8px; padding: 4px 10px;
  background: var(--dsw-alias-button-elevated-fill); color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 12px; cursor: pointer; white-space: nowrap;
  transition: background-color 120ms ease;
}
.tg-btn:hover:not(:disabled) { background: var(--dsw-alias-button-floating-hover); }
.tg-btn:active:not(:disabled) { background: var(--dsw-alias-interactive-bg-active); }
.tg-btn:disabled { opacity: 0.5; cursor: default; }
.tg-btn-danger { background: transparent; color: var(--dsw-alias-state-error-primary); }
.tg-btn-danger:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.tg-btn-primary {
  border: 1px solid var(--dsw-alias-button-primary-fill);
  background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground);
  font-weight: 500; padding: 6px 12px;
  transition: background-color 120ms ease, border-color 120ms ease, opacity 120ms ease;
}
.tg-btn-primary:hover:not(:disabled) {
  background: var(--dsw-alias-button-primary-hover); border-color: var(--dsw-alias-button-primary-hover);
}
.tg-btn-primary:disabled { opacity: 0.6; cursor: default; }
`

/**
 * Register the remote-tunnel surface.
 * @param ctx - client root context (slots, locale, configForms injected).
 */
export function apply(ctx) {
  window.__TG_DEBUG_CTX = ctx
  // Dictionaries: best-effort — the panel carries a built-in zh fallback.
  try {
    ctx.locale?.register?.(NS, { zh, en })
  } catch {
    // An absent locale service leaves the built-in dictionary in charge.
  }

  // The settings form bound to this plugin's profile entry (a standalone
  // install's entry id IS the namespace, per the cordis.patch.yml row).
  let settingsForm
  try {
    settingsForm = ctx.configForms?.get?.(NS) ?? undefined
  } catch {
    settingsForm = undefined
  }
  provideSettingsForm(settingsForm)

  // The stylesheet: injected once, removed with the plugin.
  let style = document.getElementById(STYLE_ID)
  if (style === null) {
    style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = STYLE_TEXT
    document.head.appendChild(style)
  }
  ctx.effect(() => () => style?.remove?.(), 'tunnel-gate-client: styles')

  // Sidebar foot seat: the trigger is ALWAYS registered — hiding it when
  // remote access is off would remove the only way back into the panel.
  // The disabled state is shown inside the panel with a one-click re-enable.
  ctx.slots?.inject?.('sidebar.footer.action', () => {
      let disposeEntry
    try {
      disposeEntry = ctx.slots.register({ name: 'sidebar.footer.action', id: NS, locale: NS }, FooterEntry)
    } catch (e) {
        }
    return () => {
      try {
        disposeEntry?.()
      } catch {}
    }
  })
}