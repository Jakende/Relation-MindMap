// === Module-Scope Variablen ===
let currentData = null;
let currentLayout = 'tree';
let currentScheme = 'category10';
let lastMarkdown = '';
let showAllTexts = false;
let currentGraph = null;      // Graph-Objekt für Graph-View
let currentHierarchy = null;  // Hierarchie-Objekt für Tree-View
let stickyNodesEnabled = true; // Standardmäßig ist Fixierung aktiv
let clusterEnabled = false;    // NEU: Cluster-Modus deaktiviert
let totalEnabled = false;      // Total-Modus deaktiviert
let fixedNodes = [];          // Array to track fixed nodes
let originalGraphNodes = null; // NEU: Originale Knoten für GraphView
let originalGraphLinks = null; // NEU: Originale Links für GraphView
let originalNodePositions = new Map(); // NEU: Originalpositionen der Knoten
let currentTreeViewStyle = 'default'; // NEU: Aktueller TreeView-Stil

// Globale Referenzen für DOM-Elemente, die außerhalb von DOMContentLoaded benötigt werden
let viewStyleToggle;
let viewStyleMenu;
let clusterToggle;
let relationsToggle;
let showAllToggle;
let stickyNodesToggle;
let darkToggle;
let paletteToggle;
let exportToggle;
let searchToggle;
let infoToggle;
let settingsToggle;
let markdownEditor;
let editorContainer;
let searchBar;
let searchResults;
let infoMenu;
let paletteMenu;
let exportBar;
let body;

const colorSchemes = {
  category10: d3.schemeCategory10,
  accent: d3.schemeAccent,
  dark2: d3.schemeDark2,
  set2: d3.schemeSet2,
  greys: d3.schemeGreys[9],
  bw: ["#fff", "#000"],
  'cb-friendly': ["#0072B2", "#E69F00", "#009E73", "#F0E442", "#56B4E9", "#D55E00", "#CC79A7", "#999999"]
};

// === Globale Settings für Darstellung/Animation ===
const graphSettings = {
  linkDistance: 120,
  nodeSize: 18,
  hierarchyScale: 0.5,
  animDuration: 300,
  collision: 22,
  nodeTextSize: 15 // NEU: Knotentextgröße
};

function applySettingsFromSliders() {
  graphSettings.linkDistance = +document.getElementById('slider-linkdistance').value;
  graphSettings.nodeSize = +document.getElementById('slider-nodesize').value;
  graphSettings.hierarchyScale = +document.getElementById('slider-hierarchyscale').value;
  graphSettings.animDuration = +document.getElementById('slider-animduration').value;
  graphSettings.collision = +document.getElementById('slider-collision').value;
  graphSettings.nodeTextSize = +document.getElementById('slider-nodetextsize').value; // NEU
  saveAllSettings(); // Speichere alle Einstellungen
}

function loadSettingsToSliders() {
  // Diese Funktion lädt nur die Slider-Werte in die UI, nicht aus LocalStorage
  document.getElementById('slider-linkdistance').value = graphSettings.linkDistance;
  document.getElementById('slider-nodesize').value = graphSettings.nodeSize;
  document.getElementById('slider-hierarchyscale').value = graphSettings.hierarchyScale;
  document.getElementById('slider-animduration').value = graphSettings.animDuration;
  document.getElementById('slider-collision').value = graphSettings.collision;
  document.getElementById('slider-nodetextsize').value = graphSettings.nodeTextSize; // NEU
}

// === Exporte / Hilfsfunktionen ===
function toMd(nodes, links) {
  // Hierarchie-Ebene für jeden Knoten bestimmen (aus group, falls vorhanden)
  // Fallback: group=0
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  // Versuche, die Hierarchie aus den 'hierarchy'-Links zu rekonstruieren
  const parentMap = new Map();
  links.forEach(l => {
    if (l.type === 'hierarchy') {
      const tgt = typeof l.target === 'string' ? l.target : l.target.id;
      const src = typeof l.source === 'string' ? l.source : l.source.id;
      parentMap.set(tgt, src);
    }
  });
  // Für jeden Knoten: Ebene bestimmen (Anzahl Eltern in der Hierarchie)
  function getLevel(id) {
    let lvl = 0, cur = id;
    while (parentMap.has(cur)) {
      cur = parentMap.get(cur);
      lvl++;
      // Schutz vor Zyklen
      if (lvl > 50) break;
    }
    return lvl;
  }
  return nodes.map(n => {
    const level = getLevel(n.id);
    let out = `${'\t'.repeat(level)}- ${n.id}\n`;
    links
      .filter(l => String(l.source) === n.id && l.type && l.type !== 'hierarchy')
      .forEach(l => {
        const tgt = typeof l.target === 'string' ? l.target : l.target.id;
        out += `${'\t'.repeat(level+1)}-> [rel:${l.type}] ${tgt}\n`;
      });
    return out;
  }).join('');
}

function normalizeName(name) {
  // Unicode-Normalisierung, Whitespace-Reduktion, Kleinschreibung
  return name
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseMarkdownToGraph(markdown) {
  // 1. Alle Bullets als Knoten sammeln (auch flache Bullets)
  const lines = markdown.split('\n');
  const bulletNames = [];
  lines.forEach(line => {
    // Akzeptiere -, *, +, • als Bullets, beliebig viele Leerzeichen oder Tabs
    const m = line.match(/^([ \t]*)[-*+•]\s+(.+)$/);
    if (m) bulletNames.push(m[2].trim());
  });
  // Map für robusten Vergleich
  const nameSet = new Set(bulletNames.map(normalizeName));

  // 2. Relationen parsen
  const nodes = [];
  const relationLinks = [];
  const idSet = new Set();
  let lastNode = null;
  let lastNodeIndent = 0;
  const stack = [];
  function addNode(name, group = 0) {
    const key = normalizeName(name);
    if (!idSet.has(key) && nameSet.has(key)) {
      nodes.push({ id: name, group });
      idSet.add(key);
    }
  }
  for (const line of lines) {
    // Knoten-Zeile
    let m = line.match(/^([ \t]*)[-*+•]\s+(.+)$/);
    if (m) {
      const indent = m[1].replace(/\t/g, '    ').length; // Tabs als 4 Leerzeichen
      const text = m[2].trim();
      addNode(text, Math.floor(indent/4));
      while (stack.length && stack[stack.length-1].indent >= indent) stack.pop();
      stack.push({ id: text, indent });
      lastNode = text;
      lastNodeIndent = indent;
      continue;
    }
    // Relations-Zeile (akzeptiert verschiedene Formate)
    // Format 1: -> [type] Target
    m = line.match(/^([ \t]*)->\s*(?:\[\s*(?:rel:)?([^\]]+)\])?\s*(.+)$/);
    if (m) {
      const indent = m[1].replace(/\t/g, '    ').length;
      const relType = m[2] ? m[2].trim() : 'default';
      const text = m[3].trim();
      if (!lastNode) continue;
      // Finde source (wie bisher)
      let source = lastNode;
      for (let i = stack.length-1; i >= 0; --i) {
        if (stack[i].indent < indent) {
          source = stack[i].id;
          break;
        }
      }
      const sourceKey = normalizeName(source);
      const targetKey = normalizeName(text);
      if (nameSet.has(sourceKey) && nameSet.has(targetKey)) {
        addNode(source);
        addNode(text);
        if (!relationLinks.some(l => normalizeName(l.source) === sourceKey && normalizeName(l.target) === targetKey && l.type === relType)) {
          relationLinks.push({ source, target: text, type: relType });
        }
      }
      continue;
    }
    // Format 2: Source -> Target : type
    m = line.match(/^([ \t]*)([^\-\s][^\n\r]*)\s*->\s*([^:]+?)\s*:\s*([^\n\r]+)$/);
    if (m) {
      // m[2]=source, m[3]=target, m[4]=type
      const source = m[2].trim();
      const target = m[3].trim();
      const relType = m[4].trim();
      const sourceKey = normalizeName(source);
      const targetKey = normalizeName(target);
      if (nameSet.has(sourceKey) && nameSet.has(targetKey)) {
        addNode(source);
        addNode(target);
        if (!relationLinks.some(l => normalizeName(l.source) === sourceKey && normalizeName(l.target) === targetKey && l.type === relType)) {
          relationLinks.push({ source, target, type: relType });
        }
      }
      continue;
    }
    // Format 3: Source -> Target (no type)
    m = line.match(/^([ \t]*)([^\-\s][^\n\r]*)\s*->\s*([^\n\r]+)$/);
    if (m) {
      const source = m[2].trim();
      const target = m[3].trim();
      const relType = 'default';
      const sourceKey = normalizeName(source);
      const targetKey = normalizeName(target);
      if (nameSet.has(sourceKey) && nameSet.has(targetKey)) {
        addNode(source);
        addNode(target);
        if (!relationLinks.some(l => normalizeName(l.source) === sourceKey && normalizeName(l.target) === targetKey && l.type === relType)) {
          relationLinks.push({ source, target, type: relType });
        }
      }
      continue;
    }
    // Sonst ignorieren
  }
  // Hierarchie-Links extrahieren
  const hierarchy = parseMarkdownToHierarchy(markdown);
  const hierarchyGraph = hierarchyToGraph(hierarchy);
  // Links zusammenführen (keine Duplikate)
  const allLinks = [...hierarchyGraph.links];
  for (const l of relationLinks) {
    if (!allLinks.some(h => normalizeName(h.source) === normalizeName(l.source) && normalizeName(h.target) === normalizeName(l.target) && h.type === l.type)) {
      allLinks.push(l);
    }
  }
  // Duplikate aus nodes entfernen
  const uniqueNodes = [];
  const seen = new Set();
  for (const n of nodes) {
    const key = normalizeName(n.id);
    if (!seen.has(key)) {
      uniqueNodes.push(n);
      seen.add(key);
    }
  }
  // Feedback: leeres oder fehlerhaftes Markdown
  if (uniqueNodes.length === 0 && markdown.trim().length > 0) {
    alert('Kein gültiger Knoten im Markdown gefunden. Bitte mindestens eine Zeile mit - Knotenname angeben.');
    return { nodes: [], links: [] };
  }
  return { nodes: uniqueNodes, links: allLinks };
}

function parseMarkdownToHierarchy(mdText) {
  const lines = mdText.split('\n')
    .map(line => {
      // Akzeptiere -, *, +, • als Bullets, beliebig viele Leerzeichen oder Tabs
      const m = line.match(/^([ \t]*)[-*+•]\s+(.+)$/);
      if (!m) return null;
      // Tabs als 2 Leerzeichen werten (damit ein Tab = eine Ebene)
      const indent = m[1].replace(/\t/g, '  ').length;
      return { indent, text: m[2].trim() };
    })
    .filter(item => item && item.text);
  const root = { name: 'root', children: [] };
  const stack = [{ node: root, indent: -1 }];
  lines.forEach(({ indent, text }) => {
    const node = { name: text, children: [] };
    while (indent <= stack[stack.length-1].indent) stack.pop();
    stack[stack.length-1].node.children.push(node);
    stack.push({ node, indent });
  });
  return root.children.length === 1 ? root.children[0] : root;
}

function hierarchyToGraph(root) {
  const nodes = [], links = [];
  function walk(node, parent = null) {
    if (Array.isArray(node)) {
      node.forEach(child => walk(child, parent));
      return;
    }
    nodes.push({ id: node.name });
    if (parent) {
      links.push({ source: parent.name, target: node.name, type: 'hierarchy' });
    }
    if (node.children) node.children.forEach(child => walk(child, node));
  }
  walk(root);
  // Nach dem Walk: "root" aus nodes und links entfernen
  const filteredNodes = nodes.filter(n => n.id !== 'root');
  const filteredLinks = links.filter(l => l.source !== 'root' && l.target !== 'root');
  return { nodes: filteredNodes, links: filteredLinks };
}

function initializeTree(data) {
  const svg = d3.select("svg"),
    width = window.innerWidth,
    height = window.innerHeight;
  svg.selectAll("*").remove();
  svg.style('opacity', 0);
  const g = svg.append("g");
  const root = d3.hierarchy(data);
  const nodes = root.descendants();
  const links = root.links();

  // NEU: Tags zu Knoten hinzufügen
  nodes.forEach(d => {
    d.data.tags = parseTags(d.data.name);
    // Sicherstellen, dass der Radius nicht negativ wird
    d.r = Math.max(5, graphSettings.nodeSize - d.depth * graphSettings.hierarchyScale * graphSettings.nodeSize);
  });

  function getColor(d) {
    const scheme = colorSchemes[currentScheme] || d3.schemeCategory10;
    if (currentScheme === "greys") {
      return scheme[Math.min(d.depth * 2, scheme.length - 1)];
    }
    return scheme[d.depth % scheme.length];
  }
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.index).distance(graphSettings.linkDistance).strength(1))
    .force("charge", d3.forceManyBody().strength(-220))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(d => d.r + graphSettings.collision));
  const link = g.append("g")
    .attr("class", "links")
    .selectAll("line")
    .data(links)
    .enter().append("line")
    .attr("class", "link");
  const infoBar = document.getElementById("info-bar");
  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");
  const resetBtn = document.getElementById("reset-btn");
  const searchResults = document.getElementById("search-results");

  function highlightMatch(text, query) {
    if (!query) return text;
    const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')})`, "gi");
    return text.replace(re, '<span class="search-highlight">$1</span>');
  }

  function showSearchResults(query) {
    const showResults = query && query.length > 0;
    if (showResults) {
      searchResults.classList.remove("is-hidden");
      searchResults.style.display = "block";
    } else {
      searchResults.classList.add("is-hidden");
      searchResults.style.display = "none";
    }
    if (!query) {
      searchResults.innerHTML = "";
      infoBar.innerHTML = "";
      g.selectAll(".node").style("opacity", 1);
      g.selectAll(".link").style("opacity", 1);
      return;
    }
    const matches = g.selectAll(".node").data().filter(n => n.data.name.toLowerCase().includes(query.toLowerCase()));
    if (matches.length === 0) {
      searchResults.innerHTML = `<div style="color:#d00;">Keine Treffer gefunden.</div>`;
      infoBar.innerHTML = `<span style="color:#d00;">Keine Treffer gefunden.</span>`;
      g.selectAll(".node").style("opacity", 0.15);
      g.selectAll(".link").style("opacity", 0.15);
      return;
    }
    searchResults.innerHTML = matches.map((n, i) => {
      let path = [];
      let current = n;
      while (current) {
        path.unshift(current.data.name);
        current = current.parent;
      }
      return `<div class="search-result" data-index="${n.index}">${highlightMatch(path.join(" → "), query)}</div>`;
    }).join("");
    const matchSet = new Set(matches.map(n => n));
    g.selectAll(".node").style("opacity", n => matchSet.has(n) ? 1 : 0.15);
    g.selectAll(".link").style("opacity", 0.15);
  }
  searchBtn.onclick = () => showSearchResults(searchInput.value);
  searchInput.oninput = () => showSearchResults(searchInput.value);
  resetBtn.onclick = () => {
    searchInput.value = "";
    searchResults.style.display = "none";
    infoBar.innerHTML = "";
    g.selectAll(".node").style("opacity", 1);
    g.selectAll(".link").style("opacity", 1);
  };
  searchResults.onclick = (e) => {
    if (e.target.classList.contains("search-result")) {
      const idx = +e.target.getAttribute("data-index");
      const n = g.selectAll(".node").data().find(n => n.index === idx);
      if (n) {
        g.selectAll(".node").filter(d => d.index === idx).dispatch("click");
        searchResults.style.display = "none";
      }
    }
  };
  const node = g.append("g")
    .attr("class", "nodes")
    .selectAll("g")
    .data(nodes)
    .enter().append("g")
    .attr("class", "node")
    .on("click", (event, d) => {
      event.stopPropagation();
      d3.select(event.currentTarget).select("circle")
        .transition().duration(graphSettings.animDuration).attr("r", d.r * 1.5)
        .transition().duration(graphSettings.animDuration).attr("r", d.r);
      let path = [];
      let current = d;
      while (current) {
        path.unshift(current);
        current = current.parent;
      }
      const pathText = path.map(n => n.data.name).join(" → ");
      infoBar.innerHTML = `<span class="path">${pathText}</span>`;
      const pathSet = new Set(path.map(n => n));
      const pathLinks = new Set();
      for (let i = 1; i < path.length; ++i) {
        pathLinks.add(`${path[i - 1].index}-${path[i].index}`);
      }
      g.selectAll(".node")
        .style("opacity", n => pathSet.has(n) ? 1 : 0.15);
      g.selectAll(".link")
        .style("opacity", l => pathLinks.has(`${l.source.index}-${l.target.index}`) ? 1 : 0.15);
      g.selectAll("text")
        .style("opacity", n => pathSet.has(n) ? 1 : 0);
    })
    .on("mouseover", function(event, d) {
      // Nur Text für den aktuell gehoveten Knoten anzeigen, wenn KEINE Auswahl/Hervorhebung aktiv ist
      // Wenn bereits eine Auswahl/Hervorhebung besteht (also andere Knoten ausgegraut sind), dann keine weiteren Texte einblenden/ausblenden
      const nodeOpacities = g.selectAll(".node").nodes().map(n => +d3.select(n).style("opacity"));
      const isHighlightActive = nodeOpacities.some(o => o !== 1);
      if (!isHighlightActive) {
        d3.select(this).select("text").style("opacity", 1);
      }
      if (window.showRelationLabels) {
        linkLabels.style("opacity", l => (l.source.id === d.id || l.target.id === d.id) && l.type && l.type !== 'hierarchy' ? 1 : 0);
      }
    })
    .on("mouseout", function(event, d) {
      // Nur ausblenden, wenn keine Auswahl/Hervorhebung aktiv ist
      const nodeOpacities = g.selectAll(".node").nodes().map(n => +d3.select(n).style("opacity"));
      const isHighlightActive = nodeOpacities.some(o => o !== 1);
      if (!isHighlightActive) {
        d3.select(this).select("text").style("opacity", 0);
      }
      if (window.showRelationLabels) {
        linkLabels.style("opacity", 0);
      }
    })
    .call(d3.drag()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
    .on("end", (event, d) => {
      if (!event.active) simulation.alphaTarget(0); // Simulation abkühlen lassen
      // Manuelle Gruppierung logik hier einfügen (z.B. Knoten an Zielposition fixieren)
      // Beispiel: Wenn ein Knoten auf einen anderen Knoten gezogen wird, gruppiere sie
      const targetNode = findTargetNode(event.x, event.y, nodes, d); // Hilfsfunktion
      if (targetNode) {
        console.log(`Knoten ${d.data.name} wurde auf Knoten ${targetNode.data.name} gezogen.`);
        // Hier könnte die Logik für die manuelle Gruppierung stehen
        // z.B. d.group = targetNode.group; oder eine neue Relation erstellen
      }

      // Nur lösen, wenn Fixierung AUS ist
      if (!stickyNodesEnabled) {
        d.fx = null;
        d.fy = null;
        // Remove from fixedNodes array
        const index = fixedNodes.indexOf(d);
        if (index > -1) fixedNodes.splice(index, 1);
        console.log(`Node released: ${d.data.name}`);
      } else {
        // Add to fixedNodes array if not already present
        if (fixedNodes.indexOf(d) === -1) {
          fixedNodes.push(d);
        }
        console.log(`Node fixed: ${d.data.name}`);
      }
    })
    );
  node.append("circle")
    .attr("r", d => d.r)
    .attr("fill", d => getColor(d));
  const MAX_LINE_LENGTH = 18;
  node.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", ".35em")
    .style("opacity", 0)
    .style("font-size", graphSettings.nodeTextSize + "px") // NEU
    .each(function(d) {
      if (typeof d.data.name !== 'string') return;
      const lines = wrapText(d.data.name, MAX_LINE_LENGTH);
      lines.forEach((line, i) => {
        d3.select(this)
          .append("tspan")
          .attr("x", 0)
          .attr("dy", i === 0 ? 0 : "1.2em")
          .text(line);
      });
    });
  if (showAllTexts) {
    g.selectAll('.node text').style('opacity', 1);
  }
  svg.on("click", () => {
    g.selectAll(".node").style("opacity", 1);
    g.selectAll(".link").style("opacity", 1);
    g.selectAll(".node text").style("opacity", showAllTexts ? 1 : 0);
    g.selectAll(".link-label").style("opacity", d => (window.showRelationLabels && d.type && d.type !== 'hierarchy') ? 1 : 0);
    const infoBar = document.getElementById("info-bar");
    if (infoBar) infoBar.innerHTML = "";
  });
  const zoom = d3.zoom()
    .scaleExtent([0.3, 4])
    .on("zoom", event => {
      g.attr("transform", event.transform);
      if (!showAllTexts) {
        g.selectAll("text").style("opacity", 0);
      }
    });
  svg.call(zoom);
  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);
    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });
  // Center only after simulation ends and bbox is valid
  simulation.on("end", () => {
    requestAnimationFrame(() => {
      centerGraphOrTree();
      svg.style('opacity', 1);
    });
  });
  window.addEventListener("resize", () => {
    const w = window.innerWidth, h = window.innerHeight;
    svg.attr("width", w).attr("height", h);
    simulation.force("center", d3.forceCenter(w / 2, h / 2));
    simulation.alpha(0.5).restart();
  });
  // Store simulation globally for centering
  window.lastSimulation = simulation;

  // NEU: TreeView-Stil anwenden
  toggleTreeViewStyle(currentTreeViewStyle);

  // Setup gemeinsame Suchleiste
  setupSearchBar(
    g,
    nodes,
    links,
    n => {
      let path = [];
      let current = n;
      while (current) {
        path.unshift(current.data.name);
        current = current.parent;
      }
      return path.join(" → ");
    },
    (matches, selectOnlyOne) => {
      const matchSet = new Set(matches);
      g.selectAll(".node").style("opacity", n => matchSet.has(n) ? 1 : 0.15);
      g.selectAll(".link").style("opacity", 0.15);
      if (selectOnlyOne && matches.length === 1) {
        g.selectAll(".node").filter(d => d === matches[0]).dispatch("click");
      }
    },
    () => {
      g.selectAll(".node").style("opacity", 1);
      g.selectAll(".link").style("opacity", 1);
    },
    n => {
      let path = [];
      let current = n;
      while (current) {
        path.unshift(current.data.name);
        current = current.parent;
      }
      document.getElementById("info-bar").innerHTML = `<span class="path">${path.join(" → ")}</span>`;
    }
  );
}

// NEU: Hierarchisches Layout für GraphView anwenden (ersetzt applyClusterLayout)
function applyHierarchicalLayoutForGraphView() {
  if (!window.lastSimulation || !currentGraph) return;

  const nodes = window.lastSimulation.nodes();
  const width = window.innerWidth;
  const height = window.innerHeight;
  const maxGroup = d3.max(nodes, d => d.group) || 1;

  window.lastSimulation.force("hierarchyX", d3.forceX()
    .x(d => {
      const padding = 100;
      const availableWidth = width - 2 * padding;
      return padding + (d.group / maxGroup) * availableWidth;
    })
    .strength(0.2)
  );

  // Gleichmäßige vertikale Verteilung
  window.lastSimulation.force("hierarchyY", d3.forceY()
    .y(d => {
      // Gruppieren nach Ebene
      const groupNodes = nodes.filter(n => n.group === d.group);
      const index = groupNodes.indexOf(d);
      return (index + 1) * (height / (groupNodes.length + 1));
    })
    .strength(0.1)
  );

  window.lastSimulation.alpha(1).restart();
}

// NEU: Ursprüngliches Layout wiederherstellen (für GraphView)
function resetGraphLayout() {
  if (!window.lastSimulation) return;

  const simulation = window.lastSimulation;

  // Hierarchische Kräfte entfernen
  simulation.force('hierarchyX', null);
  simulation.force('hierarchyY', null);

  // Standardkräfte wiederherstellen (falls sie entfernt wurden)
  simulation.force("center", d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2));
  simulation.force("charge", d3.forceManyBody().strength(-100)); // Oder den ursprünglichen Wert

  // Knoten auf Originalpositionen zurücksetzen
  simulation.nodes().forEach(node => {
    if (originalNodePositions.has(node.id)) {
      const pos = originalNodePositions.get(node.id);
      node.x = pos.x;
      node.y = pos.y;
      node.fx = null; // Fixierung aufheben
      node.fy = null;
    }
  });
  originalNodePositions.clear(); // Map leeren

  // Simulation mit höherer Alpha-Target neu starten für schnellere Animation
  simulation.alpha(0.5).restart(); // Erhöhter Wert für schnellere Bewegung
}

// NEU: Setzt den Cluster-Modus zurück
function resetClusterState() {
  clusterEnabled = false;
  const clusterToggle = document.getElementById('cluster-toggle');
  if (clusterToggle) {
    clusterToggle.classList.remove('toggle-btn--active');
  }
  disableTagClustering(); // Für TreeView
  resetGraphLayout(); // Für GraphView
}

// NEU: Aktualisiert die Simulationseinstellungen ohne Neuladen des Graphen
function updateSimulationSettings() {
  if (!window.lastSimulation) return;

  const simulation = window.lastSimulation;
  const nodes = simulation.nodes();

  // Aktualisiere Knotengrößen basierend auf neuen Einstellungen
  nodes.forEach(d => {
    if (currentLayout === 'tree') {
      // Sicherstellen, dass der Radius nicht negativ wird
      d.r = Math.max(5, graphSettings.nodeSize - d.depth * graphSettings.hierarchyScale * graphSettings.nodeSize);
    } else {
      // Sicherstellen, dass der Radius nicht negativ wird
      d.r = Math.max(5, graphSettings.nodeSize - (d.group || 0) * graphSettings.hierarchyScale * graphSettings.nodeSize);
    }
  });

  // Aktualisiere die Kräfte der Simulation
  if (simulation.links) { // Sicherstellen, dass links existieren
    simulation.force("link", d3.forceLink(simulation.links()).id(d => d.id || d.index).distance(graphSettings.linkDistance).strength(1));
  }
  simulation
    .force("charge", d3.forceManyBody().strength(-220)) // Oder den ursprünglichen Wert
    .force("collision", d3.forceCollide().radius(d => d.r + graphSettings.collision));

  // Aktualisiere die visuellen Attribute der Knoten und Links
  d3.select("svg").selectAll(".node circle").attr("r", d => d.r);
  d3.select("svg").selectAll(".node text").style("font-size", graphSettings.nodeTextSize + "px");
  d3.select("svg").selectAll(".link").attr("stroke-width", d => d.value ? Math.max(1.5, d.value) : 1.5);
  // NEU: Aktualisiere Relations-Label-Größe
  d3.select("svg").selectAll(".link-label").style("font-size", (graphSettings.nodeTextSize - 2) + "px");

  // Simulation neu starten, damit Änderungen wirksam werden
  simulation.alpha(1).restart();
}

// NEU: Tags aus Knotennamen parsen
function parseTags(nodeId) {
  const match = nodeId.match(/\[(.*?)\]$/); // Sucht nach [Tag1, Tag2] am Ende des Strings
  if (match && match[1]) {
    return match[1].split(',').map(tag => tag.trim());
  }
  return [];
}

// NEU: Cluster-Gruppierung für TreeView (Tag-basiert)
function applyTagClustering() {
  if (!window.lastSimulation) return;

  const simulation = window.lastSimulation;
  const nodes = simulation.nodes();
  const g = d3.select("svg").select("g");

  // 1. Knoten nach Tags gruppieren
  const tagClusters = new Map(); // Map: Tag -> [nodes]
  nodes.forEach(node => {
    const tags = node.data.tags;
    if (tags.length === 0) {
      // Knoten ohne Tags in "Ungegruppert" Cluster
      if (!tagClusters.has("Ungegruppert")) {
        tagClusters.set("Ungegruppert", []);
      }
      tagClusters.get("Ungegruppert").push(node);
    } else {
      tags.forEach(tag => {
        if (!tagClusters.has(tag)) {
          tagClusters.set(tag, []);
        }
        tagClusters.get(tag).push(node);
      });
    }
  });

  // 2. Visuelle Darstellung der Cluster (Hintergrundfarbe)
  // Entferne alte Cluster-Rechtecke
  g.selectAll(".cluster-rect").remove();
  g.selectAll(".cluster-label").remove(); // Auch Labels entfernen

  const clusterColors = d3.scaleOrdinal(d3.schemePaired); // Farbpalette für Cluster

  // Berechne Cluster-Zentren und Bounding Boxes
  const clusterData = [];
  tagClusters.forEach((clusterNodes, tag) => {
    if (clusterNodes.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let centerX = 0, centerY = 0;

    clusterNodes.forEach(node => {
      minX = Math.min(minX, node.x - node.r);
      minY = Math.min(minY, node.y - node.r);
      maxX = Math.max(maxX, node.x + node.r);
      maxY = Math.max(maxY, node.y + node.r);
      centerX += node.x;
      centerY += node.y;
    });

    centerX /= clusterNodes.length;
    centerY /= clusterNodes.length;

    const padding = 20;
    const rectX = minX - padding;
    const rectY = minY - padding;
    const rectWidth = maxX - minX + 2 * padding;
    const rectHeight = maxY - minY + 2 * padding;

    clusterData.push({
      tag: tag,
      nodes: clusterNodes,
      centerX: centerX,
      centerY: centerY,
      rect: { x: rectX, y: rectY, width: rectWidth, height: rectHeight }
    });
  });

  // Zeichne Cluster-Rechtecke und Labels
  clusterData.forEach(cluster => {
    g.insert("rect", ":first-child") // Füge Rechteck hinter den Knoten ein
      .attr("class", "cluster-rect")
      .attr("x", cluster.rect.x)
      .attr("y", cluster.rect.y)
      .attr("width", cluster.rect.width)
      .attr("height", cluster.rect.height)
      .attr("fill", clusterColors(cluster.tag))
      .attr("opacity", 0.2)
      .attr("rx", 10) // Abgerundete Ecken
      .attr("ry", 10);

    g.append("text")
      .attr("class", "cluster-label")
      .attr("x", cluster.rect.x + cluster.rect.width / 2)
      .attr("y", cluster.rect.y + 15) // Position über dem Rechteck
      .attr("text-anchor", "middle")
      .text(cluster.tag)
      .attr("fill", clusterColors(cluster.tag))
      .attr("font-weight", "bold");
  });

  // 3. Simulation anpassen, um Cluster zu berücksichtigen
  // Füge eine Kraft hinzu, die Knoten zu ihrem Cluster-Zentrum zieht
  simulation.force("cluster", forceCluster()
    .centers(clusterData.map(c => ({ x: c.centerX, y: c.centerY, tag: c.tag })))
    .strength(0.1) // Stärke der Anziehung zum Cluster-Zentrum
  );

  // Eine Kollisionskraft zwischen Clustern (optional, kann komplex werden)
  // Für den Anfang lassen wir die Standard-Kollisionskraft der Knoten.

  simulation.alpha(1).restart();
}

// Hilfsfunktion für die Cluster-Kraft
function forceCluster() {
  let nodes;
  let centers;
  let strength = 0.1;

  function force(alpha) {
    if (!centers) return;

    for (let i = 0, n = nodes.length; i < n; ++i) {
      const node = nodes[i];
      const nodeTags = node.data.tags;
      
      // Finde das passende Cluster-Zentrum für den Knoten
      let targetCenter = null;
      if (nodeTags.length === 0) {
        targetCenter = centers.find(c => c.tag === "Ungegruppert");
      } else {
        // Finde das erste passende Zentrum (oder den Durchschnitt, wenn mehrere Tags)
        for (let j = 0; j < nodeTags.length; ++j) {
          targetCenter = centers.find(c => c.tag === nodeTags[j]);
          if (targetCenter) break;
        }
      }

      if (targetCenter) {
        node.vx -= (node.x - targetCenter.x) * strength * alpha;
        node.vy -= (node.y - targetCenter.y) * strength * alpha;
      }
    }
  }

  force.initialize = function(_) {
    nodes = _;
  };

  force.centers = function(_) {
    return arguments.length ? (centers = _, force) : centers;
  };

  force.strength = function(_) {
    return arguments.length ? (strength = _, force) : strength;
  };

  return force;
}

// NEU: Dynamische Cluster-Adaptierung basierend auf Verbindungen
function dynamicClusterAdaptation(minConnections = 3) {
  if (!window.lastSimulation) return;

  const simulation = window.lastSimulation;
  const nodes = simulation.nodes();
  const links = simulation.links();
  const g = d3.select("svg").select("g");

  // 1. Verbindungen zählen
  const connectionCounts = new Map(); // Map: Knoten-ID -> Anzahl der Verbindungen
  nodes.forEach(node => connectionCounts.set(node.id, 0));
  links.forEach(link => {
    connectionCounts.set(link.source.id, connectionCounts.get(link.source.id) + 1);
    connectionCounts.set(link.target.id, connectionCounts.get(link.target.id) + 1);
  });

  // 2. Cluster basierend auf Verbindungsstärke bilden
  const dynamicClusters = new Map(); // Map: Cluster-ID -> [nodes]
  nodes.forEach(node => {
    const strength = connectionCounts.get(node.id);
    if (strength >= minConnections) {
      const clusterId = `dense-cluster-${node.id}`; // Eindeutige ID für dichte Cluster
      if (!dynamicClusters.has(clusterId)) {
        dynamicClusters.set(clusterId, []);
      }
      dynamicClusters.get(clusterId).push(node);
    } else {
      // Knoten, die nicht dicht genug sind, können in einen "lose" Cluster oder einzeln bleiben
      if (!dynamicClusters.has("loose-nodes")) {
        dynamicClusters.set("loose-nodes", []);
      }
      dynamicClusters.get("loose-nodes").push(node);
    }
  });

  // 3. Visuelle Darstellung der Cluster (Hintergrundfarbe)
  // Entferne alte Cluster-Rechtecke
  g.selectAll(".cluster-rect").remove();
  g.selectAll(".cluster-label").remove();

  const clusterColors = d3.scaleOrdinal(d3.schemeCategory20); // Neue Farbpalette

  const clusterData = [];
  dynamicClusters.forEach((clusterNodes, clusterId) => {
    if (clusterNodes.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let centerX = 0, centerY = 0;

    clusterNodes.forEach(node => {
      minX = Math.min(minX, node.x - node.r);
      minY = Math.min(minY, node.y - node.r);
      maxX = Math.max(maxX, node.x + node.r);
      maxY = Math.max(maxY, node.y + node.r);
      centerX += node.x;
      centerY += node.y;
    });

    centerX /= clusterNodes.length;
    centerY /= clusterNodes.length;

    const padding = 20;
    const rectX = minX - padding;
    const rectY = minY - padding;
    const rectWidth = maxX - minX + 2 * padding;
    const rectHeight = maxY - minY + 2 * padding;

    clusterData.push({
      id: clusterId,
      nodes: clusterNodes,
      centerX: centerX,
      centerY: centerY,
      rect: { x: rectX, y: rectY, width: rectWidth, height: rectHeight }
    });
  });

  // Zeichne Cluster-Rechtecke und Labels
  clusterData.forEach(cluster => {
    g.insert("rect", ":first-child")
      .attr("class", "cluster-rect")
      .attr("x", cluster.rect.x)
      .attr("y", cluster.rect.y)
      .attr("width", cluster.rect.width)
      .attr("height", cluster.rect.height)
      .attr("fill", clusterColors(cluster.id))
      .attr("opacity", 0.15)
      .attr("rx", 10)
      .attr("ry", 10);

    g.append("text")
      .attr("class", "cluster-label")
      .attr("x", cluster.rect.x + cluster.rect.width / 2)
      .attr("y", cluster.rect.y + 15)
      .attr("text-anchor", "middle")
      .text(cluster.id.replace('dense-cluster-', 'Cluster ')) // Schönere Beschriftung
      .attr("fill", clusterColors(cluster.id))
      .attr("font-weight", "bold");
  });

  // 4. Simulation anpassen, um Cluster zu berücksichtigen
  simulation.force("dynamicCluster", forceCluster()
    .centers(clusterData.map(c => ({ x: c.centerX, y: c.centerY, id: c.id })))
    .strength(0.05) // Leichtere Anziehung
  );

  simulation.alpha(1).restart();
}

// NEU: Cluster-Gruppierung für TreeView aufheben
function disableTagClustering() {
  const g = d3.select("svg").select("g");
  g.selectAll(".cluster-rect").remove();
  g.selectAll(".cluster-label").remove();
  
  // Simulation neu starten, um Knoten in ihren ursprünglichen Zustand zu versetzen
  if (window.lastSimulation) {
    window.lastSimulation.alpha(1).restart();
  }
}

// NEU: TreeView-Stil umschalten
function toggleTreeViewStyle(styleClass) {
  const svg = d3.select('svg');
  svg.classed('tree-view-default', false)
     .classed('tree-view-compact', false)
     .classed('tree-view-highlight', false)
     .classed(`tree-view-${styleClass}`, true);
  currentTreeViewStyle = styleClass; // Zustand speichern

  // Cluster-Gruppierung beeinflussen
  if (currentLayout === 'tree') {
    if (styleClass === 'highlight') {
      // Bei "Hervorheben" Cluster deaktivieren
      clusterEnabled = false;
      disableTagClustering();
      const clusterToggle = document.getElementById('cluster-toggle');
      if (clusterToggle) {
        clusterToggle.classList.remove('toggle-btn--active');
      }
    } else {
      // Bei "Standard" oder "Kompakt" Cluster-Status beibehalten
      // (falls zuvor aktiviert, bleibt es aktiv)
      if (clusterEnabled) {
        applyTagClustering();
      } else {
        disableTagClustering();
      }
    }
  }
  saveAllSettings(); // Einstellungen speichern
}

function initializeForceGraph(data) {
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
    console.warn('initializeForceGraph: kein gültiges Graph-Objekt', data);
    return;
  }
  const svg = d3.select("svg"),
    width = window.innerWidth,
    height = window.innerHeight;
  svg.selectAll("*").remove();
  svg.style('opacity', 0);  const g = svg.append("g");
  // === Hierarchie-Farben bestimmen ===
  // Map: Name → Hierarchieebene (group)
  let nodeGroups = {};
  if (currentHierarchy) {
    function walk(node, depth = 0) {
      nodeGroups[node.name] = depth;
      if (node.children) node.children.forEach(c => walk(c, depth + 1));
    }
    if (Array.isArray(currentHierarchy)) {
      currentHierarchy.forEach(n => walk(n, 0));
    } else {
      walk(currentHierarchy, 0);
    }
  }
  const nodes = data.nodes.map(d => Object.assign({}, d, { group: nodeGroups[d.id] ?? 0 }));
  const links = data.links.map(l => Object.assign({}, l));
  const colorScale = d3.scaleOrdinal(colorSchemes[currentScheme] || d3.schemeCategory10);
  // Knotengröße nach Settings
  nodes.forEach(d => d.r = graphSettings.nodeSize - (d.group || 0) * graphSettings.hierarchyScale * graphSettings.nodeSize + 5);
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(graphSettings.linkDistance))
    .force("charge", d3.forceManyBody().strength(-100))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(d => d.r + graphSettings.collision));
  const link = g.append("g")
    .attr("class", "links")
    .selectAll("line")
    .data(links)
    .enter().append("line")
    .attr("class", "link")
    .attr("stroke-width", d => d.value ? Math.max(1.5, d.value) : 1.5)
    .attr("stroke-opacity", d => d.value ? Math.min(1, 0.3 + d.value * 0.1) : 0.6);
  // === Relations-Beschriftung vorbereiten ===
  const linkLabels = g.append("g")
    .attr("class", "link-labels")
    .selectAll("text")
    .data(links)
    .enter().append("text")
    .attr("class", "link-label")
    .attr("text-anchor", "middle")
    .attr("dy", -4)
    .style("font-size", (graphSettings.nodeTextSize - 2) + "px") // NEU: Relations-Label skaliert mit
    .style("pointer-events", "none")
    .style("opacity", d => (window.showRelationLabels && d.type && d.type !== 'hierarchy') ? 1 : 0)
    .text(d => d.type && d.type !== 'hierarchy' ? d.type : '');
  const node = g.append("g")
    .attr("class", "nodes")
    .selectAll("g")
    .data(nodes)
    .enter().append("g")
    .attr("class", "node")
    .on("click", (event, d) => {
      event.stopPropagation();
      const infoBar = document.getElementById("info-bar");
      infoBar.innerHTML = `<span class=\"path\">${d.id}</span>`;
      // --- Highlight logic: highlight node, direct neighbors, and connecting links ---
      // Find all directly connected node ids
      const connectedNodeIds = new Set([d.id]);
      links.forEach(l => {
        if (l.source.id === d.id) connectedNodeIds.add(l.target.id);
        if (l.target.id === d.id) connectedNodeIds.add(l.source.id);
      });
      // Highlight nodes
      g.selectAll(".node").style("opacity", n => connectedNodeIds.has(n.id) ? 1 : 0.15);
      // Highlight links
      g.selectAll(".link").style("opacity", l => l.source.id === d.id || l.target.id === d.id ? 1 : 0.15);
      // Optionally: show text for highlighted nodes
      g.selectAll(".node text").style("opacity", n => connectedNodeIds.has(n.id) ? 1 : 0);
      // Relations-Beschriftung für alle Links, die von/zu diesem Node gehen, einblenden, aber nur wenn RelationLabels-Toggle aktiv
      if (window.showRelationLabels) {
        linkLabels.style("opacity", l => (l.source.id === d.id || l.target.id === d.id) && l.type && l.type !== 'hierarchy' ? 1 : 0);
      }
    })
    .on("mouseover", function(event, d) {
      d3.select(this).select("text").style("opacity", 1);
      if (window.showRelationLabels) {
        linkLabels.style("opacity", l => (l.source.id === d.id || l.target.id === d.id) && l.type && l.type !== 'hierarchy' ? 1 : 0);
      }
    })
    .on("mouseout", function(event, d) {
      const text = d3.select(this).select("text");
      if (!text.empty() && text.style("opacity") !== "1") {
        text.style("opacity", 0);
      }
      if (window.showRelationLabels) {
        linkLabels.style("opacity", 0);
      }
    })
    .call(d3.drag()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
    .on("end", (event, d) => {
      if (!event.active) simulation.alphaTarget(0); // Simulation abkühlen lassen
      // Manuelle Gruppierung logik hier einfügen (z.B. Knoten an Zielposition fixieren)
      // Beispiel: Wenn ein Knoten auf einen anderen Knoten gezogen wird, gruppiere sie
      const targetNode = findTargetNode(event.x, event.y, nodes, d); // Hilfsfunktion
      if (targetNode) {
        console.log(`Knoten ${d.id} wurde auf Knoten ${targetNode.id} gezogen.`);
        // Hier könnte die Logik für die manuelle Gruppierung stehen
        // z.B. d.group = targetNode.group; oder eine neue Relation erstellen
      }

      // Nur lösen, wenn Fixierung AUS ist
      if (!stickyNodesEnabled) {
        d.fx = null;
        d.fy = null;
        // Remove from fixedNodes array
        const index = fixedNodes.indexOf(d);
        if (index > -1) fixedNodes.splice(index, 1);
        console.log(`Node released: ${d.id}`);
      } else {
        // Add to fixedNodes array if not already present
        if (fixedNodes.indexOf(d) === -1) {
          fixedNodes.push(d);
        }
        console.log(`Node fixed: ${d.id}`);
      }
    })
    );
  node.append("circle")
    .attr("r", d => d.r)
    .attr("fill", d => colorScale(d.group));
  const MAX_LINE_LENGTH = 18;
  node.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", ".35em")
    .style("opacity", 0)
    .style("font-size", graphSettings.nodeTextSize + "px") // NEU
    .each(function(d) {
      if (typeof d.id !== 'string') return;
      const lines = wrapText(d.id, 18);
      lines.forEach((line, i) => {
        d3.select(this)
          .append("tspan")
          .attr("x", 0)
          .attr("dy", i === 0 ? 0 : "1.2em")
          .text(line);
      });
    });
  if (showAllTexts) {
    g.selectAll('.node text').style('opacity', 1);
  }
  // === Relations-Label Hover ===
  function enableRelationLabelHover() {
    const svg = d3.select('svg');
    const g = svg.select('g');
    if (!g.empty()) {
      const links = g.selectAll('line.link');
      const linkLabels = g.selectAll('text.link-label');
      links.on('mouseover', function(event, l) {
        if (window.showRelationLabels && l.type && l.type !== 'hierarchy') {
          linkLabels.style('opacity', ll => ll === l ? 1 : 0);
        }
      });
      links.on('mouseout', function(event, l) {
        if (window.showRelationLabels) {
          linkLabels.style('opacity', 1); // Restore all if toggle is ON
        }
      });
    }
  }
  svg.on("click", () => {
    g.selectAll(".node").style("opacity", 1);
    g.selectAll(".link").style("opacity", 1);
    g.selectAll(".node text").style("opacity", showAllTexts ? 1 : 0);
    g.selectAll(".link-label").style("opacity", d => (window.showRelationLabels && d.type && d.type !== 'hierarchy') ? 1 : 0);
    const infoBar = document.getElementById("info-bar");
    if (infoBar) infoBar.innerHTML = "";
  });
  enableRelationLabelHover();
  const zoom = d3.zoom()
    .scaleExtent([0.3, 4])
    .on("zoom", event => g.attr("transform", event.transform));
  svg.call(zoom);
  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);
    node.attr("transform", d => `translate(${d.x},${d.y})`);
    linkLabels
      .attr("x", d => (d.source.x + d.target.x) / 2)
      .attr("y", d => (d.source.y + d.target.y) / 2);
  });
  // Center only after simulation ends and bbox is valid
  simulation.on("end", () => {
    requestAnimationFrame(() => {
      centerGraphOrTree();
      svg.style('opacity', 1);
    });
  });
  window.addEventListener("resize", () => {
    const w = window.innerWidth, h = window.innerHeight;
    svg.attr("width", w).attr("height", h);
    simulation.force("center", d3.forceCenter(w / 2, h / 2));
    simulation.alpha(0.5).restart();
  });
  // Store simulation globally for centering
  window.lastSimulation = simulation;

  // Setup gemeinsame Suchleiste
  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");
  const resetBtn = document.getElementById("reset-btn");
  const searchResults = document.getElementById("search-results");
  const infoBar = document.getElementById("info-bar");
  
  function highlightMatch(text, query) {
    if (!query) return text;
    const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')})`, "gi");
    return text.replace(re, '<span class="search-highlight">$1</span>');
  }

  function showSearchResults(query) {
    const showResults = query && query.length > 0;
    searchResults.style.display = showResults ? "block" : "none";
    if (!query) {
      searchResults.innerHTML = "";
      infoBar.innerHTML = "";
      resetGraphSelection(g);
      return;
    }
    const matches = nodes.filter(n => (n.data?.name || n.id || "").toLowerCase().includes(query.toLowerCase()));
    if (matches.length === 0) {
      searchResults.innerHTML = `<div style="color:#d00;">Keine Treffer gefunden.</div>`;
      infoBar.innerHTML = `<span style="color:#d00;">Keine Treffer gefunden.</span>`;
      g.selectAll(".node").style("opacity", 0.15);
      g.selectAll(".link").style("opacity", 0.15);
      return;
    }
    searchResults.innerHTML = matches.map((n) => {
      let path = n.id;
      return `<div class="search-result" data-id="${n.id}">${highlightMatch(path, query)}</div>`;
    }).join("");
    const matchSet = new Set(matches.map(n => n.id));
    g.selectAll(".node").style("opacity", n => matchSet.has(n.id) ? 1 : 0.15);
    g.selectAll(".link").style("opacity", 0.15);
  }

  searchBtn.onclick = () => showSearchResults(searchInput.value);
  searchInput.oninput = () => showSearchResults(searchInput.value);
  resetBtn.onclick = () => {
    searchInput.value = "";
    searchResults.style.display = "none";
    infoBar.innerHTML = "";
    resetGraphSelection(g);
  };
  
  searchResults.onclick = (e) => {
    if (e.target.classList.contains("search-result")) {
      const id = e.target.getAttribute("data-id");
      const n = nodes.find(n => n.id === id);
      if (n) {
        g.selectAll(".node").filter(d => d.id === id).dispatch("click");
        searchResults.style.display = "none";
      }
    }
  };
}

// NEU: Alle Einstellungen im LocalStorage speichern
function saveAllSettings() {
  const settings = {
    treeViewStyle: currentTreeViewStyle,
    graphSettings: graphSettings,
    colorScheme: currentScheme,
    showAllTexts: showAllTexts,
    stickyNodesEnabled: stickyNodesEnabled,
    showRelationLabels: window.showRelationLabels || false // Sicherstellen, dass es definiert ist
  };
  localStorage.setItem('mindmapSettings', JSON.stringify(settings));
}

// NEU: Alle Einstellungen aus LocalStorage laden
function loadAllSettings() {
  const saved = localStorage.getItem('mindmapSettings');
  if (saved) {
    const settings = JSON.parse(saved);

    // TreeView-Stil
    currentTreeViewStyle = settings.treeViewStyle || 'default';
    // graphSettings
    Object.assign(graphSettings, settings.graphSettings || {});
    // Farbschema
    currentScheme = settings.colorScheme || 'category10';
    // showAllTexts
    showAllTexts = settings.showAllTexts || false;
    // stickyNodesEnabled
    stickyNodesEnabled = settings.stickyNodesEnabled || true;
    // showRelationLabels
    window.showRelationLabels = settings.showRelationLabels || false;

    // UI-Elemente aktualisieren
    loadSettingsToSliders(); // Slider-Werte setzen
    document.getElementById('darkmode-toggle').classList.toggle('toggle-btn--active', document.body.classList.contains('dark-mode'));
    document.getElementById('showall-toggle').classList.toggle('toggle-btn--active', showAllTexts);
    document.getElementById('sticky-nodes-toggle').classList.toggle('toggle-btn--active', stickyNodesEnabled);
    const relationsToggle = document.getElementById('relations-toggle');
    if (relationsToggle) {
      relationsToggle.classList.toggle('toggle-btn--active', window.showRelationLabels);
    }
    // Initialen TreeView-Stil anwenden
    toggleTreeViewStyle(currentTreeViewStyle);
  }
}

// === Hilfsfunktionen ===
function wrapText(text, maxLen) {
  if (typeof text !== 'string') return [];
  const words = text.split(' ');
  let lines = [];
  let current = '';
  for (let word of words) {
    if ((current + ' ' + word).trim().length > maxLen) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current += ' ' + word;
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

function centerGraphOrTree(retry = 0) {
  const svg = d3.select('svg');
  svg.attr('width', window.innerWidth)
     .attr('height', window.innerHeight)
     .style('width', window.innerWidth + 'px')
     .style('height', window.innerHeight + 'px');
  const g = svg.select('g');
  if (!g.empty()) {
    const bbox = g.node().getBBox();
    const isEditorOpen = document.body.classList.contains('editor-open');
    const width = window.innerWidth;
    const height = window.innerHeight;
    if ((bbox.width < 10 || bbox.height < 10) && retry < 10) {
      setTimeout(() => centerGraphOrTree(retry + 1), 50);
      return;
    }
    svg.call(d3.zoom().transform, d3.zoomIdentity);
    let graphCenterX = bbox.width > 0 ? bbox.x + bbox.width / 2 : 0;
    let graphCenterY = bbox.height > 0 ? bbox.y + bbox.height / 2 : 0;
    if (isEditorOpen) {
      // Begrenzung: Graph muss komplett in rechter Hälfte (50vw bis 100vw) sichtbar sein
      const rightHalfStart = width / 2;
      const rightHalfEnd = width;
      // Ziel: Graph möglichst mittig in rechter Hälfte, aber nicht hinausragen
      let offsetX = rightHalfStart + (rightHalfEnd - rightHalfStart) / 2 - graphCenterX;
      // Linksbegrenzung: bbox.x >= rightHalfStart
      if (bbox.x + offsetX < rightHalfStart) {
        offsetX = rightHalfStart - bbox.x;
      }
      // Rechtsbegrenzung: bbox.x + bbox.width <= rightHalfEnd
      if (bbox.x + bbox.width + offsetX > rightHalfEnd) {
        offsetX = rightHalfEnd - (bbox.x + bbox.width);
      }
      svg.transition().duration(0)
        .call(
          d3.zoom().transform,
          d3.zoomIdentity
            .translate(offsetX, height / 2 - graphCenterY)
        );
    } else {
      svg.transition().duration(0)
        .call(
          d3.zoom().transform,
          d3.zoomIdentity
            .translate(width / 2, height / 2)
            .translate(-graphCenterX, -graphCenterY)
        );
    }
    svg.style('opacity', 1);
  }
}

function loadCurrentData() {
  const saved = localStorage.getItem('mindmapData');
  const savedMd = localStorage.getItem('mindmapMarkdown');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      // Prüfe, ob Markdown im Storage ist (besser für Hierarchie)
      if (savedMd && typeof savedMd === 'string' && savedMd.trim().length > 0) {
        lastMarkdown = savedMd;
        const parsed = parseMarkdownToGraph(savedMd);
        currentGraph = parsed;
        currentHierarchy = parseMarkdownToHierarchy(savedMd);
        loadDataAndRender(currentGraph, currentHierarchy);
        setTimeout(() => {
          centerGraphOrTree();
          d3.select('svg').style('opacity', 1);
        }, 100);
      } else {
        // Nur Graph vorhanden: Hierarchie aus 'leitet'-Kanten rekonstruieren
        loadDataAndRender(data, buildHierarchyFromLinks(data));
        setTimeout(() => {
          centerGraphOrTree();
          d3.select('svg').style('opacity', 1);
        }, 100);
      }
    } catch (e) {
      // Fehler beim Parsen ignorieren
    }
  }
}

function buildHierarchyFromLinks(graph, rootId = null) {
  // Sucht alle 'leitet'-Kanten und baut daraus eine Hierarchie
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.links)) return null;
  // 1. Knoten-Map
  const nodeMap = new Map();
  graph.nodes.forEach(n => nodeMap.set(n.id, { name: n.id, children: [] }));
  // 2. Eltern-Kind-Beziehungen
  const childToParent = new Map();
  graph.links.forEach(l => {
    if (l.type === 'leitet' && nodeMap.has(l.source) && nodeMap.has(l.target)) {
      nodeMap.get(l.source).children.push(nodeMap.get(l.target));
      childToParent.set(l.target, l.source);
    }
  });
  // 3. Wurzel finden (Knoten ohne Eltern)
  let roots = graph.nodes.map(n => n.id).filter(id => !childToParent.has(id));
  if (rootId && nodeMap.has(rootId)) {
    return nodeMap.get(rootId);
  }
  if (roots.length === 1) {
    return nodeMap.get(roots[0]);
  } else if (roots.length > 1) {
    // Mehrere Wurzeln: künstliche Wurzel
    return { name: 'root', children: roots.map(r => nodeMap.get(r)) };
  }
  // Fallback: kein Tree möglich
  return null;
}

function loadDataAndRender(data, hierarchy) {
  // data: Graph-Objekt (nodes, links) oder Hierarchie
  // hierarchy: Hierarchie-Objekt (optional)
  if (data && data.nodes && data.links) {
    currentGraph = data;
    if (hierarchy) {
      currentHierarchy = hierarchy;
    } else {
      // Try to reconstruct hierarchy from Markdown if possible
      if (lastMarkdown) {
        currentHierarchy = parseMarkdownToHierarchy(lastMarkdown);
      } else {
        // --- NEU: Versuche Hierarchie aus 'leitet'-Kanten zu bauen ---
        currentHierarchy = buildHierarchyFromLinks(currentGraph);
      }
    }
  } else if (data && data.name && data.children) {
    // Only hierarchy present
    currentHierarchy = data;
    currentGraph = hierarchyToGraph(data);
  } else {
    // Fallback: try to parse as hierarchy if possible
    currentHierarchy = null;
    currentGraph = data;
  }
  // Save to Local Storage (nur Graph, aber auch Markdown, falls vorhanden)
  localStorage.setItem('mindmapData', JSON.stringify(currentGraph));
  if (lastMarkdown && lastMarkdown.trim().length > 0) {
    localStorage.setItem('mindmapMarkdown', lastMarkdown);
  } else {
    localStorage.removeItem('mindmapMarkdown');
  }
  // Always render with the correct structure
  if (currentLayout === 'graph') {
    initializeForceGraph(currentGraph);
  } else {
    initializeTree(currentHierarchy);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // === DOM References ===
  markdownEditor = document.getElementById('markdown-editor');
  paletteToggle = document.getElementById('palette-toggle');
  paletteMenu = document.getElementById('palette-menu');
  exportToggle = document.getElementById('export-toggle');
  exportBar = document.getElementById('export-bar');
  darkToggle = document.getElementById('darkmode-toggle');
  body = document.body;
  const editToggle = document.getElementById('edit-toggle'); // Bleibt lokal
  editorContainer = document.getElementById('editor-container');
  const closeEditor = document.getElementById('close-editor'); // Bleibt lokal
  const fullscreenToggle = document.getElementById('fullscreen-toggle'); // Bleibt lokal
  showAllToggle = document.getElementById('showall-toggle');
  const graphmodeToggle = document.getElementById('graphmode-toggle'); // Bleibt lokal
  const importToggle = document.getElementById('import-toggle'); // Bleibt lokal
  const importFile = document.getElementById('import-file'); // Bleibt lokal
  const clearToggle = document.getElementById('clear-toggle'); // Bleibt lokal
  stickyNodesToggle = document.getElementById('sticky-nodes-toggle');
  searchToggle = document.getElementById('search-toggle');
  searchBar = document.getElementById('search-bar');
  searchResults = document.getElementById('search-results');
  viewStyleToggle = document.getElementById('view-style-toggle'); // Global
  viewStyleMenu = document.getElementById('view-style-menu'); // Global
  clusterToggle = document.getElementById('cluster-toggle'); // Global
  relationsToggle = document.getElementById('relations-toggle'); // Global
  settingsToggle = document.getElementById('settings-toggle'); // Global
  infoToggle = document.getElementById('info-toggle'); // Global
  infoMenu = document.getElementById('info-menu'); // Global

  // --- Export-Button ---
  exportToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    exportBar.classList.toggle('is-hidden');
    exportToggle.classList.toggle('toggle-btn--active', !exportBar.classList.contains('is-hidden'));
    paletteMenu.classList.add('is-hidden');
    paletteToggle.classList.remove('toggle-btn--active');
  });
  // --- Import-Button ---
  importToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    importFile.value = '';
    importFile.click();
  });
  importFile.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      setTimeout(() => {
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'json') {
          try {
            const json = JSON.parse(evt.target.result);
            if (json && Array.isArray(json.nodes) && Array.isArray(json.links)) {
              currentGraph = json;
              currentHierarchy = null;
              lastMarkdown = '';
              markdownEditor.value = '';
              loadDataAndRender(currentGraph, currentHierarchy);
              setTimeout(() => {
                centerGraphOrTree();
                d3.select('svg').style('opacity', 1);
              }, 0);
              return;
            } else {
              alert('Ungültiges JSON-Format: Erwartet wird ein Objekt mit nodes[] und links[].');
              return;
            }
          } catch (err) {
            alert('Fehler beim Parsen der JSON-Datei: ' + err.message);
            return;
          }
        } else if (ext === 'md') {
          const md = evt.target.result;
          lastMarkdown = md;
          markdownEditor.value = md;
          const parsed = parseMarkdownToGraph(md);
          currentGraph = parsed;
          currentHierarchy = parseMarkdownToHierarchy(md);
          loadDataAndRender(currentGraph, currentHierarchy);
          setTimeout(() => {
            centerGraphOrTree();
            d3.select('svg').style('opacity', 1);
          }, 0);
          return;
        } else {
          alert('Nur .md oder .json Dateien werden unterstützt.');
          return;
        }
      }, 100);
    };
    reader.readAsText(file);
  });
  // --- Edit-Button (Editor anzeigen/verstecken) ---
  editToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = editorContainer.classList.toggle('is-hidden') === false;
    editToggle.classList.toggle('toggle-btn--active', isOpen);
    paletteMenu.classList.add('is-hidden');
    paletteToggle.classList.remove('toggle-btn--active');
    exportBar.classList.add('is-hidden');
    exportToggle.classList.remove('toggle-btn--active');
    if (isOpen) {
      if (currentGraph && currentGraph.nodes && currentGraph.links) {
        markdownEditor.value = toMd(currentGraph.nodes, currentGraph.links);
      } else if (currentHierarchy) {
        function toAd(node, indent = 0) {
          let out = " ".repeat(indent) + "- " + node.name + "\n";
          if (node.children) {
            for (const c of node.children) out += toAd(c, indent + 4);
          }
          return out;
        }
        markdownEditor.value = toAd(currentHierarchy);
      } else {
        markdownEditor.value = '';
      }
      document.querySelector('svg').style.position = 'fixed';
      document.querySelector('svg').style.left = '50vw';
      document.querySelector('svg').style.width = '50vw';
      document.querySelector('svg').style.height = '100vh';
      markdownEditor.focus();
    } else {
      document.querySelector('svg').style.position = '';
      document.querySelector('svg').style.left = '';
      document.querySelector('svg').style.width = '';
      document.querySelector('svg').style.height = '';
    }
  });
  closeEditor.addEventListener('click', (e) => {
    e.stopPropagation();
    editorContainer.classList.add('is-hidden');
    editToggle.classList.remove('toggle-btn--active');
    document.querySelector('svg').style.position = '';
    document.querySelector('svg').style.left = '';
    document.querySelector('svg').style.width = '';
    document.querySelector('svg').style.height = '';
  });
  // --- Clear-Button ---
  clearToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    d3.select('svg').selectAll('*').remove();
    document.getElementById('info-bar').innerHTML = '';
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').innerHTML = '';
    currentData = null;
    currentGraph = null;
    currentHierarchy = null;
    localStorage.removeItem('mindmapData');
  });
  // --- Graphmode-Button (Layout wechseln) ---
  graphmodeToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    currentLayout = (currentLayout === 'tree') ? 'graph' : 'tree';
    resetClusterState(); // NEU: Cluster-Modus zurücksetzen bei Layout-Wechsel

    const clusterToggle = document.getElementById('cluster-toggle'); // NEU: Referenz zum Cluster-Button

    if (currentLayout === 'graph') {
      if (currentGraph) {
        initializeForceGraph(currentGraph);
        setTimeout(centerGraphOrTree, 400);
      }
      // NEU: Cluster-Button im GraphView aktivieren
      if (clusterToggle) {
        clusterToggle.disabled = false;
        clusterToggle.classList.remove('toggle-btn--disabled');
      }
    } else { // currentLayout === 'tree'
      if (currentHierarchy) {
        initializeTree(currentHierarchy);
        setTimeout(centerGraphOrTree, 400);
      }
      // NEU: Cluster-Button im TreeView deaktivieren
      if (clusterToggle) {
        clusterToggle.disabled = true;
        clusterToggle.classList.add('toggle-btn--disabled');
      }
    }
  });
  // --- Fullscreen-Button ---
  fullscreenToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setTimeout(centerGraphOrTree, 200);
  });
  // --- ShowAll-Button (Texte ein-/ausblenden) ---
  showAllToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    showAllTexts = !showAllTexts;
    showAllToggle.classList.toggle('toggle-btn--active', showAllTexts);
    const svg = d3.select('svg');
    const g = svg.select('g'); // Dynamically select current group element
    svg.selectAll('.node text').style('opacity', showAllTexts ? 1 : 0);
    // Nach showAllTexts ggf. auch:
    g.selectAll('.link-label').style('font-size', (graphSettings.nodeTextSize - 2) + 'px'); // NEU
  });
  // --- Palette-Button ---
  paletteToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    paletteMenu.classList.toggle('is-hidden');
    paletteToggle.classList.toggle('toggle-btn--active', !paletteMenu.classList.contains('is-hidden'));
    exportBar.classList.add('is-hidden');
    exportToggle.classList.remove('toggle-btn--active');
  });
  // --- Palette-Buttons: Farbschema wechseln ---
  document.querySelectorAll('.palette-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      currentScheme = btn.getAttribute('data-scheme');
      paletteMenu.classList.add('is-hidden');
      paletteToggle.classList.remove('toggle-btn--active');
      if (currentGraph && currentLayout === 'graph') {
        initializeForceGraph(currentGraph);
      } else if (currentHierarchy && currentLayout === 'tree') {
        initializeTree(currentHierarchy);
      } else if (currentGraph && currentLayout === 'tree') {
        initializeTree(currentGraph);
      }
      // --- Ensure graph is visible and centered after color change ---
      setTimeout(() => {
        centerGraphOrTree();
        d3.select('svg').style('opacity', 1);
      }, 100);
    });
  });
  // --- Darkmode-Button ---
  darkToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    body.classList.toggle('dark-mode');
    document.documentElement.classList.toggle('dark-mode');
    darkToggle.classList.toggle('toggle-btn--active', body.classList.contains('dark-mode'));
  });
  // --- Relations-Toggle (optional, falls vorhanden) ---
  const relationsToggle = document.getElementById('relations-toggle');
  if (relationsToggle) {
    relationsToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      window.showRelationLabels = !window.showRelationLabels;
      relationsToggle.classList.toggle('toggle-btn--active', window.showRelationLabels);
      const svg = d3.select('svg');
      if (window.showRelationLabels) {
        svg.selectAll('.link-label').style('opacity', 1);
      } else {
        svg.selectAll('.link-label').style('opacity', 0);
      }
    });
    // Ensure initial state is consistent
    if (window.showRelationLabels) {
      relationsToggle.classList.add('toggle-btn--active');
    } else {
      relationsToggle.classList.remove('toggle-btn--active');
    }
  }

  // --- Sticky-Nodes-Toggle (Fixierung der Knoten nach dem Ziehen) ---
  stickyNodesToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const wasEnabled = stickyNodesEnabled;
    stickyNodesEnabled = !stickyNodesEnabled;
    stickyNodesToggle.classList.toggle('toggle-btn--active', stickyNodesEnabled);
    console.log(`Sticky nodes mode: ${stickyNodesEnabled ? 'ON' : 'OFF'}`);

    // If toggling from ON to OFF, release all fixed nodes
    if (wasEnabled && !stickyNodesEnabled) {
      fixedNodes.forEach(node => {
        node.fx = null;
        node.fy = null;
      });
      fixedNodes = []; // Clear the array
      console.log(`All fixed nodes released`);
      
      // Restart simulation to allow nodes to move
      if (window.lastSimulation) {
        window.lastSimulation.alpha(0.3).restart();
      }
    }
  });

  // --- Cluster-Toggle (Gruppierung der Knoten) ---
  const clusterToggle = document.getElementById('cluster-toggle');
  clusterToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    
    if (currentLayout === 'graph') {
      clusterEnabled = !clusterEnabled;
      clusterToggle.classList.toggle('toggle-btn--active', clusterEnabled);

      if (clusterEnabled) {
        // Speichere Originalpositionen der Knoten
        window.lastSimulation.nodes().forEach(node => {
          originalNodePositions.set(node.id, {x: node.x, y: node.y});
        });
        // Speichere die aktuellen Graphen-Daten
        originalGraphNodes = currentGraph.nodes.map(n => ({...n}));
        originalGraphLinks = currentGraph.links.map(l => ({...l}));

        applyHierarchicalLayoutForGraphView();
      } else {
        resetGraphLayout();
        // Lade die ursprünglichen Graphen-Daten und rendere neu
        if (originalGraphNodes && originalGraphLinks) {
          loadDataAndRender({nodes: originalGraphNodes, links: originalGraphLinks}, currentHierarchy);
        }
      }
    } else { // currentLayout === 'tree'
      // Im Tree-View: Cluster-Funktion (Tag-basiert)
      clusterEnabled = !clusterEnabled; // Zustand des Buttons ändern
      clusterToggle.classList.toggle('toggle-btn--active', clusterEnabled);

      if (clusterEnabled) {
        applyTagClustering();
      } else {
        disableTagClustering();
      }
    }
  });
  // --- Search-Button ---
  searchToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const hidden = searchBar.classList.toggle("is-hidden");
    searchToggle.classList.toggle("toggle-btn--active", !hidden);
    searchToggle.classList.toggle("is-hidden", !hidden);
    searchToggle.classList.toggle("is-hidden", !hidden);
  });


  // --- Klick außerhalb schließt Menüs ---
  document.addEventListener('click', (e) => {
    if (!paletteMenu.contains(e.target) && e.target !== paletteToggle) {
      paletteMenu.classList.add('is-hidden');
      paletteToggle.classList.remove('toggle-btn--active');
    }
    if (!exportBar.contains(e.target) && e.target !== exportToggle) {
      exportBar.classList.add('is-hidden');
      exportToggle.classList.remove('toggle-btn--active');
    }
    if (!editorContainer.contains(e.target) && e.target !== editToggle) {
      editorContainer.classList.add('is-hidden');
      editToggle.classList.remove('toggle-btn--active');
      document.querySelector('svg').style.position = '';
      document.querySelector('svg').style.left = '';
      document.querySelector('svg').style.width = '';
      document.querySelector('svg').style.height = '';
    }
    if (!infoMenu.contains(e.target) && e.target !== infoToggle) {
      infoMenu.classList.add("is-hidden");
    }
    if (!searchBar.contains(e.target) && e.target !== searchToggle) {
      searchBar.classList.add("is-hidden");
      searchToggle.classList.remove("toggle-btn--active");
      searchToggle.classList.remove("is-hidden");
      if (searchResults) searchResults.style.display = "none";
      searchToggle.classList.remove("is-hidden");
    }
    // NEU: View Style Toggle
    if (!viewStyleMenu.contains(e.target) && e.target !== viewStyleToggle) {
      viewStyleMenu.classList.add('is-hidden');
      viewStyleToggle.classList.remove('toggle-btn--active');
    }
    // NEU: Cluster-Toggle (nur für den Fall, dass der Button nicht existiert)
    if (clusterToggle && !clusterToggle.contains(e.target)) {
      // Wenn der Cluster-Modus aktiv ist und außerhalb geklickt wird,
      // soll er nicht deaktiviert werden, es sei denn, es ist ein Klick auf den Button selbst.
      // Die Deaktivierung erfolgt nur durch erneutes Klicken des Buttons.
    }
  });
  // --- Export-Funktionen ---
  document.getElementById('export-json').addEventListener('click', () => {
    if (!currentGraph) return;
    const blob = new Blob([JSON.stringify(currentGraph, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mindmap.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  });
  document.getElementById('export-md').addEventListener('click', () => {
    if (!currentGraph) return;
    const md = toMd(currentGraph.nodes, currentGraph.links);
    const blob = new Blob([md], {type: 'text/markdown'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mindmap.md';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  });
  // --- Initiales Laden ---
  loadCurrentData();
  // --- Live Markdown Editor: Live-Update Graph/Tree on Edit ---
  let liveEditTimeout = null;
  markdownEditor.addEventListener('input', function() {
    if (liveEditTimeout) clearTimeout(liveEditTimeout);
    liveEditTimeout = setTimeout(() => {
      const md = markdownEditor.value;
      lastMarkdown = md;
      // Parse Markdown to Data
      const parsed = parseMarkdownToGraph(md);
      currentGraph = parsed;
      currentHierarchy = parseMarkdownToHierarchy(md);
      // Render
      loadDataAndRender(currentGraph, currentHierarchy);
      // Center and fade-in
      setTimeout(() => {
        centerGraphOrTree();
        d3.select('svg').style('opacity', 1);
      }, 0);
    }, 200); // debounce: 200ms
  });
  const editor = document.getElementById('markdown-editor');
  if (editor) {
    // Undo/Redo Stack für Editor
    let undoStack = [];
    let redoStack = [];
    let lastValue = editor.value;
    let lastSelection = { start: editor.selectionStart, end: editor.selectionEnd };
    function pushUndo() {
      undoStack.push({
        value: editor.value,
        selectionStart: editor.selectionStart,
        selectionEnd: editor.selectionEnd
      });
      // Stack begrenzen
      if (undoStack.length > 100) undoStack.shift();
      redoStack = [];
    }
    // Bei jeder echten Änderung merken
    editor.addEventListener('input', function() {
      if (editor.value !== lastValue) {
        pushUndo();
        lastValue = editor.value;
        lastSelection = { start: editor.selectionStart, end: editor.selectionEnd };
      }
    });
    // Auch nach ENTER/TAB/SHIFT+TAB (synthetische Änderungen)
    function pushUndoIfNeeded() {
      if (editor.value !== lastValue) {
        pushUndo();
        lastValue = editor.value;
        lastSelection = { start: editor.selectionStart, end: editor.selectionEnd };
      }
    }
    editor.addEventListener('keydown', function(e) {
      // Undo/Redo
      const isMac = navigator.platform.toUpperCase().indexOf('MAC')>=0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;
      if (ctrlKey && !e.altKey && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          // Redo
          if (redoStack.length > 0) {
            const state = redoStack.pop();
            undoStack.push({ value: editor.value, selectionStart: editor.selectionStart, selectionEnd: editor.selectionEnd });
            editor.value = state.value;
            editor.selectionStart = state.selectionStart;
            editor.selectionEnd = state.selectionEnd;
            lastValue = editor.value;
            lastSelection = { start: editor.selectionStart, end: editor.selectionEnd };
            e.preventDefault();
            return;
          }
        } else {
          // Undo
          if (undoStack.length > 0) {
            const state = undoStack.pop();
            redoStack.push({ value: editor.value, selectionStart: editor.selectionStart, end: editor.selectionEnd });
            editor.value = state.value;
            editor.selectionStart = state.selectionStart;
            editor.selectionEnd = state.selectionEnd;
            lastValue = editor.value;
            lastSelection = { start: editor.selectionStart, end: editor.selectionEnd };
            e.preventDefault();
            return;
          }
        }
      }
      // ENTER: Automatischer Bulletpoint mit gleicher Einrückung
      if (e.key === 'Enter') {
        const val = editor.value;
        const selStart = editor.selectionStart;
        const before = val.slice(0, selStart);
        const after = val.slice(editor.selectionEnd);
        // Finde die aktuelle Zeile
        const lines = before.split('\n');
        const prevLine = lines[lines.length-1] || '';
        const match = prevLine.match(/^([\t]*)(- |\* |\+ |• )$/);
        let indent = match ? match[1] : '';
        let bullet = match && match[2] ? match[2] : '- ';
        // Wenn Zeile leer, dann nur Einrückung und Bullet
        const insert = '\n' + indent + bullet;
        editor.value = before + insert + after;
        // Cursor nach Bullet setzen
        const newPos = before.length + insert.length;
        editor.selectionStart = editor.selectionEnd = newPos;
        e.preventDefault();
        return;
      }
      // Multi-Line-Indent (TAB/SHIFT+TAB)
      if (e.key === 'Tab') {
        const val = editor.value;
        const selStart = editor.selectionStart;
        const selEnd = editor.selectionEnd;
        // Finde Zeilenanfang und -ende
        const before = val.slice(0, selStart);
        const after = val.slice(selEnd);
        const lineStart = before.lastIndexOf('\n')+1;
        const lineEnd = val.indexOf('\n', selEnd) === -1 ? val.length : val.indexOf('\n', selEnd);
        // Multi-Line: Bereich umfasst mehrere Zeilen?
        if (selStart !== selEnd && val.slice(selStart, selEnd).includes('\n')) {
          // Alle betroffenen Zeilen holen
          const selected = val.slice(lineStart, lineEnd);
          const lines = val.slice(selStart, selEnd).split('\n');
          if (!e.shiftKey) {
            // TAB: Jede Zeile einrücken
            const newLines = lines.map(line => '\t' + line);
            const newText = newLines.join('\n');
            editor.value = val.slice(0, selStart) + newText + val.slice(selEnd);
            editor.selectionStart = selStart;
            editor.selectionEnd = selStart + newText.length;
            e.preventDefault();
            return;
          } else {
            // SHIFT+TAB: Jede Zeile ausrücken (Tab am Anfang entfernen)
            const newLines = lines.map(line => line.startsWith('\t') ? line.slice(1) : line);
            const newText = newLines.join('\n');
            editor.value = val.slice(0, selStart) + newText + val.slice(selEnd);
            editor.selectionStart = selStart;
            editor.selectionEnd = selStart + newText.length;
            e.preventDefault();
            return;
          }
        } else {
          // Einzelzeile: wie bisher
          const line = val.slice(lineStart, selEnd);
          // Prüfe, ob Zeile nur aus Einrückung + Bullet besteht
          const match = line.match(/^([\t]*)(- |\* |\+ |• )$/);
          if (!e.shiftKey && match) {
            // Eine Tab voranstellen
            const newLine = '\t' + line;
            editor.value = val.slice(0, lineStart) + newLine + val.slice(selEnd);
            // Cursorposition anpassen
            const delta = 1; // ein Tab
            editor.selectionStart = editor.selectionEnd = selEnd + delta;
            e.preventDefault();
            return;
          } else if (e.shiftKey) {
            // SHIFT+TAB: Tab am Zeilenanfang entfernen
            if (line.startsWith('\t')) {
              const newLine = line.slice(1);
              editor.value = val.slice(0, lineStart) + newLine + val.slice(selEnd);
              editor.selectionStart = editor.selectionEnd = selEnd - 1;
              e.preventDefault();
              return;
            }
          }
        }
        // Sonst: Standardverhalten (z.B. Tab im Text)
      }
      // Nach synthetischer Änderung Undo-Stack pushen
      setTimeout(pushUndoIfNeeded, 0);
    });
  }

  // --- Settings-Button & Menü ---
  const settingsMenu = document.getElementById('settings-menu');
  const closeSettings = document.getElementById('close-settings');
  // Slider-Referenzen
  const sliderLinkDistance = document.getElementById('slider-linkdistance');
  const sliderNodeSize = document.getElementById('slider-nodesize');
  const sliderHierarchyScale = document.getElementById('slider-hierarchyscale');
  const sliderAnimDuration = document.getElementById('slider-animduration');
  const sliderCollision = document.getElementById('slider-collision');
  const sliderNodeTextSize = document.getElementById('slider-nodetextsize'); // NEU
  // Value-Labels
  const valLinkDistance = document.getElementById('val-linkdistance');
  const valNodeSize = document.getElementById('val-nodesize');
  const valHierarchyScale = document.getElementById('val-hierarchyscale');
  const valAnimDuration = document.getElementById('val-animduration');
  const valCollision = document.getElementById('val-collision');
  const labelNodeTextSize = document.getElementById('label-nodetextsize'); // NEU

  // Menü toggeln
  settingsToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsMenu.classList.toggle('is-hidden');
    // Andere Menüs schließen
    paletteMenu.classList.add('is-hidden');
    paletteToggle.classList.remove('toggle-btn--active');
    exportBar.classList.add('is-hidden');
    exportToggle.classList.remove('toggle-btn--active');
    viewStyleMenu.classList.add('is-hidden');
    viewStyleToggle.classList.remove('toggle-btn--active');
    infoMenu.classList.add('is-hidden');
    searchBar.classList.add('is-hidden');
    searchToggle.classList.remove('toggle-btn--active');
  });
  closeSettings.addEventListener('click', (e) => {
    settingsMenu.classList.add('is-hidden');
  });
  // Schließen bei Klick außerhalb
  document.addEventListener('mousedown', (e) => {
    if (!settingsMenu.classList.contains('is-hidden') && !settingsMenu.contains(e.target) && e.target !== settingsToggle) {
      settingsMenu.classList.add("is-hidden");
    }
  });
  // Werte synchronisieren (Slider → Label)
  function updateSliderLabels() {
    valLinkDistance.textContent = sliderLinkDistance.value;
    valNodeSize.textContent = sliderNodeSize.value;
    valHierarchyScale.textContent = sliderHierarchyScale.value;
    valAnimDuration.textContent = sliderAnimDuration.value;
    valCollision.textContent = sliderCollision.value;
    labelNodeTextSize.textContent = sliderNodeTextSize.value; // NEU
  }
  sliderLinkDistance.addEventListener('input', updateSliderLabels);
  sliderNodeSize.addEventListener('input', updateSliderLabels);
  sliderHierarchyScale.addEventListener('input', updateSliderLabels);
  sliderAnimDuration.addEventListener('input', updateSliderLabels);
  sliderCollision.addEventListener('input', updateSliderLabels);
  sliderNodeTextSize.addEventListener('input', updateSliderLabels); // NEU
  updateSliderLabels();
  // Settings-Menu: Slider-Events (Live-Update)
  function onSettingsChange() {
    applySettingsFromSliders(); // Speichert auch in LocalStorage
    updateSliderLabels();
    updateSimulationSettings(); // Aktualisiert die Simulation ohne Neuladen
  }
  sliderLinkDistance.addEventListener('input', onSettingsChange);
  sliderNodeSize.addEventListener('input', onSettingsChange);
  sliderHierarchyScale.addEventListener('input', onSettingsChange);
  sliderAnimDuration.addEventListener('input', onSettingsChange);
  sliderCollision.addEventListener('input', onSettingsChange);
  sliderNodeTextSize.addEventListener('input', onSettingsChange); // NEU
  // Settings aus localStorage laden (nur UI)
  loadSettingsToSliders();
  updateSliderLabels();

  // --- Info-Button & Info-Menü ---
  const infoToggle = document.getElementById('info-toggle');
  const infoMenu = document.getElementById('info-menu');
  const closeInfoMenu = document.getElementById('close-info-menu');
  const infoMenuList = document.getElementById('info-menu-list');
  const infoMenuMdContent = document.getElementById('info-menu-md-content');
  const infoMenuBack = document.getElementById('info-menu-back');
  const infoMenuTitle = document.getElementById('info-menu-title');

  // Themenübersicht (Dateiname → Titel)
  const infoTopics = [
    { file: 'Funktionsübersicht.md', title: 'Funktionsübersicht' },
    { file: 'Importformate.md', title: 'Importformate (Markdown & JSON)' },
    { file: 'Markdown-Editor.md', title: 'Markdown-Editor' },
    { file: 'Suche-Navigation.md', title: 'Suche & Navigation' },
    { file: 'Darstellung-Animation.md', title: 'Darstellung & Animation' }
  ];

  function showInfoMenuList() {
    infoMenuList.innerHTML = '';
    infoMenuMdContent.classList.add('is-hidden');
    infoMenuList.style.display = 'flex';
    infoMenuTitle.textContent = 'Hilfe & Informationen';
    infoTopics.forEach(topic => {
      const btn = document.createElement('button');
      btn.className = 'info-menu-topic-btn';
      btn.textContent = topic.title;
      btn.onclick = () => openInfoTopicInNewTab(topic);
      infoMenuList.appendChild(btn);
    });
  }

  // --- New: Open help topic in new tab as rendered HTML ---
  async function openInfoTopicInNewTab(topic) {
    let md = '';
    let error = null;
    try {
      const resp = await fetch('memory-bank/' + topic.file);
      if (!resp.ok) throw new Error('Datei nicht gefunden');
      md = await resp.text();
      md = md.replace(/^<!--.*?-->/s, '').trim();
    } catch (e) {
      error = e;
    }
    // Detect dark mode from app or system
    const isDark = document.body.classList.contains('dark-mode') || window.matchMedia('(prefers-color-scheme: dark)').matches;
    // Render Markdown to HTML (headlines, bold, etc.)
    let html = '';
    if (error) {
      html = `<div style='color:#d00;font-size:1.2em;'>Fehler: ${error.message || 'Datei konnte nicht geladen werden.'}</div>`;
    } else {
      html = window.marked ? window.marked.parse(md) : md.replace(/\n/g, '<br>');
    }
    // Add back-to-app link
    const backLink = `<div style='margin:2em 0 0 0;'><a href='#' onclick='window.close();return false;' style='font-size:1.1em;color:#0074d9;text-decoration:underline;'>Zurück zur App</a></div>`;
    // Compose a minimal HTML page with dark mode support
    const docHtml = `<!DOCTYPE html>\n<html lang='de'><head><meta charset='utf-8'><title>${topic.title}</title><meta name='color-scheme' content='dark light'><style>
      body{font-family:sans-serif;background:${isDark ? '#181a1b' : '#fff'};color:${isDark ? '#f1f1f1' : '#222'};padding:2em;max-width:700px;margin:auto;transition:background 0.3s,color 0.3s;}
      h1,h2,h3{color:#0074d9;}
      pre,code{background:${isDark ? '#23272b' : '#f7f7fa'};padding:2px 6px;border-radius:4px;}
      a{color:#0074d9;}
      @media (prefers-color-scheme: dark) {
        body{background:#181a1b;color:#f1f1f1;}
        pre,code{background:#23272b;}
      }
    </style></head><body>${html}${backLink}</body></html>`;
    // Open in new tab
    const win = window.open();
    if (win) {
      win.document.open();
      win.document.write(docHtml);
      win.document.close();
    } else {
      alert('Pop-up Blocker verhindert das Öffnen des Hilfethemas.');
    }
  }

  infoToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    infoMenu.classList.toggle('is-hidden');
    if (!infoMenu.classList.contains('is-hidden')) {
      showInfoMenuList();
    }
  });
  closeInfoMenu.addEventListener('click', () => infoMenu.classList.add('is-hidden'));
  infoMenuBack.addEventListener('click', showInfoMenuList);
  // Schließen bei Klick außerhalb
  document.addEventListener('mousedown', (e) => {
    if (!infoMenu.classList.contains('is-hidden') && !infoMenu.contains(e.target) && e.target !== infoToggle) {
      infoMenu.classList.add("is-hidden");
    }
  });

  // --- Benutzerdefinierte Cluster-Regeln (Live-Update) ---
  const minConnectionsInput = document.getElementById('min-connections');
  // Entferne den applyClusterRulesBtn, da Änderungen live angewendet werden sollen
  const applyClusterRulesBtn = document.getElementById('apply-cluster-rules');
  if (applyClusterRulesBtn) applyClusterRulesBtn.remove();

  minConnectionsInput.addEventListener('input', () => {
    const minConnections = +minConnectionsInput.value;
    if (currentLayout === 'tree') {
      // Im Tree-View: Tag-basierte Gruppierung mit dynamischer Adaptierung
      applyTagClustering(minConnections); // Hier könnte man minConnections an applyTagClustering übergeben
    } else {
      // Im Graph-View: Dynamische Cluster-Adaptierung
      dynamicClusterAdaptation(minConnections);
    }
  });

  // --- Cluster-Modus Auswahl ---
  const clusterModeSelect = document.getElementById('cluster-mode-select');
  clusterModeSelect.addEventListener('change', () => {
    const selectedMode = clusterModeSelect.value;
    clusterEnabled = false; // Zuerst alle Cluster deaktivieren

    if (selectedMode === 'tag-based') {
      clusterEnabled = true;
      applyTagClustering();
    } else if (selectedMode === 'connection-based') {
      clusterEnabled = true;
      dynamicClusterAdaptation(+minConnectionsInput.value);
    } else { // 'none'
      disableTagClustering(); // Deaktiviert auch dynamische Cluster
    }
    saveAllSettings(); // Speichere den neuen Cluster-Modus
  });
});

// === Gemeinsame Suchleiste für Tree & Graph ===
function setupSearchBar(g, nodes, links, getNodePath, highlightNode, highlightNone, infoBarCb) {
  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");
  const resetBtn = document.getElementById("reset-btn");
  const searchResults = document.getElementById("search-results");
  const infoBar = document.getElementById("info-bar");

  function highlightMatch(text, query) {
    if (!query) return text;
    const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')})`, "gi");
    return text.replace(re, '<span class="search-highlight">$1</span>');
  }

  function showSearchResults(query) {
    const showResults = query && query.length > 0;
    searchResults.style.display = showResults ? "block" : "none";
    if (!query) {
      searchResults.innerHTML = "";
      infoBar.innerHTML = "";
      highlightNone();
      return;
    }
    const matches = nodes.filter(n => (n.data?.name || n.id || "").toLowerCase().includes(query.toLowerCase()));
    if (matches.length === 0) {
      searchResults.innerHTML = `<div style="color:#d00;">Keine Treffer gefunden.</div>`;
      infoBar.innerHTML = `<span style="color:#d00;">Keine Treffer gefunden.</span>`;
      highlightNode([]);
      return;
    }
    searchResults.innerHTML = matches.map((n) => {
      let path = getNodePath(n);
      return `<div class="search-result" data-index="${n.index ?? n.id}">${highlightMatch(path, query)}</div>`;
    }).join("");
    highlightNode(matches);
  }
  searchBtn.onclick = () => showSearchResults(searchInput.value);
  searchInput.oninput = () => showSearchResults(searchInput.value);
  resetBtn.onclick = () => {
    searchInput.value = "";
    searchResults.style.display = "none";
    infoBar.innerHTML = "";
    highlightNone();
  };
  searchResults.onclick = (e) => {
    if (e.target.classList.contains("search-result")) {
      const idx = e.target.getAttribute("data-index");
      const n = nodes.find(n => (n.index?.toString() === idx || n.id?.toString() === idx));
      if (n) {
        if (typeof highlightNode === 'function') highlightNode([n], true);
        if (typeof infoBarCb === 'function') infoBarCb(n);
        searchResults.style.display = "none";
      }
    }
  };
}

// Setzt alle Hervorhebungen und Labels im Graph/Tree zurück
function resetGraphSelection(g) {
  g.selectAll(".node").style("opacity", 1);
  g.selectAll(".link").style("opacity", 1);
  g.selectAll(".node text").style("opacity", showAllTexts ? 1 : 0);
  // Falls vorhanden: Relations-Labels zurücksetzen
  if (g.selectAll(".link-label").size() > 0) {
    g.selectAll(".link-label").style("opacity", d => (window.showRelationLabels && d.type && d.type !== 'hierarchy') ? 1 : 0);
  }
  const infoBar = document.getElementById("info-bar");
  if (infoBar) infoBar.innerHTML = "";
}

// NEU: Hilfsfunktion zum Finden des Zielknotens beim Drag & Drop
function findTargetNode(x, y, nodes, draggedNode) {
  // Iteriere über alle Knoten außer dem gezogenen Knoten selbst
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node === draggedNode) continue;

    // Berechne den Abstand zwischen dem Mauszeiger und dem Mittelpunkt des Knotens
    const dx = x - node.x;
    const dy = y - node.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Wenn der Mauszeiger innerhalb des Radius des Knotens ist, ist dies der Zielknoten
    // Berücksichtige auch einen kleinen Puffer um den Knoten
    const buffer = 10;
    if (distance < node.r + buffer) {
      return node;
    }
  }
  return null; // Kein Zielknoten gefunden
}
