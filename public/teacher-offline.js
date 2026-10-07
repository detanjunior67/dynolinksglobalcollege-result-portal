(function (scope) {
    const DATABASE_NAME = 'dgc-teacher-offline';
    const STORE_NAME = 'checkins';
    const ALLOWED_ENDPOINTS = new Set(['/api/teacher/logins', '/api/teacher/class-sessions', '/api/teacher/class-sessions/end', '/api/teacher/checkin-reports']);
    let databasePromise;

    function openDatabase() {
        if (!databasePromise) {
            databasePromise = new Promise((resolve, reject) => {
                const request = indexedDB.open(DATABASE_NAME, 1);
                request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'clientRequestId' });
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
        return databasePromise;
    }

    async function getPending() {
        const database = await openDatabase();
        return new Promise((resolve, reject) => {
            const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function enqueue(payload, endpoint = '/api/teacher/logins') {
        if (!ALLOWED_ENDPOINTS.has(endpoint)) throw new Error('Unsupported teacher submission.');
        const database = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, 'readwrite');
            transaction.objectStore(STORE_NAME).put({ clientRequestId: payload.clientRequestId, endpoint, payload, queuedAt: Date.now() });
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async function submit(endpoint, payload) {
        if (!ALLOWED_ENDPOINTS.has(endpoint)) throw new Error('Unsupported teacher submission.');
        if (scope.window && !scope.navigator.onLine) {
            await enqueue(payload, endpoint);
            return { queued: true };
        }

        let response;
        try {
            response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (_) {
            await enqueue(payload, endpoint);
            return { queued: true };
        }
        if (!response.ok) throw await getSubmissionError(response, 'Teacher submission failed');
        return { queued: false };
    }

    async function getSubmissionError(response, action) {
        let message = `${action} (${response.status}).`;
        try {
            const data = await response.json();
            if (data.message) message = data.message;
        } catch (_) {}
        return new Error(message);
    }

    async function remove(clientRequestId) {
        const database = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, 'readwrite');
            transaction.objectStore(STORE_NAME).delete(clientRequestId);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async function syncPending() {
        if (scope.window && !scope.navigator.onLine) return { synced: 0, remaining: (await getPending()).length };
        const pending = (await getPending()).sort((left, right) => (left.queuedAt || 0) - (right.queuedAt || 0));
        let synced = 0;
        for (const item of pending) {
            const endpoint = item.endpoint || '/api/teacher/logins';
            if (!ALLOWED_ENDPOINTS.has(endpoint)) throw new Error('Unsupported queued teacher submission.');
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item.payload)
            });
            if (!response.ok) throw await getSubmissionError(response, 'Teacher submission sync failed');
            await remove(item.clientRequestId);
            synced += 1;
        }
        return { synced, remaining: pending.length - synced };
    }

    scope.TeacherOfflineQueue = { enqueue, submit, getPending, syncPending };
})(typeof self === 'undefined' ? window : self);
