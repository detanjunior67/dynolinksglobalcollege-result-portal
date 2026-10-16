(() => {
    const toggle = document.getElementById('adminChatToggle');
    const panel = document.getElementById('adminChatPanel');
    const close = document.getElementById('adminChatClose');
    const form = document.getElementById('adminChatForm');
    const input = document.getElementById('adminChatInput');
    const messages = document.getElementById('adminChatMessages');
    const typing = document.getElementById('adminChatTyping');
    const send = document.getElementById('adminChatSend');

    if (!toggle || !panel || !close || !form || !input || !messages || !typing || !send) return;

    const sensitivePattern = /\b(password|passcode|pin|secret|credential|student\s*id|email address|phone number|date of birth|home address|api key|access token)\b/i;
    const conversation = [];
    const conversationId = crypto.randomUUID();
    let focusedBeforeOpen = null;

    function setStatusMessage(text, sender = 'assistant') {
        const message = document.createElement('div');
        message.className = `cbt-faq-message max-w-[94%] text-sm ${sender === 'teacher' ? 'is-teacher' : 'is-assistant'}`;
        if (sender === 'teacher') {
            message.classList.add('is-editable');
            message.tabIndex = 0;
            message.setAttribute('role', 'group');
            message.setAttribute('aria-label', 'Your message. Click or focus to show Edit.');
            const content = document.createElement('span');
            content.textContent = text;
            message.append(content);

            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.className = 'chat-message-edit';
            editButton.textContent = 'Edit';
            editButton.title = 'Edit this message';
            editButton.setAttribute('aria-label', 'Edit this message');
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
        return message;
    }

    function addActionButton(parent, label, action, destructive = false) {
        const wrapper = document.createElement('div');
        wrapper.className = 'mt-2 flex';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = destructive
            ? 'rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50'
            : 'rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-bold text-sky-800 hover:bg-sky-50';
        button.textContent = label;
        button.addEventListener('click', action, { once: true });
        wrapper.append(button);
        parent.append(wrapper);
        messages.scrollTop = messages.scrollHeight;
        return button;
    }

    function setTyping(isTyping) {
        typing.classList.toggle('hidden', !isTyping);
        typing.classList.toggle('flex', isTyping);
        messages.setAttribute('aria-busy', String(isTyping));
        messages.scrollTop = messages.scrollHeight;
    }

    function openChat() {
        focusedBeforeOpen = document.activeElement;
        panel.classList.remove('hidden');
        panel.classList.add('flex');
        panel.setAttribute('aria-hidden', 'false');
        toggle.setAttribute('aria-expanded', 'true');
        input.focus();
    }

    function closeChat() {
        panel.classList.add('hidden');
        panel.classList.remove('flex');
        panel.setAttribute('aria-hidden', 'true');
        toggle.setAttribute('aria-expanded', 'false');
        if (focusedBeforeOpen && typeof focusedBeforeOpen.focus === 'function') focusedBeforeOpen.focus();
    }

    function updateChatVisibility() {
        const hasTeacherToken = Boolean(localStorage.getItem('dgc_cbt_admin_teacher_token'));
        const gate = document.getElementById('cbtAdminGate');
        const adminPortal = document.getElementById('viewAdminPortal');
        const adminUnlocked = Boolean(gate?.hidden && adminPortal && !adminPortal.classList.contains('hidden'));
        toggle.classList.toggle('hidden', !hasTeacherToken || !adminUnlocked);
        if (!hasTeacherToken || !adminUnlocked) closeChat();
    }

    async function postMessage(payload) {
        const token = localStorage.getItem('dgc_cbt_admin_teacher_token') || '';
        if (!token) throw new Error('Register a teacher name before using the admin chatbot.');
        const response = await fetch('/api/cbt-admin/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'x-cbt-teacher-token': token
            },
            body: JSON.stringify(payload)
        });
        const responseText = await response.text();
        let data;
        try {
            data = responseText ? JSON.parse(responseText) : {};
        } catch (_) {
            throw new Error('The admin chatbot API is unavailable on this server. Restart or deploy the updated portal server.');
        }
        if (!response.ok) throw new Error(data.message || 'The admin chatbot request failed.');
        return data;
    }

    function showGeneratedPreview(data, messageElement) {
        const scope = data.scope;
        const questions = Array.isArray(data.questions) ? data.questions : [];
        if (!scope || !questions.length) return;
        if (data.requestText) {
            addActionButton(messageElement, 'Edit request', () => {
                input.value = data.requestText;
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            });
        }
        addActionButton(messageElement, `Preview ${questions.length} question${questions.length === 1 ? '' : 's'} in Question Bank`, () => {
            showAdminSubView('questions');
            const bankClass = document.getElementById('qBankClassSelect');
            const bankDepartment = document.getElementById('qBankDepartmentSelect');
            const bankSubject = document.getElementById('qBankSubjectSelect');
            bankClass.value = scope.classKey;
            toggleQuestionBankDepartment();
            if (bankDepartment && scope.department) bankDepartment.value = scope.department;
            updateSubjectBankSelector();
            bankSubject.value = scope.subjectId;

            currentWorkspaceClass = scope.classKey;
            currentWorkspaceSubId = scope.subjectId;
            currentWorkspaceDepartment = scope.department || '';
            currentWorkspaceQuestionTime = 60;
            const editableQuestions = questions.map((question, index) => ({
                id: `q-chat-${Date.now()}-${index}`,
                qNumber: index + 1,
                text: question.text,
                options: (question.options || []).slice(0, 4),
                correctIndex: question.correctIndex,
                points: 1,
                customTime: 60,
                isAiAutofilled: true
            }));
            renderQuestionWorkspace(scope.classKey, scope.subjectId, editableQuestions);
            document.getElementById('batchQuestionWorkspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            closeChat();
        });
    }

    function showDeleteConfirmation(data, messageElement) {
        const label = `${data.scope.classLabel}${data.scope.department ? ` / ${data.scope.department}` : ''} / ${data.scope.subjectName}`;
        addActionButton(messageElement, `Confirm delete ${data.count} question${data.count === 1 ? '' : 's'}`, async event => {
            const button = event.currentTarget;
            button.disabled = true;
            setTyping(true);
            try {
                const result = await postMessage({ confirmationToken: data.confirmationToken });
                setStatusMessage(result.message || `Questions deleted for ${label}.`);
                if (result.action === 'questions_deleted' && result.scope) {
                    if (!questionBank[result.scope.classKey]) questionBank[result.scope.classKey] = {};
                    questionBank[result.scope.classKey][result.scope.subjectId] = [];
                    savePersistentData();
                    if (currentWorkspaceClass === result.scope.classKey && currentWorkspaceSubId === result.scope.subjectId) {
                        closeWorkspace();
                    }
                    if (document.getElementById('qBankClassSelect')?.value === result.scope.classKey
                        && document.getElementById('qBankSubjectSelect')?.value === result.scope.subjectId) {
                        await renderAdminQuestionBank();
                    }
                }
            } catch (error) {
                setStatusMessage(error.message || 'The scoped deletion could not be completed.');
            } finally {
                setTyping(false);
                button.remove();
            }
        }, true);
    }

    async function sendMessage(messageText) {
        const message = messageText.trim();
        if (!message || send.disabled) return;
        if (sensitivePattern.test(message)) {
            setStatusMessage('Do not send credentials or identifiable student information in this chat.');
            return;
        }
        setStatusMessage(message, 'teacher');
        input.value = '';
        send.disabled = true;
        input.disabled = true;
        setTyping(true);
        try {
            const data = await postMessage({
                message,
                conversationId,
                history: conversation.slice(-8)
            });
            const reply = data.message || 'No response was returned.';
            const responseElement = setStatusMessage(reply);
            conversation.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
            if (conversation.length > 16) conversation.splice(0, conversation.length - 16);
            if (data.type === 'generated_questions') showGeneratedPreview(data, responseElement);
            if (data.type === 'confirm_question_delete') showDeleteConfirmation(data, responseElement);
        } catch (error) {
            setStatusMessage(error.message || 'The chatbot is temporarily unavailable.');
        } finally {
            setTyping(false);
            input.disabled = false;
            send.disabled = false;
            input.focus();
        }
    }

    toggle.addEventListener('click', () => panel.classList.contains('hidden') ? openChat() : closeChat());
    close.addEventListener('click', closeChat);
    form.addEventListener('submit', event => {
        event.preventDefault();
        void sendMessage(input.value);
    });
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            form.requestSubmit();
        }
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.classList.contains('hidden')) closeChat();
    });
    const gateObserver = new MutationObserver(updateChatVisibility);
    const gate = document.getElementById('cbtAdminGate');
    const adminPortal = document.getElementById('viewAdminPortal');
    if (gate) gateObserver.observe(gate, { attributes: true, attributeFilter: ['hidden'] });
    if (adminPortal) gateObserver.observe(adminPortal, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('storage', updateChatVisibility);
    updateChatVisibility();
})();
