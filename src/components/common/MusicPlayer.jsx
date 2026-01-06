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

    const DEFAULT_GITEE_TRACKS_URL = 'https://cdn.jsdelivr.net/gh/HkingAuditore/civ-game@master/tracks.json';
    const [giteeTracksUrl, setGiteeTracksUrl] = useState(DEFAULT_GITEE_TRACKS_URL);
    const [giteeTracks, setGiteeTracks] = useState([]);
    const [currentGiteeIndex, setCurrentGiteeIndex] = useState(-1);
    const [isGiteePlaying, setIsGiteePlaying] = useState(false);
    const [giteeError, setGiteeError] = useState('');

    const [mode, setMode] = useState('gitee'); // 'netease' | 'gitee'

    const DEFAULT_VOLUME = 0.6;
    const [giteeVolume, setGiteeVolume] = useState(() => {
        const raw = localStorage.getItem('music:giteeVolume');
        const n = raw == null ? NaN : Number(raw);
        if (Number.isFinite(n)) return Math.min(1, Math.max(0, n));
        return DEFAULT_VOLUME;
    });
    const [giteeMuted, setGiteeMuted] = useState(() => localStorage.getItem('music:giteeMuted') === '1');

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        localStorage.setItem('music:giteeVolume', String(giteeVolume));
    }, [giteeVolume]);

    useEffect(() => {
        localStorage.setItem('music:giteeMuted', giteeMuted ? '1' : '0');
    }, [giteeMuted]);

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

    useEffect(() => {
        if (mode !== 'gitee') return;

        const audio = new Audio();
        audio.preload = 'auto';
        audio.volume = giteeMuted ? 0 : giteeVolume;

        const handleEnded = () => {
            playNextGitee(true);
        };
        const handlePlay = () => setIsGiteePlaying(true);
        const handlePause = () => setIsGiteePlaying(false);
        const handleError = () => {
            setGiteeError('音频加载失败，已自动切到下一首');
            playNextGitee(true);
        };

        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('error', handleError);

        window.__giteeAudio = audio;

        return () => {
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('error', handleError);
            audio.pause();
            delete window.__giteeAudio;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    useEffect(() => {
        const audio = window.__giteeAudio;
        if (!audio) return;
        audio.volume = giteeMuted ? 0 : giteeVolume;
    }, [giteeVolume, giteeMuted]);

    // NOTE: Gitee raw links usually do NOT allow CORS, so direct fetch() from browser will fail.
    // Using a public proxy is a workaround. Default proxy here is AllOrigins (returns JSON with CORS enabled).
    // You can clear it to try direct fetch, or replace it with your own proxy.
    const DEFAULT_CORS_PROXY = 'https://api.allorigins.win/raw?url=';
    const [corsProxy, setCorsProxy] = useState(DEFAULT_CORS_PROXY);

    const extractJsonArrayFromText = (text) => {
        if (typeof text !== 'string') return null;
        const idx = text.indexOf('[');
        if (idx === -1) return null;
        const candidate = text.slice(idx).trim();
        try {
            return JSON.parse(candidate);
        } catch {
            return null;
        }
    };

    const loadGiteeTracks = async (url) => {
        setGiteeError('');
        try {
            const isJsDelivr = /jsdelivr\.net\//i.test(url);
            const isGitHubRaw = /raw\.githubusercontent\.com\//i.test(url) || /githubusercontent\.com\//i.test(url);

            const shouldBypassProxy = isJsDelivr || isGitHubRaw;

            const requestUrl = shouldBypassProxy
                ? url
                : (corsProxy
                    ? (corsProxy.includes('raw?url=')
                        ? `${corsProxy}${encodeURIComponent(url)}`
                        : `${corsProxy}${url}`)
                    : url);
            const res = await fetch(requestUrl, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            let data;
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
                data = await res.json();
            } else {
                const text = await res.text();
                data = extractJsonArrayFromText(text);
            }

            if (!data) {
                throw new Error('无法解析 tracks.json（可能被代理包了一层文本）');
            }
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('tracks.json 为空或格式不正确');
            }
            const normalized = data
                .map((t) => {
                    const rawUrl = t?.url;
                    const safeUrl = typeof rawUrl === 'string' ? encodeURI(rawUrl) : rawUrl;
                    return {
                        name: t?.name ?? t?.title ?? 'Unknown',
                        url: safeUrl,
                    };
                })
                .filter((t) => typeof t.url === 'string' && t.url.length > 0);

            if (normalized.length === 0) {
                throw new Error('tracks.json 中没有可用的 url');
            }

            setGiteeTracks(normalized);
            setCurrentGiteeIndex(-1);
            return normalized;
        } catch (e) {
            console.warn('Failed to load gitee tracks:', e);
            setGiteeTracks([]);
            setCurrentGiteeIndex(-1);
            setGiteeError('加载 tracks.json 失败：常见原因是跨域(CORS)或代理返回异常。若你使用的是 Gitee raw，请保留 CORS 代理；若使用 jsDelivr/GitHub raw，一般不需要代理。');
            return null;
        }
    };

    // Auto-load tracks when entering Gitee mode (and start playing one track)
    useEffect(() => {
        if (mode !== 'gitee') return;

        const run = async () => {
            const tracks = await loadGiteeTracks(giteeTracksUrl);
            if (tracks && tracks.length > 0) {
                await playNextGitee(true);
            }
        };

        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    const playGiteeIndex = async (index) => {
        if (mode !== 'gitee') return;
        const audio = window.__giteeAudio;
        if (!audio) return;
        if (!giteeTracks || giteeTracks.length === 0) return;

        const safeIndex = ((index % giteeTracks.length) + giteeTracks.length) % giteeTracks.length;
        const track = giteeTracks[safeIndex];

        try {
            setGiteeError('');
            audio.src = track.url;
            audio.currentTime = 0;
            setCurrentGiteeIndex(safeIndex);
            await audio.play();
        } catch (e) {
            console.warn('Failed to play gitee audio:', e);
            setGiteeError('播放失败（可能是浏览器/安卓限制自动播放），请点播放按钮');
        }
    };

    const playNextGitee = async (random = false) => {
        if (!giteeTracks || giteeTracks.length === 0) return;

        if (currentGiteeIndex === -1) {
            const next = Math.floor(Math.random() * giteeTracks.length);
            await playGiteeIndex(next);
            return;
        }

        const next = random
            ? Math.floor(Math.random() * giteeTracks.length)
            : (currentGiteeIndex + 1) % giteeTracks.length;
        await playGiteeIndex(next);
    };

    const playPrevGitee = async () => {
        if (!giteeTracks || giteeTracks.length === 0) return;
        const prev = currentGiteeIndex === -1
            ? Math.floor(Math.random() * giteeTracks.length)
            : (currentGiteeIndex - 1 + giteeTracks.length) % giteeTracks.length;
        await playGiteeIndex(prev);
    };

    const toggleGiteePlayPause = async () => {
        const audio = window.__giteeAudio;
        if (!audio) return;

        if (audio.paused) {
            if (currentGiteeIndex === -1) {
                await playNextGitee(true);
            } else {
                try {
                    await audio.play();
                } catch (e) {
                    setGiteeError('播放失败：请在移动端点击一次播放按钮');
                }
            }
        } else {
            audio.pause();
        }
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
                                {mode === 'gitee'
                                    ? '自建曲库 (Gitee)'
                                    : (isRadio ? "宫廷电台 (官方)" : "宫廷乐师 (Random)")}
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

                    {/* Content Area: Iframe vs Meting vs Gitee */}
                    <div className="bg-black/50 p-0 relative min-h-[90px]">
                        {mode === 'gitee' ? (
                            <div className="p-3 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-[10px] uppercase tracking-wider text-ancient-gold/70">
                                            Now Playing
                                        </div>
                                        <div className="text-xs text-ancient-parchment/95 truncate">
                                            {currentGiteeIndex >= 0 && giteeTracks[currentGiteeIndex]
                                                ? giteeTracks[currentGiteeIndex].name
                                                : '未开始播放'}
                                        </div>
                                        <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                                            {giteeTracks.length > 0
                                                ? `${currentGiteeIndex >= 0 ? currentGiteeIndex + 1 : 0}/${giteeTracks.length}`
                                                : '0/0'}
                                        </div>
                                    </div>

                                    <div className="shrink-0 flex items-center gap-1">
                                        <button
                                            onClick={playPrevGitee}
                                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-colors flex items-center justify-center"
                                            title="上一首"
                                        >
                                            <Icon name="ChevronLeft" size={14} />
                                        </button>
                                        <button
                                            onClick={toggleGiteePlayPause}
                                            className="w-10 h-10 rounded-lg bg-ancient-gold/20 hover:bg-ancient-gold/30 border border-ancient-gold/30 text-ancient-gold transition-colors flex items-center justify-center"
                                            title={isGiteePlaying ? '暂停' : '播放'}
                                        >
                                            <Icon name={isGiteePlaying ? 'Pause' : 'Play'} size={16} />
                                        </button>
                                        <button
                                            onClick={() => playNextGitee(true)}
                                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-colors flex items-center justify-center"
                                            title="随机下一首"
                                        >
                                            <Icon name="Shuffle" size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setGiteeMuted((v) => !v)}
                                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-colors flex items-center justify-center"
                                        title={giteeMuted ? '取消静音' : '静音'}
                                    >
                                        <Icon name={giteeMuted ? 'VolumeX' : 'Volume2'} size={14} />
                                    </button>
                                    <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={giteeMuted ? 0 : giteeVolume}
                                        onChange={(e) => {
                                            const v = Number(e.target.value);
                                            setGiteeVolume(v);
                                            if (v > 0 && giteeMuted) setGiteeMuted(false);
                                        }}
                                        className="flex-1 accent-ancient-gold h-1"
                                        aria-label="Volume"
                                    />
                                    <div className="w-10 text-right text-[10px] text-gray-500 font-mono tabular-nums">
                                        {Math.round((giteeMuted ? 0 : giteeVolume) * 100)}%
                                    </div>
                                </div>

                                {giteeError && (
                                    <div className="text-[10px] text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1">
                                        {giteeError}
                                    </div>
                                )}
                            </div>
                        ) : isRadio ? (
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
                        <div className="flex items-center justify-between">
                            <div className="flex gap-1 text-[10px]">
                                <button
                                    onClick={() => setMode('netease')}
                                    className={`px-2 py-1 rounded border transition-colors ${mode === 'netease'
                                            ? 'bg-ancient-gold/20 border-ancient-gold/40 text-ancient-gold'
                                            : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                                        }`}
                                >
                                    网易云
                                </button>
                                <button
                                    onClick={() => setMode('gitee')}
                                    className={`px-2 py-1 rounded border transition-colors ${mode === 'gitee'
                                            ? 'bg-ancient-gold/20 border-ancient-gold/40 text-ancient-gold'
                                            : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                                        }`}
                                >
                                    Gitee
                                </button>
                            </div>
                        </div>

                        {mode === 'gitee' ? (
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="CORS 代理（GitHub raw 通常不需要；默认: https://api.allorigins.win/raw?url= ）"
                                        value={corsProxy}
                                        onChange={(e) => setCorsProxy(e.target.value)}
                                        className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-ancient-gold/50"
                                    />
                                    <button
                                        onClick={async () => {
                                            const tracks = await loadGiteeTracks(giteeTracksUrl);
                                            if (tracks && tracks.length > 0) {
                                                await playNextGitee(true);
                                            }
                                        }}
                                        className="px-2 py-1 bg-ancient-gold/20 hover:bg-ancient-gold/30 border border-ancient-gold/30 rounded text-xs text-ancient-gold transition-colors"
                                    >
                                        重新加载
                                    </button>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-gray-500 px-1">
                                    <span>
                                        默认曲库: jsDelivr (GitHub CDN) tracks.json（已内置）
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <>
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
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};
