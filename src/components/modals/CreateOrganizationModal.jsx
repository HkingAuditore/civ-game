import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../common/UnifiedUI';

export const CreateOrganizationModal = ({
    isOpen,
    onClose,
    orgType,
    onCreate,
    defaultName = ''
}) => {
    const [name, setName] = useState(defaultName);

    useEffect(() => {
        if (isOpen) {
            setName(defaultName || (orgType?.name ? `New ${orgType.name}` : 'New Organization'));
        }
    }, [isOpen, defaultName, orgType]);

    const handleSubmit = () => {
        if (!name.trim()) return;
        onCreate(name);
        onClose();
    };

    if (!orgType) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`建立${orgType.name}`}
            size="sm"
            footer={
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>
                        取消
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={!name.trim()}
                    >
                        建立
                    </Button>
                </div>
            }
        >
            <div className="space-y-4">
                <p className="text-ancient-stone text-sm">
                    请为即将建立的{orgType.name}命名。一个响亮的名字有助于提升组织的威望。
                </p>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-ancient-gold uppercase tracking-wider">
                        组织名称
                    </label>
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="请输入组织名称..."
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && name.trim()) {
                                handleSubmit();
                            }
                        }}
                    />
                </div>

                <div className="p-3 rounded bg-ancient-ink/30 border border-ancient-gold/10">
                    <h4 className="text-xs font-bold text-ancient-stone mb-1">组织效果预览：</h4>
                    <p className="text-xs text-ancient-stone/70 leading-relaxed">
                        {orgType.desc}
                    </p>
                </div>
            </div>
        </Modal>
    );
};
