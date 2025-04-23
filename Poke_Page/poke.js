// poke.js
(() => {
    /* --- State & Selectors --- */
    const stored = JSON.parse(localStorage.getItem('caughtPokemon')) ?? [];
    const normalized = stored.map(e =>
        typeof e === 'object' && e.id ? e : { id: e, caughtAt: Date.now() }
    );
    const state = { offset: 0, limit: 20, caught: normalized };
    localStorage.setItem('caughtPokemon', JSON.stringify(state.caught));

    const grid        = document.getElementById('pokemon-grid');
    const loadMore    = document.getElementById('load-more');
    const searchInput = document.getElementById('search-pokemon');
    const viewGallery = document.getElementById('view-gallery');

    const overlay      = document.getElementById('overlay');
    const detailModal  = document.getElementById('pokemon-details');
    const galleryModal = document.getElementById('gallery-modal');
    const closeDetail  = document.getElementById('close-details');
    const closeGallery = document.getElementById('close-gallery');

    const imgEl    = document.getElementById('details-image');
    const nameEl   = document.getElementById('details-name');
    const typesEl  = document.getElementById('details-types');
    const movesEl  = document.getElementById('details-moves');
    const catchBtn = document.getElementById('catch-button');

    const counterEl   = document.getElementById('caught-counter');
    const stacksEl    = document.getElementById('gallery-stacks');
    const scrollTopBtn = document.getElementById('scroll-to-top');

    /* --- Utilities --- */
    const extractId  = url => url.split('/').filter(Boolean).pop();
    const cap        = s => s.charAt(0).toUpperCase() + s.slice(1);
    const saveCaught = () => localStorage.setItem('caughtPokemon', JSON.stringify(state.caught));
    const updateCount= () => counterEl.textContent = `Pokémon Caught: ${state.caught.length}`;

    /* --- Focus Trap --- */
    function trapFocus(modal) {
        const focusable = modal.querySelectorAll(
            'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length-1];
        first.focus();
        function keyListener(e) {
            if (e.key === 'Tab') {
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault(); last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault(); first.focus();
                }
            } else if (e.key === 'Escape') {
                if (!detailModal.classList.contains('hidden')) closeDetailModal();
                else if (!galleryModal.classList.contains('hidden')) closeGalleryModal();
            }
        }
        modal.addEventListener('keydown', keyListener);
        modal._release = () => modal.removeEventListener('keydown', keyListener);
    }

    /* --- API --- */
    const api = {
        list:  async (off, lim) => {
            const r = await fetch(`https://pokeapi.co/api/v2/pokemon?offset=${off}&limit=${lim}`);
            if (!r.ok) throw Error('List fetch failed');
            return (await r.json()).results;
        },
        detail: async id => {
            const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
            if (!r.ok) throw Error('Detail fetch failed');
            return r.json();
        }
    };

    /* --- Render & Load --- */
    const makeCard = data => {
        const { id, name, sprites } = data;
        const card = document.createElement('div');
        card.className = 'pokemon-card';
        card.dataset.id = id;
        card.innerHTML = `
      <img src="${sprites.other['official-artwork'].front_default}" alt="${name}" />
      <h3>${cap(name)}</h3>
    `;
        if (state.caught.some(p=>p.id===id)) card.classList.add('caught');
        card.addEventListener('click', ()=>openDetail(data));
        return card;
    };

    const loadBatch = async () => {
        loadMore.disabled = true;
        try {
            const list    = await api.list(state.offset, state.limit);
            const details = await Promise.all(list.map(p=>api.detail(extractId(p.url))));
            const frag    = document.createDocumentFragment();
            details.forEach(d=>frag.append(makeCard(d)));
            grid.append(frag);
            state.offset += state.limit;
            applyFilter();
        } finally {
            loadMore.disabled = false;
        }
    };

    /* --- Detail Modal --- */
    const openDetail = data => {
        const { id, name, sprites, types, moves } = data;
        imgEl.src          = sprites.other['official-artwork'].front_default;
        nameEl.textContent = cap(name);
        typesEl.innerHTML  = `<strong>Types</strong><ul>${types.map(t=>`<li>${t.type.name}</li>`).join('')}</ul>`;
        movesEl.innerHTML  = `<strong>Moves</strong><ul>${moves.slice(0,5).map(m=>`<li>${m.move.name}</li>`).join('')}</ul>`;

        const isCaught = state.caught.some(p=>p.id===id);
        catchBtn.textContent      = isCaught ? 'Release' : 'Catch';
        catchBtn.style.background = isCaught ? '#FF6347' : 'darkseagreen';
        catchBtn.onclick = () => {
            if (isCaught) state.caught = state.caught.filter(p=>p.id!==id);
            else state.caught.push({ id, caughtAt: Date.now() });
            saveCaught(); updateCount();
            document.querySelector(`.pokemon-card[data-id="${id}"]`)
                ?.classList.toggle('caught',!isCaught);
            rebuildGallery();
            closeDetailModal();
        };

        // blur header & main & gallery
        document.querySelectorAll('main, .pg-header, #gallery-modal')
            .forEach(el=>el.classList.add('blur-background'));

        overlay.classList.remove('hidden');
        detailModal.classList.remove('hidden');
        trapFocus(detailModal);
    };

    const closeDetailModal = () => {
        overlay.classList.add('hidden');
        detailModal.classList.add('hidden');
        detailModal._release?.();
        // remove only detail blur
        document.getElementById('gallery-modal').classList.remove('blur-background');
    };

    /* --- Search Filter --- */
    const applyFilter = () => {
        const term = searchInput.value.toLowerCase();
        document.querySelectorAll('.pokemon-card').forEach(c=>{
            c.style.display =
                c.querySelector('h3').textContent.toLowerCase().includes(term) ? '' : 'none';
        });
    };

    /* --- Gallery Stacks --- */
    async function rebuildGallery() {
        stacksEl.innerHTML = '';
        const details = await Promise.all(
            state.caught.map(e=>api.detail(e.id).then(d=>({...d, caughtAt:e.caughtAt})))
        );
        const cats = [
            { name:'High Power',   items:[] },
            { name:'Medium Power', items:[] },
            { name:'Low Power',    items:[] }
        ];
        details.forEach(d=>{
            if (d.base_experience>200) cats[0].items.push(d);
            else if (d.base_experience>100) cats[1].items.push(d);
            else cats[2].items.push(d);
        });
        cats.forEach(cat=>{
            if (!cat.items.length) return;
            const stack = document.createElement('div'); stack.className='stack';
            const hdr   = document.createElement('div'); hdr.className='stack-header';
            hdr.innerHTML = `<h3>${cat.name}</h3><span>(${cat.items.length})</span>`;
            stack.append(hdr);
            const cnt = document.createElement('div'); cnt.className='stack-cards hidden';
            cat.items.forEach(d=>cnt.append(makeCard(d)));
            stack.append(cnt);
            hdr.addEventListener('click', ()=>{
                const open = !cnt.classList.contains('hidden');
                if (open) {
                    gsap.to(cnt.children,{opacity:0,y:-20,stagger:0.05,duration:0.3,
                        onComplete:()=>cnt.classList.add('hidden')});
                } else {
                    cnt.classList.remove('hidden');
                    gsap.fromTo(cnt.children,
                        {opacity:0,y:-20},
                        {opacity:1,y:0,stagger:0.05,duration:0.5,ease:'power2.out'});
                }
            });
            stacksEl.append(stack);
        });
        gsap.from('.stack',{opacity:0,y:20,stagger:0.1,duration:0.6,ease:'power2.out'});
    }

    /* --- Gallery Modal --- */
    const openGalleryModal = () => {
        rebuildGallery();
        document.querySelectorAll('main, .pg-header')
            .forEach(el=>el.classList.add('blur-background'));
        overlay.classList.remove('hidden');
        galleryModal.classList.remove('hidden');
        trapFocus(galleryModal);
    };
    const closeGalleryModal = () => {
        overlay.classList.add('hidden');
        galleryModal.classList.add('hidden');
        galleryModal._release?.();
        document.querySelectorAll('main, .pg-header')
            .forEach(el=>el.classList.remove('blur-background'));
    };

    /* --- Scroll‑to‑Top --- */
    const toggleScrollTop = () => {
        if (window.scrollY > 300) scrollTopBtn.classList.add('visible');
        else scrollTopBtn.classList.remove('visible');
    };
    scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    window.addEventListener('scroll', toggleScrollTop);

    /* --- Events & Init --- */
    loadMore.addEventListener('click', loadBatch);
    searchInput.addEventListener('input', applyFilter);
    viewGallery.addEventListener('click', openGalleryModal);
    closeDetail.addEventListener('click', closeDetailModal);
    closeGallery.addEventListener('click', closeGalleryModal);
    overlay.addEventListener('click', ()=>{
        if (!detailModal.classList.contains('hidden')) closeDetailModal();
        else if (!galleryModal.classList.contains('hidden')) closeGalleryModal();
    });

    document.addEventListener('DOMContentLoaded', async ()=>{
        overlay.classList.add('hidden');
        detailModal.classList.add('hidden');
        galleryModal.classList.add('hidden');
        await loadBatch();
        updateCount();
    });
})();
