# Relation-MindMap

Relation-MindMap ist ein browserbasiertes Werkzeug zum Erstellen interaktiver Mind Maps. Es ermöglicht Benutzern, hierarchische Strukturen sowie beliebige Beziehungen darzustellen und speichert die aktuelle Karte lokal im Browser.

## Hauptfunktionen

- **Zwei Ansichtsmodi**: Wechseln Sie nahtlos zwischen einer traditionellen Baumansicht und einer Graphansicht.
- **Live-Markdown-Editor**: Bearbeiten Sie Ihre Mind Map als eingerückte Markdown-Liste mit Funktionen wie automatischen Aufzählungszeichen, Einrückung mittels Tab/Shift+Tab und Undo/Redo-Unterstützung.
- **Import & Export**: Laden Sie Karten aus `.md`- oder `.json`-Dateien und exportieren Sie Ihre aktuelle Karte nach Markdown oder JSON.
- **Suche & Navigation**: Verwenden Sie die Suchleiste, um bestimmte Knoten hervorzuheben und direkt dorthin zu springen.
- **Anpassbare Anzeige**: Passen Sie Einstellungen wie Verbindungsabstand, Knotengröße und Animationsgeschwindigkeit an.
- **Farbschemata & Dunkelmodus**: Wählen Sie aus verschiedenen Farbpaletten und schalten Sie den Dunkelmodus um.

## Zugriff auf die Anwendung

Sie können auf die Relation-MindMap-Anwendung hier zugreifen: [Relation-MindMap](https://www.jakob-endemann.de/development/mindmap/)

## Code erkunden

Der Quellcode für Relation-MindMap ist auf GitHub verfügbar: [Relation-MindMap GitHub Repository](https://github.com/Jakende/Relation-MindMap)

## Erste Schritte

Um Relation-MindMap zu verwenden, öffnen Sie einfach `index.html` in einem modernen Webbrowser. Sie können Ihre eigenen Markdown- oder JSON-Dateien mithilfe der Importfunktion in der oberen rechten Ecke importieren. Beispiel-Datensätze finden Sie im Ordner `Importe/`.

### Arbeiten mit dem Live-Markdown-Editor

- **Erstellen von Hierarchieebenen**: Verwenden Sie die Tab-Taste, um eine neue Ebene unter einem Knoten zu erstellen. Mit Shift+Tab können Sie eine Ebene zurückspringen.
- **Hinzufügen von Beziehungen**: Um Beziehungen zwischen Knoten herzustellen, verwenden Sie die Pfeilnotation im Markdown-Editor. Zum Beispiel: `A -> B : Typ`. Unterstützte Formate sind `A -> B`, `-> [Typ] B`, und `-> [rel:Typ] B`.
- **Bearbeiten von Knoten**: Sie können die Knoten direkt im Markdown-Editor bearbeiten. Änderungen werden automatisch in der Mind Map übernommen.

Für detailliertere Informationen zu den Funktionen und der Verwendung der Anwendung lesen Sie bitte die Dokumentation im Verzeichnis `memory-bank/`.

## Detaillierte Funktionen

- **Hierarchische Strukturen**: Darstellung komplexer hierarchischer Beziehungen in der Baumansicht.
- **Beziehungen**: Visualisierung beliebiger Beziehungen zwischen Knoten in der Graphansicht.
- **Lokale Speicherung**: Die aktuelle Mind Map und alle Einstellungen werden in `localStorage` gespeichert, sodass die nächste Sitzung automatisch wiederhergestellt wird.
- **Benutzerdefinierte Einstellungen**: Anpassung von Linkdistanz, Knotengröße, Hierarchieskalierung, Animationsgeschwindigkeit und Kollisionsradius.
- **Farbschemata**: Auswahl aus mehreren vordefinierten Farbpaletten und Umschalten auf einen dunklen Modus.

## Dokumentation und Beispiele

Weitere Informationen und Beispiele finden Sie in der Dokumentation im Ordner `memory-bank/`. Dort sind detaillierte Beschreibungen der Funktionen und Anleitungen zur Verwendung der Anwendung verfügbar.
