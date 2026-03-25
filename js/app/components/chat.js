import { util } from '../../common/util.js';
import { dto } from '../../connection/dto.js';
import { lang } from '../../common/language.js';
import { storage } from '../../common/storage.js';
import { session } from '../../common/session.js';
import { request, HTTP_GET, HTTP_POST } from '../../connection/request.js';

export const chat = (() => {

    let owns = null;
    let info = null;
    let pollInterval = null;
    let eventSource = null;
    let allMessages = [];
    let isOpen = false;
    let sseSupported = true;
    let lastSince = null;

    const EVENT_DATE = '2026-04-11';

    const getPhase = () => {
        const now = new Date();
        const eventStart = new Date(EVENT_DATE + 'T09:30:00+02:00');
        const eventEnd = new Date(EVENT_DATE + 'T23:59:59+02:00');

        if (now < eventStart) return 'before';
        if (now <= eventEnd) return 'during';
        return 'after';
    };

    const getPhaseConfig = () => {
        const phases = {
            before: {
                title: 'Mural de Desejos',
                subtitle: 'Antes do grande dia',
                placeholder: 'Envie votos de felicidade ao casal...',
                icon: 'fa-solid fa-heart',
                banner: null,
            },
            during: {
                title: 'Chat ao Vivo',
                subtitle: 'A festa esta a decorrer!',
                placeholder: 'Como esta a festa? Partilhe o momento...',
                icon: 'fa-solid fa-champagne-glasses',
                banner: 'live',
            },
            after: {
                title: 'Livro de Memorias',
                subtitle: 'Obrigado por celebrar connosco',
                placeholder: 'Que momento especial guarda desta celebracao?',
                icon: 'fa-solid fa-book-open',
                banner: null,
            },
        };
        return phases[getPhase()];
    };

    const formatTime = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDateDivider = (dateStr) => {
        const d = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (d.toDateString() === today.toDateString()) return 'Hoje';
        if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
        return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
    };

    const isOwnMessage = (msg) => owns.has(msg.uuid);

    const isMusicRequest = (text) => text && text.startsWith('[MUSIC]');
    const getMusicText = (text) => text ? text.replace('[MUSIC]', '').trim() : '';

    const renderBubble = (msg) => {
        const own = isOwnMessage(msg);
        const admin = msg.is_admin;
        const music = isMusicRequest(msg.comment);
        const text = music ? getMusicText(msg.comment) : msg.comment;

        const bubbleClass = own ? 'chat-bubble-right' : (admin ? 'chat-bubble-admin' : 'chat-bubble-left');
        const alignClass = own ? 'align-self-end' : 'align-self-start';

        let content = '';

        if (!own) {
            content += `<div class="chat-bubble-name fw-bold small mb-1">${util.escapeHtml(msg.name)}${admin ? ' <i class="fa-solid fa-certificate text-primary" style="font-size:0.6rem;"></i>' : ''}${msg.presence ? ' <i class="fa-solid fa-circle-check text-success" style="font-size:0.55rem;"></i>' : ''}</div>`;
        }

        if (music) {
            content += `<div class="chat-music-request rounded-3 p-2 mb-1"><i class="fa-solid fa-music me-2 text-primary"></i><span class="small fw-semibold">${util.escapeHtml(text)}</span></div>`;
        } else if (msg.gif_url) {
            content += `<img src="${util.escapeHtml(msg.gif_url)}" class="rounded-3 mb-1" style="max-width:200px; max-height:150px;" alt="gif" loading="lazy">`;
        } else if (text) {
            content += `<div class="chat-bubble-text">${util.escapeHtml(text)}</div>`;
        }

        content += `<div class="chat-bubble-time text-end opacity-50" style="font-size:0.65rem;">${formatTime(msg.created_at)}${own ? ' <i class="fa-solid fa-check-double text-primary" style="font-size:0.55rem;"></i>' : ''}</div>`;

        return `<div class="d-flex flex-column ${alignClass} mb-2 px-3" style="max-width: 82%;"><div class="${bubbleClass} rounded-4 px-3 py-2 shadow-sm">${content}</div></div>`;
    };

    const renderDateDivider = (dateStr) => {
        return `<div class="text-center my-3"><span class="badge bg-theme-auto text-theme-auto rounded-pill px-3 py-1 shadow-sm small opacity-75">${formatDateDivider(dateStr)}</span></div>`;
    };

    const flattenMessages = () => {
        const flat = [];
        allMessages.forEach((msg) => {
            flat.push(msg);
            if (msg.comments && msg.comments.length) {
                msg.comments.forEach((reply) => flat.push(reply));
            }
        });
        flat.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        return flat;
    };

    const renderMessages = () => {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        if (allMessages.length === 0) {
            const phase = getPhaseConfig();
            container.innerHTML = `<div class="d-flex flex-column align-items-center justify-content-center h-100 opacity-50 px-4"><i class="${phase.icon} mb-3" style="font-size: 3rem;"></i><p class="text-center small">${phase.placeholder}</p></div>`;
            return;
        }

        let html = '';
        let lastDate = '';
        const flat = flattenMessages();

        flat.forEach((msg) => {
            const msgDate = new Date(msg.created_at).toDateString();
            if (msgDate !== lastDate) {
                html += renderDateDivider(msg.created_at);
                lastDate = msgDate;
            }
            html += renderBubble(msg);
        });

        container.innerHTML = html;
        autoScroll();
    };

    const autoScroll = () => {
        const container = document.getElementById('chat-messages');
        if (container) {
            requestAnimationFrame(() => {
                container.scrollTop = container.scrollHeight;
            });
        }
    };

    const loadMessages = () => {
        return request(HTTP_GET, `/api/v2/comment?per=100&lang=${lang.getLanguage()}`)
            .token(session.getToken())
            .send(dto.getCommentsResponseV2)
            .then((res) => {
                allMessages = res.data.lists || [];
                renderMessages();

                // Track latest timestamp for SSE
                const flat = flattenMessages();
                if (flat.length > 0) {
                    lastSince = flat[flat.length - 1].created_at;
                }
            })
            .catch(() => {});
    };

    // === SSE Real-time ===

    const getApiBase = () => {
        return document.body.getAttribute('data-url') || '';
    };

    const connectSSE = () => {
        if (!sseSupported || !('EventSource' in window)) {
            sseSupported = false;
            startPolling();
            return;
        }

        closeSSE();

        const since = lastSince || new Date(Date.now() - 60000).toISOString();
        const token = session.getToken();
        const base = getApiBase().replace(/\/$/, '');
        const url = `${base}/api/v2/comment/stream?since=${encodeURIComponent(since)}&token=${encodeURIComponent(token)}`;

        eventSource = new EventSource(url);

        eventSource.onmessage = (e) => {
            try {
                const payload = JSON.parse(e.data);
                if (payload.comments && payload.comments.length > 0) {
                    // Merge new comments avoiding duplicates
                    const existingUuids = new Set();
                    const flat = flattenMessages();
                    flat.forEach((m) => existingUuids.add(m.uuid));

                    payload.comments.forEach((msg) => {
                        if (!existingUuids.has(msg.uuid)) {
                            allMessages.push(msg);
                        }
                    });

                    renderMessages();
                    lastSince = payload.since;
                }
            } catch (_) { /* ignore parse errors */ }
        };

        eventSource.onerror = () => {
            closeSSE();
            // SSE failed, fallback to polling
            if (isOpen) {
                sseSupported = false;
                startPolling();
            }
        };
    };

    const closeSSE = () => {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
    };

    // === Polling fallback ===

    const startPolling = () => {
        stopPolling();
        pollInterval = setInterval(() => {
            if (isOpen && document.visibilityState === 'visible') {
                loadMessages();
            }
        }, 5000);
    };

    const stopPolling = () => {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    };

    // === Name prompt ===

    const hasName = () => {
        const name = info.get('name');
        return name && name.trim().length >= 2;
    };

    const showNamePrompt = () => {
        const prompt = document.getElementById('chat-name-prompt');
        if (!prompt) return;

        prompt.classList.remove('d-none');
        prompt.classList.add('d-flex');

        const input = document.getElementById('chat-name-input');
        if (input) {
            const savedName = info.get('name');
            if (savedName) input.value = savedName;
            util.timeOut(() => input.focus(), 300);
        }
    };

    const hideNamePrompt = () => {
        const prompt = document.getElementById('chat-name-prompt');
        if (prompt) {
            prompt.classList.add('d-none');
            prompt.classList.remove('d-flex');
        }
    };

    const saveName = () => {
        const input = document.getElementById('chat-name-input');
        if (!input) return;

        const name = input.value.trim();
        if (name.length < 2) {
            input.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.3)';
            input.focus();
            util.timeOut(() => { input.style.boxShadow = ''; }, 2000);
            return;
        }

        info.set('name', name);
        hideNamePrompt();
        document.getElementById('chat-input')?.focus();
    };

    // === Send ===

    const sendMessage = (type = 'text') => {
        const input = document.getElementById('chat-input');
        const musicInput = document.getElementById('chat-music-input');
        const nameVal = info.get('name') || 'Convidado';
        const presence = info.get('presence') ?? true;

        let text = '';
        if (type === 'music' && musicInput) {
            text = '[MUSIC]' + musicInput.value.trim();
            if (musicInput.value.trim().length === 0) return;
        } else {
            if (!input || input.value.trim().length === 0) return;
            text = input.value.trim();
        }

        const sendBtn = document.getElementById('chat-send-btn');
        if (sendBtn) sendBtn.disabled = true;

        request(HTTP_POST, `/api/comment?lang=${lang.getLanguage()}`)
            .token(session.getToken())
            .body(dto.postCommentRequest(null, nameVal, presence, text, null))
            .send(dto.getCommentResponse)
            .then((res) => {
                if (res.code === 201) {
                    owns.set(res.data.uuid, res.data.own);
                    allMessages.push(res.data);
                    lastSince = res.data.created_at;
                    renderMessages();

                    if (input) input.value = '';
                    if (musicInput) musicInput.value = '';
                    closeMusicInput();
                }
            })
            .finally(() => {
                if (sendBtn) sendBtn.disabled = false;
                input?.focus();
            });
    };

    const openMusicInput = () => {
        const el = document.getElementById('chat-music-panel');
        if (el) el.classList.remove('d-none');
    };

    const closeMusicInput = () => {
        const el = document.getElementById('chat-music-panel');
        if (el) el.classList.add('d-none');
    };

    const open = () => {
        const overlay = document.getElementById('chat-overlay');
        if (!overlay) return;

        isOpen = true;
        overlay.classList.remove('d-none');
        document.body.style.overflow = 'hidden';

        const phase = getPhaseConfig();
        const header = document.getElementById('chat-header-title');
        const subtitle = document.getElementById('chat-header-subtitle');
        const input = document.getElementById('chat-input');
        const musicBtn = document.getElementById('chat-music-btn');

        if (header) header.textContent = phase.title;
        if (subtitle) subtitle.textContent = phase.subtitle;
        if (input) input.placeholder = phase.placeholder;

        // Music request button only during event
        if (musicBtn) {
            musicBtn.classList.toggle('d-none', getPhase() !== 'during');
        }

        // Live pulse
        const live = document.getElementById('chat-live-badge');
        if (live) live.classList.toggle('d-none', phase.banner !== 'live');

        // Show name prompt if no name set
        if (!hasName()) {
            showNamePrompt();
        }

        loadMessages().then(() => {
            // Try SSE first, fallback to polling
            if (sseSupported && 'EventSource' in window) {
                connectSSE();
            } else {
                startPolling();
            }
        });
    };

    const close = () => {
        const overlay = document.getElementById('chat-overlay');
        if (!overlay) return;

        isOpen = false;
        overlay.classList.add('d-none');
        document.body.style.overflow = '';
        hideNamePrompt();
        closeSSE();
        stopPolling();
    };

    const init = () => {
        owns = storage('owns');
        info = storage('information');

        // Enter key to send
        document.addEventListener('keydown', (e) => {
            if (isOpen && e.key === 'Enter' && !e.shiftKey) {
                // Name prompt enter
                if (document.activeElement?.id === 'chat-name-input') {
                    e.preventDefault();
                    saveName();
                    return;
                }

                const musicPanel = document.getElementById('chat-music-panel');
                if (musicPanel && !musicPanel.classList.contains('d-none')) {
                    e.preventDefault();
                    sendMessage('music');
                } else if (document.activeElement?.id === 'chat-input') {
                    e.preventDefault();
                    sendMessage('text');
                }
            }
        });

        // Reconnect SSE on visibility change
        document.addEventListener('visibilitychange', () => {
            if (isOpen && document.visibilityState === 'visible') {
                if (sseSupported && !eventSource) {
                    connectSSE();
                }
            }
        });
    };

    return {
        init,
        open,
        close,
        sendMessage,
        saveName,
        openMusicInput,
        closeMusicInput,
    };
})();
