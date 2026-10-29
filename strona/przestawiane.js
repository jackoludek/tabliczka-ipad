/* Przestawianie elementów w grupie: myszą (od 8 px ruchu), po przytrzymaniu 0,5 s (mysz i palec) i z klawiatury (Alt + strzałka).
 * Ruch palca przed upływem 0,5 s to przewijanie, więc przewinięcie nigdy nie zmienia kolejności (rdzeń wyglądu Jacka, zasady 10 i 11).
 * Kolejność zostaje zapamiętana w localStorage. Elementy grupy to dzieci kontenera z atrybutem data-id.
 * Każde przestawienie przez człowieka idzie do poPrzestawieniu(przed, po), skąd app.js robi krok do Ctrl+Z. */
(function () {
  'use strict';
  const PREFIKS = 'tabliczka:kolejnosc:';

  function przestawiane(kontener, { klucz, poZmianie, poPrzestawieniu, ogloszenie } = {}) {
    const zapis = PREFIKS + klucz;
    const elementy = () => Array.from(kontener.children).filter(e => e.dataset && e.dataset.id);
    // Przesuwanie liczy tylko widoczne elementy; ukryte zostają na swoich miejscach w zapisie.
    const widoczne = () => elementy().filter(e => !e.hidden);
    const kolejnosc = () => elementy().map(e => e.dataset.id);

    function zapamietaj() {
      try { localStorage.setItem(zapis, JSON.stringify(kolejnosc())); } catch (e) { /* brak miejsca */ }
      if (poZmianie) poZmianie(kolejnosc());
    }
    /** Układa elementy w podanej kolejności: nieznane id pomija, brakujące zostają na końcu. */
    function uloz(lista) {
      const mapa = new Map(elementy().map(e => [e.dataset.id, e]));
      for (const id of lista) { const e = mapa.get(id); if (e) kontener.appendChild(e); }
    }
    /** Przestawienie z ręki człowieka: zapis i krok do cofnięcia, gdy kolejność naprawdę się zmieniła. */
    function przestawione(przed) {
      const po = kolejnosc();
      if (przed.join(',') === po.join(',')) return;
      zapamietaj();
      if (poPrzestawieniu) poPrzestawieniu(przed, po);
    }

    // Przywrócenie zapisanej kolejności (nowe elementy zostają na końcu).
    try {
      const k = JSON.parse(localStorage.getItem(zapis) || 'null');
      if (Array.isArray(k)) { uloz(k); if (poZmianie) poZmianie(kolejnosc()); }
    } catch (e) { /* zły zapis: domyślna kolejność */ }

    let ciagniety = null, x0 = 0, y0 = 0, ruszyl = false, przed = null, czekaj = null, palec = false;

    function zacznij() {
      ruszyl = true;
      ciagniety.classList.add('przeciagany');
      kontener.classList.add('przestawianie');
    }

    function koniec() {
      clearTimeout(czekaj); czekaj = null;
      if (ciagniety && ruszyl) {
        ciagniety.classList.remove('przeciagany');
        kontener.classList.remove('przestawianie');
        przestawione(przed);
        // kliknięcie po przeciągnięciu nie ma uruchamiać przycisku
        const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
        window.addEventListener('click', stop, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 50);
      }
      ciagniety = null; ruszyl = false; palec = false;
    }

    function przesun(x, y) {
      const inne = widoczne().filter(e => e !== ciagniety);
      for (const e of inne) {
        const r = e.getBoundingClientRect();
        if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
        const c = ciagniety.getBoundingClientRect();
        const tenSamWiersz = Math.abs(c.top - r.top) < Math.min(c.height, r.height) / 2;
        const przedNim = tenSamWiersz ? x < r.left + r.width / 2 : y < r.top + r.height / 2;
        kontener.insertBefore(ciagniety, przedNim ? e : e.nextSibling);
        break;
      }
    }

    kontener.addEventListener('pointerdown', ev => {
      if (ev.button > 0) return;
      const el = ev.target.closest('[data-id]');
      if (!el || el.parentElement !== kontener) return;
      ciagniety = el; x0 = ev.clientX; y0 = ev.clientY; ruszyl = false; przed = kolejnosc();
      palec = ev.pointerType !== 'mouse';
      clearTimeout(czekaj);
      czekaj = setTimeout(() => { if (ciagniety && !ruszyl) zacznij(); }, 500);
    });

    window.addEventListener('pointermove', ev => {
      if (!ciagniety) return;
      if (!ruszyl) {
        const odl = Math.hypot(ev.clientX - x0, ev.clientY - y0);
        if (palec) { if (odl > 10) { clearTimeout(czekaj); ciagniety = null; } return; } // to przewijanie
        if (odl < 8) return;
        clearTimeout(czekaj); zacznij();
      }
      przesun(ev.clientX, ev.clientY);
    });
    // Palcem po przytrzymaniu: strona się nie przewija, element jedzie za palcem.
    window.addEventListener('touchmove', ev => {
      if (ciagniety && ruszyl) { ev.preventDefault(); const t = ev.touches[0]; if (t) przesun(t.clientX, t.clientY); }
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
      const przedK = kolejnosc();
      kontener.insertBefore(el, j < i ? lista[j] : lista[j].nextSibling);
      el.focus();
      przestawione(przedK);
      if (ogloszenie) ogloszenie(`Przesunięte na miejsce ${j + 1} z ${lista.length}.`);
    });

    return {
      kolejnosc,
      /** Kolejność z cofania albo ponawiania: ułożenie i zapis, bez nowego kroku. */
      ustaw(lista) { uloz(lista); zapamietaj(); },
      /** true, gdy kolejność różni się od domyślnej (wtedy „Przywróć kolejność” jest czynne). */
      zmieniona() {
        const dom = (kontener.dataset.domyslne || '').split(',').filter(Boolean).join(',');
        return kolejnosc().join(',') !== dom;
      },
      przywroc() {
        try { localStorage.removeItem(zapis); } catch (e) { /* trudno */ }
        uloz((kontener.dataset.domyslne || '').split(',').filter(Boolean));
        if (poZmianie) poZmianie(kolejnosc());
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
