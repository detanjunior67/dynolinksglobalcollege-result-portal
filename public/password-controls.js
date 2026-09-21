(function () {
    'use strict';

    function addPasswordToggle(input) {
        if (!input || input.dataset.passwordControlReady === 'true') return;
        if (input.parentElement?.classList.contains('cbt-password-wrap') || input.parentElement?.querySelector('.cbt-password-toggle')) return;
        input.dataset.passwordControlReady = 'true';

        const wrapper = document.createElement('span');
        wrapper.className = 'password-control-wrap';
        wrapper.style.cssText = 'display:flex;align-items:stretch;width:100%;max-width:100%;position:relative;min-width:0;';
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);
        input.style.flex = '1 1 0';
        input.style.minWidth = '0';
        input.style.width = 'auto';
        input.style.paddingRight = '';

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'password-control-toggle';
        toggle.textContent = 'Show';
        toggle.setAttribute('aria-label', 'Show password');
        toggle.style.cssText = 'position:static;flex:0 0 auto;align-self:center;margin-left:6px;border:0;border-radius:8px;padding:6px 9px;background:rgba(37,99,235,.1);color:#1d4ed8;font:inherit;font-size:.75rem;font-weight:800;cursor:pointer;white-space:nowrap;z-index:2;';
        toggle.addEventListener('click', function () {
            const isHidden = input.type === 'password';
            input.type = isHidden ? 'text' : 'password';
            toggle.textContent = isHidden ? 'Hide' : 'Show';
            toggle.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
        });
        wrapper.appendChild(toggle);
    }

    function submitPasswordInput(input) {
        const form = input.closest('form');
        if (form) {
            if (typeof form.requestSubmit === 'function') form.requestSubmit();
            else form.submit();
            return true;
        }

        const actions = {
            adminPass: 'verifyAdmin',
            studentDataPassword: 'unlockStudentData',
            cbtAccessPassword: 'submitCBTAccessForm',
            adminPassInput: 'verifyAdminPass',
            studentPasswordInput: 'prepareStudentExam',
            deleteAdminPassword: 'submitDeletePassword'
        };
        const actionName = actions[input.id];
        if (actionName && typeof window[actionName] === 'function') {
            window[actionName]();
            return true;
        }

        if (input.classList.contains('student-cbt-password-input')) {
            const saveButton = input.closest('tr')?.querySelector('.student-cbt-save-btn');
            if (saveButton) saveButton.click();
            return true;
        }

        if (input.id === 'studentPasswordManagerNew' || input.id === 'studentPasswordManagerConfirm') {
            if (typeof window.saveStudentPasswordFromAdminIndex === 'function') {
                window.saveStudentPasswordFromAdminIndex();
                return true;
            }
        }
        return false;
    }

    function enhancePasswordControls(root) {
        const scope = root && root.querySelectorAll ? root : document;
        scope.querySelectorAll('input[type="password"]').forEach(addPasswordToggle);
    }

    document.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' || event.defaultPrevented) return;
        const input = event.target;
        if (!input || input.tagName !== 'INPUT' || input.type !== 'password') return;
        if (submitPasswordInput(input)) event.preventDefault();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            enhancePasswordControls(document);
            observePasswordControls();
        });
    } else {
        enhancePasswordControls(document);
        observePasswordControls();
    }

    function observePasswordControls() {
        if (!window.MutationObserver) return;
        const observer = new MutationObserver(function (mutations) {
            mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    if (node.matches?.('input[type="password"]')) addPasswordToggle(node);
                    enhancePasswordControls(node);
                }
            }));
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
})();
