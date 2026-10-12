/* Przestawianie elementów w grupie: przeciąganie myszą (od 8 px ruchu), palcem (po przytrzymaniu)
 * i z klawiatury (Alt + strzałka). Kolejność zostaje zapamiętana w localStorage.
 * Elementy grupy to dzieci kontenera z atrybutem data-id. */
(function () {
  'use strict';
  const PREFIKS = 'tabliczka:kolejnosc:';

  function przestawiane(kontener, { klucz, poZmianie, ogloszenie } = {}) {
    const zapis = PREFIKS + klucz;
    const elementy = () => Array.from(kontener.children).filter(e => e.dataset && e.dataset.id);
    // Przesuwanie liczy tylko widoczne elementy; ukryte zostają na swoich miejscach w zapisie.
    const widoczne = () => elementy().filter(e => !e.hidden);

    function zapamietaj() {
      try { localStorage.setItem(zapis, JSON.stringify(elementy().map(e => e.dataset.id))); } catch (e) { /* brak miejsca */ }
      if (poZmianie) poZmianie(elementy().map(e => e.dataset.id));
    }

    // Przywrócenie zapisanej kolejności (nowe elementy zostają na końcu).
    try {
      const k = JSON.parse(localStorage.getItem(zapis) || 'null');
      if (Array.isArray(k)) {
        const mapa = new Map(elementy().map(e => [e.dataset.id, e]));
        for (const id of k) { const e = mapa.get(id); if (e) kontener.appendChild(e); }
        if (poZmianie) poZmianie(elementy().map(e => e.dataset.id));
      }
    } catch (e) { /* zły zapis: domyślna kolejność */ }

    let ciagniety = null, x0 = 0, y0 = 0, ruszyl = false, czekaj = null, palec = false;

    function koniec() {
      clearTimeout(czekaj); czekaj = null;
      if (ciagniety && ruszyl) {
        ciagniety.classList.remove('przeciagany');
        kontener.classList.remove('przestawianie');
        zapamietaj();
        // kliknięcie po przeciągnięciu nie ma uruchamiać przycisku
        const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
        window.addEventListener('click', stop, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 50);
      }
      ciagniety = null; ruszyl = false; palec = false;
    }

    function zacznij() {
      ruszyl = true;
      ciagniety.classList.add('przeciagany');
      kontener.classList.add('przestawianie');
    }

    function przesun(x, y) {
      const inne = widoczne().filter(e => e !== ciagniety);
      for (const e of inne) {
        const r = e.getBoundingClientRect();
        if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
        const c = ciagniety.getBoundingClientRect();
        const tenSamWiersz = Math.abs(c.top - r.top) < Math.min(c.height, r.height) / 2;
        const przed = tenSamWiersz ? x < r.left + r.width / 2 : y < r.top + r.height / 2;
        kontener.insertBefore(ciagniety, przed ? e : e.nextSibling);
        break;
      }
    }

    kontener.addEventListener('pointerdown', ev => {
      const el = ev.target.closest('[data-id]');
      if (!el || el.parentElement !== kontener || ev.button > 0) return;
      ciagniety = el; x0 = ev.clientX; y0 = ev.clientY; ruszyl = false;
      palec = ev.pointerType === 'touch';
      if (palec) czekaj = setTimeout(() => { if (ciagniety) zacznij(); }, 350);
    });

    window.addEventListener('pointermove', ev => {
      if (!ciagniety) return;
      const odl = Math.hypot(ev.clientX - x0, ev.clientY - y0);
      if (!ruszyl) {
        if (palec) { if (odl > 10) { clearTimeout(czekaj); ciagniety = null; } return; } // to przewijanie
        if (odl < 8) return;
        zacznij();
      }
      przesun(ev.clientX, ev.clientY);
    });
    // Palcem po przytrzymaniu: strona się nie przewija, element jedzie za palcem.
    window.addEventListener('touchmove', ev => {
      if (ciagniety && ruszyl) {
        ev.preventDefault();
        const t = ev.touches[0]; if (t) przesun(t.clientX, t.clientY);
      }
    }, { passive: false });
    window.addEventListener('pointerup', koniec);
    window.addEventListener('pointercancel', koniec);

    kontener.addEventListener('keydown', ev => {
      if (!ev.altKey) return;
      const el = ev.target.closest('[data-id]');
      if (!el || el.parentElement !== kontener) return;
      const lista = widoczne(), i = lista.indexOf(el);
      let j = i;
      if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') j = i - 1;
      else if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') j = i + 1;
      else return;
      ev.preventDefault();
      if (j < 0 || j >= lista.length) return;
      kontener.insertBefore(el, j < i ? lista[j] : lista[j].nextSibling);
      el.focus();
      zapamietaj();
      if (ogloszenie) ogloszenie(`Przesunięte na miejsce ${j + 1} z ${lista.length}.`);
    });

    return {
      /** true, gdy kolejność różni się od domyślnej (wtedy „Przywróć kolejność” jest czynne). */
      zmieniona() {
        const dom = (kontener.dataset.domyslne || '').split(',').filter(Boolean).join(',');
        return elementy().map(e => e.dataset.id).join(',') !== dom;
      },
      przywroc() {
        try { localStorage.removeItem(zapis); } catch (e) { /* trudno */ }
        const k = (kontener.dataset.domyslne || '').split(',').filter(Boolean);
        const mapa = new Map(elementy().map(e => [e.dataset.id, e]));
        for (const id of k) { const e = mapa.get(id); if (e) kontener.appendChild(e); }
        if (poZmianie) poZmianie(elementy().map(e => e.dataset.id));
      },
    };
  }

  /** Zapamiętuje domyślną kolejność (do „Przywróć kolejność”) i włącza przestawianie. */
  function wlacz(kontener, opcje) {
    if (!kontener.dataset.domyslne) kontener.dataset.domyslne = Array.from(kontener.children).map(e => e.dataset && e.dataset.id).filter(Boolean).join(',');
    return przestawiane(kontener, opcje);
  }

  globalThis.Przestawiane = { wlacz, PREFIKS };
})();
