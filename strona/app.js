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

  /** Kiedy, krótko i wszędzie tak samo (tabela odpowiedzi, historia słoika): dziś sama godzina, wcześniej dzień i miesiąc. */
  function kiedyKrotko(ts) {
    const d = new Date(ts), g = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === new Date().toDateString() ? g : `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')} ${g}`;
  }
  const zmianaPkt = x => `${x.zmiana > 0 ? '+' : '−'}${Math.abs(x.zmiana)}`;

  function zapisz() {
    if (!B.zapiszStan(stan)) ogloś('Brakuje miejsca na zapis. Zwolnij trochę miejsca w urządzeniu.');
  }

  // Bez okienek z pytaniami (reguła Jacka z 12.10.2026): program robi, o co poproszono, a wymianę
  // i kasowanie da się cofnąć. Komunikat stoi przy rzeczy, której dotyczy, błąd jest czerwony, i znika sam.
  const czasyKomunikatow = {};
  function powiedz(id, tekst, blad = false) {
    const el = $(id); clearTimeout(czasyKomunikatow[id]);
    el.textContent = tekst; el.classList.toggle('blad', !!(tekst && blad));
    if (tekst) czasyKomunikatow[id] = setTimeout(() => { if (el.textContent === tekst) { el.textContent = ''; el.classList.remove('blad'); } }, 6000);
  }

  /** Napis przycisku Wzornika stoi w <span class="t">, bo tylko tam jest na środku wersalików. */
  function napis(id, tekst) { const b = $(id), t = b.querySelector('.t'); (t || b).textContent = tekst; }

  // Cofnij i ponów (Ctrl+Z, Ctrl+Y, reguła Jacka z 16.10.2026): każda zmiana rodzica i każde przestawienie to krok.
  // Krok z innego stanu (po „Wyczyść wszystko” albo jego cofnięciu) odpada sam, a Ctrl+Z bierze następny.
  const historia = { wstecz: [], naprzod: [] };
  function krok(opis, cofnij, ponow, zawsze = false) {
    historia.wstecz.push({ opis, cofnij, ponow, s: stan, zawsze });
    if (historia.wstecz.length > 50) historia.wstecz.shift();
    historia.naprzod = [];
  }
  async function przejdz(skad, dokad, co, slowo) {
    while (skad.length) {
      const k = skad.pop();
      if (!k.zawsze && k.s !== stan) continue;
      if (await k[co]()) { k.s = stan; dokad.push(k); odswiezPoKroku(); ogloś(`${slowo}: ${k.opis}.`); return true; }
    }
    return false;
  }
  const cofnijKrok = () => przejdz(historia.wstecz, historia.naprzod, 'cofnij', 'Cofnięte');
  const ponowKrok = () => przejdz(historia.naprzod, historia.wstecz, 'ponow', 'Ponowione');
  /** Na telefonie nie ma Ctrl+Z, więc po zmianie bez własnego przycisku „Cofnij” przez 6 s stoi „Cofnij” Wzornika. */
  function cofnijNaChwile() { if (globalThis.JezykWygladu && JezykWygladu.cofnij) JezykWygladu.cofnij(() => { cofnijKrok(); }); }
  function odswiezPoKroku() {
    const e = document.body.dataset.ekran;
    if (e === 'rodzice') { panelSloika(); panelModulow(); polaUstawien(); panelUstawien(); }
    else if (e === 'start') odswiezStart();
  }
  /** Krok cofania dla przestawienia: kolejność przed i po, z powrotem ułożona przez Przestawiane. */
  function przestawienie(nazwa) {
    return (przed, po) => {
      const uloz = l => () => { kolejnosci[nazwa].ustaw(l); panelUstawien(); return true; };
      krok('przestawienie', uloz(przed), uloz(po));
      cofnijNaChwile();
    };
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
  // Nagrodę wpisują rodzice („800 Robuxów”): liczba nie może zostać sama na końcu linii.
  const bezPrzerwy = t => String(t).replace(/(\d) (?=\S)/g, '$1\u00a0');

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
    if (l.widziane === 0) wstep = 'Najpierw krótki sprawdzian tego, co już umiesz. Bez pośpiechu, zegara nie ma.';
    else if (l.niewidziane > 0) wstep = `Sprawdzone już ${l.widziane} ze 100 działań.${l.pewne + l.mistrz ? ` Pewnych masz ${l.pewne + l.mistrz}.` : ''}`;
    else if (l.doPowtorki > 0) wstep = `Na dziś czeka ${l.doPowtorki}\u00a0${dzialan(l.doPowtorki)} do powtórki. Pewnych masz ${l.pewne + l.mistrz} ze 100.`;
    else wstep = `Na dziś wszystko powtórzone. Pewnych masz ${l.pewne + l.mistrz} ze 100.`;
    $('start-wstep').textContent = wstep;
    const dzis = S.sesjeZPunktamiDzis(stan.sloik, teraz);
    $('cwicz-opis').textContent = dzis < u.sesjiDziennie
      ? `Około 5 minut · za skończoną sesję ${ilePkt(u.punktyZaSesje)}`
      : 'Punkty na dziś już są w słoiku. Ćwiczyć i tak można.';
    const proc = Math.min(100, Math.round(100 * stan.sloik.punkty / Math.max(1, u.celPunkty)));
    $('sloik-opis').textContent = `${stan.sloik.punkty} z ${ilePkt(u.celPunkty)} · ${bezPrzerwy(u.celOpis)}`;
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
    napis('klawisz-ok', zReszta ? 'Wpisz resztę' : 'Sprawdź');
    $('podpowiedz').disabled = false;
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
    if (zReszta() && tryb === 'pytanie') napis('klawisz-ok', czesc === 'i' ? 'Wpisz resztę' : 'Sprawdź');
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

    $('podpowiedz').disabled = true;
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
      napis('klawisz-ok', 'Dalej');
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
    $('slupek-podpowiedz').disabled = trybS !== 'pytanie';
    napis('slupek-ok', 'Sprawdź');
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
    if (/^[0-9]$/.test(k)) { if (wpisaneS.length < 3) { wpisaneS = (wpisaneS === '0' ? '' : wpisaneS) + k; pokazPytanieS(); } }
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
    $('slupek-podpowiedz').disabled = true;
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
    napis('slupek-ok', 'Dalej');
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
    napis('slupek-ok', 'Dalej'); // stałe słowa procesu: Sprawdź i Dalej, a na ekranie końca Gotowe
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
    $('sloik-cel').textContent = brak > 0 ? `Do nagrody (${bezPrzerwy(u.celOpis)}) brakuje ${ilePkt(brak)}.` : `Uzbierane! Nagroda: ${bezPrzerwy(u.celOpis)}. Powiedz rodzicom.`;
    $('sloik-wypelnienie').style.height = Math.min(100, Math.round(100 * p / Math.max(1, u.celPunkty))) + '%';
    $('sloik-zasady').textContent = `Punkty są za skończone sesje, najwyżej ${u.sesjiDziennie} dziennie. Nie za szybkość i nie za wynik.`;
    // Trzy ostatnie wpisy: tu dziecko widzi bonus od rodziców („Za co (dziecko to zobaczy)”).
    const ostatnio = stan.sloik.historia.slice(-3).reverse(), ul = $('sloik-ostatnio'); ul.textContent = '';
    for (const x of ostatnio) {
      const za = x.powod === 'sesja' ? 'za sesję' : x.powod === 'bonus' ? (x.opis || 'bonus od rodziców') : bezPrzerwy(x.opis || 'wymiana na nagrodę');
      const li = document.createElement('li'); li.textContent = `${zmianaPkt(x)} ${za} · ${kiedyKrotko(x.ts)}`; ul.appendChild(li);
    }
    $('sloik-ostatnio-tytul').hidden = ul.hidden = !ostatnio.length;
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
    if (!/^[0-9]{4,8}$/.test(v)) { powiedz('pin-blad', 'Wpisz od 4 do 8 cyfr.', true); return; }
    if (pinTryb === 'ustaw') { stan.ustawienia.pin = v; zapisz(); }
    else if (v !== stan.ustawienia.pin) { powiedz('pin-blad', 'To nie ten PIN. Wpisz go jeszcze raz.', true); $('pin-pole').value = ''; return; }
    pokazRodzicow();
  }

  // Jedne słowa i jeden kolor na stan działania: podsumowanie, legenda, siatki i dymki mówią to samo.
  // Kolory jak światła: czerwony nie umie, żółty uczy się, zielony pewne; fiolet to mistrz (reguła o tabelach).
  // Znak mówi to samo bez koloru (zasada 11): kółko puste, w połowie, pełne, gwiazdka (CSS: .znak-…).
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
  /** Znak stanu rysowany w CSS (kółko puste, w połowie, pełne, gwiazdka): wszędzie wygląda tak samo, niezależnie od kroju. */
  function znak(st) { const e = document.createElement('span'); e.className = `znak znak-${st}`; e.setAttribute('aria-hidden', 'true'); return e; }
  /** Czas w kratce bez jednostki (jest w legendzie): poniżej 10 s z jedną cyfrą po przecinku, wyżej w całych sekundach. */
  const czasKratki = ms => (ms < 9950 ? (ms / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) : String(Math.round(ms / 1000)));
  /** Druga linia kratki: znak stanu i średni czas dobrej odpowiedzi; stan i czas słowami dla czytnika ekranu. */
  function znakStanu(td, r, sr) {
    const st = S.status(r);
    if (st === 'niewidziane') return;
    const sm = document.createElement('small'), jest = sr !== null && sr !== undefined;
    sm.appendChild(znak(st));
    if (jest) { const t = document.createElement('span'); t.setAttribute('aria-hidden', 'true'); t.textContent = `\u00a0${czasKratki(sr)}`; sm.appendChild(t); }
    const c = document.createElement('span'); c.className = 'tylko-czytnik'; c.textContent = `, ${STANY[st].slowo}${jest ? `, średnio ${czas(sr)}` : ''}`; sm.appendChild(c);
    td.appendChild(sm);
  }
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
        znakStanu(td, r, sr);
        const opis = STANY[S.status(r)].slowo;
        // Dymek Wzornika (data-dymek, jezyk.js) zamiast natywnego title: na środku pod kratką, z klawiatury i dla czytnika ekranu.
        td.dataset.dymek = `${typ === 'm' ? `${a} × ${b}` : `${a * b} : ${a}`}: ${opis}${r && r.proby ? `, prób ${r.proby}, dobrze ${r.dobrze}` : ''}`;
      }
    }
  }

  /** Siatka dzielenia z resztą: kolumny to dzielnik, wiersze wynik bez reszty. Kratka to cała rodzina, na przykład
   *  : 5 i = 3 to 16 : 5 … 19 : 5. W kratce tylko kolor i znak stanu, bo 72 kratki muszą zmieścić się na telefonie;
   *  pełna nazwa jest w dymku i dla czytnika ekranu. */
  function siatkaReszt(tabela) {
    tabela.textContent = '';
    tabela.classList.add('siatka-waska');
    const glowa = tabela.createTHead().insertRow();
    const rog = document.createElement('th'); rog.scope = 'col'; glowa.appendChild(rog);
    for (let a = S.MIN; a <= S.MAX; a++) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = `: ${a}`; glowa.appendChild(th); }
    const cialo = tabela.createTBody();
    for (let b = 1; b <= S.MAX; b++) {
      const w = cialo.insertRow();
      const th = document.createElement('th'); th.scope = 'row'; th.textContent = `= ${b}`; w.appendChild(th);
      for (let a = S.MIN; a <= S.MAX; a++) {
        const id = `r:${a}:${b}`, r = stan.dzialania[id], td = w.insertCell(), st = S.status(r);
        td.className = KLASA(r);
        if (st !== 'niewidziane') td.appendChild(znak(st));
        const opis = `${S.nazwa(S.dzialanie(id))} · ${STANY[st].slowo}`;
        const c = document.createElement('span'); c.className = 'tylko-czytnik'; c.textContent = opis; td.appendChild(c);
        td.dataset.dymek = `${opis}${r && r.proby ? ` · prób ${r.proby}, dobrze ${r.dobrze}` : ''}`;
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
    $('slupek-poziom').textContent = `Poziom ${stan.slupek.poziom} z ${S.NAJWYZSZY_POZIOM}: ${S.POZIOMY_SLUPKA[stan.slupek.poziom]}. Zrobionych zadań: ${stan.slupek.zadan || 0}.`;
    const ul = $('slupek-pomylki'); ul.textContent = '';
    const h = (stan.slupek.historia || []).slice(-5).reverse(); // pięć ostatnich: wszystkie są w tabeli dla Excela
    if (!h.length) { const li = document.createElement('li'); li.textContent = 'Jeszcze nie było zadań.'; ul.appendChild(li); }
    for (const x of h) {
      const li = document.createElement('li');
      li.textContent = `${x.tresc} (poziom ${x.poziom}): ${x.pomylki.length ? x.pomylki.join(', ') : 'bez pomyłki'}`;
      ul.appendChild(li);
    }
  }

  // Legenda: kratka w kolorze stanu ze znakiem w środku, taka sama jak w siatce, i słowo.
  function legenda(el, podpis) {
    el.textContent = '';
    for (const [st, { slowo, kolor }] of Object.entries(STANY)) {
      const s = document.createElement('span'), k = document.createElement('span');
      k.className = st === 'mistrz' ? 'kratka kratka-jasna' : 'kratka';
      k.style.setProperty('--k', st === 'niewidziane' || st === 'mistrz' ? kolor : `color-mix(in srgb, ${kolor} 42%, var(--karta))`);
      if (st !== 'niewidziane') k.appendChild(znak(st));
      s.append(k, slowo); el.appendChild(s);
    }
    if (podpis) { const sm = document.createElement('span'); sm.className = 'bez-koloru'; sm.textContent = podpis; el.appendChild(sm); }
  }

  const KOLUMNY = {
    kiedy: { tytul: 'Kiedy', wartosc: o => kiedyKrotko(o.ts) },
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
    kolejnosci.kolumny = P.wlacz(tr, { klucz: 'kolumny-odpowiedzi', poZmianie: () => { wierszeTabeli(); if (kolejnosci.kolumny) panelUstawien(); }, poPrzestawieniu: przestawienie('kolumny'), ogloszenie: ogloś });
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
    const h = stan.sloik.historia.slice(-5).reverse(); // pięć ostatnich, tak samo nazwane jak „Ostatnio w słoiku” u dziecka
    if (!h.length) { const li = document.createElement('li'); li.textContent = 'Jeszcze pusto.'; ul.appendChild(li); }
    for (const x of h) {
      const li = document.createElement('li');
      const za = x.powod === 'sesja' ? 'za sesję' : x.powod === 'bonus' ? `bonus${x.opis ? `: ${x.opis}` : ''}` : x.opis || 'wymiana na nagrodę';
      li.textContent = `${kiedyKrotko(x.ts)} · ${zmianaPkt(x)} ${za}`;
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
    const podCzasem = 'Liczba pod wynikiem: średni czas w sekundach.'; // znak stanu tłumaczą kratki legendy
    legenda($('legenda-mnozenie'), podCzasem); legenda($('legenda-dzielenie'), podCzasem);
    legenda($('legenda-reszta'), 'Kratka : 5 i = 3 to od 16 : 5 do 19 : 5.');
    panelModulow();
    polaUstawien();
    for (const id of ['bonus-info', 'pin-info', 'eksport-info']) powiedz(id, '');
    panelSloika(); panelUstawien();
    naglowekTabeli();
    pokaz('rodzice');
    const wszystkie = await B.odpowiedzi();
    ostatnieOdpowiedzi = wszystkie.slice(-30).reverse(); // mniej więcej jeden dzień; wszystkie są w tabeli dla Excela
    wierszeTabeli();
  }

  function wybierzZakladke(id) {
    for (const b of $('zakladki').children) b.setAttribute('aria-selected', String(b.dataset.id === id));
    for (const p of document.querySelectorAll('.panel')) p.hidden = p.id !== `panel-${id}`;
    if (id === 'dane') panelUstawien();
  }

  /** Stan słoika w widoku rodziców. Przycisk, który teraz nic nie zrobi, jest przygaszony, a nie schowany. */
  function panelSloika() {
    const h = stan.sloik.historia, ost = h[h.length - 1];
    $('nagroda-info').textContent = `W słoiku jest ${ilePkt(stan.sloik.punkty)}.`;
    $('wymien').disabled = stan.sloik.punkty <= 0;
    $('cofnij-wymiane').disabled = !(ost && ost.powod === 'wymiana');
    historiaSloika();
  }

  function panelUstawien() {
    $('przywroc-kolejnosc').disabled = !Object.values(kolejnosci).some(k => k.zmieniona());
    $('zmien-pin').disabled = !/^[0-9]{4,8}$/.test($('nowy-pin').value.trim());
    $('cofnij-wyczyszczenie').disabled = !B.kopia();
  }

  /** Pola ustawień pokazują to, co naprawdę zapisane. */
  function polaUstawien() {
    const u = stan.ustawienia;
    $('u-imie').value = u.imie; $('u-punkty').value = u.punktyZaSesje; $('u-sesji').value = u.sesjiDziennie; $('u-cel').value = u.celPunkty; $('u-opis').value = u.celOpis;
  }
  const POLA_NAGRODY = ['imie', 'punktyZaSesje', 'sesjiDziennie', 'celPunkty', 'celOpis'];
  const wybierz = (o, klucze) => Object.fromEntries(klucze.map(k => [k, o[k]]));
  /** Krok cofania dla zmiany ustawień: wartości przed i po. */
  function zmianaUstawien(opis, przed, po) {
    if (JSON.stringify(przed) === JSON.stringify(po)) return;
    const ustaw = o => () => { Object.assign(stan.ustawienia, JSON.parse(JSON.stringify(o))); zapisz(); return true; };
    krok(opis, ustaw(przed), ustaw(po));
  }

  // Ustawienia słoika zapisują się od razu po zmianie pola, tak jak moduły (bez przycisku „Zapisz”).
  function zapiszNagrode(ev) {
    if (ev) ev.preventDefault();
    const u = stan.ustawienia, przed = wybierz(u, POLA_NAGRODY);
    const liczba = (v, min, max, dom) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dom; };
    u.imie = $('u-imie').value.trim().slice(0, 20);
    u.punktyZaSesje = liczba($('u-punkty').value, 1, 100, u.punktyZaSesje);
    u.sesjiDziennie = liczba($('u-sesji').value, 1, 5, u.sesjiDziennie);
    u.celPunkty = liczba($('u-cel').value, 10, 10000, u.celPunkty);
    u.celOpis = $('u-opis').value.trim().slice(0, 40) || u.celOpis;
    zapisz();
    // Pola pokazują to, co naprawdę zapisane (na przykład 5 zamiast wpisanych 50 sesji).
    // Sukces bez komunikatu: zapis działa od razu, a pola pokazują to, co zapisane.
    polaUstawien();
    zmianaUstawien(u.imie !== przed.imie ? 'zmiana imienia' : 'zmiana ustawień słoika', przed, wybierz(u, POLA_NAGRODY));
  }

  /** Wpis w słoiku (wymiana albo bonus) z punktami; zwraca false, gdy nie ma czego zmienić. */
  function dodajWpis(w) {
    if (stan.sloik.historia.includes(w)) return false;
    stan.sloik.historia.push(w); stan.sloik.punkty += w.zmiana;
    zapisz(); panelSloika(); return true;
  }
  function usunWpis(w) {
    const h = stan.sloik.historia, i = h.lastIndexOf(w);
    if (i < 0 || stan.sloik.punkty - w.zmiana < 0) return false;
    h.splice(i, 1); stan.sloik.punkty -= w.zmiana;
    zapisz(); panelSloika(); return true;
  }

  // Wymiana bez pytania. Przed celem wymienia to, co jest; ostatnią wymianę cofa „Cofnij wymianę” albo Ctrl+Z.
  function wymien() {
    const u = stan.ustawienia, ile = Math.min(stan.sloik.punkty, u.celPunkty);
    if (ile <= 0) return;
    const wpis = { ts: Date.now(), zmiana: -ile, powod: 'wymiana', opis: `wymiana na: ${u.celOpis}` };
    dodajWpis(wpis);
    krok('wymiana na nagrodę', () => usunWpis(wpis), () => dodajWpis(wpis));
  }

  function cofnijWymiane() {
    const h = stan.sloik.historia, ost = h[h.length - 1];
    if (!ost || ost.powod !== 'wymiana') return;
    h.pop(); stan.sloik.punkty -= ost.zmiana;
    zapisz(); panelSloika();
  }

  function dodajBonus() {
    const n = Math.round(Number($('u-bonus').value));
    if (!Number.isFinite(n) || n < 1 || n > 500) { powiedz('bonus-info', 'Wpisz od 1 do 500 punktów.', true); return; }
    const opis = $('u-bonus-opis').value.trim().slice(0, 40);
    const wpis = { ts: Date.now(), zmiana: n, powod: 'bonus', opis };
    dodajWpis(wpis);
    krok('bonus', () => usunWpis(wpis), () => dodajWpis(wpis));
    cofnijNaChwile();
    $('u-bonus').value = ''; $('u-bonus-opis').value = ''; powiedz('bonus-info', '');
  }

  async function plikCsv() {
    const tekst = S.csv(await B.odpowiedzi());
    return new File([tekst], 'tabliczka-odpowiedzi.csv', { type: 'text/csv;charset=utf-8' });
  }

  // W aplikacjach (Android, iPad, Windows) zapis i wysyłanie tabeli robi kod programu:
  // TabliczkaAndroid (Java, odpowiada od razu) albo TabliczkaNatywna (Swift i C#, odpowiadają obietnicą).
  const NATYWNA = globalThis.TabliczkaAndroid || globalThis.TabliczkaNatywna || null;

  async function pobierz() {
    if (NATYWNA) { natywnaOdpowiedz(await NATYWNA.zapisz('tabliczka-odpowiedzi.csv', S.csv(await B.odpowiedzi()))); return; }
    const plik = await plikCsv();
    const url = URL.createObjectURL(plik);
    const a = document.createElement('a'); a.href = url; a.download = plik.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // Aplikacja mówi, gdzie zapisała plik (to warto wiedzieć) albo że się nie udało (wtedy na czerwono).
  function natywnaOdpowiedz(tekst) { powiedz('eksport-info', String(tekst || ''), /^Nie udało/.test(String(tekst))); }

  async function udostepnij() {
    if (NATYWNA) { natywnaOdpowiedz(await NATYWNA.wyslij('tabliczka-odpowiedzi.csv', S.csv(await B.odpowiedzi()))); return; }
    try { await navigator.share({ files: [await plikCsv()], title: 'Tabliczka: odpowiedzi' }); }
    catch (e) { if (e && e.name !== 'AbortError') powiedz('eksport-info', 'Nie udało się wysłać. Użyj „Pobierz tabelę”.', true); }
  }

  // Kasowanie bez pytania: dane idą najpierw do kopii, a „Cofnij wyczyszczenie” albo Ctrl+Z je przywraca.
  async function wyczysc() {
    if (!(await B.wyczysc())) { powiedz('dane-info', 'Nie udało się zrobić kopii, więc nic nie zostało skasowane.', true); return; }
    stan = B.wczytajStan();
    await pokazRodzicow(); wybierzZakladke('dane');
    const naNowo = async ok => { if (!ok) return false; stan = B.wczytajStan(); await pokazRodzicow(); wybierzZakladke('dane'); return true; };
    krok('wyczyszczenie', async () => naNowo(await B.cofnijWyczyszczenie()), async () => naNowo(await B.wyczysc()), true);
  }

  async function cofnijWyczyszczenie() {
    if (!(await B.cofnijWyczyszczenie())) { powiedz('dane-info', 'Kopii już nie ma.', true); panelUstawien(); return; }
    stan = B.wczytajStan();
    await pokazRodzicow(); wybierzZakladke('dane');
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
      uzytoPodpowiedzi = true; $('sposob').textContent = S.sposob(b.d, b.w.odwroc, b.w.reszta); $('podpowiedz').disabled = true;
    });
    $('slupek-podpowiedz').addEventListener('click', () => {
      if (!zad || trybS !== 'pytanie') return;
      zad.podpowiedz = true;
      $('slupek-info').textContent = S.pytanieKroku(zad.zadanie.kroki[zad.cur], zad.zadanie.dzielnik).podpowiedz;
      $('slupek-podpowiedz').disabled = true;
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
      $(`modul-${k}`).addEventListener('change', ev => {
        const przed = { moduly: { ...stan.ustawienia.moduly } };
        stan.ustawienia.moduly[k] = ev.target.value; zapisz(); panelModulow();
        zmianaUstawien('zmiana modułu', przed, { moduly: { ...stan.ustawienia.moduly } });
      });
    }
    $('u-zadan').addEventListener('change', ev => {
      const n = Math.round(Number(ev.target.value)), przed = stan.ustawienia.zadanSlupka;
      stan.ustawienia.zadanSlupka = Number.isFinite(n) ? Math.min(6, Math.max(1, n)) : 3; zapisz(); panelModulow();
      zmianaUstawien('zmiana liczby zadań', { zadanSlupka: przed }, { zadanSlupka: stan.ustawienia.zadanSlupka });
    });
    $('koniec-wroc').addEventListener('click', () => { odswiezStart(); pokaz('start'); });
    $('sloik-wroc').addEventListener('click', () => { odswiezStart(); pokaz('start'); });
    $('pin-formularz').addEventListener('submit', pinOk);
    $('pin-wroc').addEventListener('click', () => pokaz('start'));
    $('rodzice-wroc').addEventListener('click', () => { odswiezStart(); pokaz('start'); });
    $('zakladki').addEventListener('click', ev => { const b = ev.target.closest('[data-id]'); if (b) wybierzZakladke(b.dataset.id); });
    $('nagroda-formularz').addEventListener('submit', zapiszNagrode);
    for (const id of ['u-punkty', 'u-sesji', 'u-cel', 'u-opis']) $(id).addEventListener('change', () => zapiszNagrode());
    $('u-imie').addEventListener('change', () => zapiszNagrode());
    $('wymien').addEventListener('click', wymien);
    $('cofnij-wymiane').addEventListener('click', cofnijWymiane);
    $('dodaj-bonus').addEventListener('click', dodajBonus);
    $('pobierz-csv').addEventListener('click', pobierz);
    if ((NATYWNA && NATYWNA.wyslij) || (navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.csv', { type: 'text/csv' })] }))) {
      $('udostepnij-csv').hidden = false;
      $('udostepnij-csv').addEventListener('click', udostepnij);
    }
    // „Zmień PIN” jest czynny dopiero przy 4–8 cyfrach. Zmiany PIN-u nie widać, więc ta jedna dostaje krótkie potwierdzenie.
    $('nowy-pin').addEventListener('input', panelUstawien);
    $('zmien-pin').addEventListener('click', () => {
      const v = $('nowy-pin').value.trim();
      if (!/^[0-9]{4,8}$/.test(v)) return;
      const przed = stan.ustawienia.pin;
      stan.ustawienia.pin = v; zapisz(); $('nowy-pin').value = ''; panelUstawien();
      zmianaUstawien('zmiana PIN-u', { pin: przed }, { pin: v });
      powiedz('pin-info', 'PIN zmieniony.');
    });
    $('przywroc-kolejnosc').addEventListener('click', () => {
      const teraz = () => Object.fromEntries(Object.entries(kolejnosci).map(([n, k]) => [n, k.kolejnosc()]));
      const przed = teraz();
      for (const k of Object.values(kolejnosci)) k.przywroc();
      panelUstawien();
      const uloz = o => () => { for (const [n, l] of Object.entries(o)) kolejnosci[n].ustaw(l); return true; };
      krok('przywrócenie kolejności', uloz(przed), uloz(teraz()));
    });
    $('wyczysc').addEventListener('click', wyczysc);
    $('cofnij-wyczyszczenie').addEventListener('click', cofnijWyczyszczenie);

    // Klawiatura komputera: cyfry, Backspace, Enter, Escape.
    document.addEventListener('keydown', ev => {
      const e = document.body.dataset.ekran;
      // Ctrl+Z cofa, Ctrl+Y i Ctrl+Shift+Z ponawiają. W polu tekstowym zostaje zwykłe cofanie pisania, w ćwiczeniu nic.
      if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && /^[zy]$/i.test(ev.key)) {
        const wPolu = ev.target && ev.target.closest && ev.target.closest('input, textarea, select, [contenteditable="true"]');
        if (wPolu || e === 'sesja' || e === 'slupek') return;
        ev.preventDefault();
        if (ev.key.toLowerCase() === 'y' || ev.shiftKey) ponowKrok(); else cofnijKrok();
        return;
      }
      // Escape cofa ze Słoika, PIN-u i widoku rodziców. W sesji nie: łatwo o pomyłkę.
      if (ev.key === 'Escape' && (e === 'sloik' || e === 'pin' || e === 'rodzice')) { wstecz(); ev.preventDefault(); return; }
      if ((e !== 'sesja' && e !== 'slupek') || ev.altKey || ev.ctrlKey || ev.metaKey) return;
      const kl = e === 'slupek' ? klawiszSlupek : klawisz;
      if (/^[0-9]$/.test(ev.key)) { kl(ev.key); ev.preventDefault(); }
      else if (ev.key === 'Backspace') { kl('usun'); ev.preventDefault(); }
      else if (ev.key === 'Enter') {
        if (ev.target.closest && ev.target.closest('button')) return; // Enter na przycisku sam go klika
        kl('ok'); ev.preventDefault();
      }
    });

    kolejnosci.kafle = P.wlacz($('kafle'), { klucz: 'kafle-start', ogloszenie: ogloś, poPrzestawieniu: przestawienie('kafle') });
    kolejnosci.zakladki = P.wlacz($('zakladki'), { klucz: 'zakladki-rodzice', ogloszenie: ogloś, poZmianie: () => { if (kolejnosci.zakladki) panelUstawien(); }, poPrzestawieniu: przestawienie('zakladki') });
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
