/**
 * DYNOLINKS PORTAL - DEVICE DETECTOR & DATABASE LOADER UTILITY
 * High-accuracy phone model detection (iPhone 11, Samsung, Tecno, Infinix, etc.)
 * Fancy & smooth database contact loader overlay
 */

(function () {
    'use strict';

    // ========================================================
    // 1. EXACT PHONE & DEVICE MODEL DETECTION
    // ========================================================

    const SAMSUNG_MAP = {
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
        'SM-N986': 'Samsung Galaxy Note 20 Ultra',
        'SM-N985': 'Samsung Galaxy Note 20 Ultra',
        'SM-N981': 'Samsung Galaxy Note 20',
        'SM-N980': 'Samsung Galaxy Note 20',
        'SM-N975': 'Samsung Galaxy Note 10+',
        'SM-N970': 'Samsung Galaxy Note 10',
        'SM-A546': 'Samsung Galaxy A54 5G',
        'SM-A536': 'Samsung Galaxy A53 5G',
        'SM-A528': 'Samsung Galaxy A52s 5G',
        'SM-A526': 'Samsung Galaxy A52 5G',
        'SM-A525': 'Samsung Galaxy A52',
        'SM-A515': 'Samsung Galaxy A51',
        'SM-A505': 'Samsung Galaxy A50',
        'SM-A346': 'Samsung Galaxy A34 5G',
        'SM-A336': 'Samsung Galaxy A33 5G',
        'SM-A326': 'Samsung Galaxy A32 5G',
        'SM-A325': 'Samsung Galaxy A32',
        'SM-A245': 'Samsung Galaxy A24',
        'SM-A235': 'Samsung Galaxy A23',
        'SM-A236': 'Samsung Galaxy A23 5G',
        'SM-A225': 'Samsung Galaxy A22',
        'SM-A226': 'Samsung Galaxy A22 5G',
        'SM-A155': 'Samsung Galaxy A15',
        'SM-A156': 'Samsung Galaxy A15 5G',
        'SM-A145': 'Samsung Galaxy A14',
        'SM-A146': 'Samsung Galaxy A14 5G',
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
        'SM-A035': 'Samsung Galaxy A03',
        'SM-A032': 'Samsung Galaxy A03 Core',
        'SM-A025': 'Samsung Galaxy A02s',
        'SM-A022': 'Samsung Galaxy A02'
    };

    const TECNO_MAP = {
        'CK7': 'Tecno Camon 20 Pro',
        'CK8': 'Tecno Camon 20 Premier',
        'CK6': 'Tecno Camon 20',
        'CI6': 'Tecno Camon 19',
        'CI8': 'Tecno Camon 19 Pro',
        'CH6': 'Tecno Camon 18',
        'CH7': 'Tecno Camon 18P',
        'CH9': 'Tecno Camon 18 Premier',
        'BG6': 'Tecno Spark 20',
        'BG7': 'Tecno Spark 20 Pro',
        'KI5': 'Tecno Spark 10',
        'KI7': 'Tecno Spark 10 Pro',
        'KG5': 'Tecno Spark 8C',
        'KG6': 'Tecno Spark 8P',
        'KF6': 'Tecno Spark 7',
        'BF7': 'Tecno Pop 7',
        'BG5': 'Tecno Pop 8',
        'BD4': 'Tecno Pop 5',
        'LH7': 'Tecno Pova 5 Pro'
    };

    const INFINIX_MAP = {
        'X6831': 'Infinix Hot 30',
        'X6833': 'Infinix Hot 30i',
        'X6816': 'Infinix Hot 12 Play',
        'X6817': 'Infinix Hot 12',
        'X688': 'Infinix Hot 10 Play',
        'X689': 'Infinix Hot 10S',
        'X682': 'Infinix Hot 9',
        'X676': 'Infinix Note 12',
        'X670': 'Infinix Note 11',
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

        // iPhone 11 / XR: 414 x 896 @2x -> 828 x 1792
        if ((min === 414 && max === 896 && dpr === 2) || (physW === 828 && physH === 1792)) {
            if (/A13/i.test(gpu)) return 'iPhone 11';
            if (/A12/i.test(gpu)) return 'iPhone XR';
            return 'iPhone 11';
        }

        // iPhone 11 Pro / XS / X / 12 mini / 13 mini: 375 x 812 @3x -> 1125 x 2436
        if ((min === 375 && max === 812 && dpr === 3) || (physW === 1125 && physH === 2436)) {
            if (/A13/i.test(gpu)) return 'iPhone 11 Pro';
            if (/A12/i.test(gpu)) return 'iPhone XS';
            if (/A11/i.test(gpu)) return 'iPhone X';
            if (/A14/i.test(gpu)) return 'iPhone 12 mini';
            if (/A15/i.test(gpu)) return 'iPhone 13 mini';
            return 'iPhone 11 Pro';
        }

        // iPhone 11 Pro Max / XS Max: 414 x 896 @3x -> 1242 x 2688
        if ((min === 414 && max === 896 && dpr === 3) || (physW === 1242 && physH === 2688)) {
            if (/A13/i.test(gpu)) return 'iPhone 11 Pro Max';
            if (/A12/i.test(gpu)) return 'iPhone XS Max';
            return 'iPhone 11 Pro Max';
        }

        // iPhone 12 / 12 Pro / 13 / 13 Pro / 14: 390 x 844 @3x -> 1170 x 2532
        if ((min === 390 && max === 844 && dpr === 3) || (physW === 1170 && physH === 2532)) {
            if (/A14/i.test(gpu)) return 'iPhone 12 / 12 Pro';
            if (/A15/i.test(gpu)) return 'iPhone 13 / 14';
            return 'iPhone 12 / 13 / 14';
        }

        // iPhone 12 Pro Max / 13 Pro Max / 14 Plus: 428 x 926 @3x -> 1284 x 2778
        if ((min === 428 && max === 926 && dpr === 3) || (physW === 1284 && physH === 2778)) {
            if (/A14/i.test(gpu)) return 'iPhone 12 Pro Max';
            if (/A15/i.test(gpu)) return 'iPhone 13 Pro Max / 14 Plus';
            return 'iPhone 12 / 13 Pro Max';
        }

        // iPhone 14 Pro / 15 / 15 Pro / 16: 393 x 852 @3x -> 1179 x 2556
        if ((min === 393 && max === 852 && dpr === 3) || (physW === 1179 && physH === 2556)) {
            if (/A17/i.test(gpu)) return 'iPhone 15 Pro';
            if (/A18/i.test(gpu)) return 'iPhone 16 / 16 Pro';
            return 'iPhone 14 Pro / 15';
        }

        // iPhone 14 Pro Max / 15 Plus / 15 Pro Max / 16 Plus: 430 x 932 @3x -> 1290 x 2796
        if ((min === 430 && max === 932 && dpr === 3) || (physW === 1290 && physH === 2796)) {
            if (/A17/i.test(gpu)) return 'iPhone 15 Pro Max';
            if (/A18/i.test(gpu)) return 'iPhone 16 Plus / Pro Max';
            return 'iPhone 14 Pro Max / 15 Pro Max';
        }

        // iPhone 16 Pro
        if (min === 402 && max === 874) return 'iPhone 16 Pro';
        // iPhone 16 Pro Max
        if (min === 440 && max === 956) return 'iPhone 16 Pro Max';

        // iPhone 6 / 7 / 8 / SE
        if ((min === 375 && max === 667 && dpr === 2) || (physW === 750 && physH === 1334)) {
            return 'iPhone SE / iPhone 8 / 7';
        }

        // iPhone 8 Plus / 7 Plus / 6s Plus
        if ((min === 414 && max === 736 && dpr === 3) || (physW === 1242 && physH === 2208)) {
            return 'iPhone 8 Plus / 7 Plus';
        }

        return 'Apple iPhone';
    }

    function decodeAndroidModel(raw) {
        if (!raw) return 'Android Phone';
        const clean = raw.trim();

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

        // Xiaomi / Redmi
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
            deviceType = 'Mobile';
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
            deviceType = 'Mobile';
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
            else if (/Xiaomi|Redmi/i.test(exactModel)) brand = 'Xiaomi';
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

        if (loaderTimeout) clearTimeout(loaderTimeout);

        // Force reflow and activate smoothly
        overlay.classList.add('active');

        // Auto-safety release after 30s to prevent trapped state
        loaderTimeout = setTimeout(() => {
            hideDatabaseLoader();
        }, 30000);
    }

    function hideDatabaseLoader() {
        const overlay = document.getElementById('dgcGlobalLoader');
        if (overlay) {
            overlay.classList.remove('active');
        }
        if (loaderTimeout) {
            clearTimeout(loaderTimeout);
            loaderTimeout = null;
        }
    }

    // ========================================================
    // 3. STUDENT PICTURE NORMALIZER
    // ========================================================

    const STUDENT_PHOTO_FOLDER = '/stud-data/';

    function normalizeStudentPicturePath(value) {
        const trimmed = String(value || '').trim();
        if (!trimmed) return '';
        if (/^(https?:\/\/|data:|\/)/i.test(trimmed)) return trimmed;
        return STUDENT_PHOTO_FOLDER + trimmed.replace(/^\.?\/+/, '');
    }

    // Expose helpers globally
    window.getDeviceFingerprint = detectExactDevice;
    window.showDatabaseLoader = showDatabaseLoader;
    window.hideDatabaseLoader = hideDatabaseLoader;
    window.normalizeStudentPicturePath = normalizeStudentPicturePath;

    // Ensure DOM is ready for loader insertion
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureLoaderDom);
    } else {
        ensureLoaderDom();
    }
})();
