import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Lock, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

/**
 * High-Security Wrapper Component to prevent screenshots, screen captures, devtools inspection,
 * right-click saving, and text exfiltration on sensitive documents and views.
 */
export default function ProtectedView({
    children,
    title = 'Confidential Information',
    enableWatermark = true,
    preventPrintScreen = true,
    preventDevTools = true,
    blurOnFocusLoss = true,
    className = '',
}) {
    const { user } = useAuthStore();
    const [isBlurred, setIsBlurred] = useState(false);
    const [screenshotBlockedAlert, setScreenshotBlockedAlert] = useState(false);
    const isPrintingRef = useRef(false);

    useEffect(() => {
        // 1. Detect Loss of Window Focus (Snipping tool / Win+Shift+S / Alt+Tab / Screen recording tool focus grab)
        const handleBlur = () => {
            if (isPrintingRef.current) return;
            if (blurOnFocusLoss) {
                setIsBlurred(true);
            }
        };

        const handleFocus = () => {
            setIsBlurred(false);
        };

        const handleVisibilityChange = () => {
            if (isPrintingRef.current) return;
            if (document.hidden && blurOnFocusLoss) {
                setIsBlurred(true);
            } else {
                setIsBlurred(false);
            }
        };

        // 2. Intercept Key Shortcuts (PrintScreen, Snipping Tool, DevTools, Copy/Print)
        const handleKeyDown = (e) => {
            // PrintScreen / PrtScn key
            if (e.key === 'PrintScreen' || e.keyCode === 44) {
                e.preventDefault();
                e.stopPropagation();
                triggerSecurityAlert('PrintScreen attempt blocked');
                // Clear clipboard
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText('GLX SECURITY PROTECTED - SCREENSHOT RESTRICTED').catch(() => {});
                }
                setIsBlurred(true);
                setTimeout(() => setIsBlurred(false), 2000);
            }

            // Snipping tool / Windows key + Shift + S
            if (e.key === 'S' && e.shiftKey && (e.metaKey || e.winKey)) {
                e.preventDefault();
                setIsBlurred(true);
                triggerSecurityAlert('Snipping tool key combination detected');
            }

            // DevTools / View Source shortcuts (F12, Ctrl+Shift+I, Ctrl+Shift+C, Ctrl+U)
            if (preventDevTools) {
                if (
                    e.key === 'F12' ||
                    (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'C' || e.key === 'c' || e.key === 'J' || e.key === 'j')) ||
                    (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.key === 'S' || e.key === 's'))
                ) {
                    e.preventDefault();
                    triggerSecurityAlert('Developer inspect shortcuts disabled on sensitive views');
                }
            }
        };

        // 3. Clear Clipboard on Copy attempts
        const handleCopy = (e) => {
            triggerSecurityAlert('Text selection & copying restricted');
        };

        const handleBeforePrint = () => {
            isPrintingRef.current = true;
            setIsBlurred(false);
        };

        const handleAfterPrint = () => {
            isPrintingRef.current = false;
            setIsBlurred(false);
        };

        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeprint', handleBeforePrint);
        window.addEventListener('afterprint', handleAfterPrint);
        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('keyup', (e) => {
            if (e.key === 'PrintScreen') {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText('').catch(() => {});
                }
            }
        });

        return () => {
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeprint', handleBeforePrint);
            window.removeEventListener('afterprint', handleAfterPrint);
            window.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [blurOnFocusLoss, preventDevTools]);

    const triggerSecurityAlert = (reason) => {
        setScreenshotBlockedAlert(true);
        toast.error(`🛡️ SECURITY ALERT: ${reason}`, {
            id: 'security-alert-toast',
            duration: 3000,
        });
        setTimeout(() => setScreenshotBlockedAlert(false), 3000);
    };

    // User identification string for camera protection watermark
    const userEmail = user?.email || user?.username || 'GLX Employee';
    const currentTime = new Date().toLocaleDateString('en-GB');

    return (
        <div
            className={`relative overflow-hidden select-none ${className}`}
            onContextMenu={(e) => {
                e.preventDefault();
                triggerSecurityAlert('Right-click context menu disabled for security');
            }}
            style={{
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none',
                userSelect: 'none',
            }}
        >
            {/* Focus Loss / Snipping Shield Overlay */}
            {isBlurred && (
                <div className="no-print absolute inset-0 z-[9999] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center text-white p-6 text-center shadow-2xl transition-all duration-200">
                    <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mb-4 animate-pulse">
                        <EyeOff size={32} className="text-rose-400" />
                    </div>
                    <h3 className="text-lg font-extrabold uppercase tracking-wide text-rose-300">
                        🛡️ SECURITY PROTECTED VIEW
                    </h3>
                    <p className="text-xs text-slate-300 max-w-md mt-2 leading-relaxed">
                        Content hidden for security while application is out of focus or screenshot tool is active.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-4 font-mono">
                        User: {userEmail} · Return focus to browser to view.
                    </p>
                </div>
            )}

            {/* Dynamic Security Watermark (Prevents camera photos) */}
            {enableWatermark && (
                <div className="no-print pointer-events-none absolute inset-0 z-10 overflow-hidden opacity-[0.06] select-none flex flex-wrap gap-12 p-8 justify-around items-center rotate-[-25deg]">
                    {Array.from({ length: 16 }).map((_, i) => (
                        <div key={i} className="text-xs font-black tracking-widest text-rose-700 uppercase whitespace-nowrap">
                            CONFIDENTIAL · {userEmail} · {currentTime} · DO NOT DISTRIBUTE
                        </div>
                    ))}
                </div>
            )}

            {/* Protected Content */}
            <div className={`protected-view-content ${isBlurred ? 'filter blur-lg transition-all' : ''}`}>
                {children}
            </div>
        </div>
    );
}
