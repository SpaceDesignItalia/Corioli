import React, { useEffect, useState, useRef } from 'react';
import { Card, Listbox, ListboxItem } from "@nextui-org/react";

interface ContextMenuProps {
    children: React.ReactNode;
}

interface Position {
    x: number;
    y: number;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ children }) => {
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
    const menuRef = useRef<HTMLDivElement>(null);
    const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

    useEffect(() => {
        const handleContextMenu = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            // Solo per contenteditable: menu personalizzato (Taglia/Copia/Incolla).
            // Per INPUT e TEXTAREA non intercettare: così appare il menu nativo del browser
            // con Taglia/Copia/Incolla E correzione ortografica per parole sottolineate.
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                setVisible(false);
                return;
            }
            if (target.isContentEditable) {
                event.preventDefault();
                setPosition({ x: event.clientX, y: event.clientY });
                setVisible(true);
                setTargetElement(target);
            } else {
                setVisible(false);
            }
        };

        const handleClick = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setVisible(false);
            }
        };

        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('click', handleClick);

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('click', handleClick);
        };
    }, []);

    const handleAction = async (action: 'copy' | 'cut' | 'paste') => {
        if (!targetElement) return;

        try {
            if (action === 'copy') {
                const selectedText = window.getSelection()?.toString();
                if (selectedText) {
                    await navigator.clipboard.writeText(selectedText);
                } else if (targetElement instanceof HTMLInputElement || targetElement instanceof HTMLTextAreaElement) {
                    // Copy all if nothing selected? No, usually copy copies selection.
                    // If we want to support copying field value when not selected, we could but standard behavior is selection.
                    const val = targetElement.value.substring(targetElement.selectionStart || 0, targetElement.selectionEnd || 0);
                    if (val) await navigator.clipboard.writeText(val);
                }
            } else if (action === 'cut') {
                if (targetElement instanceof HTMLInputElement || targetElement instanceof HTMLTextAreaElement) {
                    const start = targetElement.selectionStart || 0;
                    const end = targetElement.selectionEnd || 0;
                    const val = targetElement.value.substring(start, end);
                    if (val) {
                        await navigator.clipboard.writeText(val);
                        targetElement.setRangeText('', start, end, 'end');
                        // Trigger change event for React controlled inputs
                        const event = new Event('input', { bubbles: true });
                        targetElement.dispatchEvent(event);
                    }
                }
            } else if (action === 'paste') {
                const text = await navigator.clipboard.readText();
                if (targetElement instanceof HTMLInputElement || targetElement instanceof HTMLTextAreaElement) {
                    const start = targetElement.selectionStart || 0;
                    const end = targetElement.selectionEnd || 0;
                    targetElement.setRangeText(text, start, end, 'end');
                    // Trigger change event for React controlled inputs
                    const event = new Event('input', { bubbles: true });
                    targetElement.dispatchEvent(event);
                }
            }
        } catch (err) {
            console.error('Context menu action failed:', err);
        }
        setVisible(false);
    };

    return (
        <>
            {children}
            {visible && (
                <div
                    ref={menuRef}
                    className="fixed z-[9999] min-w-[150px]"
                    style={{ top: position.y, left: position.x }}
                >
                    <Card className="shadow-xl bg-background/90 backdrop-blur-md border border-default-200">
                        <Listbox aria-label="Actions" onAction={(key) => handleAction(key as any)}>
                            <ListboxItem key="cut" className="text-default-500" startContent={<span className="text-lg">✂️</span>}>
                                Taglia
                            </ListboxItem>
                            <ListboxItem key="copy" className="text-default-500" startContent={<span className="text-lg">📋</span>}>
                                Copia
                            </ListboxItem>
                            <ListboxItem key="paste" className="text-default-500" startContent={<span className="text-lg">📌</span>}>
                                Incolla
                            </ListboxItem>
                        </Listbox>
                    </Card>
                </div>
            )}
        </>
    );
};
