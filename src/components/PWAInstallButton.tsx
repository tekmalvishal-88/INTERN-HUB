import React, { useState } from 'react';
import { Check, Copy, Download, ExternalLink, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (isInstalled) return null;

  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const handleCopyUrl = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(currentOrigin).then(() => {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      });
    }
  };

  return (
    <>
      {isInstallable ? (
        <button
          type="button"
          onClick={() => void install()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#12203a] dark:bg-[#2f5bea] text-white text-xs font-bold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          title="Install as mobile/desktop app or package APK"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] hover:border-[#2f5bea] text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#2f5bea] dark:text-[#7a9bff]" />
          <span className="hidden sm:inline">App / APK</span>
        </button>
      )}

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#2f5bea] dark:text-[#7a9bff]" />
                <h3 className="text-base font-bold">Install InternHub / Export Android APK</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded-lg text-[#5b6b86] hover:bg-[#f3f6fb] dark:hover:bg-[#16213a] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] leading-relaxed">
                On iPhone/iPad Safari: tap the <strong>Share</strong> icon in the toolbar, then tap{' '}
                <strong>Add to Home Screen</strong> to launch InternHub as a full-screen mobile app.
              </p>
            ) : (
              <div className="space-y-3 text-xs text-[#5b6b86] dark:text-[#9fb0cc] leading-relaxed">
                <p>
                  <strong>1. Instant Android Install (No Download Wait):</strong> Open this app in Chrome on Android and tap{' '}
                  <strong>⋮ → Add to Home screen / Install App</strong> to install InternHub natively on your phone.
                </p>
                <div className="p-3 rounded-xl bg-[#f3f6fb] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] space-y-2">
                  <p className="font-bold text-[#12203a] dark:text-[#e8eefc]">
                    2. Generate Signed Android .APK via PWABuilder:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={currentOrigin}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] font-mono text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] text-[#12203a] dark:text-[#e8eefc] font-bold hover:border-[#2f5bea] cursor-pointer whitespace-nowrap"
                    >
                      {copiedUrl ? <Check className="w-3.5 h-3.5 text-[#12805f]" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <a
                    href={`https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(currentOrigin)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-[#12805f] hover:opacity-90 text-white font-bold transition-opacity"
                  >
                    <span>Package .APK on PWABuilder</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <p>
                  <strong>3. Local Capacitor Build (From ZIP):</strong> Run <code>npm run build</code>, then <code>npx cap add android</code> and build the <code>.apk</code> in Android Studio.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl bg-[#2f5bea] text-white text-xs font-bold cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-5 left-5 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline Mode — Using cached local data</span>
    </div>
  );
};
