import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from './UIComponents';

/**
 * 此时此刻，恰如彼时彼刻 (Background Music Player)
 * Hybrid Implementation:
 * - DJ Radio -> Netease Iframe (Reliable, but no random shuffle)
 * - Playlist/Song -> MetingJS + APlayer (Supports random shuffle)
 */
export const MusicPlayer = () => {
    // Default valid radio station from user
    const DEFAULT_ID = '1484208985';
    // Default type is djradio, which requires checking if we should use iframe or Meting.
    // Meting doesn't support DJRadio well, so we default to Iframe logic for this ID.
    const DEFAULT_TYPE = 'djradio';

    const [isOpen, setIsOpen] = useState(false);
    const [musicId, setMusicId] = useState(DEFAULT_ID);
    const [musicType, setMusicType] = useState(DEFAULT_TYPE);
    const [inputUrl, setInputUrl] = useState('');
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Inject Scripts for APlayer (Only needed if we actally use it, but safe to load)
    useEffect(() => {
        const loadScripts = async () => {
            if (!document.querySelector('link[href*="aplayer"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://cdn.jsdelivr.net/npm/aplayer/dist/APlayer.min.css';
                document.head.appendChild(link);
            }
            if (!window.APlayer) {
                await new Promise((resolve) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/aplayer/dist/APlayer.min.js';
                    script.onload = resolve;
                    document.body.appendChild(script);
                });
            }
            if (!document.querySelector('script[src*="Meting.min.js"]')) {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/meting@2/dist/Meting.min.js';
                document.body.appendChild(script);
            }
        };
        loadScripts();
    }, []);

    // Parse URL input
    const parseNeteaseUrl = (url) => {
        try {
            if (/^\d+$/.test(url)) {
                return { id: url, type: musicType }; // existing type fallback
            }
            const urlObj = new URL(url);
            const params = new URLSearchParams(urlObj.search);
            const id = params.get('id');

            let type = 'song';
            // Determine type for Hybrid logic
            if (url.includes('playlist')) type = 'playlist';
            else if (url.includes('album')) type = 'album';
            else if (url.includes('djradio') || url.includes('program')) type = 'djradio';
            else if (url.includes('artist')) type = 'artist';

            if (id) {
                return { id, type };
            }
        } catch (e) {
            console.error("Invalid URL", e);
        }
        return null;
    };

    const handleApply = () => {
        if (!inputUrl) return;
        const result = parseNeteaseUrl(inputUrl);
        if (result) {
            setMusicId(result.id);
            setMusicType(result.type);
            setInputUrl('');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleApply();
    };

    // Derived logic for Renderer
    // Meting supports: song, playlist, album, artist, search
    // It DOES NOT support: djradio
    const isRadio = musicType === 'djradio' || musicType === '4';

    // Iframe codes: 0=playlist, 1=album, 2=song, 4=djradio
    const getIframeType = (t) => {
        if (t === 'djradio' || t === '4') return '4';
        if (t === 'playlist') return '0';
        if (t === 'album') return '1';
        return '2'; // song
    };

    const iframeHeight = 430; // Fixed tall height for radio/list
    const iframeSrc = `//music.163.com/outchain/player?type=${getIframeType(musicType)}&id=${musicId}&auto=1&height=${iframeHeight}`;

    // Meting Key
    const playerKey = `${musicId}-${musicType}`;

    return (
        <div className={`fixed z-[100] transition-all duration-300 pointer-events-none ${isMobile
                ? 'bottom-20 left-4'
                : 'bottom-8 right-8'
            }`}>
            <div className={`pointer-events-auto relative flex flex-col ${isMobile ? 'items-start' : 'items-end'}`}>
                {/* Minimized Button / Toggle */}
                {!isOpen && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsOpen(true)}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-ancient-gold/20 to-black/80 backdrop-blur border border-ancient-gold/40 flex items-center justify-center shadow-lg hover:shadow-glow-gold transition-all group"
                    >
                        <div className="absolute inset-0 rounded-full border border-ancient-gold/20 animate-spin-slow opacity-0 group-hover:opacity-100" />
                        <Icon name="Music" className="w-5 h-5 sm:w-6 sm:h-6 text-ancient-gold group-hover:text-white transition-colors" />
                    </motion.button>
                )}

                {/* Main Player Panel */}
                <motion.div
                    animate={isOpen ? {
                        opacity: 1,
                        scale: 1,
                        y: 0,
                        pointerEvents: 'auto',
                        height: 'auto',
                        width: isMobile ? 320 : 350
                    } : {
                        opacity: 0,
                        scale: 0.9,
                        y: 20,
                        pointerEvents: 'none',
                        height: 0,
                        width: 0,
                        overflow: 'hidden'
                    }}
                    transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
                    className={`bg-black/90 backdrop-blur-md border border-ancient-gold/30 rounded-xl shadow-2xl overflow-hidden absolute bottom-0 ${isMobile ? 'left-0 origin-bottom-left' : 'right-0 origin-bottom-right'}`}
                    style={{ visibility: 'visible' }} // Keeping it visible for audio persistence
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-ancient-gold/20 to-transparent border-b border-ancient-gold/10">
                        <div className="flex items-center gap-2">
                            <Icon name="Music" size={14} className="text-ancient-gold" />
                            <span className="text-xs font-bold text-ancient-parchment">
                                {isRadio ? "宫廷电台 (官方)" : "宫廷乐师 (Random)"}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                            >
                                <Icon name="Minus" size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Content Area: Iframe vs Meting */}
                    <div className="bg-black/50 p-0 relative min-h-[90px]">
                        {isRadio ? (
                            <iframe
                                frameBorder="no"
                                border="0"
                                marginWidth="0"
                                marginHeight="0"
                                width={isMobile ? "320" : "350"}
                                height={iframeHeight}
                                src={iframeSrc}
                                className="w-full block"
                                title="netease-radio-iframe"
                            />
                        ) : (
                            <meting-js
                                key={playerKey}
                                server="netease"
                                type={musicType === 'playlist' ? 'playlist' : 'song'}
                                id={musicId}
                                fixed="false"
                                mini="false"
                                autoplay="true"
                                loop="all"
                                order="random"
                                preload="auto"
                                list-folded="true"
                                list-max-height="300px"
                                lrc-type="0"
                                theme="#D4AF37"
                            ></meting-js>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-3 space-y-2 border-t border-white/10">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="输入链接 (电台/歌单)"
                                value={inputUrl}
                                onChange={(e) => setInputUrl(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-ancient-gold/50"
                            />
                            <button
                                onClick={handleApply}
                                className="px-2 py-1 bg-ancient-gold/20 hover:bg-ancient-gold/30 border border-ancient-gold/30 rounded text-xs text-ancient-gold transition-colors"
                            >
                                加载
                            </button>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-gray-500 px-1">
                            <span>
                                {isRadio ? "注: 电台仅支持官方播放器" : "APlayer 已启用 (支持随机)"}
                            </span>
                            <span className="font-mono opacity-50">ID: {musicId}</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};
