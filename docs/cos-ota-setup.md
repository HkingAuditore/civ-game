# 腾讯云 COS OTA 存储桶配置指引

本文档指导你在腾讯云控制台完成 OTA 热更新所需的 COS 存储桶配置。

---

## 1. 创建存储桶

- 登录 [腾讯云 COS 控制台](https://console.cloud.tencent.com/cos)
- 创建存储桶，建议命名格式：`civ-game-ota-<APPID>`
- **地域**：选择离你用户群最近的区域（如 `ap-guangzhou`）
- **访问权限**：设为 **公有读私有写**（Public Read / Private Write）

## 2. 目录结构

在存储桶中创建以下目录：

```
ota/
  production/
    updates.json       ← 正式渠道版本清单
  staging/
    updates.json       ← 测试渠道版本清单
  bundles/
    civ-game-x.y.z.zip ← OTA bundle 文件
```

不需要手动创建目录，`coscmd upload` 时会自动创建路径。

## 3. 开启静态网站或 CDN

**方案 A：开启静态网站托管（简单）**

- 存储桶 → 基础配置 → 静态网站 → 开启
- 索引文档可随便写（如 `index.html`），OTA 不会用到
- 开启后，存储桶会获得一个 `http://<bucket>.cos-website.<region>.myqcloud.com` 的访问地址

**方案 B：绑定 CDN 加速域名（推荐用于生产环境）**

- 存储桶 → 域名与传输管理 → 自定义 CDN 加速域名
- 绑定你的域名（如 `ota.yourdomain.com`）
- 开启 HTTPS（申请免费证书或上传自有证书）

## 4. 配置 CORS

存储桶 → 安全管理 → 跨域访问 CORS 设置：

| 字段              | 值                        |
| --------------- | ------------------------ |
| 来源 Origin       | `*`                      |
| 操作 Methods      | `GET, HEAD, OPTIONS`     |
| Allow-Headers   | `*`                      |
| Expose-Headers  | `ETag, Content-Length`   |
| 超时 Max-Age      | `3600`                   |

## 5. CDN 回源请求方法配置（重要）

capgo 插件以 **POST** 请求访问 `updates.json`，但 COS 静态文件不支持 POST。
需要在 CDN 控制台将回源方法设为 **GET**：

- 域名管理 → 选择加速域名 → 回源配置 → 回源请求方法
- 设为：**跟随请求** 或 **强制 GET**

如果不使用 CDN 而直接用 COS 静态网站域名，POST 可能返回 405。
此时可改用 CDN 加速域名或在 SCF 前转发。

## 6. 配置缓存策略

目标：`updates.json` 短缓存（客户端尽快拿到最新版本），bundle zip 长缓存。

| 路径模式                     | Cache-Control                  | 说明                     |
| ------------------------ | ------------------------------ | ---------------------- |
| `ota/*/updates.json`     | `max-age=60, must-revalidate`  | 客户端每分钟重新检查            |
| `ota/bundles/*.zip`      | `max-age=604800`               | bundle 不可变，长缓存 7 天      |

### 方式一：上传时通过 coscmd 指定 Header（最简单，推荐）

`release_oneclick.bat` 脚本已内置此逻辑，上传时自动附带正确的 Cache-Control。
手动上传时可这样指定：

```bash
# updates.json — 短缓存
coscmd upload -H "Cache-Control:max-age=60, must-revalidate" updates.json ota/production/updates.json

# bundle zip — 长缓存
coscmd upload -H "Cache-Control:max-age=604800" civ-game-xxx.zip ota/bundles/civ-game-xxx.zip
```

### 方式二：通过 CDN 控制台配置（仅在绑定了 CDN 加速域名后可用）

1. 进入 [CDN 控制台](https://console.cloud.tencent.com/cdn)（注意：不是 COS 控制台）
2. 域名管理 → 选择你绑定的加速域名 → 管理
3. 缓存配置 → **节点缓存过期配置** → 添加规则：
   - 类型 `目录`，路径 `/ota/bundles/`，缓存 7 天
   - 类型 `文件后缀`，后缀 `.json`，缓存 60 秒
4. 也可在 **HTTP 响应头配置** 里添加自定义 `Cache-Control`

> 如果你暂时没有绑定 CDN 域名，只用 COS 默认域名，走方式一即可。

## 7. 配置 coscmd 凭证

安装完成后（`pip install coscmd`），在命令行执行：

```bash
coscmd config -a <你的SecretID> -s <你的SecretKey> -b <存储桶名-APPID> -r <地域>
```

示例：

```bash
coscmd config -a AKIDxxxxxxxx -s xxxxxxxx -b civ-game-ota-1250000000 -r ap-guangzhou
```

凭证会保存在 `~/.cos.conf`。

> **安全提示**：不要将 SecretID/SecretKey 提交到 git 仓库。

## 8. 验证

配置完成后，手动上传一个测试文件验证：

```bash
echo {"test": true} > test.json
coscmd upload test.json ota/staging/test.json
curl https://<your-cos-domain>/ota/staging/test.json
coscmd delete ota/staging/test.json
```

如果 curl 能正常返回 JSON 内容，说明配置正确。

---

## 9. 更新 capacitor.config.json

配置完成后，将 `capacitor.config.json` 中的 `updateUrl` 替换为你的实际 URL：

```
https://<你的CDN域名或COS域名>/ota/production/updates.json
```
