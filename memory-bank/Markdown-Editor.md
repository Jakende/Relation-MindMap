# Live-Markdown-Editor – Bedienung und Funktionen

Der integrierte Markdown-Editor basiert auf **Monaco** und bietet eine umschaltbare HTML-Vorschau. Änderungen werden sofort in die Visualisierung übernommen und zusätzlich lokal gespeichert.

## Funktionen

- **Reset & Copy:** Der Editor besitzt eigene Schaltflächen zum Zurücksetzen des Inhalts und Kopieren in die Zwischenablage.
- **Sync Scroll:** Auf Wunsch wird der Scrollbalken zwischen Editor und Vorschau synchronisiert.
- **Ansicht wechseln:** Über einen Button lässt sich zwischen Editor und Vorschau hin‑ und herschalten.
- **Größe anpassen:** Die Breite des Editors kann per Drag am rechten Rand verändert werden.
- **Cursor merken:** Beim Schließen und erneuten Öffnen wird die zuletzt
  verwendete Position wiederhergestellt.
- **Auto-Speichern:** Der zuletzt bearbeitete Text bleibt über Seitenreloads erhalten.
- **Monaco Features:** Syntax‑Highlighting, Undo/Redo und Tabulator‑Unterstützung übernimmt die eingebaute Monaco-Funktionalität.
- **Dark/Light-Mode:** Editor passt sich dem gewählten Farbschema an.
- **Fehlerfeedback:** Bei fehlerhaftem Markdown wird eine Rückmeldung angezeigt.

## Tipps

- Verwenden Sie für Hierarchien Tabulatoren oder Leerzeichen.
- Relationen können als Pfeilnotation (→) am Ende der Datei hinzugefügt werden.
- Änderungen werden automatisch gespeichert.

Im Vollbildmodus blendet die Anwendung alle Schaltflächen und die Suchleiste aus.
Fahren Sie mit der Maus an deren Position, erscheinen sie vorübergehend.

---

Weitere Informationen zu Importformaten finden Sie in der Datei `Importformate.md`.

Der Code für Scroll‑Synchronisation und Lokalspeicherung basiert teilweise auf dem MIT-lizenzierten Projekt [markdown-live-preview](https://github.com/tanabe/markdown-live-preview).

