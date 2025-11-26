import React from 'react';

/**
 * 响应式布局容器
 * - PC端 (lg+): 左、中、右三列布局
 * - 移动端 (<lg): 单列流式布局
 * @param {React.ReactNode} left - 左侧面板内容
 * @param {React.ReactNode} main - 中间主内容
 * @param {React.ReactNode} right - 右侧面板内容
 */
export const ResponsiveContainer = ({ left, main, right }) => {
  return (
    <div className="flex flex-col lg:flex-row w-full max-w-[1920px] mx-auto h-full">
      {/* 左侧面板 */}
      <aside className="w-full lg:w-1/4 xl:w-1/5 p-2 lg:overflow-y-auto">{left}</aside>

      {/* 中间主内容 */}
      <main className="flex-1 w-full p-2 lg:overflow-y-auto">{main}</main>

      {/* 右侧面板 */}
      <aside className="w-full lg:w-1/4 xl:w-1/5 p-2 lg:overflow-y-auto">{right}</aside>
    </div>
  );
};