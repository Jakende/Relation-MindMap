// === Module-Scope Variablen ===
let currentData = null;
let currentLayout = 'tree';
let currentScheme = 'category10';
let lastMarkdown = '';
let showAllTexts = false;
let currentGraph = null;      // Graph-Objekt für Graph-View
let currentHierarchy = null;  // Hierarchie-Objekt für Tree-View

const colorSchemes = {
  category10: d3.schemeCategory10,
  accent: d3.schemeAccent,
  dark2: d3.schemeDark2,
  set2: d3.schemeSet2,
  greys: d3.schemeGreys[9],
  bw: ["#fff", "#000"],
  'cb-friendly': ["#0072B2", "#E69F00", "#009E73", "#F0E442", "#56B4E9", "#D55E00", "#CC79A7", "#999999"]
};

// === Exporte / Hilfsfunktionen ===
function toMd(nodes, links) {
  return nodes.map(n => {
    let out = `- ${n.id}\n`;
    links
      .filter(l => String(l.source) === n.id)
      .forEach(l => {
        const tgt = typeof l.target === 'string' ? l.target : l.target.id;
        out += `    -> [rel:${l.type}] ${tgt}\n`;
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
    const m = line.match(/^([ \t]*)[-*]\s+(.+)$/);
    if (m) bulletNames.push(m[2].trim());
  });
  // Map für robusten Vergleich
  const nameSet = new Set(bulletNames.map(normalizeName));
  console.log('parseMarkdownToGraph bulletNames:', bulletNames);
  console.log('parseMarkdownToGraph nameSet:', Array.from(nameSet));

  // 2. Relationen parsen
  const nodes = [];
  const links = [];
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
    let m = line.match(/^([ \t]*)[-*]\s+(.+)$/);
    if (m) {
      const indent = m[1].length;
      const text = m[2].trim();
      addNode(text, Math.floor(indent/4));
      while (stack.length && stack[stack.length-1].indent >= indent) stack.pop();
      stack.push({ id: text, indent });
      lastNode = text;
      lastNodeIndent = indent;
      continue;
    }
    // Relations-Zeile (akzeptiert [TYPE] oder [rel:TYPE])
    m = line.match(/^([ \t]*)->\s*(?:\[\s*(?:rel:)?([^\]]+)\])?\s*(.+)$/);
    if (m) {
      const indent = m[1].length;
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
      console.log('Relation line:', line, '| source:', source, '| target:', text, '| relType:', relType, '| sourceKey:', sourceKey, '| targetKey:', targetKey, '| in nameSet:', nameSet.has(sourceKey), nameSet.has(targetKey));
      if (nameSet.has(sourceKey) && nameSet.has(targetKey)) {
        addNode(source);
        addNode(text);
        links.push({ source, target: text, type: relType });
      }
      continue;
    }
    // Sonst ignorieren
  }
  console.log('parseMarkdownToGraph result nodes:', nodes, 'links:', links);
  // Wenn keine Relationen gefunden wurden, gib die Hierarchie zurück
  if (links.length === 0) {
    return parseMarkdownToHierarchy(markdown);
  }
  return { nodes, links };
}

function parseMarkdownToHierarchy(mdText) {
  const lines = mdText.split('\n')
    .map(line => {
      // Require a bullet (- or *) at the start of the line to be a node
      const m = line.match(/^(\s*)[-*]\s+(.+)$/);
      return m ? { indent: m[1].length, text: m[2].trim() } : null;
    })
    .filter(item => item && item.text);
  console.log('parseMarkdownToHierarchy lines:', lines);
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
  console.log('hierarchyToGraph nodes:', nodes, 'links:', links);
  return { nodes, links };
}

function initializeTree(data) {
  const svg = d3.select("svg"),
    width = window.innerWidth,
    height = window.innerHeight;
  svg.selectAll("*").remove();
  const g = svg.append("g");
  const root = d3.hierarchy(data);
  const nodes = root.descendants();
  const links = root.links();
  nodes.forEach(d => d.r = Math.max(5, 20 - d.depth * 3 + 5));

  function getColor(d) {
    const scheme = colorSchemes[currentScheme] || d3.schemeCategory10;
    if (currentScheme === "greys") {
      return scheme[Math.min(d.depth * 2, scheme.length - 1)];
    }
    return scheme[d.depth % scheme.length];
  }
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.index).distance(120).strength(1))
    .force("charge", d3.forceManyBody().strength(-220))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(d => d.r + 5));
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
    searchResults.style.display = showResults ? "block" : "none";
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
        .transition().duration(300).attr("r", d.r * 1.5)
        .transition().duration(300).attr("r", d.r);
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
      d3.select(this).select("text").style("opacity", 1);
    })
    .on("mouseout", function(event, d) {
      const text = d3.select(this).select("text");
      if (!text.empty() && text.style("opacity") !== "1") {
        text.style("opacity", 0);
      }
    })
    .call(d3.drag()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x; d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      })
    );
  node.append("circle")
    .attr("r", d => d.r)
    .attr("fill", d => getColor(d));
  const MAX_LINE_LENGTH = 18;
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
  node.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", ".35em")
    .style("opacity", 0)
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
    g.selectAll("text").style("opacity", 0);
    infoBar.innerHTML = "";
  });
  const zoom = d3.zoom()
    .scaleExtent([0.3, 4])
    .on("zoom", event => {
      g.attr("transform", event.transform);
      if (!showAllTexts) {
        g.selectAll("text").style("opacity", 0);
      }
    });
  svg.call(zoom)
    .call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2));
  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);
    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });
  window.addEventListener("resize", () => {
    const w = window.innerWidth, h = window.innerHeight;
    svg.attr("width", w).attr("height", h);
    simulation.force("center", d3.forceCenter(w / 2, h / 2));
    simulation.alpha(0.5).restart();
  });
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
  const g = svg.append("g");
  const nodes = data.nodes.map(d => Object.assign({}, d));
  const links = data.links.map(l => Object.assign({}, l));
  const colorScale = d3.scaleOrdinal(colorSchemes[currentScheme] || d3.schemeCategory10);
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(d => 50 + ((d.value || 1) * 20)))
    .force("charge", d3.forceManyBody().strength(-100))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(22));
  const link = g.append("g")
    .attr("class", "links")
    .selectAll("line")
    .data(links)
    .enter().append("line")
    .attr("class", d => "link type-" + (d.type || "default"))
    .attr("stroke-width", d => d.value ? Math.max(1.5, d.value) : 1.5)
    .attr("stroke-opacity", d => d.value ? Math.min(1, 0.3 + d.value * 0.1) : 0.6);
  const node = g.append("g")
    .attr("class", "nodes")
    .selectAll("g")
    .data(nodes)
    .enter().append("g")
    .attr("class", "node")
    .call(d3.drag()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x; d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      })
    );
  node.append("circle")
    .attr("r", 18)
    .attr("fill", d => colorScale(d.group));
  node.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", ".35em")
    .style("opacity", 0)
    .text(d => d.id);
  if (showAllTexts) {
    g.selectAll('.node text').style('opacity', 1);
  }
  const zoom = d3.zoom()
    .scaleExtent([0.3, 4])
    .on("zoom", event => g.attr("transform", event.transform));
  svg.call(zoom)
    .call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2));
  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);
    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });
  window.addEventListener("resize", () => {
    const w = window.innerWidth, h = window.innerHeight;
    svg.attr("width", w).attr("height", h);
    simulation.force("center", d3.forceCenter(w / 2, h / 2));
    simulation.alpha(0.5).restart();
  });
}

function loadCurrentData() {
  const saved = localStorage.getItem('mindmapData');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      loadDataAndRender(data);
    } catch (e) {
      // Fehler beim Parsen ignorieren
    }
  }
}

function loadDataAndRender(data, hierarchy) {
  // data: Graph-Objekt (nodes, links) oder Hierarchie
  // hierarchy: Hierarchie-Objekt (optional)
  if (data.nodes && data.links) {
    currentGraph = data;
    if (hierarchy) {
      currentHierarchy = hierarchy;
    } else {
      // Versuche Hierarchie aus Markdown zu rekonstruieren, falls möglich
      currentHierarchy = null;
    }
  } else {
    // Nur Hierarchie vorhanden
    currentHierarchy = data;
    currentGraph = hierarchyToGraph(data);
  }
  // Speichern im Local Storage (nur Graph, damit reload funktioniert)
  localStorage.setItem('mindmapData', JSON.stringify(currentGraph));
  // Automatisch Layout wählen
  if (currentLayout === 'graph') {
    initializeForceGraph(currentGraph);
  } else {
    initializeTree(currentHierarchy || currentGraph);
  }
}

// —— Alle DOM-References und Event-Listener sind nun hier ——
window.addEventListener('DOMContentLoaded', () => {
  // === DOM References ===
  const markdownEditor = document.getElementById('markdown-editor');
  const paletteToggle = document.getElementById('palette-toggle');
  const paletteMenu = document.getElementById('palette-menu');
  const exportToggle = document.getElementById('export-toggle');
  const exportBar = document.getElementById('export-bar');
  const darkToggle = document.getElementById('darkmode-toggle');
  const body = document.body;
  const editToggle = document.getElementById('edit-toggle');
  const editorContainer = document.getElementById('editor-container');
  const closeEditor = document.getElementById('close-editor');
  const fullscreenToggle = document.getElementById('fullscreen-toggle');
  const showAllToggle = document.getElementById('showall-toggle');
  const graphmodeToggle = document.getElementById('graphmode-toggle');

  document.getElementById('import-toggle').addEventListener('click', () => {
    document.getElementById('import-file').value = '';
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      let data, hierarchy;
      if (file.name.endsWith('.md')) {
        lastMarkdown = evt.target.result;
        data = parseMarkdownToGraph(lastMarkdown);
        if (data.nodes && data.links) {
          // Relationen vorhanden
          hierarchy = parseMarkdownToHierarchy(lastMarkdown);
          console.log('parseMarkdownToGraph:', data);
          console.log('parseMarkdownToHierarchy:', hierarchy);
        } else {
          // Nur Hierarchie
          hierarchy = data;
          data = hierarchyToGraph(hierarchy);
          console.log('hierarchyToGraph:', data);
        }
      } else {
        lastMarkdown = '';
        data = JSON.parse(evt.target.result);
        hierarchy = null;
      }
      loadDataAndRender(data, hierarchy);
    };
    reader.readAsText(file);
  });
  document.getElementById('clear-toggle').addEventListener('click', () => {
    d3.select('svg').selectAll('*').remove();
    document.getElementById('info-bar').innerHTML = '';
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').innerHTML = '';
    currentData = null;
    localStorage.removeItem('mindmapData');
  });
  paletteToggle.addEventListener('click', () => {
    paletteMenu.style.display = paletteMenu.style.display === 'flex' ? 'none' : 'flex';
    exportBar.style.display = 'none';
  });
  exportToggle.addEventListener('click', () => {
    exportBar.style.display = exportBar.style.display === 'flex' ? 'none' : 'flex';
    paletteMenu.style.display = 'none';
  });
  document.addEventListener('click', (e) => {
    if (!paletteMenu.contains(e.target) && e.target !== paletteToggle) {
      paletteMenu.style.display = 'none';
    }
    if (!exportBar.contains(e.target) && e.target !== exportToggle) {
      exportBar.style.display = 'none';
    }
  });
  darkToggle.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
    document.documentElement.classList.toggle('dark-mode');
  });
  document.querySelectorAll('.palette-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      currentScheme = btn.getAttribute('data-scheme');
      document.getElementById('palette-menu').style.display = 'none';
      if (currentData) {
        if (currentLayout === 'graph' && currentData.nodes && currentData.links) {
          initializeForceGraph(currentData);
        } else {
          initializeTree(currentData);
        }
      }
    });
  });
  editToggle.addEventListener('click', () => {
    editorContainer.style.display = editorContainer.style.display === 'block' ? 'none' : 'block';
    if (editorContainer.style.display === 'block') {
      if (currentHierarchy) {
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
  closeEditor.addEventListener('click', () => {
    editorContainer.style.display = 'none';
    document.querySelector('svg').style.position = '';
    document.querySelector('svg').style.left = '';
    document.querySelector('svg').style.width = '';
    document.querySelector('svg').style.height = '';
  });
  markdownEditor.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = this.selectionStart;
      const end = this.selectionEnd;
      this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
      this.selectionStart = this.selectionEnd = start + 4;
      this.dispatchEvent(new Event('input'));
    } else if (e.key === 'Enter') {
      const start = this.selectionStart;
      const before = this.value.substring(0, start);
      const after = this.value.substring(this.selectionEnd);
      const lastLine = before.split(/\r?\n/).pop();
      const match = lastLine.match(/^(\s*-\s*)/);
      if (match) {
        e.preventDefault();
        const indent = match[1];
        const insert = '\n' + indent;
        this.value = before + insert + after;
        this.selectionStart = this.selectionEnd = start + insert.length;
        this.dispatchEvent(new Event('input'));
      }
    } else if ((e.key === 'Backspace' || e.key === 'Delete') && e.altKey) {
      const start = this.selectionStart;
      const before = this.value.substring(0, start);
      const after = this.value.substring(this.selectionEnd);
      const lastNewline = before.lastIndexOf('\n');
      const lineStart = lastNewline + 1;
      const line = before.substring(lineStart, start);
      const match = line.match(/^(\s{1,})/);
      if (match && match[1].length >= 4) {
        e.preventDefault();
        const newLine = line.replace(/^ {4}/, '');
        this.value = before.substring(0, lineStart) + newLine + before.substring(lineStart + line.length) + after;
        const newPos = start - 4;
        this.selectionStart = this.selectionEnd = newPos > lineStart ? newPos : lineStart;
        this.dispatchEvent(new Event('input'));
      }
    }
  });
  markdownEditor.addEventListener('input', function() {
    const md = markdownEditor.value;
    lastMarkdown = md;
    if (md.trim()) {
      try {
        // Immer Hierarchie und Graph aktualisieren
        const hierarchy = parseMarkdownToHierarchy(md);
        const graph = parseMarkdownToGraph(md);
        currentHierarchy = hierarchy;
        currentGraph = graph.nodes && graph.links ? graph : hierarchyToGraph(hierarchy);
        loadDataAndRender(currentGraph, currentHierarchy);
      } catch (err) {}
    } else {
      d3.select('svg').selectAll('*').remove();
      document.getElementById('info-bar').innerHTML = '';
      currentData = null;
      localStorage.removeItem('mindmapData');
    }
  });
  showAllToggle.addEventListener('click', () => {
    showAllTexts = !showAllTexts;
    d3.selectAll('.node text').style('opacity', showAllTexts ? 1 : 0);
  });
  fullscreenToggle.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  });
  graphmodeToggle.addEventListener('click', () => {
    if (!currentGraph && !currentHierarchy) return;
    currentLayout = (currentLayout === 'graph') ? 'tree' : 'graph';
    if (currentLayout === 'graph') {
      initializeForceGraph(currentGraph);
    } else {
      initializeTree(currentHierarchy || currentGraph);
    }
  });

  // Initialisieren
  loadCurrentData();
});
