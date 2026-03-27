# 哈耶克的文明：市场经济

一款史诗级经济策略游戏，以奥地利经济学派代表人物哈耶克的自由市场理念为核心，让玩家建立和管理自己的文明帝国。

## 游戏特色

- 🏛️ **自由市场经济** - 体验真实的市场经济运作机制
- 📈 **资源管理** - 管理多种资源，建立完整的产业链
- 🎯 **科技发展** - 研究科技，推动文明进步
- ⚔️ **军事外交** - 建立军队，与其他国家进行外交互动
- 👥 **社会阶层** - 管理不同社会阶层，维持社会稳定

## 技术栈

- React 19 + Vite
- Tailwind CSS
- Lucide React Icons

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 一键发布（Windows）

仓库根目录提供 `release_oneclick.bat`，用于一键执行：

- `release_oneclick.bat ota`：构建 Web、生成 OTA zip + updates.json 并部署到 COS
- `release_oneclick.bat apk`：构建并打 Android release APK
- `release_oneclick.bat all`：先 OTA 再 APK

首次使用前：
1. 编辑脚本顶部"用户配置区"，填写 `CDN_BASE_URL` 等参数
2. 配置 `coscmd`（见 `docs/cos-ota-setup.md`）
3. 更新 `capacitor.config.json` 中的 `updateUrl` 为实际 COS/CDN 地址

## 游戏说明

详细的游戏指南请查看 `/ai_reports` 目录下的文档。

## 参考资料

- [vibe-collab](https://pypi.org/project/vibe-collab/) - AI 辅助协作开发工具
