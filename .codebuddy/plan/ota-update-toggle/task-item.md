# 实施计划

- [ ] 1. 在 `useOtaUpdate.js` 中添加 OTA 开关读取逻辑
   - 定义 `localStorage` key 常量：`OTA_UPDATE_ENABLED_KEY = 'civ_ota_update_enabled'`
   - 在 `checkAndUpdate()` 执行 `notifyAppReady()` 之后、`initOtaInfo()` 之前，读取该 key
   - 若值为 `null`（首次安装）或 `'false'`，则直接 `return`，跳过后续所有 OTA 检查和下载步骤
   - _需求：3.1、3.2、3.3、1.5_

- [ ] 2. 在 `SettingsPanel.jsx` 中新增 OTA 更新开关 UI 组件
   - 新增 `OtaUpdateSection` 子组件，使用与现有 `PerformanceModeSection` 一致的样式风格
   - 使用 `Capacitor.isNativePlatform()` 判断，非原生平台不渲染该组件
   - 组件内部用 `useState` + `localStorage` 管理开关状态，初始值读取 `civ_ota_update_enabled`（默认 `false`）
   - 渲染一个 toggle 开关，显示"联网更新"标签和当前状态文字（已开启/已关闭）
   - 切换时立即写入 `localStorage`
   - _需求：1.1、1.4、1.5、2.1、2.2_

- [ ] 3. 将 `OtaUpdateSection` 插入 `SettingsPanel` 渲染树
   - 在 `PerformanceModeSection` 之后、关于区域之前插入 `<OtaUpdateSection />`
   - 无需新增 props，组件自管理状态
   - _需求：1.1、3.4_
