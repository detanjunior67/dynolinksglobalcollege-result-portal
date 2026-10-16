(() => {
    const panels = document.querySelectorAll('.ai-liquid-panel');
    if (!panels.length) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const memory = Number(navigator.deviceMemory || 0);
    const cores = Number(navigator.hardwareConcurrency || 0);
    const lowPower = (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4);

    panels.forEach(panel => {
        if (lowPower) panel.classList.add('is-low-power');
        if (reducedMotion) panel.classList.add('is-static-glass');
        if (lowPower || reducedMotion) return;

        let frame = 0;
        let pointerX = 0;
        let pointerY = 0;
        let pointerBubble = null;
        panel.addEventListener('pointermove', event => {
            if (event.pointerType !== 'mouse') return;
            pointerX = event.clientX;
            pointerY = event.clientY;
            const bubble = event.target.closest?.('.cbt-faq-message') || null;
            if (pointerBubble && pointerBubble !== bubble) pointerBubble.classList.remove('is-water-active');
            pointerBubble = bubble;
            if (frame) return;
            frame = requestAnimationFrame(() => {
                const bounds = panel.getBoundingClientRect();
                panel.style.setProperty('--liquid-x', `${pointerX - bounds.left}px`);
                panel.style.setProperty('--liquid-y', `${pointerY - bounds.top}px`);
                panel.classList.add('is-pointer-active');
                if (pointerBubble?.isConnected) {
                    const bubbleBounds = pointerBubble.getBoundingClientRect();
                    pointerBubble.style.setProperty('--bubble-x', `${pointerX - bubbleBounds.left}px`);
                    pointerBubble.style.setProperty('--bubble-y', `${pointerY - bubbleBounds.top}px`);
                    pointerBubble.classList.add('is-water-active');
                }
                frame = 0;
            });
        }, { passive: true });

        panel.addEventListener('pointerleave', () => {
            panel.classList.remove('is-pointer-active');
            pointerBubble?.classList.remove('is-water-active');
            pointerBubble = null;
        }, { passive: true });
        panel.addEventListener('pointerdown', event => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            const bubble = event.target.closest?.('.cbt-faq-message');
            const surface = bubble || panel;
            const bounds = surface.getBoundingClientRect();
            const ripple = document.createElement('span');
            ripple.className = 'ai-liquid-ripple';
            ripple.style.left = `${event.clientX - bounds.left}px`;
            ripple.style.top = `${event.clientY - bounds.top}px`;
            ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
            surface.append(ripple);
        }, { passive: true });
    });
})();