/**
 * The standalone pairing page served by the gate at `/pair` — plain HTML +
 * inline CSS/JS, no build step, mobile-first, dark/light adaptive via
 * `prefers-color-scheme`. The 6-digit code comes from the desktop panel; the
 * page also accepts `?code=` for the copy-link convenience flow.
 */

/** The pairing page document. */
export function pairingPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>配对 DeepSeek Harness</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; margin: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Noto Sans CJK SC", sans-serif;
    min-height: 100dvh; display: flex; align-items: center; justify-content: center;
    padding: 24px; background: #f4f5f7; color: #1a1a1e;
  }
  @media (prefers-color-scheme: dark) { body { background: #17171b; color: #ececf0; } }
  .card {
    width: 100%; max-width: 380px; text-align: center;
    background: #ffffff; border: 1px solid rgba(0,0,0,.08); border-radius: 16px;
    padding: 28px 24px; box-shadow: 0 8px 32px rgba(0,0,0,.06);
  }
  @media (prefers-color-scheme: dark) { .card { background: #1f1f26; border-color: rgba(255,255,255,.08); } }
  h1 { font-size: 19px; font-weight: 600; margin-bottom: 8px; }
  p.hint { font-size: 13px; opacity: .65; line-height: 1.55; margin-bottom: 20px; }
  #pair-form { display: flex; gap: 8px; }
  #code {
    flex: 1; min-width: 0; font-size: 22px; letter-spacing: .35em; text-align: center;
    padding: 12px 8px 12px calc(8px + .35em); border-radius: 10px;
    border: 1px solid rgba(0,0,0,.18); background: transparent; color: inherit; outline: none;
  }
  #code:focus { border-color: #4c6ef5; }
  @media (prefers-color-scheme: dark) { #code { border-color: rgba(255,255,255,.2); } }
  button {
    padding: 12px 20px; border-radius: 10px; border: 0; font-size: 15px; font-weight: 600;
    background: #4c6ef5; color: #fff; cursor: pointer;
  }
  button:disabled { opacity: .5; }
  .status { margin-top: 16px; font-size: 13px; min-height: 1.4em; line-height: 1.4; }
  .status.err { color: #e03131; }
  .status.busy { opacity: .6; }
</style>
</head>
<body>
<main class="card">
  <h1>配对此设备</h1>
  <p class="hint">输入电脑端侧栏「隧道」面板显示的 6 位配对码。配对码每 60 秒轮换一次。</p>
  <form id="pair-form" autocomplete="off">
    <input id="code" name="code" inputmode="numeric" pattern="[0-9]*" maxlength="6"
           placeholder="······" autofocus autocomplete="one-time-code" aria-label="6 位配对码">
    <button type="submit" id="submit">配对</button>
  </form>
  <div class="status" id="status" role="status"></div>
</main>
<script>
(function () {
  var form = document.getElementById('pair-form');
  var input = document.getElementById('code');
  var button = document.getElementById('submit');
  var statusEl = document.getElementById('status');
  function say(text, kind) { statusEl.textContent = text; statusEl.className = 'status' + (kind ? ' ' + kind : ''); }
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var code = input.value.replace(/\\D/g, '');
    if (code.length !== 6) { say('请输入 6 位数字配对码', 'err'); return; }
    button.disabled = true;
    say('正在配对…', 'busy');
    fetch('/pair', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: code })
    }).then(function (response) {
      return response.json().then(function (payload) { return { status: response.status, payload: payload }; });
    }).then(function (result) {
      if (result.status === 200 && result.payload.ok && result.payload.next) {
        say('配对成功，正在进入…');
        window.location.replace(result.payload.next);
        return;
      }
      var reason = result.payload && result.payload.reason;
      say(reason === 'cooldown' || reason === 'rate_limited' ? '尝试次数过多，已进入 30 秒冷却，请稍后再试' : '配对码不正确或已过期', 'err');
      button.disabled = false;
      input.select();
    }).catch(function () {
      say('网络错误，请重试', 'err');
      button.disabled = false;
    });
  });
  // Convenience flow: ?code=123456 fills and submits automatically.
  var prefill = new URLSearchParams(window.location.search).get('code');
  if (prefill && /^\\d{6}$/.test(prefill)) {
    input.value = prefill;
    if (typeof form.requestSubmit === 'function') form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true }));
  } else {
    input.focus();
  }
})();
</script>
</body>
</html>`
}
