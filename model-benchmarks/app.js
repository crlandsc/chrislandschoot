(function () {
  "use strict";

  const DATA_URL = "data/live-cost-vs-score-latest.json";
  const FONT = '"Brandon Grotesque", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const BOARD_ORDER = [
    "aa_intelligence_v4_3_2",
    "cursorbench_4_0",
    "aa_coding_agent_v1_5",
    "terminal_bench_4_0",
    "scicode",
  ];
  const BOARD_SHORT_TITLES = {
    cursorbench_4_0: "CursorBench 4.0",
    aa_intelligence_v4_3_2: "Intelligence",
    aa_coding_agent_v1_5: "Coding Agent",
    terminal_bench_4_0: "Terminal-Bench",
    scicode: "SciCode",
  };
  const Y_AXIS_LABELS = {
    score_pct: "Score (%)",
    intelligence_index: "Intelligence Index",
    coding_agent_index: "Coding Agent Index",
  };
  const EFFORT_LABELS = {
    low: "Low",
    medium: "Medium",
    high: "High",
    extra: "Extra",
    xhigh: "Extra",
    max: "Max",
  };

  // Chip groups, left to right. Models not listed in MODEL_PROVIDERS fall back to `match` on the label.
  const PROVIDERS = [
    { id: "anthropic", label: "Anthropic", match: /claude|opus|sonnet|haiku|fable/i },
    { id: "openai", label: "OpenAI", match: /gpt|codex|\bo\d/i },
    { id: "google", label: "Google", match: /gemini|gemma/i },
    { id: "spacexai", label: "SpaceXAI", match: /grok/i },
  ];
  const OTHER_PROVIDER = { id: "other", label: "Other" };
  const MODEL_PROVIDERS = {
    sonnet55: "anthropic",
    opus55: "anthropic",
    fable: "anthropic",
    opus48: "anthropic",
    astra: "openai",
    sol6: "openai",
    luna: "openai",
    sol: "openai",
    grok47: "spacexai",
    grok46: "spacexai",
  };
  // Newest first within each provider. Models missing from this list sort to the front of their group.
  const MODEL_RECENCY = [
    "sonnet55",
    "opus55",
    "fable",
    "opus48",
    "astra",
    "sol6",
    "luna",
    "sol",
    "grok47",
    "grok46",
  ];

  const FALLBACK_COLORS = [
    "#4A90E2",
    "#D55E00",
    "#009E73",
    "#E69F00",
    "#CC79A7",
    "#0072B2",
    "#56B4E9",
    "#882255",
    "#44AA99",
    "#AA3377",
    "#332288",
  ];
  const MATPLOTLIB_TO_PLOTLY = {
    o: "circle",
    s: "square",
    "^": "triangle-up",
    D: "diamond",
    P: "cross",
    X: "x",
    v: "triangle-down",
    "*": "star",
    h: "hexagon",
    p: "pentagon",
  };

  const els = {
    asOf: document.getElementById("as-of"),
    sourceSep: document.getElementById("source-sep"),
    sourceLink: document.getElementById("source-link"),
    status: document.getElementById("status"),
    tabs: document.getElementById("board-tabs"),
    modelList: document.getElementById("model-list"),
    modelCount: document.getElementById("model-count"),
    boardTitle: document.getElementById("board-title"),
    chartCard: document.getElementById("chart-card"),
    chart: document.getElementById("chart"),
    themeToggle: document.getElementById("theme-toggle"),
    allBtn: document.getElementById("models-all"),
    noneBtn: document.getElementById("models-none"),
    scaleButtons: document.querySelectorAll(".segmented [data-scale]"),
    resetBtn: document.getElementById("reset-view"),
    downloadBtn: document.getElementById("download"),
  };

  const state = {
    payload: null,
    boardId: null,
    selected: new Set(),
    xScale: "linear",
    hoverModel: null,
    pinnedModel: null,
    fadeTimer: 0,
    plotEventsBound: false,
    pointer: null,
  };

  function setStatus(message, isError) {
    els.status.textContent = message || "";
    els.status.classList.toggle("error", Boolean(isError));
  }

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function applyTheme(theme) {
    const html = document.documentElement;
    if (theme === "dark") {
      html.setAttribute("data-theme", "dark");
      els.themeToggle.setAttribute("aria-label", "Switch to light mode");
    } else {
      html.removeAttribute("data-theme");
      els.themeToggle.setAttribute("aria-label", "Switch to dark mode");
    }
    if (state.payload && state.boardId) drawChart();
  }

  function initTheme() {
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)");
    applyTheme(systemPrefersDark.matches ? "dark" : "light");
    els.themeToggle.addEventListener("click", function () {
      applyTheme(currentTheme() === "dark" ? "light" : "dark");
    });
    systemPrefersDark.addEventListener("change", function (event) {
      applyTheme(event.matches ? "dark" : "light");
    });
  }

  function humanizeField(field) {
    return Y_AXIS_LABELS[field] || String(field || "Score").replace(/_/g, " ");
  }

  function formatUsd(value) {
    if (!Number.isFinite(value)) return "n/a";
    const abs = Math.abs(value);
    if (abs === 0) return "$0";
    if (abs >= 1) return "$" + value.toFixed(2);
    if (abs >= 0.01) return "$" + value.toFixed(3);
    if (abs >= 0.001) return "$" + value.toFixed(4);
    return "$" + value.toPrecision(3);
  }

  function formatScore(value, yField) {
    if (!Number.isFinite(value)) return "n/a";
    const text = value.toFixed(Math.abs(value) >= 10 ? 1 : 2);
    return yField === "score_pct" ? text + "%" : text;
  }

  function effortLabel(value) {
    if (!value) return "n/a";
    return EFFORT_LABELS[String(value).toLowerCase()] || String(value);
  }

  function boardIds(payload) {
    const boards = payload && payload.boards ? payload.boards : {};
    const known = BOARD_ORDER.filter(function (id) {
      return Object.prototype.hasOwnProperty.call(boards, id);
    });
    const extras = Object.keys(boards).filter(function (id) {
      return known.indexOf(id) === -1;
    });
    return known.concat(extras);
  }

  function getBoard(id) {
    return state.payload && state.payload.boards ? state.payload.boards[id] : null;
  }

  function styleMaps() {
    const style = (state.payload && state.payload.style) || {};
    return {
      colors: style.colors || {},
      markers: style.markers || {},
      labels: style.labels || {},
    };
  }

  function modelEntries(board) {
    if (!board || !board.models) return [];
    const models = board.models;
    if (Array.isArray(models)) {
      return models
        .map(function (item, index) {
          if (typeof item === "string") {
            const nested = board[item];
            if (nested && typeof nested === "object") return { id: item, series: nested };
            return { id: item, series: { label: item, points: [] } };
          }
          if (item && typeof item === "object") {
            return { id: item.id || item.key || "model-" + index, series: item };
          }
          return null;
        })
        .filter(Boolean);
    }
    return Object.keys(models).map(function (id) {
      return { id: id, series: models[id] || {} };
    });
  }

  function validPoints(series, xField, yField) {
    return (series.points || [])
      .filter(function (point) {
        if (!point || typeof point !== "object") return false;
        return Number.isFinite(point[xField]) && Number.isFinite(point[yField]);
      })
      .slice()
      .sort(function (a, b) {
        return a[xField] - b[xField];
      });
  }

  function colorFor(id, index) {
    return styleMaps().colors[id] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  }

  function markerFor(id) {
    return MATPLOTLIB_TO_PLOTLY[styleMaps().markers[id]] || "circle";
  }

  function labelFor(id, series) {
    return (series && series.label) || styleMaps().labels[id] || id;
  }

  function providerFor(id, label) {
    const known = MODEL_PROVIDERS[id];
    const provider = PROVIDERS.find(function (p) {
      return known ? p.id === known : p.match.test(label);
    });
    return provider || OTHER_PROVIDER;
  }

  function recencyRank(id) {
    const index = MODEL_RECENCY.indexOf(id);
    return index === -1 ? -1 : index;
  }

  function groupedEntries(board) {
    const entries = modelEntries(board).map(function (entry, index) {
      const label = labelFor(entry.id, entry.series);
      return {
        id: entry.id,
        series: entry.series,
        label: label,
        color: colorFor(entry.id, index),
        provider: providerFor(entry.id, label),
        order: index,
      };
    });
    const groups = PROVIDERS.concat([OTHER_PROVIDER]).map(function (provider) {
      return {
        provider: provider,
        entries: entries
          .filter(function (entry) {
            return entry.provider.id === provider.id;
          })
          .sort(function (a, b) {
            return recencyRank(a.id) - recencyRank(b.id) || a.order - b.order;
          }),
      };
    });
    return groups.filter(function (group) {
      return group.entries.length > 0;
    });
  }

  function shortTitle(boardId, board) {
    return BOARD_SHORT_TITLES[boardId] || (board && board.title) || boardId;
  }

  function boardAxes(board) {
    return {
      x: (board && board.x) || "cost_per_task_usd",
      y: board && board.y,
    };
  }

  function hashBoardId() {
    return (window.location.hash || "").replace(/^#/, "") || null;
  }

  function setHash(boardId) {
    if (hashBoardId() === boardId) return;
    const url = new URL(window.location.href);
    url.hash = boardId;
    history.replaceState(null, "", url);
  }

  function sourceHref(board) {
    const raw = board && board.source;
    if (!raw || typeof raw !== "string") return "";
    if (raw.indexOf("{") !== -1) {
      return raw.indexOf("artificialanalysis.ai") !== -1 ? "https://artificialanalysis.ai/" : "";
    }
    return raw;
  }

  function formatAsOf(payload) {
    const raw = (payload && (payload.as_of_et || payload.as_of)) || "";
    if (!raw) return "";
    return "Updated " + String(raw).replace(" ~", ", ").replace("~", " ");
  }

  function updateSource(board) {
    const href = sourceHref(board);
    els.sourceLink.hidden = !href;
    els.sourceSep.hidden = !href;
    if (!href) {
      els.sourceLink.removeAttribute("href");
      return;
    }
    els.sourceLink.href = href;
    els.sourceLink.target = "_blank";
    els.sourceLink.rel = "noopener noreferrer";
  }

  function updateChrome(board) {
    els.boardTitle.textContent = (board && board.title) || shortTitle(state.boardId, board);
    document.title = shortTitle(state.boardId, board) + " · Cost vs score";
    updateSource(board);
  }

  function updateCount() {
    const total = modelEntries(getBoard(state.boardId)).length;
    const selected = state.selected.size;
    els.modelCount.textContent = selected === total ? String(total) : selected + " of " + total;
  }

  function updateScaleButtons() {
    Array.prototype.forEach.call(els.scaleButtons, function (button) {
      button.setAttribute("aria-pressed", button.dataset.scale === state.xScale ? "true" : "false");
    });
  }

  function renderTabs() {
    const ids = boardIds(state.payload);
    els.tabs.replaceChildren();
    ids.forEach(function (id) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "tab");
      button.id = "tab-" + id;
      button.dataset.boardId = id;
      button.setAttribute("aria-selected", id === state.boardId ? "true" : "false");
      button.setAttribute("aria-controls", "chart");
      button.tabIndex = id === state.boardId ? 0 : -1;
      button.textContent = shortTitle(id, getBoard(id));
      button.addEventListener("click", function () {
        selectBoard(id);
      });
      button.addEventListener("keydown", function (event) {
        const buttons = Array.prototype.slice.call(els.tabs.querySelectorAll('[role="tab"]'));
        const index = buttons.indexOf(button);
        let next = null;
        if (event.key === "ArrowRight") next = buttons[(index + 1) % buttons.length];
        if (event.key === "ArrowLeft") next = buttons[(index - 1 + buttons.length) % buttons.length];
        if (event.key === "Home") next = buttons[0];
        if (event.key === "End") next = buttons[buttons.length - 1];
        if (!next || next === button) return;
        event.preventDefault();
        next.focus();
        selectBoard(next.dataset.boardId);
      });
      els.tabs.appendChild(button);
    });
  }

  function activeModelId() {
    return state.hoverModel || state.pinnedModel || null;
  }

  function setHoverModel(id) {
    if (state.hoverModel === id) return;
    state.hoverModel = id;
    applyEmphasis();
  }

  function setPinnedModel(id) {
    state.pinnedModel = id || null;
    applyEmphasis();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function hoverText(entry, point, axes, colors) {
    const muted = 'style="color:' + colors.muted + '"';
    const rows = [
      "<b>" + escapeHtml(entry.label) + "</b>",
      "<span " + muted + ">Effort</span>  " + escapeHtml(effortLabel(point.effort)),
      "<span " + muted + ">" +
        (axes.y === "score_pct" ? "Score" : "Index") +
        "</span>  " +
        formatScore(point[axes.y], axes.y),
      "<span " + muted + ">Cost</span>  " + formatUsd(point[axes.x]) + " per task",
    ];
    const harness = point.harness || (entry.series && entry.series.harness);
    if (harness) {
      rows.push("<span " + muted + ">Harness</span>  " + escapeHtml(harness));
    }
    return rows.join("<br>");
  }

  function toggleModels(ids, on) {
    ids.forEach(function (id) {
      if (on) state.selected.add(id);
      else state.selected.delete(id);
    });
    if (state.pinnedModel && !state.selected.has(state.pinnedModel)) setPinnedModel(null);
    renderModels();
    drawChart();
  }

  function buildChip(entry, hasPoints) {
    const button = document.createElement("button");
    const swatch = document.createElement("span");
    const text = document.createElement("span");
    button.type = "button";
    button.className = "model-chip";
    button.dataset.modelId = entry.id;
    button.setAttribute("aria-pressed", state.selected.has(entry.id) ? "true" : "false");
    swatch.className = "swatch";
    swatch.style.background = entry.color;
    text.textContent = entry.label;
    button.append(swatch, text);
    if (!hasPoints) {
      button.classList.add("is-empty");
      button.title = "No results on this board";
      button.setAttribute("aria-disabled", "true");
      return button;
    }
    button.addEventListener("click", function () {
      const turningOff = state.selected.has(entry.id);
      if (turningOff && state.pinnedModel === entry.id) setPinnedModel(null);
      toggleModels([entry.id], !turningOff);
    });
    button.addEventListener("mouseenter", function () {
      setHoverModel(entry.id);
    });
    button.addEventListener("mouseleave", function () {
      setHoverModel(null);
    });
    button.addEventListener("focus", function () {
      setHoverModel(entry.id);
    });
    button.addEventListener("blur", function () {
      setHoverModel(null);
    });
    return button;
  }

  function renderModels() {
    const board = getBoard(state.boardId);
    const axes = boardAxes(board);
    const focusedId = document.activeElement && document.activeElement.dataset
      ? document.activeElement.dataset.modelId || document.activeElement.dataset.providerId
      : null;
    els.modelList.replaceChildren();
    groupedEntries(board).forEach(function (group) {
      const wrap = document.createElement("div");
      const label = document.createElement("button");
      const chips = document.createElement("div");
      const plottable = group.entries
        .filter(function (entry) {
          return validPoints(entry.series || {}, axes.x, axes.y).length > 0;
        })
        .map(function (entry) {
          return entry.id;
        });
      wrap.className = "model-group";
      label.type = "button";
      label.className = "group-label";
      label.dataset.providerId = group.provider.id;
      label.textContent = group.provider.label;
      label.title = "Toggle all " + group.provider.label + " models";
      label.addEventListener("click", function () {
        const allOn = plottable.every(function (id) {
          return state.selected.has(id);
        });
        toggleModels(plottable, !allOn);
      });
      chips.className = "group-chips";
      group.entries.forEach(function (entry) {
        chips.appendChild(buildChip(entry, plottable.indexOf(entry.id) !== -1));
      });
      wrap.append(label, chips);
      els.modelList.appendChild(wrap);
    });
    if (focusedId) {
      const again = els.modelList.querySelector(
        '[data-model-id="' + focusedId + '"], [data-provider-id="' + focusedId + '"]'
      );
      if (again) again.focus();
    }
    updateCount();
    applyEmphasis();
  }

  function selectAll(on) {
    const board = getBoard(state.boardId);
    state.selected = new Set();
    if (!on) setPinnedModel(null);
    if (on) {
      modelEntries(board).forEach(function (entry) {
        state.selected.add(entry.id);
      });
    }
    renderModels();
    drawChart();
  }

  function selectBoard(boardId, immediate) {
    const board = getBoard(boardId);
    if (!board || boardId === state.boardId) return;
    const firstPaint = !state.boardId;
    state.boardId = boardId;
    state.hoverModel = null;
    state.pinnedModel = null;
    state.xScale = board.x_scale === "log" ? "log" : "linear";
    state.selected = new Set(
      modelEntries(board).map(function (entry) {
        return entry.id;
      })
    );
    setHash(boardId);
    updateChrome(board);
    updateScaleButtons();
    renderTabs();
    renderModels();
    if (firstPaint || immediate) {
      drawChart();
      return;
    }
    els.chartCard.classList.add("is-fading");
    window.clearTimeout(state.fadeTimer);
    state.fadeTimer = window.setTimeout(function () {
      drawChart();
      els.chartCard.classList.remove("is-fading");
    }, 90);
  }

  function plotTheme() {
    const dark = currentTheme() === "dark";
    return {
      paper: dark ? "#121212" : "#ffffff",
      text: dark ? "#e0e0e0" : "#212529",
      heading: dark ? "#f5f5f5" : "#1a1f23",
      grid: dark ? "rgba(255, 255, 255, 0.08)" : "rgba(26, 31, 35, 0.08)",
      line: dark ? "#333333" : "#dee2e6",
      muted: dark ? "#a0a0a0" : "#6c757d",
      // Soft fill so the caret bubble does not fully bury the lines behind it.
      tipBg: dark ? "rgba(30, 30, 30, 0.88)" : "rgba(255, 255, 255, 0.9)",
    };
  }

  function applyEmphasis() {
    const graph = els.chart;
    const data = graph && graph.data;
    const hot = activeModelId();
    const nodes = graph ? graph.querySelectorAll(".scatterlayer .trace") : [];
    Array.prototype.forEach.call(nodes, function (node, index) {
      const id = data && data[index] ? data[index].meta : null;
      const on = !hot || id === hot;
      node.classList.toggle("is-hot", Boolean(hot) && id === hot);
      node.classList.toggle("is-dim", Boolean(hot) && id !== hot);
      // Plotly SVG groups ignore stylesheet opacity reliably; set it on the node.
      node.style.opacity = on ? "1" : "0.22";
      const line = node.querySelector(".js-line");
      if (line) line.style.strokeWidth = hot && id === hot ? "2.6" : "1.6";
    });
    const chips = els.modelList.querySelectorAll(".model-chip");
    Array.prototype.forEach.call(chips, function (chip) {
      const id = chip.dataset.modelId;
      chip.classList.toggle("is-hot", id === hot);
      chip.classList.toggle("is-pinned", id === state.pinnedModel);
    });
  }

  function isZoomed() {
    const layout = els.chart && els.chart._fullLayout;
    if (!layout || !layout.xaxis || !layout.yaxis) return false;
    return !(layout.xaxis.autorange && layout.yaxis.autorange);
  }

  function syncResetButton() {
    els.resetBtn.disabled = !isZoomed();
  }

  function resetView() {
    if (typeof Plotly === "undefined" || !els.chart.data) return;
    Plotly.relayout(els.chart, { "xaxis.autorange": true, "yaxis.autorange": true });
  }

  function ensurePlotEvents() {
    if (state.plotEventsBound || typeof els.chart.on !== "function") return;
    state.plotEventsBound = true;
    els.chart.on("plotly_hover", function (event) {
      const pt = event.points && event.points[0];
      if (pt) setHoverModel(pt.data.meta);
    });
    els.chart.on("plotly_unhover", function () {
      setHoverModel(null);
    });
    // Pin on a true click. Zoom drags move farther than this threshold, so they do not pin.
    els.chart.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) return;
      state.pointer = {
        x: event.clientX,
        y: event.clientY,
        model: state.hoverModel,
      };
    });
    els.chart.addEventListener("pointerup", function (event) {
      const start = state.pointer;
      state.pointer = null;
      if (!start || !start.model || event.button !== 0) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
      setPinnedModel(state.pinnedModel === start.model ? null : start.model);
    });
    els.chart.addEventListener("pointercancel", function () {
      state.pointer = null;
    });
    els.chart.on("plotly_relayout", syncResetButton);
    els.chart.on("plotly_afterplot", applyEmphasis);
  }

  function tickUsd(value) {
    return "$" + Number(value.toPrecision(1)).toString();
  }

  // Plotly drops tickprefix on minor log labels, so log ticks are built by hand: 1-2-5 for
  // narrow ranges, decades only once the data spans two or more.
  function logTicks(traces) {
    let min = Infinity;
    let max = -Infinity;
    traces.forEach(function (trace) {
      trace.x.forEach(function (x) {
        if (x > 0) {
          min = Math.min(min, x);
          max = Math.max(max, x);
        }
      });
    });
    if (!Number.isFinite(min)) return {};
    const steps = Math.log10(max / min) < 2 ? [1, 2, 5] : [1];
    const values = [];
    for (let exp = Math.floor(Math.log10(min)) - 1; exp <= Math.ceil(Math.log10(max)) + 1; exp += 1) {
      steps.forEach(function (step) {
        values.push(step * Math.pow(10, exp));
      });
    }
    return {
      tickmode: "array",
      tickvals: values,
      ticktext: values.map(tickUsd),
    };
  }

  function drawChart() {
    if (typeof Plotly === "undefined") {
      setStatus("Plotly failed to load.", true);
      return;
    }
    const board = getBoard(state.boardId);
    if (!board) {
      setStatus("Board not found in snapshot.", true);
      return;
    }

    const axes = boardAxes(board);
    const xScale = state.xScale;
    const colors = plotTheme();
    const traces = [];

    groupedEntries(board).forEach(function (group) {
      group.entries.forEach(function (entry) {
        if (!state.selected.has(entry.id)) return;
        const points = validPoints(entry.series || {}, axes.x, axes.y).filter(function (point) {
          return xScale !== "log" || point[axes.x] > 0;
        });
        if (!points.length) return;
        traces.push({
          type: "scatter",
          mode: points.length > 1 ? "lines+markers+text" : "markers+text",
          name: entry.label,
          meta: entry.id,
          x: points.map(function (point) {
            return point[axes.x];
          }),
          y: points.map(function (point) {
            return point[axes.y];
          }),
          text: points.map(function (point) {
            return effortLabel(point.effort);
          }),
          textposition: "top center",
          textfont: { size: 11, color: colors.muted, family: FONT },
          hovertext: points.map(function (point) {
            return hoverText(entry, point, axes, colors);
          }),
          hovertemplate: "%{hovertext}<extra></extra>",
          hoverlabel: {
            bgcolor: colors.tipBg,
            bordercolor: entry.color,
            align: "left",
            font: { family: FONT, size: 13, color: colors.text },
          },
          cliponaxis: false,
          marker: {
            size: points.length > 1 ? 11 : 13,
            color: entry.color,
            symbol: markerFor(entry.id),
            line: { width: 1, color: colors.paper },
          },
          line: { color: entry.color, width: 1.6 },
        });
      });
    });

    const axisTitleFont = { family: FONT, size: 13, color: colors.muted };
    const tickFont = { family: FONT, size: 12, color: colors.muted };
    const xTicks = xScale === "log" ? logTicks(traces) : { tickprefix: "$" };
    const layout = {
      uirevision: state.boardId + ":" + xScale,
      margin: { l: 68, r: 36, t: 24, b: 64 },
      paper_bgcolor: colors.paper,
      plot_bgcolor: colors.paper,
      font: { color: colors.text, family: FONT, size: 13 },
      showlegend: false,
      hovermode: "closest",
      hoverdistance: 28,
      dragmode: "zoom",
      xaxis: Object.assign(
        {
          title: { text: "Cost per task", font: axisTitleFont },
          type: xScale,
          showgrid: true,
          gridcolor: colors.grid,
          zeroline: false,
          linecolor: colors.line,
          tickfont: tickFont,
          automargin: true,
        },
        xTicks
      ),
      yaxis: {
        title: { text: humanizeField(axes.y), font: axisTitleFont },
        showgrid: true,
        gridcolor: colors.grid,
        zeroline: false,
        linecolor: colors.line,
        tickfont: tickFont,
        automargin: true,
      },
      annotations: traces.length
        ? []
        : [
            {
              text: "Select at least one model.",
              showarrow: false,
              xref: "paper",
              yref: "paper",
              x: 0.5,
              y: 0.5,
              font: { color: colors.muted, size: 14, family: FONT },
            },
          ],
    };

    Plotly.react(els.chart, traces, layout, {
      displayModeBar: false,
      displaylogo: false,
      responsive: true,
      scrollZoom: false,
      doubleClick: "reset",
    }).then(function () {
      ensurePlotEvents();
      applyEmphasis();
      syncResetButton();
    });
    setStatus("");
  }

  function downloadPng() {
    if (typeof Plotly === "undefined" || !els.chart.data) return;
    Plotly.downloadImage(els.chart, {
      format: "png",
      filename: "cost-vs-score-" + state.boardId,
      scale: 2,
    });
  }

  async function boot() {
    initTheme();
    els.allBtn.addEventListener("click", function () {
      selectAll(true);
    });
    els.noneBtn.addEventListener("click", function () {
      selectAll(false);
    });
    Array.prototype.forEach.call(els.scaleButtons, function (button) {
      button.addEventListener("click", function () {
        if (state.xScale === button.dataset.scale) return;
        state.xScale = button.dataset.scale;
        updateScaleButtons();
        drawChart();
      });
    });
    els.resetBtn.addEventListener("click", resetView);
    els.downloadBtn.addEventListener("click", downloadPng);
    window.addEventListener("hashchange", function () {
      const id = hashBoardId();
      if (id && id !== state.boardId && getBoard(id)) selectBoard(id);
    });

    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      state.payload = await response.json();
    } catch (error) {
      setStatus("Could not load the snapshot. Serve this folder over HTTP.", true);
      els.asOf.textContent = "";
      return;
    }

    els.asOf.textContent = formatAsOf(state.payload);
    const ids = boardIds(state.payload);
    if (!ids.length) {
      setStatus("Snapshot has no boards.", true);
      return;
    }
    const requested = hashBoardId();
    selectBoard(ids.indexOf(requested) >= 0 ? requested : ids[0], true);
  }

  boot();
})();
