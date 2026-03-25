import { video } from './video.js';
import { image } from './image.js';
import { audio } from './audio.js';
import { progress } from './progress.js';
import { util } from '../../common/util.js';
import { bs } from '../../libs/bootstrap.js';
import { loader } from '../../libs/loader.js';
import { theme } from '../../common/theme.js';
import { lang } from '../../common/language.js';
import { storage } from '../../common/storage.js';
import { session } from '../../common/session.js';
import { offline } from '../../common/offline.js';
import { comment } from '../components/comment.js';
import * as confetti from '../../libs/confetti.js';
import { pool, request, HTTP_POST } from '../../connection/request.js';
import { dto } from '../../connection/dto.js';
import { pwa } from '../../common/pwa.js';
import { chat } from '../components/chat.js';
import { emojiPicker } from '../components/emoji-picker.js';

export const guest = (() => {

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let information = null;

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let config = null;

    /**
     * @returns {void}
     */
    const countDownDate = () => {
        const count = (new Date(document.body.getAttribute('data-time').replace(' ', 'T'))).getTime();

        /**
         * @param {number} num 
         * @returns {string}
         */
        const pad = (num) => num < 10 ? `0${num}` : `${num}`;

        const day = document.getElementById('day');
        const hour = document.getElementById('hour');
        const minute = document.getElementById('minute');
        const second = document.getElementById('second');

        const updateCountdown = () => {
            const distance = Math.abs(count - Date.now());

            day.textContent = pad(Math.floor(distance / (1000 * 60 * 60 * 24)));
            hour.textContent = pad(Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
            minute.textContent = pad(Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)));
            second.textContent = pad(Math.floor((distance % (1000 * 60)) / 1000));

            util.timeOut(updateCountdown, 1000 - (Date.now() % 1000));
        };

        util.timeOut(updateCountdown);
    };

    /**
     * @returns {void}
     */
    const showGuestName = () => {
        /**
         * Make sure "to=" is the last query string.
         * Ex. ulems.my.id/?id=some-uuid-here&to=name
         */
        const raw = window.location.search.split('to=');
        let name = null;

        if (raw.length > 1 && raw[1].length >= 1) {
            name = window.decodeURIComponent(raw[1]);
        }

        if (name) {
            const guestName = document.getElementById('guest-name');
            const div = document.createElement('div');
            div.classList.add('m-2');

            const template = `<small class="mt-0 mb-1 mx-0 p-0">${util.escapeHtml(guestName?.getAttribute('data-message'))}</small><p class="m-0 p-0" style="font-size: 1.25rem">${util.escapeHtml(name)}</p>`;
            util.safeInnerHTML(div, template);

            guestName?.appendChild(div);
        }

        const form = document.getElementById('form-name');
        if (form) {
            form.value = information.get('name') ?? name;
        }
    };

    /**
     * @returns {Promise<void>}
     */
    const slide = async () => {
        const interval = 6000;
        const slides = document.querySelectorAll('.slide-desktop');

        if (!slides || slides.length === 0) {
            return;
        }

        const desktopEl = document.getElementById('root')?.querySelector('.d-sm-block');
        if (!desktopEl) {
            return;
        }

        desktopEl.dispatchEvent(new Event('undangan.slide.stop'));

        if (window.getComputedStyle(desktopEl).display === 'none') {
            return;
        }

        if (slides.length === 1) {
            await util.changeOpacity(slides[0], true);
            return;
        }

        let index = 0;
        for (const [i, s] of slides.entries()) {
            if (i === index) {
                s.classList.add('slide-desktop-active');
                await util.changeOpacity(s, true);
                break;
            }
        }

        let run = true;
        const nextSlide = async () => {
            await util.changeOpacity(slides[index], false);
            slides[index].classList.remove('slide-desktop-active');

            index = (index + 1) % slides.length;

            if (run) {
                slides[index].classList.add('slide-desktop-active');
                await util.changeOpacity(slides[index], true);
            }

            return run;
        };

        desktopEl.addEventListener('undangan.slide.stop', () => {
            run = false;
        });

        const loop = async () => {
            if (await nextSlide()) {
                util.timeOut(loop, interval);
            }
        };

        util.timeOut(loop, interval);
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const open = (button) => {
        button.disabled = true;
        document.body.scrollIntoView({ behavior: 'instant' });
        document.getElementById('root').classList.remove('opacity-0');

        if (theme.isAutoMode()) {
            document.getElementById('button-theme').classList.remove('d-none');
        }

        slide();
        theme.spyTop();

        confetti.basicAnimation();
        util.timeOut(confetti.openAnimation, 1500);

        document.dispatchEvent(new Event('undangan.open'));
        util.changeOpacity(document.getElementById('welcome'), false).then((el) => el.remove());
    };

    /**
     * @param {string} choice - 'yes' or 'no'
     * @returns {void}
     */
    const selectRsvp = (choice) => {
        const yesBtn = document.getElementById('rsvp-yes');
        const noBtn = document.getElementById('rsvp-no');
        const hiddenVal = document.getElementById('rsvp-presence-value');

        // Reset both
        [yesBtn, noBtn].forEach((b) => {
            b.style.borderColor = 'rgba(var(--bs-emphasis-color-rgb), 0.1)';
            b.style.background = 'transparent';
            b.style.transform = 'scale(1)';
        });

        if (choice === 'yes') {
            yesBtn.style.borderColor = '#22c55e';
            yesBtn.style.background = 'rgba(34, 197, 94, 0.08)';
            yesBtn.style.transform = 'scale(1.03)';
            hiddenVal.value = '1';
        } else {
            noBtn.style.borderColor = '#ef4444';
            noBtn.style.background = 'rgba(239, 68, 68, 0.08)';
            noBtn.style.transform = 'scale(1.03)';
            hiddenVal.value = '2';
        }
    };

    /**
     * @returns {void}
     */
    const hidePresenceFromCommentForm = () => {
        const presenceWrapper = document.getElementById('form-presence')?.closest('.mb-3');
        if (presenceWrapper) presenceWrapper.style.display = 'none';
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const submitRsvp = (button) => {
        const name = document.getElementById('rsvp-name');
        const presenceVal = document.getElementById('rsvp-presence-value').value;
        const commentEl = document.getElementById('rsvp-comment');

        if (!name.value || name.value.trim().length < 2) {
            name.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.3)';
            name.focus();
            util.timeOut(() => { name.style.boxShadow = ''; }, 2000);
            return;
        }

        if (presenceVal === '0') {
            const btns = document.querySelectorAll('.rsvp-choice');
            btns.forEach((b) => { b.style.borderColor = '#f59e0b'; });
            util.timeOut(() => btns.forEach((b) => { b.style.borderColor = 'rgba(var(--bs-emphasis-color-rgb), 0.1)'; }), 2000);
            return;
        }

        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>A enviar...';

        const isPresence = presenceVal === '1';

        // Sync to original form
        const formName = document.getElementById('form-name');
        const formPresence = document.getElementById('form-presence');
        if (formName) formName.value = name.value;
        if (formPresence) formPresence.value = presenceVal;

        // Save
        information.set('name', name.value);
        information.set('presence', isPresence);
        information.set('rsvp_done', true);

        request(HTTP_POST, '/api/comment')
            .token(session.getToken())
            .body(dto.postCommentRequest(null, name.value, isPresence, commentEl.value || null, null))
            .send(dto.getCommentResponse)
            .then(() => {
                // Transition to success
                document.getElementById('rsvp-form-card').classList.add('d-none');
                const successCard = document.getElementById('rsvp-success-card');
                successCard.classList.remove('d-none');

                document.getElementById('rsvp-success-message').textContent = isPresence
                    ? 'Esperamos por si no dia 11 de Abril! A sua presença fará toda a diferença.'
                    : 'Lamentamos que não possa comparecer. Obrigado por nos ter avisado!';

                hidePresenceFromCommentForm();
                confetti.basicAnimation();
            })
            .catch(() => {
                button.disabled = false;
                button.innerHTML = '<i class="fa-solid fa-paper-plane me-2"></i>Confirmar Presença';
            });
    };

    /**
     * @returns {void}
     */
    const initRsvpScrollTrigger = () => {
        if (information.get('rsvp_done')) {
            hidePresenceFromCommentForm();
            return;
        }

        const target = document.getElementById('wedding-date');
        if (!target) return;

        let triggered = false;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !triggered) {
                triggered = true;
                observer.disconnect();
                util.timeOut(() => bs.modal('modal-rsvp').show(), 600);
            }
        }, { threshold: 0.3 });

        document.addEventListener('undangan.open', () => observer.observe(target));
    };

    /**
     * @param {HTMLImageElement} img
     * @returns {void}
     */
    const modal = (img) => {
        document.getElementById('button-modal-click').setAttribute('href', img.src);
        document.getElementById('button-modal-download').setAttribute('data-src', img.src);

        const i = document.getElementById('show-modal-image');
        i.src = img.src;
        i.width = img.width;
        i.height = img.height;
        bs.modal('modal-image').show();
    };

    /**
     * @returns {void}
     */
    const modalImageClick = () => {
        document.getElementById('show-modal-image').addEventListener('click', (e) => {
            const abs = e.currentTarget.parentNode.querySelector('.position-absolute');

            abs.classList.contains('d-none')
                ? abs.classList.replace('d-none', 'd-flex')
                : abs.classList.replace('d-flex', 'd-none');
        });
    };

    /**
     * @param {HTMLDivElement} div 
     * @returns {void}
     */
    const showStory = (div) => {
        if (navigator.vibrate) {
            navigator.vibrate(500);
        }

        confetti.tapTapAnimation(div, 100);
        util.changeOpacity(div, false).then((e) => e.remove());
    };

    /**
     * @returns {void}
     */
    const closeInformation = () => information.set('info', true);

    /**
     * @returns {void}
     */
    const normalizeArabicFont = () => {
        document.querySelectorAll('.font-arabic').forEach((el) => {
            el.innerHTML = String(el.innerHTML).normalize('NFC');
        });
    };

    /**
     * @returns {void}
     */
    const animateSvg = () => {
        document.querySelectorAll('svg').forEach((el) => {
            if (el.hasAttribute('data-class')) {
                util.timeOut(() => el.classList.add(el.getAttribute('data-class')), parseInt(el.getAttribute('data-time')));
            }
        });
    };

    /**
     * @returns {void}
     */
    const buildGoogleCalendar = () => {
        /**
         * @param {string} d 
         * @returns {string}
         */
        const formatDate = (d) => (new Date(d.replace(' ', 'T') + ':00Z')).toISOString().replace(/[-:]/g, '').split('.').shift();

        const url = new URL('https://calendar.google.com/calendar/render');
        const eventDate = '2026-04-11';
        const data = new URLSearchParams({
            action: 'TEMPLATE',
            text: 'Noivado de Arnaldo e Claudia',
            dates: `${formatDate(eventDate + ' 10:00')}/${formatDate(eventDate + ' 11:00')}`,
            details: 'Com alegria, convidamos você para celebrar nosso noivado. Agradecemos por celebrar conosco este momento tão especial.',
            location: 'Local a confirmar, Maputo, Moçambique',
            ctz: config.get('tz'),
        });

        url.search = data.toString();
        document.querySelector('#home button')?.addEventListener('click', () => window.open(url, '_blank'));
    };

    /**
     * @returns {object}
     */
    const loaderLibs = () => {
        progress.add();

        /**
         * @param {{aos: boolean, confetti: boolean}} opt
         * @returns {void}
         */
        const load = (opt) => {
            loader(opt)
                .then(() => progress.complete('libs'))
                .catch(() => progress.invalid('libs'));
        };

        return {
            load,
        };
    };

    /**
     * @returns {Promise<void>}
     */
    const booting = async () => {
        animateSvg();
        countDownDate();
        showGuestName();
        modalImageClick();
        normalizeArabicFont();
        buildGoogleCalendar();

        if (information.has('presence')) {
            document.getElementById('form-presence').value = information.get('presence') ? '1' : '2';
        }

        if (information.get('info')) {
            document.getElementById('information')?.remove();
        }

        // RSVP modal: pre-fill name on show, reset on close
        const rsvpModal = document.getElementById('modal-rsvp');
        if (rsvpModal) {
            rsvpModal.addEventListener('show.bs.modal', () => {
                const savedName = information.get('name');
                if (savedName) {
                    document.getElementById('rsvp-name').value = savedName;
                }
            });
            rsvpModal.addEventListener('hidden.bs.modal', () => {
                document.getElementById('rsvp-form-card').classList.remove('d-none');
                document.getElementById('rsvp-success-card').classList.add('d-none');
                document.getElementById('rsvp-presence-value').value = '0';
                document.querySelectorAll('.rsvp-choice').forEach((b) => {
                    b.style.borderColor = 'rgba(var(--bs-emphasis-color-rgb), 0.1)';
                    b.style.background = 'transparent';
                    b.style.transform = 'scale(1)';
                });
                const btn = document.getElementById('rsvp-submit');
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-paper-plane me-2"></i>Confirmar Presença';
            });
        }

        initRsvpScrollTrigger();

        // wait until welcome screen is show.
        await util.changeOpacity(document.getElementById('welcome'), true);

        // remove loading screen and show welcome screen.
        await util.changeOpacity(document.getElementById('loading'), false).then((el) => el.remove());
    };

    /**
     * @returns {void}
     */
    const pageLoaded = () => {
        lang.init();
        offline.init();
        comment.init();
        chat.init();
        progress.init();

        config = storage('config');
        information = storage('information');

        const vid = video.init();
        const img = image.init();
        const aud = audio.init();
        const lib = loaderLibs();
        const token = document.body.getAttribute('data-key');
        const params = new URLSearchParams(window.location.search);

        window.addEventListener('resize', util.debounce(slide));
        document.addEventListener('undangan.progress.done', () => booting());
        document.addEventListener('hide.bs.modal', () => document.activeElement?.blur());
        document.getElementById('button-modal-download').addEventListener('click', (e) => {
            img.download(e.currentTarget.getAttribute('data-src'));
        });

        if (!token || token.length <= 0) {
            document.getElementById('comment')?.remove();
            document.querySelector('a.nav-link[href="#comment"]')?.closest('li.nav-item')?.remove();

            vid.load();
            img.load();
            aud.load();
            lib.load({ confetti: document.body.getAttribute('data-confetti') === 'true' });
        }

        if (token && token.length > 0) {
            // add 2 progress for config and comment.
            // before img.load();
            progress.add();
            progress.add();

            // if don't have data-src.
            if (!img.hasDataSrc()) {
                img.load();
            }

            session.guest(params.get('k') ?? token).then(({ data }) => {
                document.dispatchEvent(new Event('undangan.session'));
                progress.complete('config');

                if (img.hasDataSrc()) {
                    img.load();
                }

                vid.load();
                aud.load();
                lib.load({ confetti: data.is_confetti_animation });

                comment.show()
                    .then(() => progress.complete('comment'))
                    .catch(() => progress.invalid('comment'));

            }).catch(() => progress.invalid('config'));
        }
    };

    /**
     * @returns {object}
     */
    const init = () => {
        theme.init();
        session.init();
        pwa.init();

        if (session.isAdmin()) {
            storage('user').clear();
            storage('owns').clear();
            storage('likes').clear();
            storage('session').clear();
            storage('comment').clear();
        }

        window.addEventListener('load', () => {
            pool.init(pageLoaded, [
                'image',
                'video',
                'audio',
                'libs',
                'gif',
            ]);
        });

        return {
            util,
            theme,
            comment,
            chat,
            emojiPicker,
            pwa,
            guest: {
                open,
                modal,
                showStory,
                closeInformation,
                submitRsvp,
                selectRsvp,
            },
        };
    };

    return {
        init,
    };
})();