import { Component } from 'react';
import { reportReactCrash } from '../../utils/crashReporter';

const containerStyle = {
    position: 'fixed',
    inset: 0,
    zIndex: 99999,
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    color: '#e0e0e0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
};

const cardStyle = {
    maxWidth: '480px',
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '16px',
    padding: '32px 24px',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.1)',
    textAlign: 'center',
};

const titleStyle = {
    fontSize: '20px',
    fontWeight: 700,
    color: '#ff6b6b',
    marginBottom: '12px',
};

const messageStyle = {
    fontSize: '14px',
    color: '#aaa',
    marginBottom: '20px',
    lineHeight: 1.6,
};

const detailBoxStyle = {
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '20px',
    textAlign: 'left',
    fontSize: '12px',
    fontFamily: 'monospace',
    color: '#ff9a9a',
    maxHeight: '160px',
    overflow: 'auto',
    wordBreak: 'break-all',
};

const btnStyle = {
    padding: '10px 24px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    margin: '0 6px',
};

const primaryBtnStyle = {
    ...btnStyle,
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff',
};

const secondaryBtnStyle = {
    ...btnStyle,
    background: 'rgba(255,255,255,0.1)',
    color: '#ccc',
};

export class AppErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null, crashRecord: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        const record = reportReactCrash(error, errorInfo);
        this.setState({ errorInfo, crashRecord: record });
    }

    handleReload = () => {
        window.location.reload();
    };

    handleResetAndReload = () => {
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('civ_save_')) {
                    // 不删除存档
                    continue;
                }
                if (key && (key.startsWith('civ_game_') || key === 'civ_game_state')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
        } catch { /* ignore */ }
        window.location.reload();
    };

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        const { error, crashRecord } = this.state;
        const errorMessage = error?.message || '未知错误';
        const timestamp = crashRecord
            ? new Date(crashRecord.timestamp).toLocaleString('zh-CN')
            : new Date().toLocaleString('zh-CN');

        return (
            <div style={containerStyle}>
                <div style={cardStyle}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
                    <div style={titleStyle}>游戏遇到了问题</div>
                    <div style={messageStyle}>
                        别担心，你的存档是安全的。<br />
                        崩溃信息已自动记录，下次启动会上报。
                    </div>
                    <div style={detailBoxStyle}>
                        <div><strong>时间：</strong>{timestamp}</div>
                        <div><strong>错误：</strong>{errorMessage}</div>
                        {crashRecord?.memoryMB && (
                            <div><strong>内存：</strong>{crashRecord.memoryMB} MB</div>
                        )}
                        {crashRecord?.appVersion && (
                            <div><strong>版本：</strong>{crashRecord.appVersion}</div>
                        )}
                    </div>
                    <div>
                        <button style={primaryBtnStyle} onClick={this.handleReload}>
                            重新加载
                        </button>
                        <button style={secondaryBtnStyle} onClick={this.handleResetAndReload}>
                            清除缓存重载
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}
