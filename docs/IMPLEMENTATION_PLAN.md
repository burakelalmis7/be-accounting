# Implementierungsstand

1. Der bisherige globale Browserzustand wurde analysiert. `State.set()` bleibt
   synchron für die UI, ist aber nach einer Anmeldung kein Speichererfolg.
   Kritische Cloud-Schreibvorgänge warten auf die Datenbankantwort.
2. Die Migration definiert mandantenfähige Tabellen, Versionen, RLS, private
   Belege und die atomare RPC-Funktion für Ausgangsrechnungen.
3. Das statische Frontend erhält Auth, paginiertes Laden, Konflikterkennung und
   lokale IndexedDB-Entwürfe für Buchungen und Rechnungen.
4. Der geführte Bestandsimport für JSON-Exporte ohne eingebettete Belege ist
   aktiviert. Als nächstes: RLS mit zwei echten Auth-Sitzungen testen und
   einen Import mit Belegen in einer isolierten Testfirma entwickeln.

## Bewusste Abweichungen

- Die vorhandenen IDs sind keine UUIDs. Neue Datensätze verwenden UUIDv4.
  Der Altdatenimport muss eine Zuordnungstabelle verwenden, statt alte IDs in
  UUID-Spalten zu erzwingen.
- Die Anwendung legt keine Demodaten mehr an. Ohne Konfiguration erscheint der
  Einrichtungsbildschirm, nicht ein lokaler Ersatzbetrieb.
- Der bestehende JSON-Export bleibt als lesbarer Legacy-Export erhalten. Ein
  ZIP-Export mit Binärbelegen benötigt eine aktiv konfigurierte Supabase-Umgebung
  und ist noch nicht implementiert.
