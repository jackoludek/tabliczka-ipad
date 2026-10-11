// Tabliczka na iPada: okno WKWebView wokół tej samej strony co na telefonach i na Windows.
// Strona leży w aplikacji (folder www) i otwiera się pod adresem tabliczka://app/, który podaje
// ten kod (Pliki). Nic nie idzie do sieci. Odpowiedzi, słoik i ustawienia (localStorage, IndexedDB)
// zostają w kontenerze aplikacji, także po ponownym podpisaniu tym samym Apple ID.
// Budowane bez projektu Xcode: swiftc + actool (ipad/buduj.sh), na Macu GitHub Actions.
// Kolory idą za motywem iPada; ciemny to czerń.
import UIKit
import WebKit

@main
final class Aplikacja: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let k = UISceneConfiguration(name: "Domyslna", sessionRole: connectingSceneSession.role)
        k.delegateClass = Scena.self
        return k
    }
}

final class Scena: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let ws = scene as? UIWindowScene else { return }
        let w = UIWindow(windowScene: ws)
        w.rootViewController = Ekran()
        w.makeKeyAndVisible()
        window = w
    }
}

/// Tło jak w styl.css: #f5f5f7 w jasnym motywie, czerń w ciemnym.
let kolorTla = UIColor { cechy in
    cechy.userInterfaceStyle == .dark ? UIColor.black : UIColor(red: 0xF5 / 255.0, green: 0xF5 / 255.0, blue: 0xF7 / 255.0, alpha: 1)
}

final class Ekran: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, WKScriptMessageHandlerWithReply, UIScrollViewDelegate {
    private var web: WKWebView!
    /// Etap testu na symulatorze (ipad/test-symulator.sh): 0 = zwykła praca, 1 i 2 = test.
    private let etapTestu: Int = {
        let a = ProcessInfo.processInfo.arguments
        if a.contains("--test-etap1") { return 1 }
        if a.contains("--test-etap2") { return 2 }
        return 0
    }()

    override func loadView() {
        let konf = WKWebViewConfiguration()
        konf.setURLSchemeHandler(Pliki(), forURLScheme: "tabliczka")
        konf.websiteDataStore = WKWebsiteDataStore.default()
        konf.defaultWebpagePreferences.allowsContentJavaScript = true
        let uc = konf.userContentController
        uc.addUserScript(WKUserScript(source: Ekran.most, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        uc.addScriptMessageHandler(self, contentWorld: .page, name: "tabliczka")
        if etapTestu > 0 {
            uc.addUserScript(WKUserScript(source: Ekran.test.replacingOccurrences(of: "__ETAP__", with: String(etapTestu)), injectionTime: .atDocumentEnd, forMainFrameOnly: true))
            uc.add(self, name: "test")
        }
        let w = WKWebView(frame: .zero, configuration: konf)
        w.isOpaque = false
        w.backgroundColor = kolorTla
        w.scrollView.backgroundColor = kolorTla
        // Strona sama pilnuje marginesów (env(safe-area-inset-*) z viewport-fit=cover).
        w.scrollView.contentInsetAdjustmentBehavior = .never
        w.scrollView.delegate = self
        w.allowsBackForwardNavigationGestures = false
        w.allowsLinkPreview = false
        w.navigationDelegate = self
        w.uiDelegate = self
        web = w
        view = w
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        web.load(URLRequest(url: URL(string: "tabliczka://app/index.html")!))
    }

    // Układ jest liczony na jeden ekran bez przewijania; powiększanie palcami by go rozsadziło.
    func viewForZooming(in scrollView: UIScrollView) -> UIView? { return nil }

    // Strona zostaje w aplikacji; linki na zewnątrz (np. źródła) otwiera Safari.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let u = navigationAction.request.url, let s = u.scheme?.lowercased() else { decisionHandler(.cancel); return }
        if s == "tabliczka" || s == "about" { decisionHandler(.allow); return }
        if s == "http" || s == "https" { UIApplication.shared.open(u) }
        decisionHandler(.cancel)
    }

    // Gdy iPadOS zamknie proces strony (np. przy braku pamięci), otwieramy ją od nowa. Dane są na dysku.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.load(URLRequest(url: URL(string: "tabliczka://app/index.html")!))
    }

    // confirm() i alert() z widoku rodziców (wymiana punktów, czyszczenie danych).
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Anuluj", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }

    /// Most do strony: window.TabliczkaNatywna.zapisz/wyslij(nazwa, treść) → obietnica z tekstem dla rodziców.
    /// Na iPadzie oba otwierają okno udostępniania: „Zachowaj w Plikach”, AirDrop, Mail.
    static let most = """
    (function () {
      var h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.tabliczka;
      if (!h) return;
      window.TabliczkaNatywna = {
        platforma: 'ipad',
        zapisz: function (nazwa, tresc) { return h.postMessage({ akcja: 'zapisz', nazwa: nazwa, tresc: tresc }); },
        wyslij: function (nazwa, tresc) { return h.postMessage({ akcja: 'wyslij', nazwa: nazwa, tresc: tresc }); }
      };
    })();
    """

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard let d = message.body as? [String: Any], d["akcja"] is String else { replyHandler(nil, "Zła prośba."); return }
        let nazwa = (d["nazwa"] as? String) ?? "tabliczka-odpowiedzi.csv"
        let tresc = (d["tresc"] as? String) ?? ""
        let bezpieczna = nazwa.replacingOccurrences(of: "[^A-Za-z0-9._-]", with: "-", options: .regularExpression)
        let plik = FileManager.default.temporaryDirectory.appendingPathComponent(bezpieczna.isEmpty ? "tabliczka.csv" : bezpieczna)
        do {
            try Data(tresc.utf8).write(to: plik, options: .atomic)
        } catch {
            replyHandler("Nie udało się przygotować tabeli.", nil)
            return
        }
        if etapTestu > 0 { replyHandler("Tabela przygotowana (test).", nil); return }
        let ac = UIActivityViewController(activityItems: [plik], applicationActivities: nil)
        if let pop = ac.popoverPresentationController {
            pop.sourceView = view
            pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 80, width: 1, height: 1)
            pop.permittedArrowDirections = []
        }
        ac.completionWithItemsHandler = { _, zrobione, _, _ in
            replyHandler(zrobione ? "Tabela zapisana albo wysłana." : "Nie zapisano.", nil)
        }
        present(ac, animated: true)
    }

    // --- Test na symulatorze --------------------------------------------------------------

    /// Etap 1: sesja, 3 dobre odpowiedzi, zapis, most. Etap 2 (po ponownym uruchomieniu): czy zapis został.
    static let test = """
    (async function () {
      var ETAP = __ETAP__;
      var czekaj = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
      var zglos = function (d) { window.webkit.messageHandlers.test.postMessage(JSON.stringify(d)); };
      try {
        for (var i = 0; i < 150 && !(window.Aplikacja && document.readyState === 'complete'); i++) await czekaj(100);
        await czekaj(400);
        var idb = await new Promise(function (ok) {
          try { var r = indexedDB.open('test-idb', 1); r.onsuccess = function () { r.result.close(); ok(true); }; r.onerror = function () { ok(false); }; }
          catch (e) { ok(false); }
        });
        var w = { etap: ETAP, adres: location.href, indexedDB: idb, natywna: !!window.TabliczkaNatywna,
          czcionka: document.fonts.check('17px Inter'), szer: innerWidth, wys: innerHeight,
          ciemny: matchMedia('(prefers-color-scheme: dark)').matches,
          tlo: getComputedStyle(document.body).backgroundColor,
          startBezPrzewijania: document.documentElement.scrollHeight <= innerHeight + 1 };
        if (ETAP === 1) {
          document.getElementById('przycisk-cwicz').click();
          await czekaj(300);
          w.sesjaBezPrzewijania = document.documentElement.scrollHeight <= innerHeight + 1;
          for (var k = 0; k < 3; k++) {
            var m = document.getElementById('dzialanie').textContent.match(/(\\d+)\\s*×\\s*(\\d+)/);
            if (!m) break;
            var wynik = String(Number(m[1]) * Number(m[2]));
            for (var c = 0; c < wynik.length; c++) document.querySelector('#klawiatura [data-k="' + wynik[c] + '"]').click();
            document.getElementById('klawisz-ok').click();
            for (var j = 0; j < 30 && Aplikacja.tryb() === 'dobrze'; j++) await czekaj(100);
          }
          w.eksport = await TabliczkaNatywna.zapisz('tabliczka-test.csv', Silnik.csv(await Baza.odpowiedzi()));
        }
        w.odpowiedzi = (await Baza.odpowiedzi()).length;
        w.proby = Object.values(Aplikacja.stan().dzialania).reduce(function (s, r) { return s + (r.proby || 0); }, 0);
        w.ekran = document.body.dataset.ekran;
        w.wstep = (document.getElementById('start-wstep') || {}).textContent || '';
        zglos(w);
      } catch (e) { zglos({ etap: ETAP, blad: String((e && e.stack) || e) }); }
    })();
    """

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "test", let tekst = message.body as? String else { return }
        let dok = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dok, withIntermediateDirectories: true)
        try? Data(tekst.utf8).write(to: dok.appendingPathComponent("test-etap\(etapTestu).json"), options: .atomic)
    }
}

/// Pliki strony z folderu www w aplikacji. Ścieżki spoza www i inne hosty dostają odmowę.
final class Pliki: NSObject, WKURLSchemeHandler {
    private static let typy: [String: String] = [
        "html": "text/html; charset=utf-8", "js": "text/javascript; charset=utf-8", "css": "text/css; charset=utf-8",
        "webmanifest": "application/manifest+json", "json": "application/json", "svg": "image/svg+xml",
        "png": "image/png", "woff2": "font/woff2", "txt": "text/plain; charset=utf-8",
    ]

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let u = urlSchemeTask.request.url, u.host == "app", let www = Bundle.main.resourceURL?.appendingPathComponent("www") else {
            odpowiedz(urlSchemeTask, 403, Data(), "text/plain"); return
        }
        var p = u.path
        if p.isEmpty || p == "/" { p = "/index.html" }
        if p.contains("..") { odpowiedz(urlSchemeTask, 404, Data(), "text/plain"); return }
        let plik = www.appendingPathComponent(String(p.dropFirst()))
        guard let dane = try? Data(contentsOf: plik) else { odpowiedz(urlSchemeTask, 404, Data(), "text/plain"); return }
        odpowiedz(urlSchemeTask, 200, dane, Pliki.typy[plik.pathExtension.lowercased()] ?? "application/octet-stream")
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private func odpowiedz(_ t: WKURLSchemeTask, _ kod: Int, _ dane: Data, _ typ: String) {
        let naglowki = ["Content-Type": typ, "Content-Length": String(dane.count), "Cache-Control": "no-cache"]
        guard let u = t.request.url, let r = HTTPURLResponse(url: u, statusCode: kod, httpVersion: "HTTP/1.1", headerFields: naglowki) else { return }
        t.didReceive(r)
        t.didReceive(dane)
        t.didFinish()
    }
}
