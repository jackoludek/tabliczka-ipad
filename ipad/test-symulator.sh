#!/bin/bash
# Test Tabliczki na symulatorze iPada mini (na Macu GitHub Actions):
#   etap 1: sesja, 3 dobre odpowiedzi, zapis, most do iPadOS; zamknięcie aplikacji;
#   etap 2: ponowne uruchomienie, czy odpowiedzi zostały; potem zrzut w ciemnym motywie.
# Zrzuty zmniejszone do najwyżej 1500 px (sips). Werdykt: wynik/werdykt.txt, kod wyjścia 1 przy błędzie.
set -euo pipefail
cd "$(dirname "$0")/.."
WYNIK="$PWD/wynik"
APP="$PWD/budowa/iphonesimulator/Tabliczka.app"
ID=pl.jacek.tabliczka

UDID=$(xcrun simctl list devices available -j | python3 -c '
import json, sys
d = json.load(sys.stdin)["devices"]
naj = None
for rt, lista in d.items():
    if "iOS" not in rt:
        continue
    for x in lista:
        if "iPad mini" in x["name"] and (naj is None or rt > naj[0]):
            naj = (rt, x["udid"], x["name"])
print(naj[1] if naj else "")
')
if [ -z "$UDID" ]; then echo "Brak symulatora iPad mini:"; xcrun simctl list devices available; exit 1; fi
xcrun simctl list devices | grep "$UDID" | tee "$WYNIK/symulator.txt"

xcrun simctl boot "$UDID" || true
xcrun simctl bootstatus "$UDID" -b
xcrun simctl ui "$UDID" appearance light
xcrun simctl install "$UDID" "$APP"
DANE=$(xcrun simctl get_app_container "$UDID" "$ID" data)

czekaj_na() { for i in $(seq 1 120); do [ -f "$1" ] && return 0; sleep 1; done; return 1; }
zrzut() { xcrun simctl io "$UDID" screenshot "$WYNIK/$1.png" && sips -Z 1500 "$WYNIK/$1.png" > /dev/null; }

xcrun simctl launch "$UDID" "$ID" --test-etap1
if ! czekaj_na "$DANE/Documents/test-etap1.json"; then zrzut blad-etap1; echo "Etap 1 bez wyniku"; exit 1; fi
sleep 1; zrzut ipad-mini-sesja
sleep 3
xcrun simctl terminate "$UDID" "$ID" || true
sleep 2
xcrun simctl launch "$UDID" "$ID" --test-etap2
if ! czekaj_na "$DANE/Documents/test-etap2.json"; then zrzut blad-etap2; echo "Etap 2 bez wyniku"; exit 1; fi
sleep 1; zrzut ipad-mini-start
xcrun simctl terminate "$UDID" "$ID" || true
xcrun simctl ui "$UDID" appearance dark
sleep 1
xcrun simctl launch "$UDID" "$ID"
sleep 5; zrzut ipad-mini-ciemny
cp "$DANE/Documents/"test-etap*.json "$WYNIK/"

python3 - "$WYNIK" <<'PY'
import json, sys, os
w = sys.argv[1]
e1 = json.load(open(os.path.join(w, "test-etap1.json")))
e2 = json.load(open(os.path.join(w, "test-etap2.json")))
spr = [
    ("etap 1 bez wyjątku", "blad" not in e1, e1.get("blad", "")),
    ("etap 2 bez wyjątku", "blad" not in e2, e2.get("blad", "")),
    ("strona z aplikacji (tabliczka://app/)", str(e1.get("adres", "")).startswith("tabliczka://app/"), e1.get("adres")),
    ("most do iPadOS", e1.get("natywna") is True and str(e1.get("eksport", "")).startswith("Tabela"), e1.get("eksport")),
    ("czcionka Inter z aplikacji", e1.get("czcionka") is True, ""),
    ("start bez przewijania", e1.get("startBezPrzewijania") is True, "%sx%s" % (e1.get("szer"), e1.get("wys"))),
    ("sesja na jednym ekranie", e1.get("sesjaBezPrzewijania") is True, ""),
    ("3 odpowiedzi zapisane", e1.get("odpowiedzi") == 3 and e1.get("proby") == 3, "odpowiedzi %s, próby %s" % (e1.get("odpowiedzi"), e1.get("proby"))),
    ("po ponownym uruchomieniu odpowiedzi zostają", e2.get("odpowiedzi") == 3 and e2.get("proby") == 3, "odpowiedzi %s, próby %s" % (e2.get("odpowiedzi"), e2.get("proby"))),
    ("IndexedDB działa", e1.get("indexedDB") is True, "(gdy nie, odpowiedzi idą do localStorage)"),
]
linie = ["%s %s %s" % ("ok  " if ok else "BŁĄD", nazwa, opis or "") for nazwa, ok, opis in spr]
bledy = sum(1 for _, ok, _ in spr if not ok)
linie.append("")
linie.append("%d z %d sprawdzeń OK" % (len(spr) - bledy, len(spr)))
open(os.path.join(w, "werdykt.txt"), "w").write("\n".join(linie) + "\n")
print("\n".join(linie))
sys.exit(1 if bledy else 0)
PY
