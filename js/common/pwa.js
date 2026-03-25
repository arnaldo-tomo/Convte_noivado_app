import { storage } from './storage.js';

export const pwa = (() => {

    let deferredPrompt = null;
    let info = null;

    const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isAndroid = () => /Android/.test(navigator.userAgent);
    const isSafari = () => /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    const getPlatform = () => {
        if (isIOS()) return 'ios';
        if (isAndroid()) return 'android';
        return 'desktop';
    };

    const shouldShow = () => {
        if (isStandalone()) return false;
        if (info.get('pwa_installed')) return false;

        const dismissed = info.get('pwa_dismissed_at');
        if (dismissed) {
            const daysSince = (Date.now() - dismissed) / (1000 * 60 * 60 * 24);
            if (daysSince < 7) return false;
        }

        return true;
    };

    const dismiss = () => {
        info.set('pwa_dismissed_at', Date.now());
        hideOverlay();
    };

    const hideOverlay = () => {
        const overlay = document.getElementById('pwa-install-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.classList.add('d-none'), 400);
        }
    };

    const showOverlay = () => {
        if (!shouldShow()) return;

        const overlay = document.getElementById('pwa-install-overlay');
        if (!overlay) return;

        const platform = getPlatform();

        // Show correct instructions
        document.querySelectorAll('.pwa-platform').forEach((el) => el.classList.add('d-none'));
        const platformEl = document.getElementById(`pwa-${platform}`);
        if (platformEl) platformEl.classList.remove('d-none');

        overlay.classList.remove('d-none');
        requestAnimationFrame(() => { overlay.style.opacity = '1'; });
    };

    const installNative = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;

        if (result.outcome === 'accepted') {
            info.set('pwa_installed', true);
            hideOverlay();
        }

        deferredPrompt = null;
    };

    const init = () => {
        info = storage('information');

        // Register service worker
        if ('serviceWorker' in navigator && window.isSecureContext) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        }

        // Capture install prompt (Chrome, Edge, Samsung)
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
        });

        // Detect successful install
        window.addEventListener('appinstalled', () => {
            info.set('pwa_installed', true);
            hideOverlay();
        });

        // Show after user opens invite (3s delay)
        document.addEventListener('undangan.open', () => {
            setTimeout(showOverlay, 3000);
        });
    };

    return {
        init,
        dismiss,
        installNative,
        getPlatform,
        isStandalone,
    };
})();
