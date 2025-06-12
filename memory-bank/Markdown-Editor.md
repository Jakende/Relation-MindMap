# Live-Markdown-Editor – Bedienung und Funktionen

Der integrierte Markdown-Editor basiert nun auf **Monaco** und zeigt parallel eine HTML-Vorschau an. Änderungen werden weiterhin sofort in die Visualisierung übernommen und zusätzlich lokal gespeichert.

## Funktionen

- **Reset & Copy:** Der Editor besitzt eigene Schaltflächen zum Zurücksetzen des Inhalts und Kopieren in die Zwischenablage.
- **Sync Scroll:** Auf Wunsch wird der Scrollbalken zwischen Editor und Vorschau synchronisiert.
- **Auto-Speichern:** Der zuletzt bearbeitete Text bleibt über Seitenreloads erhalten.
- **Monaco Features:** Syntax‑Highlighting, Undo/Redo und Tabulator‑Unterstützung übernimmt die eingebaute Monaco-Funktionalität.
- **Dark/Light-Mode:** Editor passt sich dem gewählten Farbschema an.
- **Fehlerfeedback:** Bei fehlerhaftem Markdown wird eine Rückmeldung angezeigt.

## Tipps

- Verwenden Sie für Hierarchien Tabulatoren oder Leerzeichen.
- Relationen können als Pfeilnotation (→) am Ende der Datei hinzugefügt werden.
- Änderungen werden automatisch gespeichert.

---

Weitere Informationen zu Importformaten finden Sie in der Datei `Importformate.md`.

Der Code für Scroll‑Synchronisation und Lokalspeicherung basiert teilweise auf dem MIT-lizenzierten Projekt [markdown-live-preview](https://github.com/tanabe/markdown-live-preview).

