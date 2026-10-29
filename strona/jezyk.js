// Język wyglądu Jacka 0.1.0: barwy ról obu motywów i światło za kursorem. Wygenerowane przez jezyk/generuj.mjs.
window.JezykWygladu = {"wersja":"0.1.0","stan":"2026-10-28","jasny":{"tlo":"#ffffff","tlo-drugie":"#f5f5f7","karta":"#ffffff","tekst":"#1d1d1f","tekst-drugi":"#636366","obwodka":"rgb(0 0 0 / 0.12)","obwodka-pola":"#86868b","akcent":"#0071e3","na-akcencie":"#ffffff","fokus":"#0071e3","link":"#0066cc","blad":"#d70015","przycisk-szary":"#e8e8ed","stan-jest":"#e5e5ea","stan-pracuje":"#34c759","stan-czeka":"#ff9f0a","stan-skonczyl":"#d70015","stan-wybrane":"#0071e3","stan-szukanie":"#a843db","stan-lider":"#a843db","stan-zaznaczenie":"#7138cc","na-stanie-jest":"#1d1d1f","na-stanie-pracuje":"#1d1d1f","na-stanie-czeka":"#1d1d1f","na-stanie-skonczyl":"#ffffff","na-stanie-wybrane":"#ffffff","na-stanie-szukanie":"#ffffff","na-stanie-lider":"#ffffff","na-stanie-zaznaczenie":"#ffffff","skala-zly":"rgb(255 56 60 / 0.42)","skala-slaby":"rgb(255 141 40 / 0.42)","skala-sredni":"rgb(255 204 0 / 0.42)","skala-dobry":"rgb(52 199 89 / 0.42)","skala-napis":"#1d1d1f","szklo-blysk-krawedzi":"rgb(255 255 255 / 0.95)","szklo-poswiata-wcisniecia":"rgb(255 255 255 / 0.45)"},"ciemny":{"tlo":"#000000","tlo-drugie":"#1c1c1e","karta":"#000000","tekst":"#ffffff","tekst-drugi":"#c7c7cc","obwodka":"rgb(255 255 255 / 0.16)","obwodka-pola":"#7c7c80","akcent":"#409cff","na-akcencie":"#000000","fokus":"#409cff","link":"#2997ff","blad":"#ff6961","przycisk-szary":"#2c2c2e","stan-jest":"#1c1c1e","stan-pracuje":"#30d158","stan-czeka":"#ff9f0a","stan-skonczyl":"#d70015","stan-wybrane":"#409cff","stan-szukanie":"#a843db","stan-lider":"#a843db","stan-zaznaczenie":"#9e61ff","na-stanie-jest":"#ffffff","na-stanie-pracuje":"#1d1d1f","na-stanie-czeka":"#1d1d1f","na-stanie-skonczyl":"#ffffff","na-stanie-wybrane":"#000000","na-stanie-szukanie":"#ffffff","na-stanie-lider":"#ffffff","na-stanie-zaznaczenie":"#000000","skala-zly":"rgb(255 66 69 / 0.42)","skala-slaby":"rgb(255 146 48 / 0.42)","skala-sredni":"rgb(255 214 0 / 0.42)","skala-dobry":"rgb(48 209 88 / 0.42)","skala-napis":"#ffffff","szklo-blysk-krawedzi":"rgb(255 255 255 / 0.4)","szklo-poswiata-wcisniecia":"rgb(255 255 255 / 0.26)"}};
// Światło za kursorem na przyciskach wariantu 4: ustawia --mx i --my, resztę robi jezyk.css.
(() => {
  const ustaw = (e) => {
    const el = e.target.closest && e.target.closest('.wz-przycisk');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left).toFixed(1) + 'px');
    el.style.setProperty('--my', (e.clientY - r.top).toFixed(1) + 'px');
  };
  document.addEventListener('pointermove', ustaw, { passive: true });
  document.addEventListener('pointerdown', ustaw, { passive: true });
})();

// Zachowania klocków (zadanie 6). Działają same po dołączeniu jezyk.js; program dostaje zdarzenia i woła JezykWygladu.menu i JezykWygladu.cofnij.
(() => {
  const J = window.JezykWygladu = window.JezykWygladu || {};
  const czas = (n, z) => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--wz-czas-" + n)); return isFinite(v) ? v : z; };
  const AKTYWNE = "button, a[href], input, select, textarea, label, [role=button], [role=menuitem], [role=switch], [tabindex]";
  const wPolu = (el) => Boolean(el && el.closest && el.closest("input, textarea, select, [contenteditable=true]"));

  // Dymek (D-075, D-077): rzecz z data-dymek pokazuje go po 250 ms pod kursorem, a z klawiatury od razu przy fokusie. Stoi na środku
  // pod rzeczą, a bez miejsca na środku nad nią. Kursor może na niego wjechać, Escape go chowa (WCAG 1.4.13), czytnik ekranu dostaje tekst.
  let dymek = null, nad = null, zegar = 0, chowanie = 0;
  const schowaj = () => { clearTimeout(zegar); clearTimeout(chowanie); if (dymek) dymek.remove(); if (nad) nad.removeAttribute("aria-describedby"); dymek = null; nad = null; };
  const pokaz = (el) => {
    schowaj(); nad = el;
    dymek = document.createElement("div"); dymek.className = "wz-dymek"; dymek.id = "wz-dymek"; dymek.setAttribute("role", "tooltip");
    dymek.textContent = el.getAttribute("data-dymek");
    Object.assign(dymek.style, { position: "fixed", left: "0px", top: "0px", pointerEvents: "auto" });
    (el.closest(".wz-jasny, .wz-ciemny") || document.body).appendChild(dymek);
    el.setAttribute("aria-describedby", "wz-dymek");
    const r = el.getBoundingClientRect(), d = dymek.getBoundingClientRect(), m = 8;
    let y = r.bottom + m; if (y + d.height > innerHeight - m) y = r.top - m - d.height;
    const x = Math.max(m, Math.min(innerWidth - m - d.width, r.left + r.width / 2 - d.width / 2));
    dymek.style.left = Math.round(x) + "px"; dymek.style.top = Math.round(y) + "px";
    dymek.addEventListener("pointerenter", () => clearTimeout(chowanie));
    dymek.addEventListener("pointerleave", () => { chowanie = setTimeout(schowaj, 150); });
  };
  const zDymkiem = (e) => (e.target.closest ? e.target.closest("[data-dymek]") : null);
  document.addEventListener("pointerover", (e) => { const el = zDymkiem(e); if (!el || el === nad || e.pointerType === "touch") return; clearTimeout(zegar); clearTimeout(chowanie); zegar = setTimeout(() => pokaz(el), czas("dymek", 250)); });
  document.addEventListener("pointerout", (e) => { const el = zDymkiem(e); if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return; clearTimeout(zegar); if (nad === el) chowanie = setTimeout(schowaj, 150); });
  document.addEventListener("focusin", (e) => { const el = zDymkiem(e); if (el && el.matches(":focus-visible")) pokaz(el); });
  document.addEventListener("focusout", () => { if (nad) schowaj(); });
  document.addEventListener("pointerdown", (e) => { if (nad && !(dymek && dymek.contains(e.target))) schowaj(); }, true);

  // Menu (D-085, D-086): J.menu(menu, x, y, wroc) stawia ukryte .wz-menu przy miejscu kliku, a gdy brakuje miejsca, przesuwa je tylko
  // o tyle, ile trzeba. Fokus idzie na pierwszą pozycję, strzałki chodzą po pozycjach, Escape, Tab i klik obok zamykają, a fokus wraca.
  // Rzecz z data-menu="<id menu>" otwiera je prawym klikiem, klawiszem menu i Shift+F10 (z klawiatury pod sobą).
  let otwarte = null;
  const zamknijMenu = () => { if (!otwarte) return; const o = otwarte; otwarte = null; o.m.hidden = true; o.m.style.position = ""; if (o.wroc && o.wroc.focus) o.wroc.focus(); };
  J.zamknijMenu = zamknijMenu;
  J.menu = (m, x, y, wroc) => {
    zamknijMenu();
    Object.assign(m.style, { position: "fixed", zIndex: "1000", left: "0px", top: "0px" }); m.hidden = false;
    const d = m.getBoundingClientRect(), g = 8;
    m.style.left = Math.round(Math.max(g, Math.min(innerWidth - g - d.width, x))) + "px";
    m.style.top = Math.round(Math.max(g, Math.min(innerHeight - g - d.height, y))) + "px";
    otwarte = { m, wroc: wroc || document.activeElement };
    const p = m.querySelector("[role=menuitem]:not([aria-disabled=true])"); if (p) p.focus();
    return zamknijMenu;
  };
  // Na oknie w fazie przechwytywania, przed menu programu (app.js) i przed klawiszami ekranu: menu i dymek biorą swój Escape.
  addEventListener("contextmenu", (e) => {
    const el = e.target.closest ? e.target.closest("[data-menu]") : null, m = el && document.getElementById(el.getAttribute("data-menu"));
    if (!m) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const r = el.getBoundingClientRect(), zKlawiatury = e.button !== 2 || (e.clientX === 0 && e.clientY === 0);
    J.menu(m, zKlawiatury ? r.left + 8 : e.clientX, zKlawiatury ? r.bottom + 4 : e.clientY, el);
  }, true);
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && (otwarte || dymek)) { e.preventDefault(); e.stopImmediatePropagation(); if (otwarte) zamknijMenu(); else schowaj(); return; }
    const okno = e.key === "Escape" && e.target.closest ? e.target.closest("[data-zamykany]:not([hidden])") : null;
    if (okno) { e.preventDefault(); e.stopImmediatePropagation(); zamknijOkno(okno); return; }
    if (!otwarte) return;
    const poz = [...otwarte.m.querySelectorAll("[role=menuitem]:not([aria-disabled=true])")], i = poz.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); e.stopImmediatePropagation(); const n = i < 0 ? poz[0] : poz[(i + (e.key === "ArrowDown" ? 1 : poz.length - 1)) % poz.length]; if (n) n.focus(); }
    else if (e.key === "Tab") zamknijMenu();
  }, true);
  addEventListener("pointerdown", (e) => { if (otwarte && !otwarte.m.contains(e.target)) zamknijMenu(); }, true);
  document.addEventListener("click", (e) => { const p = otwarte && e.target.closest && e.target.closest("[role=menuitem]"); if (p && otwarte.m.contains(p) && p.getAttribute("aria-disabled") !== "true") setTimeout(zamknijMenu, 0); });

  // Arkusz (D-073, D-087, D-093): .wz-arkusz z data-ruchomy przesuwa się chwytem w wolnym miejscu (myszą i za górę od razu, palcem
  // gdzie indziej po 0,5 s), a uchwyt .wz-uchwyt i Ctrl+kółko skalują całość od 75 do 160%. Rusza się co piksel i sam nie wraca.
  // Escape w arkuszu daje zdarzenie wz-zamknij: zamyka go program, tak jak kółko X.
  const skala = (a, s) => { s = Math.max(0.75, Math.min(1.6, s)); a.dataset.skala = String(s); a.style.zoom = String(Math.round(s * 100) / 100); };
  addEventListener("pointerdown", (e) => {
    const a = e.target.closest ? e.target.closest(".wz-arkusz[data-ruchomy]") : null;
    if (!a || e.button !== 0) return;
    const uchwyt = e.target.closest(".wz-uchwyt");
    if (!uchwyt && e.target.closest(AKTYWNE)) return;
    const x0 = e.clientX, y0 = e.clientY, s0 = +(a.dataset.skala || 1), dx0 = +(a.dataset.dx || 0), dy0 = +(a.dataset.dy || 0);
    let jedzie = e.pointerType === "mouse" || Boolean(uchwyt) || Boolean(e.target.closest(".wz-arkusz > .gora"));
    const czekaj = jedzie ? 0 : setTimeout(() => { jedzie = true; a.classList.add("wz-przestawiany"); }, czas("przytrzymanie", 500));
    function ruch(ev) {
      if (ev.pointerId !== e.pointerId) return;
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!jedzie) { if (Math.hypot(dx, dy) > 10) koniec(); return; }
      ev.preventDefault();
      if (uchwyt) skala(a, s0 + (dx + dy) / 600);
      else { a.dataset.dx = String(dx0 + dx / s0); a.dataset.dy = String(dy0 + dy / s0); a.style.translate = Math.round(dx0 + dx / s0) + "px " + Math.round(dy0 + dy / s0) + "px"; }
    }
    function koniec() { clearTimeout(czekaj); a.classList.remove("wz-przestawiany"); removeEventListener("pointermove", ruch, true); removeEventListener("pointerup", koniec, true); removeEventListener("pointercancel", koniec, true); }
    addEventListener("pointermove", ruch, true); addEventListener("pointerup", koniec, true); addEventListener("pointercancel", koniec, true);
  }, true);
  addEventListener("wheel", (e) => { const a = e.ctrlKey && e.target.closest ? e.target.closest(".wz-arkusz[data-ruchomy]") : null; if (!a) return; e.preventDefault(); skala(a, +(a.dataset.skala || 1) * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); }, { passive: false, capture: true });
  document.addEventListener("keydown", (e) => { const a = e.key === "Escape" && e.target.closest ? e.target.closest(".wz-arkusz") : null; if (a) a.dispatchEvent(new CustomEvent("wz-zamknij", { bubbles: true })); });

  // Okna na żądanie (D-087, D-103, D-120): przycisk z data-otworz="<id>" pokazuje ukryty element (ściągę, notę, arkusz) i daje fokus
  // pierwszej rzeczy w środku. Element z data-zamykany zamyka kółko X z data-zamknij, Escape w środku i, przy nocie, przesunięcie
  // palcem w bok o ponad 80 px. Po zamknięciu dostaje zdarzenie wz-zamknij, a fokus wraca tam, skąd przyszedł. Ctrl+0 to 100% arkusza.
  function zamknijOkno(el) {
    const wFokusie = el.contains(document.activeElement), w = el._wroc;
    el.hidden = true; el.style.translate = ""; el.style.opacity = ""; el._wroc = null;
    el.dispatchEvent(new CustomEvent("wz-zamknij", { bubbles: true }));
    if (wFokusie && w && w.isConnected) w.focus();
  }
  J.zamknijOkno = zamknijOkno;
  document.addEventListener("click", (e) => {
    const b = e.target.closest ? e.target.closest("[data-otworz], [data-zamknij]") : null; if (!b) return;
    if (b.hasAttribute("data-zamknij")) { const z = b.closest("[data-zamykany]"); if (z) zamknijOkno(z); return; }
    const el = document.getElementById(b.getAttribute("data-otworz")); if (!el) return;
    el.hidden = false; el._wroc = b;
    const f = el.querySelector(AKTYWNE); if (f) f.focus(); else { el.tabIndex = -1; el.focus(); }
  });
  addEventListener("pointerdown", (e) => {
    const n = e.target.closest ? e.target.closest(".wz-nota[data-zamykany]") : null;
    if (!n || e.button !== 0 || e.target.closest(AKTYWNE)) return;
    const x0 = e.clientX; let dx = 0;
    function ruch(ev) { if (ev.pointerId !== e.pointerId) return; dx = ev.clientX - x0; n.style.translate = Math.round(dx) + "px 0"; n.style.opacity = String(Math.max(0.3, 1 - Math.abs(dx) / 240)); }
    function koniec(ev) {
      if (ev.pointerId !== e.pointerId) return;
      removeEventListener("pointermove", ruch, true); removeEventListener("pointerup", koniec, true); removeEventListener("pointercancel", koniec, true);
      if (ev.type === "pointerup" && Math.abs(dx) > 80) zamknijOkno(n); else { n.style.translate = ""; n.style.opacity = ""; }
    }
    addEventListener("pointermove", ruch, true); addEventListener("pointerup", koniec, true); addEventListener("pointercancel", koniec, true);
  }, true);
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key !== "0") return;
    const a = document.activeElement && document.activeElement.closest ? document.activeElement.closest(".wz-arkusz[data-ruchomy]") : null;
    if (a) { e.preventDefault(); skala(a, 1); }
  });

  // Cofnij po operacji (D-205): J.cofnij(fn) stawia „Cofnij” na dole na środku ekranu na 6 s; klik cofa. Klawiatura go nie dostaje,
  // bo z klawiatury cofa Ctrl+Z programu. Na komputerze pod napisem stoi skrót.
  let cof = null;
  J.cofnij = (fn, napis) => {
    if (cof) cof.remove();
    const b = document.createElement("button"); b.type = "button"; b.className = "wz-przycisk wz-cofnij paruje"; b.tabIndex = -1;
    const t = document.createElement("span"); t.className = "t"; t.textContent = napis || "Cofnij"; b.appendChild(t);
    if (!matchMedia("(pointer: coarse)").matches) { const s = document.createElement("span"); s.className = "t skrot"; s.textContent = "Ctrl+Z"; b.appendChild(s); }
    Object.assign(b.style, { position: "fixed", left: "50%", bottom: "24px", translate: "-50% 0", zIndex: "1000" });
    b.addEventListener("click", () => { b.remove(); if (cof === b) cof = null; fn(); });
    b.addEventListener("animationend", () => { b.remove(); if (cof === b) cof = null; });
    document.body.appendChild(b); cof = b; return b;
  };

  // Przestawianie (D-090, D-091, D-092): dzieci pojemnika z data-przestaw przestawia się po przytrzymaniu 0,5 s (rosną o 10%, ramka
  // w akcencie), potem rzecz jedzie za kursorem albo palcem; krótsze wciśnięcie to zwykły klik. Z klawiatury Alt+strzałka.
  // Po zmianie pojemnik dostaje zdarzenie wz-przestaw z kolejnością (data-id albo napis), a data-przestaw z nazwą zapisuje ją
  // w pamięci strony; J.przywrocKolejnosc(pojemnik) stawia zapisaną.
  const klucz = (c) => c.dataset.id || c.textContent.trim();
  const kolejnosc = (p) => [...p.children].map(klucz);
  const zapamietaj = (p) => { const n = p.getAttribute("data-przestaw"), o = kolejnosc(p); if (n) try { localStorage.setItem("wz-przestaw:" + n, JSON.stringify(o)); } catch (_) { /* pamięć strony wyłączona */ } p.dispatchEvent(new CustomEvent("wz-przestaw", { bubbles: true, detail: o })); };
  J.przywrocKolejnosc = (p) => { let o = null; try { o = JSON.parse(localStorage.getItem("wz-przestaw:" + p.getAttribute("data-przestaw"))); } catch (_) { o = null; } if (!Array.isArray(o)) return; const mapa = new Map([...p.children].map((c) => [klucz(c), c])); for (const k of o) if (mapa.has(k)) p.appendChild(mapa.get(k)); };
  document.addEventListener("keydown", (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || !/^Arrow/.test(e.key) || wPolu(e.target)) return;
    const c = e.target.closest ? e.target.closest("[data-przestaw] > *") : null; if (!c) return;
    const p = c.parentElement, wstecz = e.key === "ArrowUp" || e.key === "ArrowLeft", s = wstecz ? c.previousElementSibling : c.nextElementSibling;
    e.preventDefault(); e.stopPropagation(); if (!s) return;
    if (wstecz) p.insertBefore(c, s); else p.insertBefore(s, c);
    if (e.target.focus) e.target.focus(); zapamietaj(p);
  });
  let poPrzestawieniu = 0, trwa = false;
  addEventListener("click", (e) => { if (Date.now() < poPrzestawieniu) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  addEventListener("contextmenu", (e) => { if (trwa || Date.now() < poPrzestawieniu) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  document.addEventListener("pointerdown", (e) => {
    const c = e.target.closest ? e.target.closest("[data-przestaw] > *") : null;
    if (!c || e.button !== 0 || wPolu(e.target)) return;
    const p = c.parentElement, x0 = e.clientX, y0 = e.clientY, ox = c.offsetLeft, oy = c.offsetTop, przed = kolejnosc(p).join("\u0001");
    let jedzie = false;
    const start = setTimeout(() => { jedzie = trwa = true; c.classList.add("wz-przestawiany"); p.classList.add("wz-przestawianie"); }, czas("przytrzymanie", 500));
    function dotyk(ev) { if (jedzie && ev.cancelable) ev.preventDefault(); }
    function ruch(ev) {
      if (ev.pointerId !== e.pointerId) return;
      if (!jedzie) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > (e.pointerType === "mouse" ? 5 : 10)) koniec(); return; }
      ev.preventDefault();
      const cel = [...p.children].find((x) => { if (x === c) return false; const r = x.getBoundingClientRect(); return ev.clientY < r.top || (ev.clientY <= r.bottom && ev.clientX < r.left + r.width / 2); });
      if (cel !== c.nextElementSibling) { if (cel) p.insertBefore(c, cel); else p.appendChild(c); }
      c.style.translate = Math.round(ox + ev.clientX - x0 - c.offsetLeft) + "px " + Math.round(oy + ev.clientY - y0 - c.offsetTop) + "px";
    }
    function puszcz(ev) { if (ev.pointerId === e.pointerId) koniec(); }
    function koniec() {
      clearTimeout(start); removeEventListener("pointermove", ruch, true); removeEventListener("pointerup", puszcz, true); removeEventListener("pointercancel", puszcz, true); removeEventListener("touchmove", dotyk, true);
      if (!jedzie) return;
      trwa = false; c.classList.remove("wz-przestawiany"); p.classList.remove("wz-przestawianie"); c.style.translate = ""; poPrzestawieniu = Date.now() + 400;
      if (kolejnosc(p).join("\u0001") !== przed) zapamietaj(p);
    }
    addEventListener("pointermove", ruch, true); addEventListener("pointerup", puszcz, true); addEventListener("pointercancel", puszcz, true); addEventListener("touchmove", dotyk, { capture: true, passive: false });
  });
})();
