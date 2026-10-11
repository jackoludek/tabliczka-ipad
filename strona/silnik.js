/* Silnik nauki: działania, pudełka powtórek, dobór pytań, ocena odpowiedzi, punkty i eksport.
 * Bez ekranu i bez zapisu, więc da się go sprawdzić testami w Node (testy\silnik.test.cjs).
 *
 * Skąd te zasady (plik z researchem i planem obok projektu):
 * - pytamy, nie pokazujemy (przypominanie z pamięci, fiszki > recytowanie),
 * - dużo trafień: nowych działań w sesji mało, reszta to rzeczy już znane (Jansen i in. 2013),
 * - przemieszane działania (Rohrer i in.), dzielenie osobno od mnożenia (Rickard 2005),
 * - czas mierzony po cichu; szybkie złe odpowiedzi pod rząd to sygnał „chcę uciec” (Cipora 2015),
 * - punkty za skończone sesje, nie za wynik (Fryer 2011).
 */
(function () {
  'use strict';

  const MIN = 2;
  const MAX = 9;
  const DZIEN_MS = 86400000;
  // Pudełko 0 = jeszcze nie umie. Każdy awans (najwyżej raz dziennie) odsuwa powtórkę.
  const ODSTEPY_DNI = [0, 1, 3, 7, 14, 30];
  const NAJWYZSZE = ODSTEPY_DNI.length - 1;

  const USTAWIENIA = Object.freeze({
    szybkoMs: 4000,          // dobrze w tym czasie = płynnie (palec na klawiaturze telefonu wliczony)
    ucieczkaMs: 1500,        // zła odpowiedź szybsza niż to: możliwa „ucieczka”, nie niewiedza
    pytanWSesji: 18,
    minPytan: 8,             // krótsza sesja liczy się do punktów tylko, gdy skończyła całą kolejkę
    maxNowych: 3,            // w ćwiczeniu najwyżej 3 działania, których dziecko jeszcze nie umie
    maxNowychSprawdzian: 12, // w sprawdzianie startowym tyle niewidzianych naraz
    maxWsparciaSprawdzian: 6,
    bledowNaSesje: 2,        // sprawdzian: tyle pomyłek na sesję najwyżej się spodziewamy
    sesjaMaxMs: 10 * 60000,  // po 10 minutach zostaje tylko łatwe pytanie na koniec
    progTrafien: 0.7,        // poniżej tego w ostatnich odpowiedziach: koniec z nowymi w tej sesji
  });

  // --- Działania -------------------------------------------------------------------------

  /** Wszystkie 100 działań: 36 par mnożenia (a ≤ b, kolejność czynników losowana przy pytaniu)
   *  i 64 dzielenia w zakresie tabliczki, każde osobno, bo w pamięci siedzą osobno. */
  function wszystkie() {
    const lista = [];
    for (let a = MIN; a <= MAX; a++) for (let b = a; b <= MAX; b++) lista.push({ id: `m:${a}:${b}`, typ: 'm', a, b });
    for (let a = MIN; a <= MAX; a++) for (let b = MIN; b <= MAX; b++) lista.push({ id: `d:${a * b}:${a}`, typ: 'd', p: a * b, a, b });
    return lista;
  }

  /** Dzielenie z resztą w pamięci: 72 rodziny „dzielnik × iloraz” (2–9 × 1–9). Reszta (1 … dzielnik−1)
   *  jest losowana przy każdym pytaniu, bo umiejętność to ta sama: znaleźć najbliższy wynik w tabliczce. */
  function reszty() {
    const lista = [];
    for (let a = MIN; a <= MAX; a++) for (let b = 1; b <= MAX; b++) lista.push({ id: `r:${a}:${b}`, typ: 'r', a, b });
    return lista;
  }

  /** Pula działań jednego rodzaju sesji: 'tabliczka' (100) albo 'reszta' (72). */
  function pula(rodzaj) { return rodzaj === 'reszta' ? reszty() : wszystkie(); }
  function zPuli(id, rodzaj) { return rodzaj === 'reszta' ? String(id).startsWith('r:') : /^[md]:/.test(String(id)); }

  function dzialanie(id) {
    const [typ, x, y] = String(id).split(':');
    const n1 = Number(x), n2 = Number(y);
    if (typ === 'm' && n1 >= MIN && n2 <= MAX && n1 <= n2) return { id, typ, a: n1, b: n2 };
    if (typ === 'd' && n2 >= MIN && n2 <= MAX && n1 % n2 === 0 && n1 / n2 >= MIN && n1 / n2 <= MAX) return { id, typ, p: n1, a: n2, b: n1 / n2 };
    if (typ === 'r' && n1 >= MIN && n1 <= MAX && n2 >= 1 && n2 <= MAX) return { id, typ, a: n1, b: n2 };
    throw new Error(`Nieznane działanie: ${id}`);
  }

  /** Wynik: iloczyn albo iloraz. Przy dzieleniu z resztą iloraz (reszta jest we wpisie kolejki). */
  function wynik(d) { return d.typ === 'm' ? d.a * d.b : d.b; }

  function tresc(d, odwroc, reszta) {
    if (d.typ === 'm') return odwroc ? `${d.b} × ${d.a}` : `${d.a} × ${d.b}`;
    if (d.typ === 'r') return `${d.a * d.b + (reszta || 1)} : ${d.a}`;
    return `${d.p} : ${d.a}`;
  }

  /** Nazwa dla pochwały i dla rodziców (rodzina z resztą: „46–49 : 5”). */
  function nazwa(d) {
    if (d.typ === 'r') return d.a === 2 ? `${d.a * d.b + 1} : 2` : `${d.a * d.b + 1}–${d.a * d.b + d.a - 1} : ${d.a}`;
    return tresc(d);
  }

  /** Przybliżona trudność na start (efekt wielkości: 6, 7, 8 trudne; 2, 5, kwadraty łatwiejsze). */
  function trudnosc(d) {
    const x = Math.min(d.a, d.b), y = Math.max(d.a, d.b);
    let t = x + y;
    if (x === 2) t -= 6;
    if (x === 5 || y === 5) t -= 4;
    if (x === y) t -= 2;
    if (y === 9) t -= 1;
    if (d.typ === 'd') t += 3;
    if (d.typ === 'r') t += x === 1 ? -4 : 4;
    return t;
  }

  /** Sposób na wolne albo pomylone działanie. Nie podaje wyniku wprost. */
  function sposob(d, odwroc, reszta) {
    if (d.typ === 'd') return `Pomyśl: ${d.a} × ? = ${d.p}`;
    if (d.typ === 'r') return `Szukaj w tabliczce ${d.a} największego wyniku, który nie przekracza ${d.a * d.b + (reszta || 1)}. Reszta to to, co zostaje.`;
    const [x, y] = odwroc ? [d.b, d.a] : [d.a, d.b];
    const maly = Math.min(x, y), duzy = Math.max(x, y);
    if (maly === 2) return `Podwój: ${duzy} + ${duzy}`;
    if (maly === 5 || duzy === 5) { const inna = maly === 5 ? duzy : maly; return `Połowa z ${inna} × 10, czyli ${inna * 10} : 2`; }
    if (duzy === 9) return `${maly} × 10 = ${maly * 10}, potem odejmij ${maly}`;
    if (maly === 4 || duzy === 4) { const inna = maly === 4 ? duzy : maly; return `Podwój dwa razy: ${inna} → ${inna * 2} → …`; }
    if (maly === 8 || duzy === 8) { const inna = maly === 8 ? duzy : maly; return `Podwój trzy razy: ${inna} → ${inna * 2} → …`; }
    if (maly === 3) return `Trzy razy: ${duzy} + ${duzy} + ${duzy}`;
    if (maly === duzy) return `${maly} × ${maly - 1} i dodaj jeszcze ${maly}`;
    return `${duzy} × 5 = ${duzy * 5}, potem dodaj ${maly - 5} × ${duzy}`;
  }

  // --- Czas ------------------------------------------------------------------------------

  function kluczDnia(ts) { const x = new Date(ts); return x.getFullYear() * 10000 + (x.getMonth() + 1) * 100 + x.getDate(); }
  function poczatekDnia(ts) { const x = new Date(ts); x.setHours(0, 0, 0, 0); return x.getTime(); }
  function dodajDni(ts, dni) { const x = new Date(poczatekDnia(ts)); x.setDate(x.getDate() + dni); return x.getTime(); }

  // --- Rekord jednego działania -------------------------------------------------------------

  function nowyRekord() { return { pudelko: 0, termin: 0, proby: 0, dobrze: 0, historia: [], awansDzien: 0 }; }

  /** Stan dla rodziców: niewidziane, nowe (jeszcze nie umie), wolne (umie, ale niepewnie albo wolno),
   *  pewne (dwa awanse w różne dni) i mistrz (najwyższe pudełko). */
  function status(r) {
    if (!r || r.proby === 0) return 'niewidziane';
    if (r.pudelko >= NAJWYZSZE) return 'mistrz';
    if (r.pudelko >= 2) return 'pewne';
    if (r.pudelko === 1 || r.historia.slice(-3).some(h => h.ok)) return 'wolne';
    return 'nowe';
  }

  /** Średni czas ostatnich (najwyżej 3) dobrych odpowiedzi, w ms; null, gdy nie ma. */
  function sredniCzas(r) {
    if (!r) return null;
    const dobre = r.historia.filter(h => h.ok).slice(-3);
    if (!dobre.length) return null;
    return Math.round(dobre.reduce((s, h) => s + h.ms, 0) / dobre.length);
  }

  /** Nowy rekord po odpowiedzi. Awans tylko za dobrze i szybko, najwyżej raz dziennie,
   *  więc „pewne” znaczy: umiała w co najmniej dwa różne dni. */
  function zapiszWynik(r0, { ok, ms, teraz }, ust = USTAWIENIA) {
    const r = JSON.parse(JSON.stringify(r0 || nowyRekord()));
    const dzien = kluczDnia(teraz);
    if (r.proby === 0) { r.pierwszaOk = !!ok; r.pierwszaTs = teraz; } // co umiała, zanim zaczęła ćwiczyć
    r.proby += 1;
    if (ok) r.dobrze += 1;
    r.historia.push({ ok: !!ok, ms: Math.max(0, Math.round(ms)), dzien });
    if (r.historia.length > 8) r.historia = r.historia.slice(-8);
    if (!ok) {
      r.pudelko = 0;
      r.termin = poczatekDnia(teraz);
    } else if (ms <= ust.szybkoMs) {
      if (r.awansDzien !== dzien) { r.pudelko = Math.min(NAJWYZSZE, r.pudelko + 1); r.awansDzien = dzien; }
      r.termin = dodajDni(teraz, ODSTEPY_DNI[r.pudelko]);
    } else {
      if (r.pudelko === 0) r.pudelko = 1;
      r.termin = dodajDni(teraz, 1);
    }
    return r;
  }

  // --- Dobór pytań ---------------------------------------------------------------------------

  function tasuj(lista, losuj) {
    const t = lista.slice();
    for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(losuj() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
    return t;
  }

  /** Kolejka jednej sesji. Sprawdzian startowy, dopóki są działania niewidziane
   *  (najpierw całe mnożenie od łatwych, potem dzielenie); potem ćwiczenie z powtórkami. */
  function dobierz(stan, teraz, ust = USTAWIENIA, losuj = Math.random, rodzaj = 'tabliczka') {
    const rek = id => stan[id];
    const lista = pula(rodzaj).map(d => ({ d, r: rek(d.id), trud: trudnosc(d) }));
    const niewidziane = lista.filter(x => !x.r || x.r.proby === 0);
    const widziane = lista.filter(x => x.r && x.r.proby > 0);
    const uczone = widziane.filter(x => x.r.pudelko === 0)
      .sort((p, q) => p.r.termin - q.r.termin || p.trud - q.trud);
    const znane = widziane.filter(x => x.r.pudelko >= 1);
    const doPowtorki = znane.filter(x => x.r.termin <= teraz)
      .sort((p, q) => p.r.pudelko - q.r.pudelko || p.r.termin - q.r.termin);
    const latwe = znane.slice().sort((p, q) => q.r.pudelko - p.r.pudelko || p.trud - q.trud);
    const traf = trafieniaOstatnio(stan, teraz, rodzaj);

    // p = jak często umiała działanie za pierwszym razem, z 8 ostatnich pierwszych prób
    // (sprawdzian idzie od łatwych do trudnych, więc stare próby zawyżałyby wynik). Na start 0,8.
    const pierwsze = widziane.filter(x => typeof x.r.pierwszaOk === 'boolean')
      .sort((a, b) => (b.r.pierwszaTs || 0) - (a.r.pierwszaTs || 0)).slice(0, 8);
    const p = (pierwsze.filter(x => x.r.pierwszaOk).length + 4) / (pierwsze.length + 5);
    const mnozenie = niewidziane.filter(x => x.d.typ === 'm');
    const niewidzianeKolejno = (mnozenie.length ? mnozenie : niewidziane)
      .map(x => ({ x, k: x.trud + losuj() * 3 })).sort((a, b) => a.k - b.k).map(a => a.x);

    // Szybki sprawdzian, dopóki pierwsze próby idą dobrze. Gdy idą słabo, lepiej ćwiczyć to,
    // co już wiadomo, i dokładać po 1–2 niewidziane działania na sesję.
    const szybkiSprawdzian = niewidziane.length > 0 && p >= 0.6 && (traf === null || traf >= 0.7);
    const faza = szybkiSprawdzian ? 'sprawdzian' : 'cwiczenie';
    let nowe, wsparcie;
    if (szybkiSprawdzian) {
      // Tyle niewidzianych naraz, żeby wyszły najwyżej około 2 pomyłki na sesję.
      const ile = p >= 0.75 ? ust.maxNowychSprawdzian
        : Math.max(3, Math.min(ust.maxNowychSprawdzian, Math.round(ust.bledowNaSesje / (1 - p))));
      const sprawdzane = niewidzianeKolejno.slice(0, ile);
      const doNauki = uczone.slice(0, 2);
      nowe = sprawdzane.concat(doNauki);
      // Znane działania do tylu, żeby spodziewane trafienia w sesji wyszły około 80%.
      const potrzeba = Math.ceil((sprawdzane.length * Math.max(0, 0.8 - p) + doNauki.length * 0.4) / 0.15);
      const ileWsparcia = Math.min(ust.pytanWSesji - nowe.length, Math.max(ust.maxWsparciaSprawdzian, potrzeba));
      const wsp = doPowtorki.concat(latwe.filter(x => !doPowtorki.includes(x)));
      wsparcie = wsp.slice(0, Math.max(0, ileWsparcia));
    } else {
      // Ostatnie dni szły słabiej: mniej nowych naraz.
      const maxNowych = traf === null || traf >= 0.88 ? ust.maxNowych : traf >= 0.8 ? 2 : 1;
      // Nauka ma pierwszeństwo przed sprawdzaniem: niewidziane dochodzą tylko wtedy,
      // gdy ostatnio szło dobrze albo nie ma już czego się uczyć.
      let niewidzianych = 0;
      if (niewidziane.length) niewidzianych = traf === null || traf >= 0.88 ? 2 : traf >= 0.75 || !uczone.length ? 1 : 0;
      const ileUczonych = uczone.length ? Math.max(1, maxNowych - niewidzianych) : 0;
      nowe = uczone.slice(0, ileUczonych).concat(niewidzianeKolejno.slice(0, niewidzianych));
      wsparcie = doPowtorki.slice(0, ust.pytanWSesji - nowe.length);
      // Mało do powtórki: sesja jest krótsza, a nie wypchana łatwymi pytaniami.
      // Dokładamy łatwe tylko do minimum, żeby było z czego zrobić sesję.
      for (const x of latwe) {
        if (nowe.length + wsparcie.length >= ust.minPytan) break;
        if (!wsparcie.includes(x)) wsparcie.push(x);
      }
      // Nowe najwyżej co piąte pytanie, żeby trafień było około 9 na 10.
      // Niewidziane są na końcu listy nowych, więc przy cięciu odpadają najpierw.
      const limit = Math.max(1, Math.floor((nowe.length + wsparcie.length) / 5));
      if (nowe.length > limit) {
        const niew = nowe.filter(x => !x.r || x.r.proby === 0);
        const ucz = nowe.filter(x => x.r && x.r.proby > 0);
        nowe = ucz.slice(0, Math.max(0, limit - Math.min(1, niew.length))).concat(niew.slice(0, Math.min(1, niew.length)));
      }
    }
    return { faza, kolejka: uloz(nowe, wsparcie, faza, losuj) };
  }

  /** Odsetek dobrych odpowiedzi z ostatnich 3 dni (bez dzisiejszych); null, gdy było ich mniej niż 10. */
  function trafieniaOstatnio(stan, teraz, rodzaj = 'tabliczka') {
    const dzis = kluczDnia(teraz), od = kluczDnia(dodajDni(teraz, -3));
    let ok = 0, wszystkich = 0;
    for (const id in stan) if (zPuli(id, rodzaj)) for (const h of (stan[id].historia || [])) {
      if (h.dzien >= od && h.dzien < dzis) { wszystkich += 1; if (h.ok) ok += 1; }
    }
    return wszystkich >= 10 ? ok / wszystkich : null;
  }

  function losujReszte(d, losuj) { return 1 + Math.floor(losuj() * (d.a - 1)); }

  function wpis(x, losuj, nowe) {
    const odwroc = x.d.typ === 'm' && x.d.a !== x.d.b && losuj() < 0.5;
    const w = { id: x.d.id, odwroc, nowe: !!nowe, powtorka: false };
    if (x.d.typ === 'r') w.reszta = losujReszte(x.d, losuj);
    return w;
  }

  /** Najpierw coś znanego na rozgrzewkę, potem nowe przekładane znanymi, a na koniec
   *  najłatwiejsze znane, żeby sesja kończyła się sukcesem. */
  function uloz(nowe, wsparcie, faza, losuj) {
    const n = (faza === 'sprawdzian' ? nowe.slice() : tasuj(nowe, losuj));
    const s = tasuj(wsparcie, losuj);
    let koniec = null;
    if (s.length) {
      let k = 0;
      for (let i = 1; i < s.length; i++) if (s[i].r.pudelko > s[k].r.pudelko || (s[i].r.pudelko === s[k].r.pudelko && s[i].trud < s[k].trud)) k = i;
      koniec = s.splice(k, 1)[0];
    }
    const out = [];
    if (s.length && n.length) out.push(wpis(s.shift(), losuj, false));
    while (n.length || s.length) {
      if (n.length) out.push(wpis(n.shift(), losuj, true));
      for (let k = 0; k < 2 && s.length; k++) out.push(wpis(s.shift(), losuj, false));
      if (!n.length) while (s.length) out.push(wpis(s.shift(), losuj, false));
    }
    if (koniec) { const w = wpis(koniec, losuj, false); w.koniec = true; out.push(w); }
    return out;
  }

  // --- Sesja ---------------------------------------------------------------------------------

  function nowaSesja(stan, teraz, ust = USTAWIENIA, losuj = Math.random, rodzaj = 'tabliczka') {
    const { faza, kolejka } = dobierz(stan, teraz, ust, losuj, rodzaj);
    return { id: `s${teraz}`, rodzaj, faza, kolejka, i: 0, start: teraz, odpowiedzi: [], ponowione: [], pominieteNowe: 0, ostatniaPrzerwa: -10 };
  }

  function biezace(s) { return s.kolejka[s.i] || null; }
  function maLatwyKoniec(s) { const o = s.kolejka[s.kolejka.length - 1]; return !!(o && o.koniec); }

  /** Zapisuje odpowiedź na bieżące pytanie. Zwraca nowy stan działań, sygnał („ucieczka”) i koniec. */
  function odpowiedz(s, stan, { ok, ms, nieWiem = false, teraz }, ust = USTAWIENIA) {
    const w = biezace(s);
    if (!w) throw new Error('Sesja jest już skończona.');
    const nowyStan = Object.assign({}, stan);
    nowyStan[w.id] = zapiszWynik(stan[w.id], { ok: !!ok && !nieWiem, ms, teraz }, ust);
    s.odpowiedzi.push({ id: w.id, ok: !!ok && !nieWiem, ms: Math.round(ms), nieWiem: !!nieWiem, ts: teraz, powtorka: !!w.powtorka });

    // Pomyłka wraca za kilka pytań, raz, w drugiej kolejności czynników.
    // Sesja nie rośnie ponad pytanWSesji + 3 przez same powtórki.
    if (!(ok && !nieWiem) && !w.powtorka && !s.ponowione.includes(w.id) && s.kolejka.length < ust.pytanWSesji + 3) {
      s.ponowione.push(w.id);
      const gdzie = Math.max(s.i + 1, Math.min(s.i + 4, s.kolejka.length - (maLatwyKoniec(s) ? 1 : 0)));
      const ponow = { id: w.id, odwroc: !w.odwroc, nowe: false, powtorka: true };
      if (w.reszta) ponow.reszta = w.reszta;
      s.kolejka.splice(gdzie, 0, ponow);
    }

    // Za mało trafień ostatnio: w tej sesji już bez nowych działań.
    const ostatnie = s.odpowiedzi.slice(-6);
    // W sprawdzianie liczbę nowych dobiera już dobór pytań, więc hamulec włącza się dopiero przy połowie pomyłek.
    const prog = s.faza === 'sprawdzian' ? 0.5 : ust.progTrafien;
    if (ostatnie.length >= 5 && ostatnie.filter(o => o.ok).length / ostatnie.length < prog) {
      for (let k = s.kolejka.length - 1; k > s.i; k--) {
        if (s.kolejka[k].nowe && !s.kolejka[k].powtorka) { s.kolejka.splice(k, 1); s.pominieteNowe += 1; }
      }
    }

    // Dwie szybkie złe odpowiedzi pod rząd: proponujemy przerwę (nie częściej niż co 3 pytania).
    const dwie = s.odpowiedzi.slice(-2);
    let sygnal = null;
    if (dwie.length === 2 && dwie.every(o => !o.ok && !o.nieWiem && o.ms < ust.ucieczkaMs) && s.odpowiedzi.length - s.ostatniaPrzerwa >= 3) {
      sygnal = 'ucieczka';
      s.ostatniaPrzerwa = s.odpowiedzi.length;
    }

    s.i += 1;
    if (teraz - s.start >= ust.sesjaMaxMs && s.i < s.kolejka.length) {
      const kon = maLatwyKoniec(s) ? s.kolejka[s.kolejka.length - 1] : null;
      s.kolejka = s.kolejka.slice(0, s.i).concat(kon ? [kon] : []);
    }
    return { stan: nowyStan, sygnal, koniec: s.i >= s.kolejka.length };
  }

  /** Po przerwie: zamiast reszty sesji n najłatwiejszych znanych działań. */
  function dolozLatwe(s, stan, n = 3, losuj = Math.random) {
    const lista = pula(s.rodzaj).map(d => ({ d, r: stan[d.id], trud: trudnosc(d) }));
    const znane = lista.filter(x => x.r && x.r.proby > 0 && x.r.historia.some(h => h.ok))
      .sort((p, q) => q.r.pudelko - p.r.pudelko || p.trud - q.trud);
    const wybrane = (znane.length >= n ? znane : znane.concat(lista.filter(x => !znane.includes(x)).sort((p, q) => p.trud - q.trud))).slice(0, n);
    s.kolejka = s.kolejka.slice(0, s.i).concat(wybrane.map(x => {
      const w = { id: x.d.id, odwroc: false, nowe: false, powtorka: false };
      if (x.d.typ === 'r') w.reszta = losujReszte(x.d, losuj);
      return w;
    }));
  }

  /** Pochwała z konkretem. Bez liczenia pomyłek. */
  function podsumowanie(s, przed, po) {
    const dobrze = s.odpowiedzi.filter(o => o.ok).length;
    let seria = 0, biezaca = 0;
    for (const o of s.odpowiedzi) { biezaca = o.ok ? biezaca + 1 : 0; seria = Math.max(seria, biezaca); }
    const awanse = [];
    for (const o of s.odpowiedzi) {
      if (awanse.includes(o.id)) continue;
      const a = (przed[o.id] && przed[o.id].pudelko) || 0;
      if (a < 2 && po[o.id] && po[o.id].pudelko >= 2) awanse.push(o.id);
    }
    const lista = pula(s.rodzaj);
    const widziane = lista.filter(d => po[d.id] && po[d.id].proby > 0).length;
    const zdania = [];
    if (awanse.length === 1) zdania.push(`Działanie ${nazwa(dzialanie(awanse[0]))} masz już pewne.`);
    else if (awanse.length > 1) {
      const nazwy = awanse.slice(0, 3).map(id => nazwa(dzialanie(id)));
      const reszta = awanse.length - nazwy.length;
      zdania.push(`Masz już pewne: ${nazwy.slice(0, -1).join(', ')}${nazwy.length > 1 ? ' i ' : ''}${nazwy[nazwy.length - 1]}${reszta > 0 ? ` i jeszcze ${reszta}` : ''}.`);
    }
    if (seria >= 3) zdania.push(`Najdłuższa seria: ${seria} dobrze z rzędu.`);
    if (s.faza === 'sprawdzian') zdania.push(s.rodzaj === 'reszta' ? `Sprawdzone już ${widziane} z ${lista.length} rodzin dzielenia z resztą.` : `Sprawdzone już ${widziane} ze 100 działań.`);
    if (!zdania.length) zdania.push(dobrze > 0 ? `Dobrze: ${dobrze}. Każde ćwiczenie się liczy.` : 'Dziś było trudno. Jutro pójdzie łatwiej, bo już to widziałaś.');
    return { pytan: s.odpowiedzi.length, dobrze, seria, awanse, widziane, zdania };
  }

  // --- Słoik -----------------------------------------------------------------------------------

  /** Punkty za regularność, nie za wynik: za skończoną sesję, najwyżej kilka razy dziennie. */
  function punktyZaSesje(sloik, s, teraz, ust) {
    const pelna = s.i >= s.kolejka.length;
    if (s.odpowiedzi.length === 0 || (!pelna && s.odpowiedzi.length < USTAWIENIA.minPytan)) return { punkty: 0, powod: 'krotka' };
    const dzien = kluczDnia(teraz);
    const dzis = sloik.historia.filter(h => h.powod === 'sesja' && kluczDnia(h.ts) === dzien).length;
    if (dzis >= ust.sesjiDziennie) return { punkty: 0, powod: 'limit' };
    return { punkty: ust.punktyZaSesje, powod: 'sesja' };
  }

  function sesjeZPunktamiDzis(sloik, teraz) {
    const dzien = kluczDnia(teraz);
    return sloik.historia.filter(h => h.powod === 'sesja' && kluczDnia(h.ts) === dzien).length;
  }

  // --- Liczby dla ekranów -------------------------------------------------------------------

  function liczby(stan, teraz, rodzaj = 'tabliczka') {
    const lista = pula(rodzaj);
    const st = { niewidziane: 0, nowe: 0, wolne: 0, pewne: 0, mistrz: 0 };
    let doPowtorki = 0;
    for (const d of lista) {
      const r = stan[d.id];
      st[status(r)] += 1;
      if (r && r.proby > 0 && r.termin <= teraz) doPowtorki += 1;
    }
    return { ...st, wszystkich: lista.length, widziane: lista.length - st.niewidziane, doPowtorki };
  }

  // --- Moduły: co jest włączone ---------------------------------------------------------------

  /** Dzielenie z resztą otwiera się samo, gdy 48 z 64 dzieleń z tabliczki jest pewnych;
   *  słupek, gdy połowa rodzin z resztą jest pewna. Rodzice mogą włączyć albo wyłączyć ręcznie. */
  function odblokowane(stan, ustawienia = {}) {
    const m = ustawienia.moduly || {};
    const pewne = id => stan[id] && stan[id].pudelko >= 2;
    const pewneDzielenia = wszystkie().filter(d => d.typ === 'd' && pewne(d.id)).length;
    const pewneReszty = reszty().filter(d => pewne(d.id)).length;
    const auto = { reszta: pewneDzielenia >= 48, slupek: pewneReszty >= 36 };
    const wybor = k => (m[k] === 'tak' ? true : m[k] === 'nie' ? false : auto[k]);
    return { reszta: wybor('reszta'), slupek: wybor('slupek'), auto, pewneDzielenia, pewneReszty };
  }

  // --- Dzielenie pisemne (słupek) -------------------------------------------------------------

  const POZIOMY_SLUPKA = Object.freeze({
    1: 'dwucyfrowa liczba, bez reszty',
    2: 'trzycyfrowa liczba, bez reszty',
    3: 'zero w wyniku',
    4: 'z resztą, do czterech cyfr',
    5: 'przez liczbę dwucyfrową',
  });
  const NAJWYZSZY_POZIOM = 5;

  /** Kroki słupka po polsku: wynik nad kreską, potem dla każdej cyfry
   *  podziel → pomnóż → odejmij → ściągnij. Gdy dzielnik mieści się 0 razy, piszemy 0
   *  i od razu ściągamy następną cyfrę (bez mnożenia i odejmowania).
   *  wiersz: 0 to wiersz dzielnej, 1, 2, … to kolejne wiersze różnic. */
  function slupek(dzielna, dzielnik) {
    if (!(dzielnik >= 2 && dzielnik <= 99) || !(dzielna >= dzielnik) || dzielna > 99999) throw new Error(`Złe zadanie: ${dzielna} : ${dzielnik}`);
    const C = String(dzielna).split('').map(Number), n = C.length;
    let k = 0, biez = C[0];
    while (biez < dzielnik && k < n - 1) { k += 1; biez = biez * 10 + C[k]; }
    const kroki = [];
    let poz = k, wiersz = 0;
    for (;;) {
      const q = Math.floor(biez / dzielnik);
      kroki.push({ typ: 'podziel', odp: q, kol: poz, biez, wiersz });
      let roznica = biez;
      if (q > 0) {
        const il = q * dzielnik;
        kroki.push({ typ: 'pomnoz', odp: il, kol: poz, biez, q, wiersz });
        roznica = biez - il;
        wiersz += 1;
        kroki.push({ typ: 'odejmij', odp: roznica, kol: poz, biez, il, wiersz });
      }
      if (poz === n - 1) break;
      poz += 1;
      kroki.push({ typ: 'sciagnij', odp: C[poz], kol: poz, wiersz, przed: roznica });
      biez = roznica * 10 + C[poz];
    }
    return { dzielna, dzielnik, cyfry: C, start: k, iloraz: Math.floor(dzielna / dzielnik), reszta: dzielna % dzielnik, kroki, wierszy: wiersz + 1 };
  }

  /** Zadanie na danym poziomie. Poziomy 1–2 bez zera w wyniku, 3 z zerem, 4 z resztą,
   *  5 przez liczbę dwucyfrową (11–39, wynik dwucyfrowy, reszta bywa), jak w podstawie programowej klas 4–6. */
  function zadanieSlupek(poziom, losuj = Math.random) {
    const los = (a, b) => a + Math.floor(losuj() * (b - a + 1));
    for (let proba = 0; proba < 1000; proba++) {
      let d, q, r = 0;
      if (poziom <= 1) { d = los(2, 5); q = los(10, Math.floor(99 / d)); if (String(q).includes('0')) continue; }
      else if (poziom === 2) { d = los(2, 9); q = los(Math.ceil(100 / d), Math.floor(999 / d)); if (String(q).includes('0')) continue; }
      else if (poziom === 3) { d = los(2, 9); q = los(Math.ceil(100 / d), Math.floor(999 / d)); if (!String(q).slice(1).includes('0')) continue; }
      else if (poziom === 4) { d = los(3, 9); const dl = los(100, 9999); q = Math.floor(dl / d); r = dl % d; if (r === 0 || q < 10) continue; }
      else { d = los(11, 39); q = los(12, 99); r = losuj() < 0.5 ? 0 : los(1, d - 1); }
      const dzielna = d * q + r;
      if (poziom <= 1 && (dzielna < 10 || dzielna > 99)) continue;
      if ((poziom === 2 || poziom === 3) && (dzielna < 100 || dzielna > 999)) continue;
      return { dzielna, dzielnik: d };
    }
    return { dzielna: 936, dzielnik: 4 };
  }

  /** Układ słupka na kratce, tak jak w polskim zeszycie:
   *    wiersz 0: wynik nad kreską, wiersz 1: dzielna : dzielnik, potem na zmianę
   *    odejmowana liczba (z minusem i kreską pod spodem) i różnica z dopisanymi cyframi.
   *  Kolumna 0 jest na minus, 1 … n to cyfry dzielnej, n+1 i n+2 to „:” i dzielnik (w wierszu 0: „r.” i reszta).
   *  Każda komórka ma numer kroku, w którym się pojawia (-1: od początku, kroki.length: na końcu). */
  function ukladSlupka(sl) {
    const n = sl.cyfry.length, kol = k => 1 + k;
    const komorki = [], kreski = [], uwagi = sl.kroki.map(() => []), cele = [];
    // Dzielnik i reszta po jednej cyfrze w kratce, jak w zeszycie (przy dzielniku dwucyfrowym dwie kratki).
    const cyfryDzielnika = String(sl.dzielnik).split('');
    const kratkiDzielnika = cyfryDzielnika.map((_, i) => ({ r: 1, c: n + 2 + i }));
    const dodaj = (r, c, txt, krok, rola) => komorki.push({ r, c, txt: String(txt), krok, rola });
    const wiersz = w => 1 + 2 * w;      // wiersz z liczbą, od której odejmujemy
    const podWiersz = w => 2 + 2 * w;   // wiersz z liczbą odejmowaną
    const cyfryNa = (r, cKoniec, liczba, krok, rola) => {
      const t = String(liczba);
      for (let i = 0; i < t.length; i++) dodaj(r, cKoniec - t.length + 1 + i, t[i], krok, rola);
      return cKoniec - t.length + 1;
    };
    const zakres = (r, cKoniec, dl) => Array.from({ length: dl }, (_, i) => ({ r, c: cKoniec - dl + 1 + i }));

    sl.cyfry.forEach((c, i) => dodaj(1, kol(i), c, -1, 'dzielna'));
    dodaj(1, n + 1, ':', -1, 'znak');
    cyfryDzielnika.forEach((c, i) => dodaj(1, n + 2 + i, c, -1, 'dzielnik'));
    for (let i = 0; i < n; i++) kreski.push({ r: 0, c: kol(i), krok: -1 });
    // Gdzie w tej chwili stoi liczba, którą dzielimy: wiersz i ostatnia kolumna.
    sl.kroki.forEach((k, idx) => {
      const c = kol(k.kol);
      if (k.typ === 'podziel') {
        dodaj(0, c, k.odp, idx, 'wynik');
        cele[idx] = { r: 0, c };
        uwagi[idx] = zakres(wiersz(k.wiersz), c, String(k.biez).length);
      } else if (k.typ === 'pomnoz') {
        const r = podWiersz(k.wiersz);
        const lewa = cyfryNa(r, c, k.odp, idx, 'odjemnik');
        dodaj(r, lewa - 1, '−', idx, 'znak');
        for (let cc = lewa; cc <= c; cc++) kreski.push({ r, c: cc, krok: idx + 1 });
        cele[idx] = { r, c };
        uwagi[idx] = [{ r: 0, c }].concat(kratkiDzielnika);
      } else if (k.typ === 'odejmij') {
        const r = wiersz(k.wiersz);
        const nast = sl.kroki[idx + 1];
        // Różnica może mieć dwie cyfry (przy dzielniku dwucyfrowym): każda w swojej kratce, do prawej.
        cyfryNa(r, c, k.odp, idx, k.odp === 0 && nast && nast.typ === 'sciagnij' ? 'zero' : 'roznica');
        cele[idx] = { r, c };
        uwagi[idx] = zakres(wiersz(k.wiersz - 1), c, String(k.biez).length).concat(zakres(podWiersz(k.wiersz - 1), c, String(k.il).length));
      } else {
        const r = wiersz(k.wiersz);
        dodaj(r, c, k.odp, idx, 'sciagnieta');
        cele[idx] = { r, c };
        uwagi[idx] = [{ r: 1, c }];
      }
    });
    if (sl.reszta > 0) {
      dodaj(0, n + 1, 'r.', sl.kroki.length, 'znak');
      String(sl.reszta).split('').forEach((c, i) => dodaj(0, n + 2 + i, c, sl.kroki.length, 'reszta'));
    }
    return { wierszy: 2 * sl.wierszy, kolumn: n + 2 + cyfryDzielnika.length, komorki, kreski, uwagi, cele };
  }

  /** Pytanie do kroku i podpowiedź (podpowiedź nie podaje odpowiedzi wprost). */
  function pytanieKroku(k, dzielnik) {
    if (k.typ === 'podziel') {
      const wiel = [];
      for (let i = 1; i <= 9 && i * dzielnik <= k.biez + dzielnik; i++) wiel.push(i * dzielnik);
      // Dzielnik dwucyfrowy: szacowanie dziesiątkami („przy 23 myśl o 20”), potem sprawdzenie mnożeniem.
      const szacuj = dzielnik % 10 === 0
        ? `Pomyśl o dziesiątkach: ile razy ${dzielnik / 10} mieści się w ${Math.floor(k.biez / 10)}?`
        : `Szacuj: ${dzielnik} to około ${Math.round(dzielnik / 10) * 10}. Ile razy ${Math.round(dzielnik / 10) * 10} mieści się w ${k.biez}? Potem sprawdź mnożeniem i popraw o jeden.`;
      return {
        pytanie: `Ile razy ${dzielnik} mieści się w ${k.biez}?`,
        podpowiedz: k.biez < dzielnik ? `${k.biez} jest mniejsze od ${dzielnik}.`
          : dzielnik >= 10 ? szacuj
            : `Licz po ${dzielnik}: ${wiel.join(', ')}. Ile kroków nie przekracza ${k.biez}?`,
      };
    }
    if (k.typ === 'pomnoz') return { pytanie: `${k.q} × ${dzielnik} =`, podpowiedz: 'Pomnóż cyfrę nad kreską przez dzielnik.' };
    if (k.typ === 'odejmij') return { pytanie: `${k.biez} − ${k.il} =`, podpowiedz: 'Odejmij dolną liczbę od górnej.' };
    return { pytanie: 'Którą cyfrę ściągasz w dół?', podpowiedz: 'Weź następną cyfrę z górnej liczby, tę zaznaczoną.' };
  }

  /** Wyjaśnienie po pomyłce w kroku (spokojne, z liczbami). */
  function wyjasnienieKroku(k, dzielnik, odp) {
    if (k.typ === 'podziel') {
      if (k.biez < dzielnik) return `${k.biez} jest mniejsze od ${dzielnik}, więc zero razy. Zero też piszemy w wyniku.`;
      const o = Number(odp);
      if (odp !== '' && o * dzielnik > k.biez) return `${o} × ${dzielnik} = ${o * dzielnik}, a to więcej niż ${k.biez}.`;
      return `${k.odp} × ${dzielnik} = ${k.odp * dzielnik}. To najbliżej ${k.biez}, ale nie więcej.`;
    }
    if (k.typ === 'pomnoz') return `${k.q} × ${dzielnik} = ${k.odp}.`;
    if (k.typ === 'odejmij') return `${k.biez} − ${k.il} = ${k.odp}.`;
    return `Następna cyfra to ${k.odp}. Dopisujemy ją obok.`;
  }

  /** Nazwa pomyłki w kroku (dla rodziców). */
  function rodzajPomylki(krok, dzielnik, odp) {
    if (krok.typ === 'podziel') {
      if (krok.biez < dzielnik) return 'zero w wyniku';
      if (Number(odp) * dzielnik > krok.biez) return 'za dużo razy';
      return 'za mało razy';
    }
    return { pomnoz: 'mnożenie', odejmij: 'odejmowanie', sciagnij: 'ściąganie cyfry' }[krok.typ] || krok.typ;
  }

  /** Następny poziom po zadaniu: dwa gładkie zadania pod rząd w górę (najwyżej do 5), cztery pomyłki w jednym w dół. */
  function poZadaniuSlupek(st0, pomylek) {
    const st = Object.assign({ poziom: 1, gladkich: 0, zadan: 0 }, st0 || {});
    st.zadan += 1;
    if (pomylek <= 1) {
      st.gladkich += 1;
      if (st.gladkich >= 2 && st.poziom < NAJWYZSZY_POZIOM) { st.poziom += 1; st.gladkich = 0; }
    } else {
      st.gladkich = 0;
      if (pomylek >= 4 && st.poziom > 1) st.poziom -= 1;
    }
    return st;
  }

  // --- Eksport do Excela -------------------------------------------------------------------

  function dwa(n) { return String(n).padStart(2, '0'); }
  function poleCsv(v) {
    const t = v === null || v === undefined ? '' : String(v);
    return /[";\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  }

  /** CSV dla polskiego Excela: średnik, BOM, CRLF. */
  function csv(odpowiedzi) {
    const naglowek = ['data', 'godzina', 'sesja', 'faza', 'działanie', 'rodzaj', 'poprawny wynik', 'odpowiedź', 'dobrze', 'nie wiem', 'czas ms', 'powtórka', 'podpowiedź', 'uwagi'];
    const RODZAJ = { m: 'mnożenie', d: 'dzielenie', r: 'z resztą', s: 'słupek' };
    const wiersze = [naglowek.join(';')];
    for (const o of odpowiedzi) {
      const t = new Date(o.ts);
      wiersze.push([
        `${t.getFullYear()}-${dwa(t.getMonth() + 1)}-${dwa(t.getDate())}`,
        `${dwa(t.getHours())}:${dwa(t.getMinutes())}:${dwa(t.getSeconds())}`,
        o.sesja, o.faza, o.tresc, RODZAJ[String(o.id).charAt(0)] || '',
        o.poprawna, o.odpowiedz, o.ok ? 'tak' : 'nie', o.nieWiem ? 'tak' : 'nie', o.ms,
        o.powtorka ? 'tak' : 'nie', o.podpowiedz ? 'tak' : 'nie', o.uwagi || '',
      ].map(poleCsv).join(';'));
    }
    return '\uFEFF' + wiersze.join('\r\n') + '\r\n';
  }

  const Silnik = {
    MIN, MAX, ODSTEPY_DNI, NAJWYZSZE, USTAWIENIA,
    wszystkie, reszty, pula, zPuli, dzialanie, wynik, tresc, nazwa, trudnosc, sposob,
    kluczDnia, poczatekDnia, dodajDni,
    nowyRekord, status, sredniCzas, zapiszWynik,
    dobierz, nowaSesja, biezace, odpowiedz, dolozLatwe, podsumowanie,
    punktyZaSesje, sesjeZPunktamiDzis, liczby, csv,
    odblokowane, POZIOMY_SLUPKA, NAJWYZSZY_POZIOM, slupek, zadanieSlupek, rodzajPomylki, poZadaniuSlupek,
    ukladSlupka, pytanieKroku, wyjasnienieKroku,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Silnik;
  else globalThis.Silnik = Silnik;
})();
