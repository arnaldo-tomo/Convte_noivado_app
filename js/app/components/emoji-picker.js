export const emojiPicker = (() => {

    let isVisible = false;

    const categories = {
        'Caras': ['😀','😂','🥰','😍','😘','🤩','😊','🥹','😭','🤗','😎','🤭','😏','🥳','😇','🫶'],
        'Amor': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💕','💞','💓','💗','💖','💝','💘','💌'],
        'Festa': ['🎉','🎊','🥂','🍾','🎂','🎁','🎈','🎆','🎇','✨','🌟','⭐','🔥','🎵','🎶','🎤'],
        'Casamento': ['💒','💍','👰','🤵','💐','🌹','🌸','🌺','🌷','🕊️','🦋','🫧','🪷','🌻','🌼','💮'],
        'Gestos': ['👏','🙌','🤝','👍','💪','🙏','✌️','🤟','👋','🫡','🫂','💃','🕺','👫','💑','👨‍❤️‍👩'],
        'Comida': ['🍰','🧁','🍩','🍫','🍪','🍨','🍹','🍷','☕','🫖','🍕','🍔','🥗','🍣','🎂','🥘'],
    };

    const toggle = () => {
        isVisible ? hide() : show();
    };

    const show = () => {
        const panel = document.getElementById('emoji-picker-panel');
        if (!panel) return;

        if (panel.children.length === 0) render(panel);

        panel.classList.remove('d-none');
        isVisible = true;
    };

    const hide = () => {
        const panel = document.getElementById('emoji-picker-panel');
        if (panel) panel.classList.add('d-none');
        isVisible = false;
    };

    const render = (panel) => {
        let html = '<div class="emoji-picker-tabs d-flex gap-1 px-2 py-1 border-bottom overflow-x-auto flex-nowrap" style="scrollbar-width:none;">';

        const catNames = Object.keys(categories);
        catNames.forEach((name, i) => {
            html += `<button class="btn btn-sm rounded-3 px-2 py-1 flex-shrink-0 ${i === 0 ? 'btn-primary' : 'btn-outline-secondary'} emoji-tab-btn" style="font-size:0.7rem;" data-tab="${name}" onclick="undangan.emojiPicker.switchTab('${name}')">${name}</button>`;
        });

        html += '</div><div class="emoji-picker-grid p-2" id="emoji-grid"></div>';
        panel.innerHTML = html;

        switchTab(catNames[0]);
    };

    const switchTab = (name) => {
        const grid = document.getElementById('emoji-grid');
        if (!grid) return;

        const emojis = categories[name] || [];
        grid.innerHTML = emojis.map((e) =>
            `<button class="btn btn-sm p-1 emoji-item" style="font-size:1.4rem; width:40px; height:40px;" onclick="undangan.emojiPicker.insert('${e}')">${e}</button>`
        ).join('');

        // Update active tab
        document.querySelectorAll('.emoji-tab-btn').forEach((b) => {
            if (b.getAttribute('data-tab') === name) {
                b.classList.add('btn-primary');
                b.classList.remove('btn-outline-secondary');
            } else {
                b.classList.remove('btn-primary');
                b.classList.add('btn-outline-secondary');
            }
        });
    };

    const insert = (emoji) => {
        const input = document.getElementById('chat-input');
        if (!input) return;

        const start = input.selectionStart;
        const end = input.selectionEnd;
        const value = input.value;

        input.value = value.substring(0, start) + emoji + value.substring(end);
        input.selectionStart = input.selectionEnd = start + emoji.length;
        input.focus();
    };

    return {
        toggle,
        show,
        hide,
        insert,
        switchTab,
    };
})();
