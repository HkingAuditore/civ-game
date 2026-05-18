# 实施计划

- [ ] 1. 在 `App.jsx` 移动端 `GameControls` 实例中移除 `onDonate` prop
   - 定位 `App.jsx` 第 1505 行附近的移动端 `GameControls`（位于 `lg:hidden` 区域）
   - 删除该实例的 `onDonate={() => setShowDonateModal(true)}` 这一行
   - 保留桌面端（第 1475 行，`lg:block` 区域）的 `onDonate` prop 不变
   - _需求：1.1、1.2_

- [ ] 2. 验证 `GameControls.jsx` 中打赏按钮的条件渲染逻辑已覆盖此场景
   - 确认第 318 行 `disabled={!onDonate}` 及第 321 行样式逻辑在 `onDonate` 为 `undefined` 时能正确隐藏/禁用按钮
   - 若现有逻辑仅 `disabled` 而非隐藏，则在第 315 行附近添加 `{onDonate && <button ...>}` 条件渲染，确保移动端完全不渲染该按钮
   - _需求：1.1、1.3_

- [ ] 3. 验证其他菜单项和桌面端打赏功能不受影响
   - 在桌面端（≥ 1024px）确认打赏按钮仍正常显示并可点击弹出 `DonateModal`
   - 在移动端（< 1024px）确认菜单中不出现打赏按钮，其余菜单项（设置、存档、教程、百科、更新日志）正常显示
   - _需求：1.2、1.4、1.5_
