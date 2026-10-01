# Supabase einrichten

1. Erstelle ein Supabase-Projekt und führe `supabase db push` mit dem Ordner
   `supabase/migrations` aus. Die Migration erstellt auch den privaten Bucket
   `receipts` und die RLS-Regeln.
2. Lege den ersten Benutzer in **Authentication → Users** an. Öffentliche
   Registrierung bleibt deaktiviert. Erstelle anschließend eine Firma und die
   Mitgliedschaft ausschließlich im SQL-Editor als Administrator:

```sql
insert into public.companies (name) values ('Meine Firma') returning id;
insert into public.company_members (company_id, user_id)
values ('<company-uuid>', '<auth-user-uuid>');
insert into public.settings (company_id, data, company_snapshot)
values ('<company-uuid>', '{"accountingYear":2026,"currency":"EUR","invoice":{"nextNumber":1,"numberingFormat":"plain"}}', '{"name":"Meine Firma"}');
```

3. Kopiere `js/supabase-config.js` nach `js/supabase-config.local.js` und setze
   dort – in einer ignorierten lokalen Datei –
   ausschließlich die Projekt-URL und den Publishable/Anon Key:

```js
window.BE_ACCOUNTING_SUPABASE = {
  url: 'https://DEIN-PROJEKT.supabase.co',
  publishableKey: 'DEIN-PUBLISHABLE-KEY'
};
```

Kein Service-Role-Key, Datenbankpasswort oder Storage-Schlüssel gehört in den
Browser oder dieses Repository.

4. In **Authentication → URL Configuration** die lokale HTTPS/HTTP-Adresse und
   die Produktionsadresse als Redirect URLs setzen. Lokal die App über einen
   HTTP-Server öffnen, niemals über `file://`; z. B. `python3 -m http.server`.
5. Statische Veröffentlichung: nur `becoding-buchhaltung.html`, `index.html`,
   `css/` und `js/` bereitstellen. Nicht veröffentlichen: `.git/`, `.idea/`,
   PDFs/Belegordner, `supabase-config.local.js`, `.env` und private Dokumente.

## Sicherheit prüfen

Führe die SQL-Tests mit Supabase CLI aus und ergänze dabei zwei echte
Auth-Sitzungen: Mitglied A muss nur Firma A lesen/schreiben können; Mitglied B
darf weder Datensätze noch `receipts/<firma-A>/…` abrufen. Teste nie mit einem
Service-Role-Key, weil dieser RLS umgeht.

Die verwendeten Muster folgen der aktuellen Supabase-Dokumentation zu
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Datenbankfunktionen](https://supabase.com/docs/guides/database/functions) und
[Auth-Sitzungen](https://supabase.com/docs/reference/javascript/auth-getsession).

## Bestehende Daten sicher übernehmen

1. Vorher den vorhandenen JSON-Export erzeugen und außerhalb des Hosts sichern.
2. In der angemeldeten App **JSON importieren** wählen. Die Vorschau zeigt die
   Anzahl der Buchungen, Rechnungen, Geschäftspartner und Belege. Der Import
   akzeptiert derzeit nur Exporte **ohne eingebettete Belege**; sonst stoppt er
   vor dem ersten Cloud-Schreibvorgang.
3. Der Import beginnt nur bei einem leeren Cloud-Datenbestand. Jede alte ID
   erhält eine stabile neue UUID; Verweise auf Geschäftspartner und Buchungen
   werden zugeordnet. Bei einer Unterbrechung kann ausschließlich dieselbe
   Datei fortgesetzt werden. Nicht mit einer anderen Sicherung mischen.
4. Die App vergleicht Anzahl je Datensatztyp sowie Netto-, USt.- und
   Bruttosummen der Buchungen mit der Quelle. Erst danach markiert sie den
   Import als abgeschlossen und übernimmt Firmenprofil und Einstellungen.

Der Import erfolgt in mehreren Cloud-Anfragen, nicht in einer einzigen
Datenbanktransaktion. Währenddessen die Seite geöffnet lassen. Bei einer
Fehlermeldung die Originaldatei behalten und denselben Import fortsetzen;
keinen zweiten Export darüber importieren.

Es gibt bewusst keine automatische Zusammenführung lokaler Daten in eine
bereits befüllte Cloud-Firma und keinen Import von Dateien aus Repositoryordnern.

## Backups und Wiederherstellung

Der JSON-Export bewahrt die bisherige Datenstruktur. Für die zentrale Umgebung
muss ein Backup Datenbank und Storage getrennt sichern. Prüfe Aufbewahrung,
Point-in-time-Recovery und den tatsächlichen Tarif im Supabase-Dashboard vor
einer Zusage. Vor der Produktivsetzung eine Wiederherstellung in einer isolierten
Firma einschließlich eines privaten Belegs testen.
