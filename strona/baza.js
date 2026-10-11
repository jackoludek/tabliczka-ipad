/* Zapis w telefonie: stan (działania, słoik, ustawienia) w localStorage,
 * każda odpowiedź osobno w IndexedDB (dziennik do Excela). Nic nie wychodzi z telefonu. */
(function () {
  'use strict';
  const KLUCZ = 'tabliczka:stan';
  const KLUCZ_ZAPAS = 'tabliczka:odpowiedzi'; // gdy przeglądarka nie da IndexedDB
  const NAZWA_DB = 'tabliczka';

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

  let polaczenie = null;
  function db() {
    if (!('indexedDB' in globalThis)) return Promise.reject(new Error('brak IndexedDB'));
    if (!polaczenie) {
      polaczenie = new Promise((ok, zle) => {
        const r = indexedDB.open(NAZWA_DB, 1);
        r.onupgradeneeded = () => { r.result.createObjectStore('odpowiedzi', { autoIncrement: true }); };
        r.onsuccess = () => ok(r.result);
        r.onerror = () => zle(r.error);
        r.onblocked = () => zle(new Error('baza zablokowana'));
      }).catch(e => { polaczenie = null; throw e; });
    }
    return polaczenie;
  }

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
    try {
      const d = await db();
      lista = await new Promise((ok, zle) => {
        const r = d.transaction('odpowiedzi').objectStore('odpowiedzi').getAll();
        r.onsuccess = () => ok(r.result || []);
        r.onerror = () => zle(r.error);
      });
    } catch (e) { /* tylko zapas */ }
    return lista.concat(zapas()).sort((a, b) => a.ts - b.ts);
  }

  async function wyczysc() {
    localStorage.removeItem(KLUCZ);
    localStorage.removeItem(KLUCZ_ZAPAS);
    try {
      const d = await db();
      await new Promise((ok, zle) => {
        const t = d.transaction('odpowiedzi', 'readwrite');
        t.objectStore('odpowiedzi').clear();
        t.oncomplete = () => ok();
        t.onerror = () => zle(t.error);
      });
    } catch (e) { /* nie było bazy */ }
  }

  /** Prośba o trwałe miejsce: telefon nie skasuje danych przy braku miejsca. */
  async function utrwal() {
    try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) { /* nie wspiera */ }
    return false;
  }

  globalThis.Baza = { domyslne, wczytajStan, zapiszStan, dodajOdpowiedz, odpowiedzi, wyczysc, utrwal };
})();
