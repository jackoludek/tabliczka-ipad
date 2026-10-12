/* Zapis na urządzeniu: stan (działania, słoik, ustawienia) w localStorage,
 * każda odpowiedź osobno w IndexedDB (dziennik do Excela). Nic nie wychodzi z urządzenia. */
(function () {
  'use strict';
  const KLUCZ = 'tabliczka:stan';
  const KLUCZ_ZAPAS = 'tabliczka:odpowiedzi'; // gdy przeglądarka nie da IndexedDB
  const NAZWA_DB = 'tabliczka';
  // Kopia sprzed „Wyczyść wszystko” (jedna, ostatnia): stan w localStorage, odpowiedzi w osobnej bazie.
  const KLUCZ_KOPII = 'tabliczka:kopia-przed-wyczyszczeniem';
  const NAZWA_KOPII = 'tabliczka-kopia';

  function domyslne() {
    return {
      wersja: 1,
      dzialania: {},
      sloik: { punkty: 0, historia: [] },
      sesje: [],
      slupek: { poziom: 1, gladkich: 0, zadan: 0 },
      ustawienia: {
        // Imię wpisują rodzice w aplikacji; strona jest publiczna, więc domyślnie bez imienia.
        imie: '', punktyZaSesje: 10, sesjiDziennie: 2, celPunkty: 200, celOpis: '800 Robuxów', pin: '',
        moduly: { reszta: 'auto', slupek: 'auto' }, zadanSlupka: 3,
      },
    };
  }

  function wczytajStan() {
    try {
      const s = JSON.parse(localStorage.getItem(KLUCZ) || 'null');
      if (s && s.wersja === 1) {
        const d = domyslne();
        const u = { ...d.ustawienia, ...(s.ustawienia || {}) };
        u.moduly = { ...d.ustawienia.moduly, ...((s.ustawienia && s.ustawienia.moduly) || {}) };
        return { ...d, ...s, sloik: { ...d.sloik, ...(s.sloik || {}) }, slupek: { ...d.slupek, ...(s.slupek || {}) }, ustawienia: u };
      }
    } catch (e) { /* uszkodzony zapis: zaczynamy od nowa, stary zostaje pod kluczem kopii */
      try { localStorage.setItem(KLUCZ + ':uszkodzony', localStorage.getItem(KLUCZ) || ''); } catch (e2) { /* brak miejsca */ }
    }
    return domyslne();
  }

  function zapiszStan(s) {
    try { localStorage.setItem(KLUCZ, JSON.stringify(s)); return true; } catch (e) { return false; }
  }

  function otworz(nazwa) {
    if (!('indexedDB' in globalThis)) return Promise.reject(new Error('brak IndexedDB'));
    return new Promise((ok, zle) => {
      const r = indexedDB.open(nazwa, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('odpowiedzi', { autoIncrement: true }); };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => zle(r.error);
      r.onblocked = () => zle(new Error('baza zablokowana'));
    });
  }

  let polaczenie = null;
  function db() {
    if (!polaczenie) polaczenie = otworz(NAZWA_DB).catch(e => { polaczenie = null; throw e; });
    return polaczenie;
  }

  const wszystkie = d => new Promise((ok, zle) => {
    const r = d.transaction('odpowiedzi').objectStore('odpowiedzi').getAll();
    r.onsuccess = () => ok(r.result || []);
    r.onerror = () => zle(r.error);
  });
  /** Zamienia zawartość bazy na podaną listę, w jednej transakcji. */
  const zastap = (d, lista) => new Promise((ok, zle) => {
    const t = d.transaction('odpowiedzi', 'readwrite'), s = t.objectStore('odpowiedzi');
    s.clear(); for (const o of lista) s.add(o);
    t.oncomplete = () => ok(); t.onerror = () => zle(t.error);
  });

  function zapas() { try { return JSON.parse(localStorage.getItem(KLUCZ_ZAPAS) || '[]'); } catch (e) { return []; } }

  async function dodajOdpowiedz(o) {
    try {
      const d = await db();
      await new Promise((ok, zle) => {
        const t = d.transaction('odpowiedzi', 'readwrite');
        t.objectStore('odpowiedzi').add(o);
        t.oncomplete = () => ok();
        t.onerror = () => zle(t.error);
      });
    } catch (e) {
      const l = zapas(); l.push(o);
      try { localStorage.setItem(KLUCZ_ZAPAS, JSON.stringify(l)); } catch (e2) { /* brak miejsca */ }
    }
  }

  async function odpowiedzi() {
    let lista = [];
    try { lista = await wszystkie(await db()); } catch (e) { /* tylko zapas */ }
    return lista.concat(zapas()).sort((a, b) => a.ts - b.ts);
  }

  /** „Wyczyść wszystko” da się cofnąć: najpierw kopia, potem kasowanie. Bez kopii nic nie kasuje (false). */
  async function wyczysc() {
    let wBazie = false, lista = [];
    try { lista = await wszystkie(await db()); } catch (e) { /* nie ma bazy */ }
    if (lista.length) {
      try { const k = await otworz(NAZWA_KOPII); await zastap(k, lista); k.close(); wBazie = true; } catch (e) { return false; }
    }
    const kopia = { ts: Date.now(), stan: localStorage.getItem(KLUCZ), zapas: localStorage.getItem(KLUCZ_ZAPAS), wBazie };
    try { localStorage.setItem(KLUCZ_KOPII, JSON.stringify(kopia)); } catch (e) { return false; }
    localStorage.removeItem(KLUCZ);
    localStorage.removeItem(KLUCZ_ZAPAS);
    try { await zastap(await db(), []); } catch (e) { /* nie było bazy */ }
    return true;
  }

  function kopia() { try { return JSON.parse(localStorage.getItem(KLUCZ_KOPII) || 'null'); } catch (e) { return null; } }

  /** Przywraca stan sprzed wyczyszczenia. Odpowiedzi z kopii wracają, a te dodane od tamtej pory zostają. */
  async function cofnijWyczyszczenie() {
    const k = kopia();
    if (!k) return false;
    if (k.wBazie) {
      const kd = await otworz(NAZWA_KOPII), d = await db();
      const stare = await wszystkie(kd), nowe = await wszystkie(d);
      await zastap(d, stare.concat(nowe).sort((a, b) => a.ts - b.ts));
      await zastap(kd, []); kd.close();
    }
    if (k.stan) localStorage.setItem(KLUCZ, k.stan); else localStorage.removeItem(KLUCZ);
    if (k.zapas) localStorage.setItem(KLUCZ_ZAPAS, k.zapas);
    localStorage.removeItem(KLUCZ_KOPII);
    return true;
  }

  /** Prośba o trwałe miejsce: telefon nie skasuje danych przy braku miejsca. */
  async function utrwal() {
    try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) { /* nie wspiera */ }
    return false;
  }

  globalThis.Baza = { domyslne, wczytajStan, zapiszStan, dodajOdpowiedz, odpowiedzi, wyczysc, kopia, cofnijWyczyszczenie, utrwal };
})();
