(() => {
    const panel = document.getElementById('cbtFaqPanel');
    const toggle = document.getElementById('cbtFaqToggle');
    const close = document.getElementById('cbtFaqClose');
    const form = document.getElementById('cbtFaqForm');
    const input = document.getElementById('cbtFaqInput');
    const messages = document.getElementById('cbtFaqMessages');
    const typing = document.getElementById('cbtFaqTyping');
    const send = document.getElementById('cbtFaqSend');

    if (!panel || !toggle || !close || !form || !input || !messages || !typing || !send) return;

    function setOpen(isOpen) {
        panel.classList.toggle('hidden', !isOpen);
        panel.classList.toggle('flex', isOpen);
        panel.setAttribute('aria-hidden', String(!isOpen));
        toggle.setAttribute('aria-expanded', String(isOpen));
        if (isOpen) input.focus();
        else toggle.focus();
    }

    function appendMathNotation(parent, text) {
        const normalized = String(text)
            .replace(/\$\$?([\s\S]*?)\$\$?/g, '$1')
            .replace(/\\\(([\s\S]*?)\\\)/g, '$1')
            .replace(/\\\[([\s\S]*?)\\\]/g, '$1');
        const notationPattern = /(\\sqrt\{[^{}]*\}|\\frac\{[^{}]*\}\{[^{}]*\}|\\(?:times|cdot|div|pm|leq?|geq?|neq|approx|pi|theta|alpha|beta|infty)|\^\{[^{}]*\}|_\{[^{}]*\}|\^[A-Za-z0-9+-]|_[A-Za-z0-9]+)/g;
        const symbols = {
            '\\times': '×',
            '\\cdot': '·',
            '\\div': '÷',
            '\\pm': '±',
            '\\le': '≤',
            '\\leq': '≤',
            '\\ge': '≥',
            '\\geq': '≥',
            '\\neq': '≠',
            '\\approx': '≈',
            '\\pi': 'π',
            '\\theta': 'θ',
            '\\alpha': 'α',
            '\\beta': 'β',
            '\\infty': '∞'
        };
        let lastIndex = 0;
        let match;

        while ((match = notationPattern.exec(normalized))) {
            if (match.index > lastIndex) parent.append(document.createTextNode(normalized.slice(lastIndex, match.index)));
            const token = match[0];
            const rootMatch = token.match(/^\\sqrt\{([^{}]*)\}$/);
            const fractionMatch = token.match(/^\\frac\{([^{}]*)\}\{([^{}]*)\}$/);
            const powerMatch = token.match(/^\^(?:\{([^{}]*)\}|(.+))$/);
            const subscriptMatch = token.match(/^_(?:\{([^{}]*)\}|(.+))$/);

            if (rootMatch) {
                const root = document.createElement('span');
                root.className = 'ai-response-root';
                const sign = document.createElement('span');
                sign.textContent = '√';
                const radicand = document.createElement('span');
                radicand.className = 'ai-response-radicand';
                appendMathNotation(radicand, rootMatch[1]);
                root.append(sign, radicand);
                parent.append(root);
            } else if (fractionMatch) {
                const fraction = document.createElement('span');
                fraction.className = 'ai-response-fraction';
                const numerator = document.createElement('span');
                numerator.className = 'ai-response-numerator';
                const denominator = document.createElement('span');
                denominator.className = 'ai-response-denominator';
                appendMathNotation(numerator, fractionMatch[1]);
                appendMathNotation(denominator, fractionMatch[2]);
                fraction.append(numerator, denominator);
                parent.append(fraction);
            } else if (powerMatch || subscriptMatch) {
                const element = document.createElement(powerMatch ? 'sup' : 'sub');
                appendMathNotation(element, (powerMatch || subscriptMatch)[1] || (powerMatch || subscriptMatch)[2]);
                parent.append(element);
            } else {
                parent.append(document.createTextNode(symbols[token] || token));
            }
            lastIndex = notationPattern.lastIndex;
        }

        if (lastIndex < normalized.length) parent.append(document.createTextNode(normalized.slice(lastIndex)));
    }

    function appendFormattedInline(parent, text) {
        const tokens = String(text).split(/(\*\*[^*]+?\*\*|__[^_]+?__|`[^`]+`|\*[^*\n]+?\*)/g);
        tokens.forEach(token => {
            if (!token) return;
            if (token.startsWith('**') || token.startsWith('__')) {
                const strong = document.createElement('strong');
                strong.className = 'ai-response-emphasis';
                appendMathNotation(strong, token.slice(2, -2));
                parent.append(strong);
            } else if (token.startsWith('`')) {
                const code = document.createElement('code');
                code.className = 'ai-response-inline-code';
                code.textContent = token.slice(1, -1);
                parent.append(code);
            } else if (token.startsWith('*')) {
                const emphasis = document.createElement('em');
                appendMathNotation(emphasis, token.slice(1, -1));
                parent.append(emphasis);
            } else {
                appendMathNotation(parent, token);
            }
        });
    }

    function createFormattedAssistantMessage(text) {
        const message = document.createElement('div');
        message.className = 'cbt-faq-message max-w-[90%] text-sm is-assistant';
        const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
        let paragraph = null;

        for (let index = 0; index < lines.length; index += 1) {
            const line = lines[index].trim();
            if (!line) {
                paragraph = null;
                continue;
            }

            const displayLine = line.replace(/^#{1,3}\s+/, '');
            const headingText = displayLine.replace(/^\*\*(.*?)\*\*$/, '$1');
            if (/^#{1,3}\s+/.test(line) || /^(step\s+\d+|answer|solution|example|key idea|remember|final answer)\b/i.test(headingText)) {
                paragraph = null;
                const heading = document.createElement('p');
                heading.className = 'ai-response-step-title';
                appendFormattedInline(heading, displayLine);
                message.append(heading);
                continue;
            }

            if (line.includes('=') && /^[\dxX\s.+\-*\/=^()]+$/.test(line)) {
                paragraph = null;
                const equation = document.createElement('div');
                equation.className = 'ai-response-equation';
                appendFormattedInline(equation, line);
                message.append(equation);
                continue;
            }

            const listMatch = line.match(/^([-*]|\d+[.)])\s+(.+)$/);
            if (listMatch) {
                paragraph = null;
                const ordered = /^\d/.test(listMatch[1]);
                const list = document.createElement(ordered ? 'ol' : 'ul');
                list.className = 'ai-response-list';
                let itemMatch = listMatch;
                while (itemMatch && /^\d/.test(itemMatch[1]) === ordered) {
                    const item = document.createElement('li');
                    appendFormattedInline(item, itemMatch[2]);
                    list.append(item);
                    index += 1;
                    const nextLine = lines[index]?.trim() || '';
                    itemMatch = nextLine.match(/^([-*]|\d+[.)])\s+(.+)$/);
                    if (!itemMatch || /^\d/.test(itemMatch[1]) !== ordered) index -= 1;
                }
                message.append(list);
                continue;
            }

            if (!paragraph) {
                paragraph = document.createElement('p');
                paragraph.className = 'ai-response-paragraph';
                message.append(paragraph);
            } else {
                paragraph.append(document.createElement('br'));
            }
            appendFormattedInline(paragraph, displayLine);
        }

        return message;
    }

    function addMessage(text, sender) {
        const message = sender === 'student'
            ? document.createElement('p')
            : createFormattedAssistantMessage(text);
        message.className = `cbt-faq-message max-w-[90%] text-sm ${sender === 'student' ? 'is-student' : 'is-assistant'}`;
        if (sender === 'student') {
            message.classList.add('is-editable');
            message.tabIndex = 0;
            message.setAttribute('role', 'group');
            message.setAttribute('aria-label', 'Your question. Click or focus to show Edit.');
            const content = document.createElement('span');
            content.textContent = text;
            message.append(content);

            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.className = 'chat-message-edit';
            editButton.textContent = 'Edit';
            editButton.title = 'Edit this question';
            editButton.setAttribute('aria-label', 'Edit this question');
            editButton.addEventListener('click', event => {
                event.stopPropagation();
                input.value = text;
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            });
            message.append(editButton);

            const revealEditAction = () => {
                messages.querySelectorAll('.is-edit-action-visible').forEach(item => item.classList.remove('is-edit-action-visible'));
                message.classList.add('is-edit-action-visible');
            };
            message.addEventListener('click', revealEditAction);
            message.addEventListener('focus', revealEditAction);
        } else {
            message.textContent = text;
        }
        messages.insertBefore(message, typing);
        messages.scrollTop = messages.scrollHeight;
    }

    function setTyping(isTyping) {
        typing.classList.toggle('hidden', !isTyping);
        typing.classList.toggle('flex', isTyping);
        messages.setAttribute('aria-busy', String(isTyping));
        messages.scrollTop = messages.scrollHeight;
    }

    toggle.addEventListener('click', () => setOpen(panel.classList.contains('hidden')));
    close.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.classList.contains('hidden')) setOpen(false);
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        const question = input.value.trim();
        if (!question || send.disabled) return;
        if (/\b(password|passcode|pin|secret|credential|login details|access code)\b/i.test(question)) {
            input.value = '';
            addMessage('Please do not enter a password, PIN, or other credential here. Contact your CBT administrator for account help.', 'assistant');
            return;
        }

        addMessage(question, 'student');
        setTyping(true);
        input.value = '';
        input.disabled = true;
        send.disabled = true;

        try {
            const response = await fetch('/api/cbt/faq', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ question })
            });
            const responseText = await response.text();
            let data;
            try {
                data = responseText ? JSON.parse(responseText) : {};
            } catch (_) {
                throw new Error('The CBT help service is unavailable on this server. Restart or deploy the updated portal server, then try again.');
            }
            if (!response.ok) throw new Error(data.error || 'Help is temporarily unavailable.');
            if (typeof data.answer !== 'string' || !data.answer.trim()) {
                throw new Error('The CBT help service returned an empty response. Please try again.');
            }
            addMessage(data.answer, 'assistant');
        } catch (error) {
            addMessage(error.message || 'Help is temporarily unavailable. Please contact your CBT administrator.', 'assistant');
        } finally {
            setTyping(false);
            input.disabled = false;
            send.disabled = false;
            input.focus();
        }
    });
})();