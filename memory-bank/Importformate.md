# Importformate für die Mindmap-App

Die Mindmap-Anwendung unterstützt den Import von zwei Dateitypen: **Markdown (.md)** und **JSON (.json)**. Beide Formate ermöglichen es, komplexe Strukturen und Relationen für Mindmaps zu definieren. Im Folgenden wird erklärt, wie die jeweiligen Dateien aufgebaut sein müssen, damit sie korrekt importiert und visualisiert werden können.

---

## 1. Markdown (.md)

Markdown-Dateien werden als hierarchische Listen interpretiert. Jeder Eintrag (Bullet Point) stellt einen Knoten dar. Die Einrückung (Tabulatoren oder Leerzeichen) definiert die Hierarchieebene. Relationen zwischen Knoten können als Pfeilnotation angegeben werden.

**Beispiel für eine gültige Markdown-Datei:**

````markdown
- Projektleitung
    - Entwicklung
        - Frontend
        - Backend
        - QA
    - Marketing
        - Online-Marketing
        - Events
- Kunde
    - Support
        - Helpdesk
        - 2nd-Level

Frontend -> QA : testet
Backend -> QA : testet
Frontend -> Kunde : liefert
Backend -> Kunde : liefert
Online-Marketing -> Kunde : kommuniziert
Events -> Kunde : kommuniziert
Kunde -> Support : fragt
Support -> Helpdesk : eskaliert
Helpdesk -> 2nd-Level : eskaliert
````

**Unterstützte Relation-Formate in Markdown:**

````markdown  
A -> B : Typ
A -> B
-> [Typ] B
-> [rel:Typ] B
````

**Beispiele:**

````markdown  
Frontend -> QA : testet
Backend -> QA
-> [liefert] Kunde
-> [rel:kommuniziert] Kunde
````

- Wenn kein Typ angegeben ist, wird "default" verwendet.
- Die Reihenfolge und Einrückung der Relationszeilen ist beliebig.

**Hinweise:**

- Jede Zeile mit einem Bullet (z.B. `-`, `*`, `+`) erzeugt einen Knoten.
- Einrückungen (Tab oder Leerzeichen) bestimmen die Hierarchie.
- Relationen werden mit den oben genannten Formaten angegeben.
- Leere Zeilen werden ignoriert.

**Beispiele für gültige Relationen:**

````markdown  
Frontend -> QA : testet
Backend -> QA : testet
-> [liefert] Kunde
-> [rel:kommuniziert] Kunde
Kunde -> Support
````

---

## 2. JSON (.json)

JSON-Dateien müssen ein Objekt mit den Feldern `nodes` und `links` enthalten. Jeder Knoten wird als Objekt mit einer eindeutigen `id` definiert. Relationen werden als Objekte mit `source`, `target` und optional `type` angegeben.

**Beispiel für eine gültige JSON-Datei:**

```json  
{
  "nodes": [
    { "id": "Projektleitung" },  
    { "id": "Entwicklung" },  
    { "id": "Frontend" },  
    { "id": "Backend" },  
    { "id": "QA" },  
    { "id": "Marketing" },  
    { "id": "Online-Marketing" },  
    { "id": "Events" },  
    { "id": "Kunde" },  
    { "id": "Support" },  
    { "id": "Helpdesk" },  
    { "id": "2nd-Level" }  
  ],  
  "links": [
    { "source": "Projektleitung", "target": "Entwicklung", "type": "koordiniert" },  
    { "source": "Projektleitung", "target": "Marketing", "type": "koordiniert" },  
    { "source": "Entwicklung", "target": "Frontend", "type": "leitet" },  
    { "source": "Entwicklung", "target": "Backend", "type": "leitet" },  
    { "source": "Entwicklung", "target": "QA", "type": "leitet" },  
    { "source": "Marketing", "target": "Online-Marketing", "type": "leitet" },  
    { "source": "Marketing", "target": "Events", "type": "leitet" },  
    { "source": "Frontend", "target": "QA", "type": "testet" },  
    { "source": "Backend", "target": "QA", "type": "testet" },  
    { "source": "Frontend", "target": "Kunde", "type": "liefert" },  
    { "source": "Backend", "target": "Kunde", "type": "liefert" },  
    { "source": "Online-Marketing", "target": "Kunde", "type": "kommuniziert" },  
    { "source": "Events", "target": "Kunde", "type": "kommuniziert" },  
    { "source": "Kunde", "target": "Support", "type": "fragt" },  
    { "source": "Support", "target": "Helpdesk", "type": "eskaliert" },  
    { "source": "Helpdesk", "target": "2nd-Level", "type": "eskaliert" }  
  ]  
}  
```

**Hinweise:**

- Jeder Knoten benötigt ein eindeutiges Feld `id` (String).
- Jede Relation benötigt `source` und `target` (jeweils die `id` eines Knotens).
- Das Feld `type` ist optional und beschreibt die Art der Beziehung.
- Die Reihenfolge der Knoten und Links ist beliebig.

---

## Fehlerquellen & Tipps

- Achten Sie auf korrekte Einrückungen und eindeutige Namen.
- In Markdown dürfen keine doppelten Knotennamen vorkommen.
- In JSON müssen alle referenzierten Knoten in `nodes` existieren.
- Bei Fehlern im Import erhalten Sie eine Rückmeldung in der Anwendung.

---

**Fragen?**
Bei Unsicherheiten oder Problemen mit dem Import wenden Sie sich bitte an den Entwickler oder konsultieren Sie die Hilfeseite der Anwendung.
