// Store 桥接层
// 将 Zustand store 包装成与 useState 相同的接口 [value, setter]
// 用于 useGameState 从 useState 迁移到 Zustand 的过渡期
//
// 使用方式：在 useGameState 中用 useStoreField(useUIStore, 'activeTab') 
// 替代 useState('overview')，返回值完全兼容 [value, setter] 解构

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';

/**
 * 从 Zustand store 中读取单个字段，返回 [value, setter] 形式
 * 兼容 React 的 useState 使用模式
 * 
 * @param {Function} useStore - Zustand store hook
 * @param {string} fieldName - 字段名
 * @param {string} [setterName] - setter 名称（默认 set + FieldName）
 * @returns {[any, Function]} [value, setter]
 */
export const useStoreField = (useStore, fieldName, setterName) => {
    const resolvedSetter = setterName || `set${fieldName.charAt(0).toUpperCase()}${fieldName.slice(1)}`;
    const value = useStore(state => state[fieldName]);
    const setter = useStore(state => state[resolvedSetter]);
    return [value, setter];
};

/**
 * 从 Zustand store 中批量读取多个字段
 * 返回 { field1, setField1, field2, setField2, ... } 格式
 * 
 * @param {Function} useStore - Zustand store hook
 * @param {string[]} fieldNames - 字段名列表
 * @returns {Object} 包含所有字段值和 setter 的对象
 */
export const useStoreFields = (useStore, fieldNames) => {
    return useStore(
        useShallow(state => {
            const result = {};
            fieldNames.forEach(name => {
                result[name] = state[name];
                const setterName = `set${name.charAt(0).toUpperCase()}${name.slice(1)}`;
                if (state[setterName]) {
                    result[setterName] = state[setterName];
                }
            });
            return result;
        })
    );
};

/**
 * 获取 Zustand store 的非 React 版本（用于 game loop 等非组件代码）
 * 直接返回 getState() + setState() 而不触发订阅
 * 
 * @param {Object} store - Zustand store（带 getState）
 * @param {string} fieldName - 字段名
 * @returns {[Function, Function]} [getter, setter]
 */
export const getStoreAccessor = (store, fieldName) => {
    const setterName = `set${fieldName.charAt(0).toUpperCase()}${fieldName.slice(1)}`;
    const getter = () => store.getState()[fieldName];
    const setter = (v) => {
        const fn = store.getState()[setterName];
        if (fn) fn(v);
    };
    return [getter, setter];
};
