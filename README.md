# dsh-tunnel-gate · DeepSeek Harness 的 Cloudflare 隧道配对门禁插件

通过你自己的 Cloudflare 固定域名，把本机 DeepSeek Harness（DSH）的 Web GUI 安全地暴露到公网——手机或另一台电脑配对一次，之后打开的就是**和本机完全一致的官方 Web GUI**，没有任何第二套界面。

```
手机 / 远程电脑
   │  https://dsh.example.com（Cloudflare 固定域名）
   ▼
Cloudflare Edge ── Tunnel（cloudflared，token 只走环境变量）
   ▼
127.0.0.1:16177   ← 本插件的门禁服务（只绑回环）
   │  未配对：配对页（输入 6 位匹配码，60 秒轮换）
   │  已配对：反代（改写 Host/Origin，转发 HTTP + WebSocket）
   ▼
127.0.0.1:3080    ← DSH 官方 Web GUI（配置零改动）
```

## 功能

- **侧栏入口**：DSH 侧栏底部（设置按钮旁）的地球图标，点开即面板。
- **6 位匹配码**：面板显示当前配对码，60 秒自动轮换，可手动刷新；配对成功后立即作废当前码。
- **配对链接**：一键复制 `https://<域名>/pair?code=XXXXXX`，手机打开自动填码提交。
- **设备管理**：已配对设备列表（UA 推断的设备名、在线状态、最近活跃），可逐个断开或全部断开；断开即时生效。
- **Cloudflare 隧道**：填入命名隧道 Token（和固定域名）即可自动运行 `cloudflared tunnel run`；Token 通过 `TUNNEL_TOKEN` 环境变量传递，不进命令行、不进日志。没有固定域名时可改用一次性快速隧道（trycloudflare.com）。
- **实时状态**：隧道运行状态徽标、公网地址、一键重启隧道。

## 安全模型

- **门禁服务只绑 `127.0.0.1`**——只有本机的 cloudflared 能连它。
- **6 位码即全部准入**：每窗口（默认 60 秒）每来源 IP 最多 6 次错误尝试，每窗口最多配对 4 台设备；设备总数有上限（默认 8，满了驱逐最久未活跃的）。
- **设备凭据**：HttpOnly + SameSite=Lax（https 下加 Secure）Cookie，服务端只存 `sha256(secret)`；365 天有效，随时撤销。
- **DSH 自身零改动**：插件把代理请求的 `Host`/`Origin` 重写为 `127.0.0.1:<端口>`，通过 DSH 的回环围栏；配对成功后跳转到 `connection.authenticatedUrl()`，让 DSH 自己铸造浏览器认证 Cookie——插件不接触任何 DSH 密钥。
- **面板 API 仅限回环**：`/api/tunnel-gate/*`（配对码、设备列表、撤销）只接受回环 Host（或显式信任域），跨站标记一律 403。

## 环境要求

- DSH ≥ 0.2.0-rc.2（`dsh` CLI 支持 profile / `dsh plugin`）。
- 一个 Cloudflare 账号 + 一条命名隧道（固定域名）；`cloudflared` 二进制由 npm 包 `cloudflared` 自动下载。

## 安装

```sh
# 方式一：从 GitHub 直接安装（lib/ 预构建产物已提交，无需本地构建）
dsh plugin --profile web add github:12624841/dsh-tunnel-gate

# 方式二：本地开发目录（开发循环）
dsh plugin --profile web add link:/path/to/dsh-tunnel-gate

# 然后重启 profile
dsh web
```

> 首次启动隧道时 `cloudflared` 二进制会自动下载（pnpm 若拦截其 postinstall 也不影响，运行时兜底下载）。
> 发布为 npm 包后可改用 `dsh plugin --profile web add dsh-tunnel-gate@<version>`。

## 配置 Cloudflare 固定域名（一次性）

1. Cloudflare Zero Trust → **Networks → Tunnels** → 创建一条 Tunnel，复制它的 **Token**。
2. 在该 Tunnel 的 **Public Hostname** 页添加映射：
   - 子域名/域名：例如 `dsh.example.com`
   - Service：`http://localhost:16177`
3. 打开 DSH 侧栏的隧道面板 → 设置，填入 **固定域名** 和 **隧道 Token**，保存。

隧道随即启动（面板徽标变绿）。手机浏览器打开面板里复制的配对链接（或手动访问 `https://dsh.example.com/pair`），输入面板显示的 6 位码，即完成配对并直接进入官方 Web GUI。配对一次，书签永久有效（域名不变、设备会话持久化在 `$DSH_HOME/tunnel-gate/`）。

## 面板操作

| 操作 | 位置 |
|---|---|
| 查看 / 刷新 6 位配对码 | 配对卡片 |
| 复制配对链接 | 配对卡片（链接内含当前码） |
| 重启隧道 | 隧道卡片 |
| 断开某台设备 / 全部断开 | 设备卡片 |
| 域名 / Token / 快速隧道 / 总开关 | 设置折叠卡片（实时生效，无需重启） |

## 免责声明

- 本插件会把 DeepSeek Harness 的**完整控制面**暴露到网络（公网隧道或局域网）。**6 位配对码是唯一的门禁**——请像保管密码一样保管它：不要截图外发、不要留在公共场合的屏幕上；不用的设备及时在面板断开；长期不用时在设置里关闭「启用远程访问」。
- 隧道域名一旦泄露，任何访问者都能看到配对页。插件内置了失败冷却与配对限次，仍建议在 Cloudflare 侧为该域名叠加 **WAF 限速**或 **Access** 访问控制，把防线再前置一层。
- 配对设备等同**完全控制凭证**：拿到它的任何人可以在你的电脑上执行 DSH 支持的任何操作。请只在信任的设备上配对。
- 本项目按「现状」提供，不附带任何明示或默示的担保（详见 LICENSE）。作者不对因使用或滥用本插件导致的任何直接或间接损失负责。

## 开发

```sh
npm install          # 安装 esbuild（构建 client bundle）
npm test             # 68 个单元/集成测试（node:test，零测试依赖）
npm run build        # 产出 lib/client.js（ModuleLoader 工厂包装）
```

### 热更新边界（实测结论）

- **浏览器半区**（侧栏入口/面板样式）：`lib/client.js` 按请求从磁盘读取，改完 `npm run build` 后**刷新页面**即生效，无需重启。
- **安装/卸载**：`dsh plugin add/remove` 的 registry 变化会被运行中的 host 热应用（插件行即时挂载/卸载）。
- **host 半区代码修复**：Node 的 ESM 模块缓存按真实路径永不失效，运行中的 host 无法从进程外替换已加载模块——host 修复需要**一次 `dsh web` 重启**。`scripts/hotfix.mjs` 提供了尽力而为的时间戳入口（新 URL 首次导入），但对已经导入过的模块同样无效；仅适用于"新增从未导入过的入口文件"的场景。


源码结构：

```
src/
  index.js        # host 入口：装配 + 生命周期 + 热更新设置
  config.js       # schemastery 配置模式（= 设置页模型）
  pairing.js      # 6 位码状态机 + 设备会话 + 持久化
  gate-server.js  # 16177 门禁服务（配对页 / 反代分派 / 健康检查）
  proxy.js        # 反代引擎（Host/Origin 重写 + WS 隧道）
  tunnel.js       # cloudflared 生命周期（named / quick）
  panel-routes.js # /api/tunnel-gate/* 面板 API（回环围栏）
  pages.js        # 手机端配对页（单文件 HTML）
  loopback.js     # 回环判定
  client/         # 浏览器半区（React：侧栏入口 + 面板）
tests/            # node:test 套件
scripts/          # build.mjs（esbuild 工厂包装）/ dev-link.mjs（peer 链接）
```

## cloudflared 二进制与排查

**二进制解析顺序**（启动隧道时依次尝试，命中即用）：

1. `cloudflared` npm 包内置路径（安装时若允许了构建脚本则已就位）
2. **PATH 里的 `cloudflared`**（brew / 手动安装的均可）
3. `~/.dsh/dsh-pocket/bin/cloudflared`（共享缓存位置）
4. 都没有 → 自动下载（120 秒超时；受限网络建议手动放置到位置 3）

**常见故障对照**：

| 症状 | 原因 | 处理 |
|---|---|---|
| 面板显示「启动失败: connect ETIMEDOUT …」 | GitHub 下载二进制超时 | 从任一可用机器拷贝 `cloudflared` 到 `~/.dsh/dsh-pocket/bin/`，点「重启隧道」 |
| 公网访问报 **Cloudflare 1033** | 隧道无活跃连接（cloudflared 没跑/刚被杀） | 面板点「重启隧道」；若反复出现，检查 CF 控制台回源地址 |
| 隧道「运行中」但域名仍打不开 | CF 控制台**回源地址**不是 `http://localhost:16177` | Zero Trust → Tunnels → 该域名的 Service 改为 `http://localhost:16177` |
| 面板红字「Provided Tunnel token is not valid」 | Token 粘贴损坏/不完整 | 重新复制完整 Token 粘贴保存 |
| 保存设置提示「配置条目不可写」 | 插件条目未持久化（旧版安装残留） | 更新插件后重启 dsh web；或按下方「手动写持久层」处理 |
| 配对码一直提示冷却 | 全局 6 次失败触发 30 秒防爆破冷却 | 等 30 秒，冷却结束自动换新码 |

**手动写持久层**（设置写入被拒时的兜底，桌面机示例）：

```sh
python3 - <<'PY'
import re
p = '/Users/<你的用户名>/.dsh/profiles/<profile>/cordis.yml'
s = open(p).read()
config = """- id: tunnel-gate
  name: dsh-tunnel-gate
  config:
    publicHostname: https://app.example.com
    tunnelToken: <你的隧道Token>
    gateHost: 0.0.0.0
    enabled: true
"""
pattern = re.compile(r'- id: tunnel-gate\n(?:  [^\n]*\n?)*')
s = pattern.sub(config, s, count=1) if '- id: tunnel-gate' in s else s.rstrip('\n') + '\n' + config
open(p, 'w').write(s)
print('✓ 已写入')
PY
```

## 已知边界

- DSH 网页服务端口变化（`--port` 指定等）会被自动跟随；但 webserver 必须保持回环绑定（默认即是）。
- 快速隧道模式每次重启域名都会变，配对设备需要重新配对；固定域名模式无此问题。
- `gatePort` 修改属于结构性配置，重启 profile 后生效；其余设置项全部实时生效。
- 隧道连接注册成功后，就绪探测失败只会降级警告、**不会杀掉 cloudflared**（回源配置错误时域名会 1033，但连接保持，改完 CF 控制台配置即自动恢复）。
