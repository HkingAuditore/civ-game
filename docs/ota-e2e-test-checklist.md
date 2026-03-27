# OTA 端到端测试清单

在首次发布带 OTA 能力的 APK 后，按此清单完成验证。

## 前置条件

- [ ] COS 存储桶已创建并配置（参考 `docs/cos-ota-setup.md`）
- [ ] `coscmd` 已安装且凭证已配置（`coscmd config ...`）
- [ ] `capacitor.config.json` 中的 `updateUrl` 已替换为实际 COS/CDN 地址
- [ ] 已执行 `npx cap sync android` 并重新构建 APK
- [ ] 新 APK 已安装到测试设备

## 测试流程

### 1. 首次启动（无 OTA）

- [ ] 安装新 APK 并启动
- [ ] 游戏正常加载，无崩溃
- [ ] 打开 Android Logcat 过滤 `CapacitorUpdater`，确认：
  - `notifyAppReady` 成功调用
  - 插件尝试检查 updateUrl
  - 无更新时日志显示 "no new version" 或类似信息

### 2. 发布第一个 OTA 更新

- [ ] 修改一个可见的 UI 元素（如在某个页面加一行文字）
- [ ] 运行 `release_oneclick.bat ota`
- [ ] 确认 COS 上有 `ota/production/updates.json` 和 `ota/bundles/civ-game-*.zip`
- [ ] 手动验证 `updates.json` 格式正确（`version`、`url`、`checksum` 字段）

### 3. 冷启动更新

- [ ] 完全杀掉 App（从任务管理器清除）
- [ ] 重新启动 App
- [ ] 等待约 10-30 秒，确认插件开始下载
- [ ] 切到后台再切回前台，或重启 App
- [ ] 验证 UI 变更已生效

### 4. 热启动更新

- [ ] 保持 App 在前台运行
- [ ] 发布一个新的 OTA 包
- [ ] 将 App 切到后台等待几秒
- [ ] 切回前台或重启
- [ ] 验证更新已应用

### 5. 断网恢复

- [ ] 关闭设备网络（飞行模式）
- [ ] 启动 App
- [ ] 确认 App 正常工作（使用当前 bundle）
- [ ] 恢复网络
- [ ] 等待下次自动检查或重启 App
- [ ] 确认更新可以正常下载

### 6. 更新中杀进程

- [ ] 发布一个较大的 OTA 包
- [ ] 在下载过程中强制杀掉 App
- [ ] 重新启动 App
- [ ] 确认 App 正常运行（应回到之前版本）
- [ ] 等待重新下载并成功安装

### 7. 回滚验证

- [ ] 发布一个故意有问题的 OTA 包（如删掉 index.html）
- [ ] 安装到设备
- [ ] 确认 capgo 插件在 `appReadyTimeout`（默认 10 秒）内未收到 `notifyAppReady`
- [ ] 确认自动回滚到上一个正常版本
- [ ] Logcat 中应有 `updateFailed` 事件

### 8. 手动回滚

- [ ] 将 COS 上的 `updates.json` 指向旧版本 bundle
- [ ] 重启 App
- [ ] 确认 App 下载并切换到指定的旧版本

### 9. staging 渠道隔离

- [ ] 修改脚本 `CHANNEL=staging` 并发布
- [ ] 确认 staging 设备收到更新
- [ ] 确认 production 设备不受影响

### 10. 存档兼容性

- [ ] 在旧版本创建一个游戏存档
- [ ] OTA 更新后加载该存档
- [ ] 确认存档数据完整，游戏正常进行

## 通过标准

- 所有 10 项测试通过
- 无崩溃或数据丢失
- 更新流程对用户无感知（后台下载，下次启动生效）
