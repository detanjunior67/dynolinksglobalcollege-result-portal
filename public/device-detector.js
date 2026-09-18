/**
 * DYNOLINKS PORTAL - DEVICE DETECTOR & DATABASE LOADER UTILITY
 * High-accuracy phone model detection (iPhone 11, Samsung, Tecno, Infinix, etc.)
 * Modern glassmorphism database contact loader overlay
 * Student photo normalizer and avatar fallback generator
 */

(function () {
    'use strict';

    // ========================================================
    // 1. PHONE & DEVICE MODEL DETECTION DICTIONARIES
    // ========================================================

    const SAMSUNG_MAP = {
        // S Series
        'SM-S928': 'Samsung Galaxy S24 Ultra',
        'SM-S926': 'Samsung Galaxy S24+',
        'SM-S921': 'Samsung Galaxy S24',
        'SM-S918': 'Samsung Galaxy S23 Ultra',
        'SM-S916': 'Samsung Galaxy S23+',
        'SM-S911': 'Samsung Galaxy S23',
        'SM-S908': 'Samsung Galaxy S22 Ultra',
        'SM-S906': 'Samsung Galaxy S22+',
        'SM-S901': 'Samsung Galaxy S22',
        'SM-G998': 'Samsung Galaxy S21 Ultra',
        'SM-G996': 'Samsung Galaxy S21+',
        'SM-G991': 'Samsung Galaxy S21',
        'SM-G990': 'Samsung Galaxy S21 FE',
        'SM-G988': 'Samsung Galaxy S20 Ultra',
        'SM-G986': 'Samsung Galaxy S20+',
        'SM-G981': 'Samsung Galaxy S20',
        'SM-G980': 'Samsung Galaxy S20',
        'SM-G975': 'Samsung Galaxy S10+',
        'SM-G973': 'Samsung Galaxy S10',
        'SM-G970': 'Samsung Galaxy S10e',
        'SM-G965': 'Samsung Galaxy S9+',
        'SM-G960': 'Samsung Galaxy S9',
        // Note Series
        'SM-N986': 'Samsung Galaxy Note 20 Ultra',
        'SM-N985': 'Samsung Galaxy Note 20 Ultra',
        'SM-N981': 'Samsung Galaxy Note 20',
        'SM-N980': 'Samsung Galaxy Note 20',
        'SM-N975': 'Samsung Galaxy Note 10+',
        'SM-N970': 'Samsung Galaxy Note 10',
        'SM-N960': 'Samsung Galaxy Note 9',
        // A Series
        'SM-A556': 'Samsung Galaxy A55 5G',
        'SM-A546': 'Samsung Galaxy A54 5G',
        'SM-A536': 'Samsung Galaxy A53 5G',
        'SM-A528': 'Samsung Galaxy A52s 5G',
        'SM-A526': 'Samsung Galaxy A52 5G',
        'SM-A525': 'Samsung Galaxy A52',
        'SM-A515': 'Samsung Galaxy A51',
        'SM-A505': 'Samsung Galaxy A50',
        'SM-A356': 'Samsung Galaxy A35 5G',
        'SM-A346': 'Samsung Galaxy A34 5G',
        'SM-A336': 'Samsung Galaxy A33 5G',
        'SM-A326': 'Samsung Galaxy A32 5G',
        'SM-A325': 'Samsung Galaxy A32',
        'SM-A256': 'Samsung Galaxy A25 5G',
        'SM-A245': 'Samsung Galaxy A24',
        'SM-A236': 'Samsung Galaxy A23 5G',
        'SM-A235': 'Samsung Galaxy A23',
        'SM-A226': 'Samsung Galaxy A22 5G',
        'SM-A225': 'Samsung Galaxy A22',
        'SM-A156': 'Samsung Galaxy A15 5G',
        'SM-A155': 'Samsung Galaxy A15',
        'SM-A146': 'Samsung Galaxy A14 5G',
        'SM-A145': 'Samsung Galaxy A14',
        'SM-A137': 'Samsung Galaxy A13',
        'SM-A135': 'Samsung Galaxy A13',
        'SM-A127': 'Samsung Galaxy A12 Nacho',
        'SM-A125': 'Samsung Galaxy A12',
        'SM-A115': 'Samsung Galaxy A11',
        'SM-A107': 'Samsung Galaxy A10s',
        'SM-A105': 'Samsung Galaxy A10',
        'SM-A057': 'Samsung Galaxy A05s',
        'SM-A055': 'Samsung Galaxy A05',
        'SM-A047': 'Samsung Galaxy A04s',
        'SM-A045': 'Samsung Galaxy A04',
        'SM-A042': 'Samsung Galaxy A04e',
        'SM-A037': 'Samsung Galaxy A03s',
        'SM-A035': 'Samsung Galaxy A03',
        'SM-A032': 'Samsung Galaxy A03 Core',
        'SM-A025': 'Samsung Galaxy A02s',
        'SM-A022': 'Samsung Galaxy A02',
        // M Series
        'SM-M546': 'Samsung Galaxy M54 5G',
        'SM-M346': 'Samsung Galaxy M34 5G',
        'SM-M146': 'Samsung Galaxy M14 5G',
        'SM-M135': 'Samsung Galaxy M13',
        // Z Flip / Fold
        'SM-F946': 'Samsung Galaxy Z Fold 5',
        'SM-F731': 'Samsung Galaxy Z Flip 5',
        'SM-F936': 'Samsung Galaxy Z Fold 4',
        'SM-F721': 'Samsung Galaxy Z Flip 4'
    };

    const TECNO_MAP = {
        'CL8': 'Tecno Camon 30 Premier',
        'CL7': 'Tecno Camon 30 Pro',
        'CL6': 'Tecno Camon 30',
        'CK8': 'Tecno Camon 20 Premier',
        'CK7': 'Tecno Camon 20 Pro',
        'CK6': 'Tecno Camon 20',
        'CI8': 'Tecno Camon 19 Pro',
        'CI6': 'Tecno Camon 19',
        'CH9': 'Tecno Camon 18 Premier',
        'CH7': 'Tecno Camon 18P',
        'CH6': 'Tecno Camon 18',
        'BG7': 'Tecno Spark 20 Pro',
        'BG6': 'Tecno Spark 20',
        'KJ5': 'Tecno Spark 20C',
        'KI7': 'Tecno Spark 10 Pro',
        'KI5': 'Tecno Spark 10',
        'KH7': 'Tecno Spark 9 Pro',
        'KH6': 'Tecno Spark 9',
        'KG7': 'Tecno Spark 8 Pro',
        'KG6': 'Tecno Spark 8P',
        'KG5': 'Tecno Spark 8C',
        'KF6': 'Tecno Spark 7',
        'BG5': 'Tecno Pop 8',
        'BF7': 'Tecno Pop 7',
        'BE7': 'Tecno Pop 6',
        'BD4': 'Tecno Pop 5',
        'LI7': 'Tecno Pova 6 Pro',
        'LH7': 'Tecno Pova 5 Pro'
    };

    const INFINIX_MAP = {
        'X6837': 'Infinix Hot 40 Pro',
        'X6836': 'Infinix Hot 40',
        'X6833': 'Infinix Hot 30i',
        'X6831': 'Infinix Hot 30',
        'X6817': 'Infinix Hot 12',
        'X6816': 'Infinix Hot 12 Play',
        'X6812': 'Infinix Hot 11S',
        'X662': 'Infinix Hot 11',
        'X689': 'Infinix Hot 10S',
        'X688': 'Infinix Hot 10 Play',
        'X682': 'Infinix Hot 9',
        'X6716': 'Infinix Note 30',
        'X676': 'Infinix Note 12',
        'X670': 'Infinix Note 11',
        'X6525': 'Infinix Smart 8',
        'X6515': 'Infinix Smart 7',
        'X6511': 'Infinix Smart 6',
        'X657': 'Infinix Smart 5'
    };

    function getGpuRenderer() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return '';
            const ext = gl.getExtension('WEBGL_debug_renderer_info');
            return ext ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';
        } catch (_) {
            return '';
        }
    }

    // High accuracy iPhone model detection matrix
    function detectIPhoneModel() {
        const ua = navigator.userAgent || '';
        if (!/iPhone/i.test(ua)) return null;

        const screen = window.screen || {};
        const width = screen.width || 0;
        const height = screen.height || 0;
        const dpr = window.devicePixelRatio || 1;
        const min = Math.min(width, height);
        const max = Math.max(width, height);
        const physW = Math.round(min * dpr);
        const physH = Math.round(max * dpr);
        const gpu = getGpuRenderer();

        // 1. iPhone 11 vs iPhone XR (414 x 896 @2x DPR -> physical 828 x 1792)
        if ((min === 414 && max === 896 && dpr === 2) || (physW === 828 && physH === 1792)) {
            if (/A13/i.test(gpu)) return 'iPhone 11';
            if (/A12/i.test(gpu)) return 'iPhone XR';
            return 'iPhone 11';
        }

        // 2. iPhone 11 Pro / XS / X / 12 mini / 13 mini (375 x 812 @3x DPR -> physical 1125 x 2436)
        if ((min === 375 && max === 812 && dpr === 3) || (physW === 1125 && physH === 2436)) {
            if (/A13/i.test(gpu)) return 'iPhone 11 Pro';
            if (/A12/i.test(gpu)) return 'iPhone XS';
            if (/A11/i.test(gpu)) return 'iPhone X';
            if (/A14/i.test(gpu)) return 'iPhone 12 mini';
            if (/A15/i.test(gpu)) return 'iPhone 13 mini';
            return 'iPhone 11 Pro';
        }

        // 3. iPhone 11 Pro Max / XS Max (414 x 896 @3x DPR -> physical 1242 x 2688)
        if ((min === 414 && max === 896 && dpr === 3) || (physW === 1242 && physH === 2688)) {
            if (/A13/i.test(gpu)) return 'iPhone 11 Pro Max';
            if (/A12/i.test(gpu)) return 'iPhone XS Max';
            return 'iPhone 11 Pro Max';
        }

        // 4. iPhone 12 / 12 Pro / 13 / 13 Pro / 14 (390 x 844 @3x DPR -> physical 1170 x 2532)
        if ((min === 390 && max === 844 && dpr === 3) || (physW === 1170 && physH === 2532)) {
            if (/A14/i.test(gpu)) return 'iPhone 12 / 12 Pro';
            if (/A15/i.test(gpu)) return 'iPhone 13 / 14';
            if (/A16/i.test(gpu)) return 'iPhone 14';
            return 'iPhone 12 / 13 / 14';
        }

        // 5. iPhone 12 Pro Max / 13 Pro Max / 14 Plus (428 x 926 @3x DPR -> physical 1284 x 2778)
        if ((min === 428 && max === 926 && dpr === 3) || (physW === 1284 && physH === 2778)) {
            if (/A14/i.test(gpu)) return 'iPhone 12 Pro Max';
            if (/A15/i.test(gpu)) return 'iPhone 13 Pro Max / 14 Plus';
            return 'iPhone 12 / 13 Pro Max';
        }

        // 6. iPhone 14 Pro / 15 / 15 Pro / 16 (393 x 852 @3x DPR -> physical 1179 x 2556)
        if ((min === 393 && max === 852 && dpr === 3) || (physW === 1179 && physH === 2556)) {
            if (/A16/i.test(gpu)) return 'iPhone 14 Pro / 15';
            if (/A17/i.test(gpu)) return 'iPhone 15 Pro';
            if (/A18/i.test(gpu)) return 'iPhone 16 / 16 Pro';
            return 'iPhone 14 Pro / 15';
        }

        // 7. iPhone 14 Pro Max / 15 Plus / 15 Pro Max / 16 Plus (430 x 932 @3x DPR -> physical 1290 x 2796)
        if ((min === 430 && max === 932 && dpr === 3) || (physW === 1290 && physH === 2796)) {
            if (/A16/i.test(gpu)) return 'iPhone 14 Pro Max / 15 Plus';
            if (/A17/i.test(gpu)) return 'iPhone 15 Pro Max';
            if (/A18/i.test(gpu)) return 'iPhone 16 Plus / Pro Max';
            return 'iPhone 15 Pro Max / 16 Plus';
        }

        // 8. iPhone 16 Pro
        if (min === 402 && max === 874) return 'iPhone 16 Pro';
        // 9. iPhone 16 Pro Max
        if (min === 440 && max === 956) return 'iPhone 16 Pro Max';

        // 10. iPhone SE / 8 / 7 (375 x 667 @2x DPR -> physical 750 x 1334)
        if ((min === 375 && max === 667 && dpr === 2) || (physW === 750 && physH === 1334)) {
            return 'iPhone SE / iPhone 8 / 7';
        }

        // 11. iPhone 8 Plus / 7 Plus (414 x 736 @3x DPR -> physical 1242 x 2208)
        if ((min === 414 && max === 736 && dpr === 3) || (physW === 1242 && physH === 2208)) {
            return 'iPhone 8 Plus / 7 Plus';
        }

        return 'Apple iPhone';
    }

    function decodeAndroidModel(raw) {
        if (!raw) return 'Android Phone';
        const clean = String(raw).trim();

        // Samsung
        for (const [code, name] of Object.entries(SAMSUNG_MAP)) {
            if (clean.toUpperCase().startsWith(code.toUpperCase())) {
                return `${name} (${clean})`;
            }
        }
        if (/^SM-[A-Z0-9]+/i.test(clean)) {
            return `Samsung Galaxy (${clean})`;
        }

        // Tecno
        for (const [code, name] of Object.entries(TECNO_MAP)) {
            if (clean.toUpperCase().includes(code.toUpperCase())) {
                return `${name} (${clean})`;
            }
        }
        if (/^TECNO\s*/i.test(clean)) {
            return clean;
        }

        // Infinix
        for (const [code, name] of Object.entries(INFINIX_MAP)) {
            if (clean.toUpperCase().includes(code.toUpperCase())) {
                return `${name} (${clean})`;
            }
        }
        if (/^Infinix\s*/i.test(clean)) {
            return clean;
        }

        // Google Pixel
        if (/Pixel\s*[0-9a-zA-Z\s]+/i.test(clean)) {
            return `Google ${clean}`;
        }

        // Xiaomi / Redmi / POCO
        if (/Redmi|POCO|Xiaomi|Mi\s*/i.test(clean)) {
            return clean;
        }

        return clean;
    }

    async function detectExactDevice() {
        const ua = navigator.userAgent || '';
        let exactModel = '';
        let brand = '';
        let os = '';
        let browser = '';
        let deviceType = 'Desktop';

        // 1. Check if iPhone
        const iphone = detectIPhoneModel();
        if (iphone) {
            exactModel = iphone;
            brand = 'Apple';
            deviceType = 'Mobile Phone';
            const iosMatch = ua.match(/iPhone OS ([0-9_]+)/i);
            os = iosMatch ? `iOS ${iosMatch[1].replace(/_/g, '.')}` : 'iOS';
            browser = /Version\/([0-9.]+).*Safari/i.test(ua) ? `Safari Mobile ${ua.match(/Version\/([0-9.]+)/i)[1]}` : 'Safari Mobile';
            return {
                exactModel,
                brand,
                model: exactModel,
                os,
                browser,
                deviceType,
                isMobile: true,
                screen: `${window.screen.width}x${window.screen.height} (dpr ${window.devicePixelRatio || 1})`
            };
        }

        // 2. Check iPad
        if (/iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
            exactModel = 'Apple iPad';
            brand = 'Apple';
            deviceType = 'Tablet';
            os = 'iPadOS';
            browser = 'Safari Mobile';
            return {
                exactModel,
                brand,
                model: exactModel,
                os,
                browser,
                deviceType,
                isMobile: true,
                screen: `${window.screen.width}x${window.screen.height}`
            };
        }

        // 3. Check Android with Client Hints or UA
        if (/Android/i.test(ua)) {
            deviceType = 'Mobile Phone';
            const androidVerMatch = ua.match(/Android ([0-9.]+)/i);
            os = androidVerMatch ? `Android ${androidVerMatch[1]}` : 'Android';

            let rawModel = '';
            if (navigator.userAgentData && typeof navigator.userAgentData.getHighEntropyValues === 'function') {
                try {
                    const hints = await navigator.userAgentData.getHighEntropyValues(['model', 'platform', 'platformVersion']);
                    if (hints && hints.model) {
                        rawModel = hints.model;
                    }
                } catch (_) {}
            }

            if (!rawModel) {
                const match = ua.match(/Android [^;]+;\s*([^;)]+?)(?:\s+Build|\s*;|\))/i);
                if (match && match[1]) {
                    rawModel = match[1].trim();
                }
            }

            exactModel = decodeAndroidModel(rawModel);
            if (/Samsung/i.test(exactModel)) brand = 'Samsung';
            else if (/Tecno/i.test(exactModel)) brand = 'Tecno';
            else if (/Infinix/i.test(exactModel)) brand = 'Infinix';
            else if (/Google/i.test(exactModel)) brand = 'Google';
            else if (/Xiaomi|Redmi|POCO/i.test(exactModel)) brand = 'Xiaomi';
            else brand = 'Android';

            if (/Chrome\/([0-9.]+)/i.test(ua)) browser = `Chrome ${ua.match(/Chrome\/([0-9.]+)/i)[1].split('.')[0]}`;
            else if (/Firefox\/([0-9.]+)/i.test(ua)) browser = 'Firefox Mobile';
            else browser = 'Mobile Browser';

            return {
                exactModel,
                brand,
                model: rawModel || exactModel,
                os,
                browser,
                deviceType,
                isMobile: true,
                screen: `${window.screen.width}x${window.screen.height}`
            };
        }

        // 4. Desktop Platforms
        if (/Windows NT 10.0/i.test(ua)) {
            exactModel = 'Windows 10 / 11 PC';
            brand = 'PC';
            os = 'Windows 11 / 10';
            deviceType = 'Desktop PC';
        } else if (/Mac OS X/i.test(ua)) {
            exactModel = 'Apple Mac';
            brand = 'Apple';
            os = 'macOS';
            deviceType = 'Mac Computer';
        } else if (/Linux/i.test(ua)) {
            exactModel = 'Linux Desktop';
            brand = 'PC';
            os = 'Linux';
            deviceType = 'Desktop';
        } else {
            exactModel = navigator.platform || 'Desktop Computer';
            brand = 'Desktop';
            os = 'Desktop OS';
        }

        if (/Edg\/([0-9.]+)/i.test(ua)) browser = `Edge ${ua.match(/Edg\/([0-9.]+)/i)[1].split('.')[0]}`;
        else if (/Chrome\/([0-9.]+)/i.test(ua)) browser = `Chrome ${ua.match(/Chrome\/([0-9.]+)/i)[1].split('.')[0]}`;
        else if (/Firefox\/([0-9.]+)/i.test(ua)) browser = `Firefox ${ua.match(/Firefox\/([0-9.]+)/i)[1].split('.')[0]}`;
        else if (/Safari/i.test(ua)) browser = 'Safari';
        else browser = 'Web Browser';

        return {
            exactModel,
            brand,
            model: exactModel,
            os,
            browser,
            deviceType,
            isMobile: false,
            screen: `${window.screen.width}x${window.screen.height}`
        };
    }

    // ========================================================
    // 2. FANCY & SMOOTH DATABASE LOADER OVERLAY
    // ========================================================

    let loaderTimeout = null;
    let loaderShownAt = 0;
    const MIN_LOADER_DURATION_MS = 80;

    function ensureLoaderDom() {
        if (document.getElementById('dgcGlobalLoader')) return;

        // Ensure stylesheet is loaded
        if (!document.querySelector('link[href*="dgc-loader.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/dgc-loader.css';
            document.head.appendChild(link);
        }

        const overlay = document.createElement('div');
        overlay.id = 'dgcGlobalLoader';
        overlay.className = 'dgc-loader-overlay';
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-live', 'polite');
        overlay.innerHTML = `
            <div class="dgc-loader-card">
                <div class="dgc-spinner-wrapper">
                    <div class="dgc-spinner-ring dgc-ring-outer"></div>
                    <div class="dgc-spinner-ring dgc-ring-middle"></div>
                    <div class="dgc-spinner-core">
                        <i class="fa-solid fa-graduation-cap"></i>
                    </div>
                </div>
                <div class="dgc-loader-text">
                    <h4 id="dgcLoaderTitle" class="dgc-loader-title">Connecting to Database...</h4>
                    <p id="dgcLoaderSubtitle" class="dgc-loader-subtitle">Please wait while we securely process your request</p>
                </div>
                <div class="dgc-loader-progress-bar">
                    <div class="dgc-loader-progress-shimmer"></div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    function showDatabaseLoader(title, subtitle) {
        ensureLoaderDom();
        const overlay = document.getElementById('dgcGlobalLoader');
        const titleEl = document.getElementById('dgcLoaderTitle');
        const subtitleEl = document.getElementById('dgcLoaderSubtitle');

        if (titleEl) titleEl.textContent = title || 'Connecting to Database...';
        if (subtitleEl) subtitleEl.textContent = subtitle || 'Please wait while we securely process your request';

        if (loaderTimeout) {
            clearTimeout(loaderTimeout);
            loaderTimeout = null;
        }

        loaderShownAt = Date.now();

        // Force reflow and activate smoothly
        if (overlay) {
            overlay.classList.add('active');
        }

        // Auto-safety release after 30s to prevent trapped state
        loaderTimeout = setTimeout(() => {
            hideDatabaseLoader(true);
        }, 30000);
    }

    function hideDatabaseLoader(immediate = false) {
        const overlay = document.getElementById('dgcGlobalLoader');
        if (!overlay) return;

        const performHide = () => {
            overlay.classList.remove('active');
            if (loaderTimeout) {
                clearTimeout(loaderTimeout);
                loaderTimeout = null;
            }
        };

        if (immediate) {
            performHide();
            return;
        }

        // Guarantee minimum display time to prevent jarring flicker
        const elapsed = Date.now() - loaderShownAt;
        if (elapsed < MIN_LOADER_DURATION_MS) {
            setTimeout(performHide, MIN_LOADER_DURATION_MS - elapsed);
        } else {
            performHide();
        }
    }

    async function withDatabaseLoader(action, title, subtitle) {
        showDatabaseLoader(title, subtitle);
        try {
            if (typeof action === 'function') {
                return await action();
            }
            return await action;
        } finally {
            hideDatabaseLoader();
        }
    }

    // ========================================================
    // 3. STUDENT PICTURE NORMALIZER & AVATAR GENERATOR
    // ========================================================

    const STUDENT_PHOTO_FOLDER = '/stud-data/';

    function normalizeStudentPicturePath(value) {
        const trimmed = String(value || '').trim();
        if (!trimmed) return '';
        if (/^(https?:\/\/|data:)/i.test(trimmed)) return trimmed;

        const cleaned = trimmed
            .replace(/\\/g, '/')
            .replace(/^\/+/, '')
            .replace(/^public\//i, '')
            .replace(/^stud-data\//i, '')
            .replace(/^\.\//, '')
            .replace(/\/+/g, '/');

        const filename = cleaned.split('/').pop() || cleaned;
        if (!filename) return '';

        const normalizedName = filename.toLowerCase();
        if (/\.(jpg|jpeg|png|webp|gif)$/i.test(normalizedName)) {
            return STUDENT_PHOTO_FOLDER + normalizedName;
        }

        return STUDENT_PHOTO_FOLDER + normalizedName + '.jpg';
    }

    function createStudentInitialsAvatar(name, size = 128) {
        const cleanName = String(name || '').trim();
        const parts = cleanName.split(/\s+/).filter(Boolean);
        let initials = 'ST';
        if (parts.length >= 2) {
            initials = (parts[0][0] + parts[1][0]).toUpperCase();
        } else if (parts.length === 1 && parts[0].length >= 1) {
            initials = parts[0].slice(0, 2).toUpperCase();
        }

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#0284c7" />
                    <stop offset="100%" stop-color="#1e40af" />
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" rx="${Math.round(size * 0.22)}" fill="url(#grad)"/>
            <text x="50%" y="54%" font-family="system-ui, -apple-system, sans-serif" font-size="${Math.round(size * 0.4)}" font-weight="800" fill="#ffffff" dominant-baseline="middle" text-anchor="middle" letter-spacing="1">${initials}</text>
        </svg>`;

        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }

    function attachStudentPhoto(imgElement, picturePath, studentName) {
        if (!imgElement) return;
        const normalized = normalizeStudentPicturePath(picturePath);
        const fallbackAvatar = createStudentInitialsAvatar(studentName);

        imgElement.crossOrigin = 'anonymous';
        imgElement.onerror = function () {
            this.onerror = null;
            this.src = fallbackAvatar;
        };

        if (normalized) {
            imgElement.src = normalized;
        } else {
            imgElement.src = fallbackAvatar;
        }
        imgElement.style.display = 'block';
    }

    // Expose helpers globally
    window.getDeviceFingerprint = detectExactDevice;
    window.showDatabaseLoader = showDatabaseLoader;
    window.hideDatabaseLoader = hideDatabaseLoader;
    window.withDatabaseLoader = withDatabaseLoader;
    window.normalizeStudentPicturePath = normalizeStudentPicturePath;
    window.createStudentInitialsAvatar = createStudentInitialsAvatar;
    window.attachStudentPhoto = attachStudentPhoto;

    // Ensure DOM is ready for loader insertion
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureLoaderDom);
    } else {
        ensureLoaderDom();
    }
})();
