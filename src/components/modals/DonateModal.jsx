// 打赏作者模态框
import React from 'react';
import { Icon } from '../common/UIComponents';
import donateQrImage from '../../assets/images/donate_qr.jpg';

/**
 * 打赏作者模态框
 */
export const DonateModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* 背景遮罩 */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* 模态框内容 */}
            <div className="relative w-full max-w-sm bg-gray-900/95 border border-gray-700 rounded-xl shadow-2xl animate-slide-up">
                {/* 头部 */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                        <Icon name="Heart" size={18} className="text-pink-400" />
                        打赏作者
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 transition-colors"
                    >
                        <Icon name="X" size={14} />
                    </button>
                </div>

                {/* 内容 */}
                <div className="p-4 space-y-4">
                    <p className="text-sm text-gray-300 text-center leading-relaxed">
                        作者在自由市场里开动脑筋了，<br />
                        打赏助力作者扩张游戏规模 💰
                    </p>

                    {/* 收款码 */}
                    <div className="flex justify-center p-4 bg-white rounded-xl">
                        <img
                            src={donateQrImage}
                            alt="打赏作者二维码"
                            className="w-48 h-48 object-contain rounded-lg"
                        />
                    </div>

                    <p className="text-xs text-gray-500 text-center">
                        微信扫一扫，感谢您的支持！
                    </p>
                </div>
            </div>
        </div>
    );
};
