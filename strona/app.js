/* Ekrany aplikacji. Logika nauki jest w silnik.js, zapis w baza.js. */
(function () {
  'use strict';
  const S = globalThis.Silnik, B = globalThis.Baza, P = globalThis.Przestawiane;
  const $ = id => document.getElementById(id);
  const EKRANY = ['start', 'sesja', 'slupek', 'przerwa', 'koniec', 'sloik', 'pin', 'rodzice'];
  const DOBRZE = ['Dobrze!', 'Tak!', 'Świetnie!', 'Zgadza się!', 'Super!'];

  let stan = B.wczytajStan();
  let sesja = null, stanPrzed = null;
  let wpisane = '', tryb = 'pytanie', startPytania = 0, numerPytania = 0, uzytoPodpowiedzi = false, czekaDalej = null;
  // Dzielenie z resztą: dwie części odpowiedzi, iloraz ('i') i reszta ('r').
  let wpisaneR = '', czesc = 'i';
  const kolejnosci = {};

  // --- Ogólne ---------------------------------------------------------------------------------

  function ogloś(tekst) { const o = $('ogloszenia'); o.textContent = ''; setTimeout(() => { o.textContent = tekst; }, 30); }

  function pokaz(nazwa) {
    for (const e of EKRANY) $(e).hidden = e !== nazwa;
    document.body.dataset.ekran = nazwa;
    const cel = $(nazwa).querySelector('h1, .dzialanie, .slupek-pytanie');
    if (cel) setTimeout(() => cel.focus({ preventScroll: true }), 0);
    window.scrollTo(0, 0);
  }

  function zapisz() {
    if (!B.zapiszStan(stan)) ogloś('Brakuje miejsca na zapis. Zwolnij trochę miejsca w urządzeniu.');
  }

  /** Okno pytania przed rzadką, ważną zmianą. Przycisk nazywa skutek, Anuluj stoi pierwszy, Escape zamyka.
   *  Przy kasowaniu przycisk jest czerwony, a fokus stoi na Anuluj. Zwraca obietnicę: true, gdy „tak”. */
  function zapytaj({ tytul, tresc, tak, niszczy = false }) {
    const d = $('okno'), t = $('okno-tak');
    $('okno-tytul').textContent = tytul;
    $('okno-tresc').textContent = tresc;
    t.textContent = tak;
    t.className = niszczy ? 'przycisk przycisk-drugi przycisk-niszczy' : 'przycisk';
    return new Promise(ok => {
      d.returnValue = '';
      d.addEventListener('close', () => ok(d.returnValue === 'tak'), { once: true });
      d.showModal();
      (niszczy ? $('okno-anuluj') : t).focus();
    });
  }

  /** Po pomyłce liczy się tylko „Dalej”: cyfry są przygaszone i nieczynne, żeby było widać, co teraz. */
  function tylkoDalej(ekran, tak) {
    const e = $(ekran);
    e.classList.toggle('czeka-dalej', tak);
    for (const b of e.querySelectorAll('.klawiatura button:not(.klawisz-ok)')) b.setAttribute('aria-disabled', String(tak));
  }

  // Słowo po liczbie, poprzedzone twardą spacją, żeby liczba nie została sama na końcu linii.
  function liczbaPunktow(n) {
    const r10 = n % 10, r100 = n % 100;
    if (n === 1) return 'punkt';
    if (r10 >= 2 && r10 <= 4 && (r100 < 12 || r100 > 14)) return 'punkty';
    return 'punktów';
  }
  const ilePkt = n => `${n}\u00a0${liczbaPunktow(n)}`;

  function dzialan(n) {
    const r10 = n % 10, r100 = n % 100;
    if (n === 1) return 'działanie';
    if (r10 >= 2 && r10 <= 4 && (r100 < 12 || r100 > 14)) return 'działania';
    return 'działań';
  }

  // --- Start ----------------------------------------------------------------------------------

  function odswiezStart() {
    const teraz = Date.now(), u = stan.ustawienia;
    const l = S.liczby(stan.dzialania, teraz);
    $('start-data').textContent = new Date(teraz).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
    $('start-tytul').textContent = u.imie ? `Cześć, ${u.imie}!` : 'Cześć!';
    let wstep;
    if (l.widziane === 0) wstep = 'Najpierw sprawdzimy, co już umiesz. Bez pośpiechu, zegara nie ma.';
    else if (l.niewidziane > 0) wstep = `Sprawdzone już ${l.widziane} ze 100 działań.${l.pewne + l.mistrz ? ` Pewnych masz ${l.pewne + l.mistrz}.` : ''}`;
    else if (l.doPowtorki > 0) wstep = `Na dziś czeka ${l.doPowtorki}\u00a0${dzialan(l.doPowtorki)} do powtórki. Pewnych masz ${l.pewne + l.mistrz} ze 100.`;
    else wstep = `Na dziś wszystko powtórzone. Pewnych masz ${l.pewne + l.mistrz} ze 100.`;
    $('start-wstep').textContent = wstep;
    const dzis = S.sesjeZPunktamiDzis(stan.sloik, teraz);
    $('cwicz-opis').textContent = dzis < u.sesjiDziennie
      ? `Około 5 minut · za skończoną sesję ${ilePkt(u.punktyZaSesje)}`
      : 'Punkty na dziś już są w słoiku. Ćwiczyć i tak można.';
    const proc = Math.min(100, Math.round(100 * stan.sloik.punkty / Math.max(1, u.celPunkty)));
    $('sloik-opis').textContent = `${stan.sloik.punkty} z ${ilePkt(u.celPunkty)} · ${u.celOpis}`;
    $('sloik-pasek').style.width = proc + '%';
    const m = S.odblokowane(stan.dzialania, u);
    $('przycisk-reszta').hidden = !m.reszta;
    $('przycisk-slupek').hidden = !m.slupek;
    if (m.reszta) {
      const lr = S.liczby(stan.dzialania, teraz, 'reszta');
      // Jak na powitaniu: liczba pewnych dopiero wtedy, gdy jest się czym pochwalić.
      const pewneR = lr.pewne + lr.mistrz;
      $('reszta-opis').textContent = lr.widziane === 0 ? 'Nowe! Na przykład 47 : 5 = 9 r. 2' : pewneR > 0 ? `Pewnych ${pewneR} z ${lr.wszystkich}` : 'Na przykład 47 : 5 = 9 r. 2';
    }
    if (m.slupek) $('slupek-opis').textContent = `Poziom ${stan.slupek.poziom}: ${S.POZIOMY_SLUPKA[stan.slupek.poziom]}`;
  }

  // --- Sesja ----------------------------------------------------------------------------------

  function zacznijSesje(rodzaj = 'tabliczka') {
    stanPrzed = JSON.parse(JSON.stringify(stan.dzialania));
    sesja = S.nowaSesja(stan.dzialania, Date.now(), S.USTAWIENIA, Math.random, rodzaj);
    pokaz('sesja');
    nastepne();
  }

  const czytaj = t => t.replace('×', 'razy').replace(':', 'podzielić przez');

  function biezaceDzialanie() { const w = S.biezace(sesja); return w ? { w, d: S.dzialanie(w.id) } : null; }

  function nastepne() {
    clearTimeout(czekaDalej);
    const b = biezaceDzialanie();
    if (!b) { zakonczSesje(); return; }
    wpisane = ''; wpisaneR = ''; czesc = 'i'; tryb = 'pytanie'; uzytoPodpowiedzi = false;
    tylkoDalej('sesja', false);
    const zReszta = b.d.typ === 'r';
    $('karta').classList.remove('dobrze', 'pokaz');
    $('karta').classList.toggle('z-reszta', zReszta);
    $('r-znak').hidden = !zReszta; $('wpisana-reszta').hidden = !zReszta;
    const t = S.tresc(b.d, b.w.odwroc, b.w.reszta);
    $('dzialanie').textContent = `${t} =`;
    $('dzialanie').setAttribute('aria-label', czytaj(t) + (zReszta ? ', ile to jest i ile zostaje?' : ', ile to jest?'));
    $('informacja').textContent = '';
    $('sposob').textContent = '';
    $('klawisz-ok').textContent = zReszta ? 'Reszta →' : 'Sprawdź';
    $('podpowiedz').hidden = false;
    pokazWpisane();
    const proc = Math.round(100 * sesja.i / Math.max(1, sesja.kolejka.length));
    $('postep-pasek').style.width = proc + '%';
    $('postep').setAttribute('aria-valuenow', String(proc));
    // Czas liczony od pokazania pytania. Gdy klatka się narysuje, start przesuwa się na nią,
    // ale tylko jeśli to wciąż to samo pytanie i nic jeszcze nie wpisano.
    startPytania = performance.now();
    const nr = ++numerPytania;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (nr === numerPytania && tryb === 'pytanie' && !wpisane) startPytania = performance.now();
    }));
  }

  function zReszta() { const b = sesja && biezaceDzialanie(); return !!(b && b.d.typ === 'r'); }

  function pokazWpisane() {
    $('wpisana').textContent = wpisane || '\u00a0';
    $('wpisana-reszta').textContent = wpisaneR || '\u00a0';
    const r = zReszta() && tryb === 'pytanie';
    $('wpisana').classList.toggle('aktywna-czesc', r && czesc === 'i');
    $('wpisana-reszta').classList.toggle('aktywna-czesc', r && czesc === 'r');
    if (zReszta() && tryb === 'pytanie') $('klawisz-ok').textContent = czesc === 'i' ? 'Reszta →' : 'Sprawdź';
  }

  function dopisz(v, k) { return v.length < 3 ? (v === '0' ? '' : v) + k : v; }

  function klawisz(k) {
    if (tryb === 'pokazano') { if (k === 'ok') dalej(); return; }
    if (tryb !== 'pytanie') return;
    const r = zReszta();
    if (/^[0-9]$/.test(k)) {
      if (r && czesc === 'r') wpisaneR = dopisz(wpisaneR, k); else wpisane = dopisz(wpisane, k);
      pokazWpisane();
    } else if (k === 'usun') {
      if (r && czesc === 'r') { if (wpisaneR) wpisaneR = wpisaneR.slice(0, -1); else czesc = 'i'; }
      else wpisane = wpisane.slice(0, -1);
      pokazWpisane();
    } else if (k === 'ok') {
      if (r && czesc === 'i') { if (wpisane) { czesc = 'r'; pokazWpisane(); } }
      else if (r) { if (wpisane && wpisaneR) sprawdz(false); }
      else if (wpisane) sprawdz(false);
    } else if (k === 'nie-wiem') sprawdz(true);
  }

  async function sprawdz(nieWiem) {
    const b = biezaceDzialanie(); if (!b) return;
    const ms = Math.max(0, Math.round(performance.now() - startPytania));
    const r = b.d.typ === 'r';
    const poprawna = S.wynik(b.d), poprawnaR = r ? b.w.reszta : null;
    const okI = !nieWiem && Number(wpisane) === poprawna;
    const okR = !r || (!nieWiem && Number(wpisaneR) === poprawnaR);
    const ok = okI && okR;
    const teraz = Date.now();
    // Z podpowiedzią dobrze, ale bez awansu: to jeszcze nie jest wynik z pamięci.
    // Przy reszcie są dwie liczby do wpisania, więc próg czasu jest o połowę dłuższy.
    const msDoOceny = uzytoPodpowiedzi ? Math.max(ms, S.USTAWIENIA.szybkoMs * 2 + 1) : (r ? Math.round(ms / 1.5) : ms);
    const faza = sesja.faza, sesjaId = sesja.id, tresc = S.tresc(b.d, b.w.odwroc, b.w.reszta), powtorka = !!b.w.powtorka;
    const w = S.odpowiedz(sesja, stan.dzialania, { ok, ms: msDoOceny, nieWiem, teraz });
    stan.dzialania = w.stan;
    zapisz();
    let uwagi = '';
    if (r && !nieWiem && !ok) uwagi = okI ? 'iloraz dobrze, reszta inna' : okR ? 'reszta dobrze, iloraz inny' : 'iloraz i reszta inne';
    if (r && !nieWiem && Number(wpisaneR) >= b.d.a) uwagi += (uwagi ? '; ' : '') + 'reszta nie mniejsza od dzielnika';
    B.dodajOdpowiedz({
      ts: teraz, sesja: sesjaId, faza, id: b.d.id, tresc,
      poprawna: r ? `${poprawna} r. ${poprawnaR}` : poprawna,
      odpowiedz: nieWiem ? '' : (r ? `${wpisane} r. ${wpisaneR}` : wpisane),
      ok, nieWiem, ms, powtorka, podpowiedz: uzytoPodpowiedzi, uwagi,
    });

    $('podpowiedz').hidden = true;
    if (ok) {
      tryb = 'dobrze';
      $('karta').classList.add('dobrze');
      $('informacja').textContent = DOBRZE[Math.floor(Math.random() * DOBRZE.length)];
      czekaDalej = setTimeout(() => po(w), 700);
    } else {
      tryb = 'pokazano';
      $('karta').classList.add('pokaz');
      wpisane = String(poprawna); if (r) wpisaneR = String(poprawnaR);
      pokazWpisane();
      $('informacja').textContent = nieWiem ? 'Nic się nie stało. Tyle to jest.' : 'Tyle to jest. Wróci za chwilę.';
      $('sposob').textContent = r
        ? `${b.d.a} × ${poprawna} = ${b.d.a * poprawna}, a do ${b.d.a * poprawna + poprawnaR} zostaje ${poprawnaR}.`
        : S.sposob(b.d, b.w.odwroc);
      $('klawisz-ok').textContent = 'Dalej';
      tylkoDalej('sesja', true);
      sesja._poOdpowiedzi = w;
      ogloś(`${czytaj(tresc)} to ${poprawna}${r ? `, reszty ${poprawnaR}` : ''}.`);
    }
  }

  function dalej() { if (tryb === 'pokazano' && sesja && sesja._poOdpowiedzi) { const w = sesja._poOdpowiedzi; sesja._poOdpowiedzi = null; po(w); } }

  function po(w) {
    if (!sesja) return;
    if (w.sygnal === 'ucieczka' && !w.koniec) { tryb = 'przerwa'; przerwaZ = 'sesja'; pokaz('przerwa'); return; }
    if (w.koniec) { zakonczSesje(); return; }
    nastepne();
  }

  function zakonczSesje() {
    clearTimeout(czekaDalej);
    if (!sesja) { pokaz('start'); return; }
    const s = sesja; sesja = null; tryb = 'koniec';
    if (!s.odpowiedzi.length) { odswiezStart(); pokaz('start'); return; }
    const teraz = Date.now(), u = stan.ustawienia;
    const pod = S.podsumowanie(s, stanPrzed, stan.dzialania);
    const pkt = S.punktyZaSesje(stan.sloik, s, teraz, u);
    if (pkt.punkty > 0) {
      stan.sloik.punkty += pkt.punkty;
      stan.sloik.historia.push({ ts: teraz, zmiana: pkt.punkty, powod: 'sesja' });
    }
    stan.sesje.push({ id: s.id, rodzaj: s.rodzaj, start: s.start, koniec: teraz, faza: s.faza, pytan: pod.pytan, dobrze: pod.dobrze, punkty: pkt.punkty });
    if (stan.sesje.length > 500) stan.sesje = stan.sesje.slice(-500);
    zapisz();
    $('koniec-tytul').textContent = pod.dobrze > 0 ? 'Brawo!' : 'Koniec na dziś';
    const z = $('koniec-zdania'); z.textContent = '';
    for (const t of pod.zdania) { const p = document.createElement('p'); p.textContent = t; z.appendChild(p); }
    $('koniec-punkty').textContent = pkt.punkty > 0
      ? `+${ilePkt(pkt.punkty)} do słoika. Masz już ${stan.sloik.punkty}.`
      : pkt.powod === 'limit' ? 'Punkty na dziś już są w słoiku. To ćwiczenie i tak się liczy.'
        : 'Sesja była krótka, więc tym razem bez punktów.';
    pokaz('koniec');
  }

  // --- Słupek -------------------------------------------------------------------------------------

  let sl = null;          // sesja słupka: { id, start, zadan, nr, odpowiedzi, ostatnie, ostatniaPrzerwa, poziomNaStart }
  let zad = null;         // bieżące zadanie: { zadanie, uklad, cur, pomylki, zle, podpowiedz, start }
  let wpisaneS = '', trybS = 'pytanie', startKroku = 0, czekaS = null, przerwaZ = 'sesja';

  function zacznijSlupek() {
    const teraz = Date.now();
    sl = { id: `s${teraz}`, rodzaj: 'slupek', start: teraz, zadan: Math.max(1, Math.min(6, stan.ustawienia.zadanSlupka || 3)), nr: 0, odpowiedzi: [], ostatnie: [], ostatniaPrzerwa: -10, poziomNaStart: stan.slupek.poziom };
    pokaz('slupek');
    noweZadanie();
  }

  function noweZadanie(poziom) {
    const { dzielna, dzielnik } = S.zadanieSlupek(poziom || stan.slupek.poziom);
    const zadanie = S.slupek(dzielna, dzielnik);
    zad = { zadanie, uklad: S.ukladSlupka(zadanie), cur: 0, pomylki: [], zle: new Set(), podpowiedz: false, start: Date.now() };
    nastepnyKrok();
  }

  function nastepnyKrok() {
    clearTimeout(czekaS);
    wpisaneS = ''; trybS = zad.cur >= zad.zadanie.kroki.length ? 'gotowe' : 'pytanie';
    tylkoDalej('slupek', trybS === 'gotowe');
    $('slupek-karta').classList.remove('dobrze', 'pokaz');
    $('slupek-podpowiedz').hidden = trybS !== 'pytanie';
    $('slupek-ok').textContent = 'Sprawdź';
    $('slupek-info').textContent = '';
    const proc = Math.round(100 * (sl.nr + zad.cur / Math.max(1, zad.zadanie.kroki.length)) / sl.zadan);
    $('slupek-postep-pasek').style.width = proc + '%';
    $('slupek-postep').setAttribute('aria-valuenow', String(proc));
    if (trybS === 'gotowe') { zadanieGotowe(); return; }
    rysujSlupek(); pokazPytanieS();
    startKroku = performance.now();
  }

  /** Kratka słupka: wszystko do bieżącego kroku, bieżące miejsce zaznaczone, nic dalej. */
  function rysujSlupek() {
    const u = zad.uklad, cur = zad.cur, gotowe = cur >= zad.zadanie.kroki.length;
    // Kratka tak duża, jak się da (najwyżej 40 px), ale cała w karcie; poniżej 22 px raczej przewijamy.
    const ramka = t0 => t0.closest('.slupek-ramka');
    const t = $('slupek-tabela'); t.textContent = '';
    const r0 = ramka(t);
    if (r0 && r0.clientHeight > 0) {
      const k = Math.max(22, Math.min(40, Math.floor((r0.clientHeight - 8) / u.wierszy), Math.floor((r0.clientWidth - 8) / u.kolumn)));
      r0.style.setProperty('--k', `${k}px`);
    }
    const kom = [];
    for (let r = 0; r < u.wierszy; r++) { const tr = t.insertRow(); kom.push([]); for (let c = 0; c < u.kolumn; c++) kom[r].push(tr.insertCell()); }
    for (const k of u.komorki) {
      const td = kom[k.r][k.c];
      if (k.krok < cur || (gotowe && k.krok <= cur) || (k.rola === 'znak' && k.krok === cur && !gotowe)) {
        td.textContent = k.txt;
        td.classList.add(`rola-${k.rola}`);
        if (zad.zle.has(k.krok)) td.classList.add('poprawione');
      }
      if (k.rola === 'dzielna' && zad.zadanie.kroki.some((s, i) => i < cur && s.typ === 'sciagnij' && 1 + s.kol === k.c)) td.classList.add('uzyta');
    }
    for (const k of u.kreski) if (k.krok <= cur || gotowe) kom[k.r][k.c].classList.add('kreska');
    if (!gotowe) {
      for (const p of u.uwagi[cur]) kom[p.r][p.c].classList.add('uwaga');
      const cel = u.cele[cur];
      kom[cel.r][cel.c].classList.add('cel');
      if (trybS !== 'pytanie') {
        // Po odpowiedzi: wpisana liczba w swoim miejscu (dobra albo pokazana).
        for (const k of u.komorki) if (k.krok === cur) { const td = kom[k.r][k.c]; td.textContent = k.txt; td.classList.add(`rola-${k.rola}`, trybS === 'pokazano' ? 'poprawione' : 'swieze'); }
      }
      // Przewijamy tylko kratkę (nie stronę), żeby bieżące miejsce było widać pod przypiętymi wierszami.
      const tdCel = kom[cel.r][cel.c];
      setTimeout(() => {
        if (!r0) return;
        const a = r0.getBoundingClientRect(), b = tdCel.getBoundingClientRect();
        const gora = a.top + 2 * tdCel.offsetHeight;
        if (b.bottom > a.bottom) r0.scrollTop += b.bottom - a.bottom + 4;
        else if (b.top < gora && cel.r > 1) r0.scrollTop -= gora - b.top + 4;
      }, 0);
    }
  }

  function pokazPytanieS() {
    const k = zad.zadanie.kroki[zad.cur];
    const { pytanie } = S.pytanieKroku(k, zad.zadanie.dzielnik);
    const p = $('slupek-pytanie'); p.textContent = '';
    const t = document.createElement('span'); t.textContent = pytanie + ' '; p.appendChild(t);
    const o = document.createElement('span'); o.className = 'slupek-odp'; o.textContent = wpisaneS || '\u00a0'; p.appendChild(o);
  }

  function klawiszSlupek(k) {
    if (!zad) return;
    if (trybS === 'pokazano') { if (k === 'ok') { zad.cur += 1; nastepnyKrok(); } return; }
    if (trybS === 'gotowe') { if (k === 'ok') poZadaniu(); return; }
    if (trybS !== 'pytanie') return;
    if (/^[0-9]$/.test(k)) { if (wpisaneS.length < 2) { wpisaneS = (wpisaneS === '0' ? '' : wpisaneS) + k; pokazPytanieS(); } }
    else if (k === 'usun') { wpisaneS = wpisaneS.slice(0, -1); pokazPytanieS(); }
    else if (k === 'ok') { if (wpisaneS) sprawdzKrok(false); }
    else if (k === 'nie-wiem') sprawdzKrok(true);
  }

  function sprawdzKrok(nieWiem) {
    const k = zad.zadanie.kroki[zad.cur], d = zad.zadanie.dzielnik;
    const ms = Math.round(performance.now() - startKroku);
    const wpisana = wpisaneS;
    const ok = !nieWiem && Number(wpisana) === k.odp;
    sl.ostatnie.push({ ok, ms, nieWiem });
    $('slupek-podpowiedz').hidden = true;
    if (ok) {
      trybS = 'dobrze';
      $('slupek-karta').classList.add('dobrze');
      rysujSlupek();
      czekaS = setTimeout(() => { zad.cur += 1; nastepnyKrok(); }, 450);
      return;
    }
    zad.pomylki.push(nieWiem ? 'nie wiem' : S.rodzajPomylki(k, d, wpisana));
    zad.zle.add(zad.cur);
    trybS = 'pokazano';
    $('slupek-karta').classList.add('pokaz');
    rysujSlupek();
    wpisaneS = String(k.odp); pokazPytanieS();
    $('slupek-info').textContent = (nieWiem ? 'Nic się nie stało. ' : '') + S.wyjasnienieKroku(k, d, nieWiem ? '' : wpisana);
    $('slupek-ok').textContent = 'Dalej';
    tylkoDalej('slupek', true);
    // Dwie szybkie pomyłki pod rząd: chwila oddechu (nie częściej niż co 3 kroki).
    const dwie = sl.ostatnie.slice(-2);
    if (dwie.length === 2 && dwie.every(o => !o.ok && !o.nieWiem && o.ms < S.USTAWIENIA.ucieczkaMs) && sl.ostatnie.length - sl.ostatniaPrzerwa >= 3) {
      sl.ostatniaPrzerwa = sl.ostatnie.length;
      przerwaZ = 'slupek'; trybS = 'przerwa';
      setTimeout(() => pokaz('przerwa'), 900);
    }
  }

  function zadanieGotowe() {
    const z = zad.zadanie, teraz = Date.now();
    rysujSlupek();
    const wynik = `${z.iloraz}${z.reszta ? ` r. ${z.reszta}` : ''}`;
    $('slupek-pytanie').textContent = `${z.dzielna} : ${z.dzielnik} = ${wynik}`;
    $('slupek-info').textContent = `Sprawdzenie: ${z.iloraz} × ${z.dzielnik}${z.reszta ? ` + ${z.reszta}` : ''} = ${z.dzielna}. ${zad.pomylki.length ? 'Zrobione!' : 'Bez jednej pomyłki!'}`;
    $('slupek-karta').classList.add('dobrze');
    $('slupek-ok').textContent = sl.nr + 1 >= sl.zadan ? 'Koniec' : 'Następne zadanie';
    const poziom = stan.slupek.poziom;
    stan.slupek = S.poZadaniuSlupek(stan.slupek, zad.pomylki.length);
    const hist = (stan.slupek.historia || []).concat([{ ts: teraz, tresc: `${z.dzielna} : ${z.dzielnik}`, poziom, pomylki: zad.pomylki }]);
    stan.slupek.historia = hist.slice(-20);
    zapisz();
    const o = { ts: teraz, sesja: sl.id, faza: `poziom ${poziom}`, id: `s:${z.dzielna}:${z.dzielnik}`, tresc: `${z.dzielna} : ${z.dzielnik}`,
      poprawna: wynik, odpowiedz: wynik, ok: zad.pomylki.length === 0, nieWiem: false, ms: teraz - zad.start, powtorka: false, podpowiedz: zad.podpowiedz,
      uwagi: zad.pomylki.length ? `pomyłki: ${zad.pomylki.join(', ')}` : '' };
    sl.odpowiedzi.push(o);
    B.dodajOdpowiedz(o);
    sl.nr += 1;
    ogloś(`${z.dzielna} podzielić przez ${z.dzielnik} to ${z.iloraz}${z.reszta ? `, reszty ${z.reszta}` : ''}.`);
  }

  function poZadaniu() { if (sl.nr >= sl.zadan) koniecSlupka(); else noweZadanie(); }

  function koniecSlupka() {
    clearTimeout(czekaS);
    if (!sl) { pokaz('start'); return; }
    const s = sl; sl = null; zad = null; trybS = 'koniec';
    if (!s.odpowiedzi.length) { odswiezStart(); pokaz('start'); return; }
    const teraz = Date.now(), u = stan.ustawienia;
    const pkt = S.punktyZaSesje(stan.sloik, { i: s.nr, kolejka: new Array(s.zadan), odpowiedzi: s.odpowiedzi }, teraz, u);
    if (pkt.punkty > 0) { stan.sloik.punkty += pkt.punkty; stan.sloik.historia.push({ ts: teraz, zmiana: pkt.punkty, powod: 'sesja' }); }
    const bez = s.odpowiedzi.filter(o => o.ok).length;
    stan.sesje.push({ id: s.id, rodzaj: 'slupek', start: s.start, koniec: teraz, faza: 'slupek', pytan: s.odpowiedzi.length, dobrze: bez, punkty: pkt.punkty });
    zapisz();
    $('koniec-tytul').textContent = 'Brawo!';
    const zd = [`Zadań w słupku: ${s.odpowiedzi.length}.`];
    if (bez > 0) zd.push(bez === s.odpowiedzi.length ? 'Wszystkie bez jednej pomyłki.' : `Bez jednej pomyłki: ${bez}.`);
    if (stan.slupek.poziom > s.poziomNaStart) zd.push(`Następnym razem nowy poziom: ${S.POZIOMY_SLUPKA[stan.slupek.poziom]}.`);
    const z = $('koniec-zdania'); z.textContent = '';
    for (const t of zd) { const p = document.createElement('p'); p.textContent = t; z.appendChild(p); }
    $('koniec-punkty').textContent = pkt.punkty > 0 ? `+${ilePkt(pkt.punkty)} do słoika. Masz już ${stan.sloik.punkty}.`
      : pkt.powod === 'limit' ? 'Punkty na dziś już są w słoiku. To ćwiczenie i tak się liczy.' : 'Sesja była krótka, więc tym razem bez punktów.';
    pokaz('koniec');
  }

  // --- Słoik -------------------------------------------------------------------------------------

  function pokazSloik() {
    const u = stan.ustawienia, p = stan.sloik.punkty;
    $('sloik-punkty').textContent = String(p);
    $('sloik-punkty').parentElement.lastChild.textContent = `\u00a0${liczbaPunktow(p)}`;
    const brak = Math.max(0, u.celPunkty - p);
    $('sloik-cel').textContent = brak > 0 ? `Do nagrody (${u.celOpis}) brakuje ${ilePkt(brak)}.` : `Uzbierane! Nagroda: ${u.celOpis}. Powiedz rodzicom.`;
    $('sloik-wypelnienie').style.height = Math.min(100, Math.round(100 * p / Math.max(1, u.celPunkty))) + '%';
    $('sloik-zasady').textContent = `Punkty są za skończone sesje, najwyżej ${u.sesjiDziennie} dziennie. Nie za szybkość i nie za wynik.`;
    pokaz('sloik');
  }

  // --- Rodzice -------------------------------------------------------------------------------------

  let pinTryb = 'wpisz';
  function pokazPin() {
    pinTryb = stan.ustawienia.pin ? 'wpisz' : 'ustaw';
    $('pin-tytul').textContent = 'Dla rodziców';
    $('pin-opis').textContent = pinTryb === 'ustaw' ? 'Ustaw PIN dla rodziców, od 4 do 8 cyfr. Dziecko go nie zna.' : 'Tu są postępy i ustawienia.';
    $('pin-pole').value = ''; $('pin-blad').textContent = '';
    pokaz('pin');
    setTimeout(() => $('pin-pole').focus(), 50);
  }

  function pinOk(ev) {
    ev.preventDefault();
    const v = $('pin-pole').value.trim();
    if (!/^[0-9]{4,8}$/.test(v)) { $('pin-blad').textContent = 'PIN to od 4 do 8 cyfr.'; return; }
    if (pinTryb === 'ustaw') { stan.ustawienia.pin = v; zapisz(); }
    else if (v !== stan.ustawienia.pin) { $('pin-blad').textContent = 'To nie ten PIN.'; $('pin-pole').value = ''; return; }
    pokazRodzicow();
  }

  // Jedne słowa i jeden kolor na stan działania: podsumowanie, legenda, siatki i dymki mówią to samo.
  // Kolory jak światła: czerwony nie umie, żółty uczy się, zielony pewne; fiolet to mistrz (reguła o tabelach).
  const STANY = {
    niewidziane: { slowo: 'jeszcze nie było', kolor: 'var(--pole)' },
    nowe: { slowo: 'jeszcze nie umie', kolor: 'var(--skala-1)' },
    wolne: { slowo: 'uczy się', kolor: 'var(--skala-3)' },
    pewne: { slowo: 'pewne', kolor: 'var(--skala-4)' },
    mistrz: { slowo: 'mistrz', kolor: 'var(--lider)' },
  };
  const KLASA = r => { const s = S.status(r); return s === 'niewidziane' ? '' : `st-${s}`; };
  /** „mistrz 3, pewne 9, uczy się 20, jeszcze nie było 68”: od najlepszego, zera pominięte. */
  const stanySlowami = l => ['mistrz', 'pewne', 'wolne', 'nowe', 'niewidziane'].filter(k => l[k] > 0).map(k => `${STANY[k].slowo} ${l[k]}`).join(', ');
  function czas(ms) { return ms === null ? '' : `${(ms / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} s`; }

  function siatka(tabela, typ) {
    tabela.textContent = '';
    const glowa = tabela.createTHead().insertRow();
    const rog = document.createElement('th'); rog.textContent = typ === 'm' ? '×' : ':'; rog.scope = 'col'; glowa.appendChild(rog);
    for (let b = S.MIN; b <= S.MAX; b++) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = typ === 'm' ? String(b) : `= ${b}`; glowa.appendChild(th); }
    const cialo = tabela.createTBody();
    for (let a = S.MIN; a <= S.MAX; a++) {
      const w = cialo.insertRow();
      const th = document.createElement('th'); th.scope = 'row'; th.textContent = typ === 'm' ? String(a) : `: ${a}`; w.appendChild(th);
      for (let b = S.MIN; b <= S.MAX; b++) {
        const id = typ === 'm' ? `m:${Math.min(a, b)}:${Math.max(a, b)}` : `d:${a * b}:${a}`;
        const r = stan.dzialania[id];
        const td = w.insertCell();
        td.className = KLASA(r);
        const sr = S.sredniCzas(r);
        td.textContent = typ === 'm' ? String(a * b) : `${a * b}:${a}`;
        if (r && r.proby > 0) { const sm = document.createElement('small'); sm.textContent = sr === null ? 'jeszcze nie' : czas(sr); td.appendChild(sm); }
        const opis = STANY[S.status(r)].slowo;
        td.title = `${typ === 'm' ? `${a} × ${b}` : `${a * b} : ${a}`}: ${opis}${r && r.proby ? `, prób ${r.proby}, dobrze ${r.dobrze}` : ''}`;
      }
    }
  }

  /** Siatka dzielenia z resztą: wiersze to dzielnik, kolumny iloraz, w kratce zakres dzielnych. */
  function siatkaReszt(tabela) {
    // Kolumny to dzielnik (8), wiersze iloraz (9): tak siatka mieści się na wąskim telefonie.
    tabela.textContent = '';
    tabela.classList.add('siatka-waska');
    const glowa = tabela.createTHead().insertRow();
    const rog = document.createElement('th'); rog.scope = 'col'; rog.textContent = '='; glowa.appendChild(rog);
    for (let a = S.MIN; a <= S.MAX; a++) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = `: ${a}`; glowa.appendChild(th); }
    const cialo = tabela.createTBody();
    for (let b = 1; b <= S.MAX; b++) {
      const w = cialo.insertRow();
      const th = document.createElement('th'); th.scope = 'row'; th.textContent = String(b); w.appendChild(th);
      for (let a = S.MIN; a <= S.MAX; a++) {
        const id = `r:${a}:${b}`, r = stan.dzialania[id], td = w.insertCell();
        td.className = KLASA(r);
        td.textContent = a === 2 ? String(a * b + 1) : `${a * b + 1}–${a * b + a - 1}`;
        const sr = S.sredniCzas(r);
        if (r && r.proby > 0) { const sm = document.createElement('small'); sm.textContent = sr === null ? 'jeszcze nie' : czas(sr); td.appendChild(sm); }
        td.title = `${S.nazwa(S.dzialanie(id))}: ${STANY[S.status(r)].slowo}${r && r.proby ? `, prób ${r.proby}, dobrze ${r.dobrze}` : ''}`;
      }
    }
  }

  // Opis pod wyborem modułu tylko przy „Samo”: przy „Włączone” i „Wyłączone” wszystko mówi sam wybór.
  const OPIS_MODULU = (wybor, otwarty, pewnych, prog, wszystkich, czego) => (wybor !== 'auto' ? ''
    : otwarty ? 'Otworzyło się samo.' : `Otworzy się samo, gdy pewnych będzie ${prog} z ${wszystkich} ${czego}. Teraz pewnych: ${pewnych}.`);

  function panelModulow() {
    const u = stan.ustawienia, m = S.odblokowane(stan.dzialania, u);
    $('modul-reszta').value = u.moduly.reszta; $('modul-slupek').value = u.moduly.slupek;
    $('modul-reszta-info').textContent = OPIS_MODULU(u.moduly.reszta, m.auto.reszta, m.pewneDzielenia, 48, 64, 'dzieleń z tabliczki');
    $('modul-slupek-info').textContent = OPIS_MODULU(u.moduly.slupek, m.auto.slupek, m.pewneReszty, 36, 72, 'działań z resztą');
    $('u-zadan').value = u.zadanSlupka;
    $('slupek-poziom').textContent = `Poziom ${stan.slupek.poziom} z 4: ${S.POZIOMY_SLUPKA[stan.slupek.poziom]}. Zrobionych zadań: ${stan.slupek.zadan || 0}.`;
    const ul = $('slupek-pomylki'); ul.textContent = '';
    const h = (stan.slupek.historia || []).slice(-10).reverse();
    if (!h.length) { const li = document.createElement('li'); li.textContent = 'Jeszcze nie było zadań.'; ul.appendChild(li); }
    for (const x of h) {
      const li = document.createElement('li');
      li.textContent = `${x.tresc} (poziom ${x.poziom}): ${x.pomylki.length ? x.pomylki.join(', ') : 'bez pomyłki'}`;
      ul.appendChild(li);
    }
  }

  function legenda(el) {
    el.textContent = '';
    for (const { kolor: k, slowo: t } of Object.values(STANY)) {
      const s = document.createElement('span'); s.style.setProperty('--k', k); s.textContent = t; el.appendChild(s);
    }
    const sm = document.createElement('span'); sm.className = 'bez-koloru'; sm.textContent = 'Mała liczba: średni czas dobrej odpowiedzi.'; el.appendChild(sm);
  }

  const KOLUMNY = {
    // Dziś sama godzina, wcześniej dzień i miesiąc: tabela mieści się wtedy na telefonie bez przewijania w bok.
    kiedy: { tytul: 'Kiedy', wartosc: o => {
      const d = new Date(o.ts), g = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
      return d.toDateString() === new Date().toDateString() ? g : `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')} ${g}`;
    } },
    dzialanie: { tytul: 'Działanie', wartosc: o => o.tresc },
    odpowiedz: { tytul: 'Odpowiedź', wartosc: o => (o.nieWiem ? 'nie wiem' : o.odpowiedz) },
    wynik: { tytul: 'Wynik', wartosc: o => (o.ok ? 'dobrze' : `inna, ${o.poprawna}`) },
    czas: { tytul: 'Czas', wartosc: o => czas(o.ms) },
  };
  let ostatnieOdpowiedzi = [];

  function naglowekTabeli() {
    const tr = $('tabela-naglowek');
    if (tr.children.length) return;
    for (const [id, k] of Object.entries(KOLUMNY)) { const th = document.createElement('th'); th.dataset.id = id; th.scope = 'col'; th.tabIndex = 0; th.textContent = k.tytul; tr.appendChild(th); }
    kolejnosci.kolumny = P.wlacz(tr, { klucz: 'kolumny-odpowiedzi', poZmianie: wierszeTabeli, ogloszenie: ogloś });
  }

  function wierszeTabeli() {
    const kol = Array.from($('tabela-naglowek').children).map(th => th.dataset.id);
    const tb = $('tabela-cialo'); tb.textContent = '';
    for (const o of ostatnieOdpowiedzi) {
      const tr = tb.insertRow();
      for (const id of kol) tr.insertCell().textContent = KOLUMNY[id].wartosc(o);
    }
  }

  function historiaSloika() {
    const ul = $('sloik-historia'); ul.textContent = '';
    const h = stan.sloik.historia.slice(-15).reverse();
    if (!h.length) { const li = document.createElement('li'); li.textContent = 'Jeszcze pusto.'; ul.appendChild(li); }
    for (const x of h) {
      const li = document.createElement('li');
      const kiedy = new Date(x.ts).toLocaleString('pl-PL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
      const za = x.powod === 'sesja' ? 'za sesję' : x.powod === 'bonus' ? `bonus${x.opis ? `: ${x.opis}` : ''}` : x.opis || 'wymiana na nagrodę';
      li.textContent = `${kiedy}: ${x.zmiana > 0 ? '+' : ''}${x.zmiana} ${za}`;
      ul.appendChild(li);
    }
  }

  async function pokazRodzicow() {
    const teraz = Date.now(), l = S.liczby(stan.dzialania, teraz);
    const ost = stan.sesje[stan.sesje.length - 1];
    // Dwie linie: stan tabliczki tymi samymi słowami co legenda i kiedy była ostatnia sesja.
    // Z resztą i słupek mają swoje liczby w swoich zakładkach.
    $('rodzice-podsumowanie').textContent = `Tabliczka: ${stanySlowami(l)}.`;
    $('rodzice-sesje').textContent = ost
      ? `Ostatnia sesja ${new Date(ost.koniec).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}, razem ${stan.sesje.length}.`
      : 'Jeszcze nie było sesji.';
    siatka($('siatka-mnozenie'), 'm'); siatka($('siatka-dzielenie'), 'd'); siatkaReszt($('siatka-reszta'));
    legenda($('legenda-mnozenie')); legenda($('legenda-dzielenie')); legenda($('legenda-reszta'));
    panelModulow();
    const u = stan.ustawienia;
    $('u-imie').value = u.imie; $('u-punkty').value = u.punktyZaSesje; $('u-sesji').value = u.sesjiDziennie; $('u-cel').value = u.celPunkty; $('u-opis').value = u.celOpis;
    $('nagroda-info').textContent = `W słoiku jest ${ilePkt(stan.sloik.punkty)}.`;
    $('imie-info').textContent = 'Widać je na powitaniu.';
    for (const id of ['bonus-info', 'pin-info', 'kolejnosc-info', 'eksport-info']) $(id).textContent = '';
    historiaSloika();
    naglowekTabeli();
    pokaz('rodzice');
    const wszystkie = await B.odpowiedzi();
    ostatnieOdpowiedzi = wszystkie.slice(-60).reverse();
    wierszeTabeli();
  }

  function wybierzZakladke(id) {
    for (const b of $('zakladki').children) b.setAttribute('aria-selected', String(b.dataset.id === id));
    for (const p of document.querySelectorAll('.panel')) p.hidden = p.id !== `panel-${id}`;
  }

  // Ustawienia słoika zapisują się od razu po zmianie pola, tak jak moduły (bez przycisku „Zapisz”).
  function zapiszNagrode(ev, info = 'nagroda-info') {
    if (ev) ev.preventDefault();
    const u = stan.ustawienia;
    const liczba = (v, min, max, dom) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dom; };
    u.imie = $('u-imie').value.trim().slice(0, 20);
    u.punktyZaSesje = liczba($('u-punkty').value, 1, 100, u.punktyZaSesje);
    u.sesjiDziennie = liczba($('u-sesji').value, 1, 5, u.sesjiDziennie);
    u.celPunkty = liczba($('u-cel').value, 10, 10000, u.celPunkty);
    u.celOpis = $('u-opis').value.trim().slice(0, 40) || u.celOpis;
    zapisz();
    // Pola pokazują to, co naprawdę zapisane (na przykład 5 zamiast wpisanych 50 sesji).
    $('u-imie').value = u.imie; $('u-punkty').value = u.punktyZaSesje; $('u-sesji').value = u.sesjiDziennie; $('u-cel').value = u.celPunkty; $('u-opis').value = u.celOpis;
    $(info).textContent = 'Zapisane.';
  }

  async function wymien() {
    const u = stan.ustawienia, p = stan.sloik.punkty;
    if (p > 0 && p < u.celPunkty && !(await zapytaj({ tytul: 'Wymienić przed celem?', tresc: `W słoiku jest ${p} z ${ilePkt(u.celPunkty)}. Wymiana zabierze ${ilePkt(p)}.`, tak: 'Wymień' }))) return;
    const ile = Math.min(p, u.celPunkty);
    if (ile <= 0) { $('nagroda-info').textContent = 'Słoik jest pusty.'; return; }
    stan.sloik.punkty -= ile;
    stan.sloik.historia.push({ ts: Date.now(), zmiana: -ile, powod: 'wymiana', opis: `wymiana na: ${u.celOpis}` });
    zapisz(); historiaSloika();
    $('nagroda-info').textContent = `Wymienione ${ilePkt(ile)} na: ${u.celOpis}. Zostało ${stan.sloik.punkty}.`;
  }

  function dodajBonus() {
    const n = Math.round(Number($('u-bonus').value));
    if (!Number.isFinite(n) || n < 1 || n > 500) { $('bonus-info').textContent = 'Wpisz od 1 do 500 punktów.'; return; }
    const opis = $('u-bonus-opis').value.trim().slice(0, 40);
    stan.sloik.punkty += n;
    stan.sloik.historia.push({ ts: Date.now(), zmiana: n, powod: 'bonus', opis });
    zapisz(); historiaSloika();
    $('u-bonus').value = ''; $('u-bonus-opis').value = '';
    $('bonus-info').textContent = `Dodane ${ilePkt(n)}. W słoiku jest ${stan.sloik.punkty}.`;
  }

  async function plikCsv() {
    const tekst = S.csv(await B.odpowiedzi());
    return new File([tekst], 'tabliczka-odpowiedzi.csv', { type: 'text/csv;charset=utf-8' });
  }

  // W aplikacjach (Android, iPad, Windows) zapis i wysyłanie tabeli robi kod programu:
  // TabliczkaAndroid (Java, odpowiada od razu) albo TabliczkaNatywna (Swift i C#, odpowiadają obietnicą).
  const NATYWNA = globalThis.TabliczkaAndroid || globalThis.TabliczkaNatywna || null;

  async function pobierz() {
    if (NATYWNA) { $('eksport-info').textContent = await NATYWNA.zapisz('tabliczka-odpowiedzi.csv', S.csv(await B.odpowiedzi())); return; }
    const plik = await plikCsv();
    const url = URL.createObjectURL(plik);
    const a = document.createElement('a'); a.href = url; a.download = plik.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    $('eksport-info').textContent = 'Tabela pobrana.';
  }

  async function udostepnij() {
    if (NATYWNA) { $('eksport-info').textContent = await NATYWNA.wyslij('tabliczka-odpowiedzi.csv', S.csv(await B.odpowiedzi())); return; }
    try { await navigator.share({ files: [await plikCsv()], title: 'Tabliczka: odpowiedzi' }); $('eksport-info').textContent = 'Wysłane.'; }
    catch (e) { if (e && e.name !== 'AbortError') $('eksport-info').textContent = 'Nie udało się wysłać. Użyj „Pobierz tabelę”.'; }
  }

  async function wyczysc() {
    if (!(await zapytaj({ tytul: 'Wyczyścić wszystko?', tresc: 'Znikną odpowiedzi, słoik i ustawienia na tym urządzeniu. Tego nie da się cofnąć.', tak: 'Wyczyść', niszczy: true }))) return;
    await B.wyczysc();
    stan = B.wczytajStan();
    odswiezStart(); pokaz('start');
  }

  // --- Zdarzenia -----------------------------------------------------------------------------------

  function podepnij() {
    $('przycisk-cwicz').addEventListener('click', () => zacznijSesje('tabliczka'));
    $('przycisk-reszta').addEventListener('click', () => zacznijSesje('reszta'));
    $('przycisk-slupek').addEventListener('click', zacznijSlupek);
    $('przycisk-sloik').addEventListener('click', pokazSloik);
    $('przycisk-rodzice').addEventListener('click', pokazPin);
    $('klawiatura').addEventListener('click', ev => { const b = ev.target.closest('button[data-k]'); if (b) klawisz(b.dataset.k); });
    $('klawiatura-slupek').addEventListener('click', ev => { const b = ev.target.closest('button[data-k]'); if (b) klawiszSlupek(b.dataset.k); });
    $('podpowiedz').addEventListener('click', () => {
      const b = biezaceDzialanie(); if (!b || tryb !== 'pytanie') return;
      uzytoPodpowiedzi = true; $('sposob').textContent = S.sposob(b.d, b.w.odwroc, b.w.reszta); $('podpowiedz').hidden = true;
    });
    $('slupek-podpowiedz').addEventListener('click', () => {
      if (!zad || trybS !== 'pytanie') return;
      zad.podpowiedz = true;
      $('slupek-info').textContent = S.pytanieKroku(zad.zadanie.kroki[zad.cur], zad.zadanie.dzielnik).podpowiedz;
      $('slupek-podpowiedz').hidden = true;
    });
    $('sesja-koniec').addEventListener('click', zakonczSesje);
    $('slupek-koniec').addEventListener('click', koniecSlupka);
    $('przerwa-latwe').addEventListener('click', () => {
      if (przerwaZ === 'slupek') {
        if (!sl) { pokaz('start'); return; }
        // Zamiast trudnego zadania jedno łatwe na koniec.
        sl.zadan = sl.nr + 1; pokaz('slupek'); noweZadanie(1); return;
      }
      if (!sesja) { pokaz('start'); return; }
      S.dolozLatwe(sesja, stan.dzialania, 3); pokaz('sesja'); nastepne();
    });
    $('przerwa-koniec').addEventListener('click', () => (przerwaZ === 'slupek' ? koniecSlupka() : zakonczSesje()));
    for (const k of ['reszta', 'slupek']) {
      $(`modul-${k}`).addEventListener('change', ev => { stan.ustawienia.moduly[k] = ev.target.value; zapisz(); panelModulow(); });
    }
    $('u-zadan').addEventListener('change', ev => {
      const n = Math.round(Number(ev.target.value));
      stan.ustawienia.zadanSlupka = Number.isFinite(n) ? Math.min(6, Math.max(1, n)) : 3; zapisz(); panelModulow();
    });
    $('koniec-wroc').addEventListener('click', () => { odswiezStart(); pokaz('start'); });
    $('sloik-wroc').addEventListener('click', () => { odswiezStart(); pokaz('start'); });
    $('pin-formularz').addEventListener('submit', pinOk);
    $('pin-wroc').addEventListener('click', () => pokaz('start'));
    $('rodzice-wroc').addEventListener('click', () => { odswiezStart(); pokaz('start'); });
    $('zakladki').addEventListener('click', ev => { const b = ev.target.closest('[data-id]'); if (b) wybierzZakladke(b.dataset.id); });
    $('nagroda-formularz').addEventListener('submit', zapiszNagrode);
    for (const id of ['u-punkty', 'u-sesji', 'u-cel', 'u-opis']) $(id).addEventListener('change', () => zapiszNagrode());
    $('u-imie').addEventListener('change', () => zapiszNagrode(null, 'imie-info'));
    $('wymien').addEventListener('click', wymien);
    $('dodaj-bonus').addEventListener('click', dodajBonus);
    $('pobierz-csv').addEventListener('click', pobierz);
    if ((NATYWNA && NATYWNA.wyslij) || (navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.csv', { type: 'text/csv' })] }))) {
      $('udostepnij-csv').hidden = false;
      $('udostepnij-csv').addEventListener('click', udostepnij);
    }
    $('zmien-pin').addEventListener('click', () => {
      const v = $('nowy-pin').value.trim();
      if (!/^[0-9]{4,8}$/.test(v)) { $('pin-info').textContent = 'Wpisz od 4 do 8 cyfr.'; return; }
      stan.ustawienia.pin = v; zapisz(); $('nowy-pin').value = ''; $('pin-info').textContent = 'PIN zmieniony.';
    });
    $('przywroc-kolejnosc').addEventListener('click', () => {
      for (const k of Object.values(kolejnosci)) k.przywroc();
      $('kolejnosc-info').textContent = 'Kolejność przywrócona.';
    });
    $('wyczysc').addEventListener('click', wyczysc);

    // Klawiatura komputera: cyfry, Backspace, Enter, Escape.
    document.addEventListener('keydown', ev => {
      const e = document.body.dataset.ekran;
      // Escape cofa ze Słoika, PIN-u i widoku rodziców (gdy nie ma otwartego pytania). W sesji nie: łatwo o pomyłkę.
      if (ev.key === 'Escape' && !$('okno').open && (e === 'sloik' || e === 'pin' || e === 'rodzice')) { wstecz(); ev.preventDefault(); return; }
      if ((e !== 'sesja' && e !== 'slupek') || ev.altKey || ev.ctrlKey || ev.metaKey) return;
      const kl = e === 'slupek' ? klawiszSlupek : klawisz;
      if (/^[0-9]$/.test(ev.key)) { kl(ev.key); ev.preventDefault(); }
      else if (ev.key === 'Backspace') { kl('usun'); ev.preventDefault(); }
      else if (ev.key === 'Enter') {
        if (ev.target.closest && ev.target.closest('button')) return; // Enter na przycisku sam go klika
        kl('ok'); ev.preventDefault();
      }
    });

    kolejnosci.kafle = P.wlacz($('kafle'), { klucz: 'kafle-start', ogloszenie: ogloś });
    kolejnosci.zakladki = P.wlacz($('zakladki'), { klucz: 'zakladki-rodzice', ogloszenie: ogloś });
  }

  function start() {
    podepnij();
    odswiezStart();
    pokaz('start');
    B.utrwal();
    // W aplikacjach pliki są na miejscu, więc service worker nie jest potrzebny.
    if (!NATYWNA && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* bez pracy offline */ });
    }
  }

  // Dla testów automatycznych (testy\ekrany.cjs): podgląd stanu bez grzebania w środku.
  /** Przycisk „wstecz” telefonu: z każdego ekranu wraca na start; na starcie zwraca false (zamknij aplikację). */
  function wstecz() {
    const e = document.body.dataset.ekran;
    if (e === 'start') return false;
    if (e === 'sesja') zakonczSesje();
    else if (e === 'slupek') koniecSlupka();
    else if (e === 'przerwa') { if (przerwaZ === 'slupek') koniecSlupka(); else zakonczSesje(); }
    else { odswiezStart(); pokaz('start'); }
    return true;
  }

  globalThis.Aplikacja = {
    wstecz,
    stan: () => stan, sesja: () => sesja, tryb: () => tryb,
    slupek: () => (zad ? { kroki: zad.zadanie.kroki, cur: zad.cur, dzielna: zad.zadanie.dzielna, dzielnik: zad.zadanie.dzielnik, iloraz: zad.zadanie.iloraz, reszta: zad.zadanie.reszta } : null),
    trybSlupka: () => trybS,
  };
  start();
})();
