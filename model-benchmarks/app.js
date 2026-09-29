(function () {
  "use strict";

  const DATA_URL = "data/live-cost-vs-score-latest.json";
  const FONT = '"Brandon Grotesque", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const BOARD_ORDER = [
    "cursorbench_4_0",
    "aa_intelligence_v4_3_2",
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
    xhigh: "Extra high",
    max: "Max",
  };
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
    chartNote: document.getElementById("chart-note"),
    chartCard: document.getElementById("chart-card"),
    chart: document.getElementById("chart"),
    themeToggle: document.getElementById("theme-toggle"),
    allBtn: document.getElementById("models-all"),
    noneBtn: document.getElementById("models-none"),
    readoutText: document.getElementById("readout-text"),
    readoutSwatch: document.getElementById("readout-swatch"),
    readoutClear: document.getElementById("readout-clear"),
  };

  const state = {
    payload: null,
    boardId: null,
    selected: new Set(),
    hoverModel: null,
    pinned: null,
    fadeTimer: 0,
    plotEventsBound: false,
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
    const isDark = theme === "dark";
    if (isDark) {
      html.setAttribute("data-theme", "dark");
      els.themeToggle.setAttribute("aria-label", "Switch to light mode");
    } else {
      html.removeAttribute("data-theme");
      els.themeToggle.setAttribute("aria-label", "Switch to dark mode");
    }
    if (state.payload && state.boardId) {
      drawChart();
    }
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
    const digits = Math.abs(value) >= 10 ? 1 : 2;
    const text = value.toFixed(digits);
    return yField === "score_pct" ? text + "%" : text;
  }

  function effortLabel(value) {
    if (!value) return "n/a";
    const key = String(value).toLowerCase();
    return EFFORT_LABELS[key] || String(value);
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
    if (!board) return [];
    const models = board.models;
    if (!models) return [];
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
    const colors = styleMaps().colors;
    return colors[id] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  }

  function markerFor(id) {
    const markers = styleMaps().markers;
    return MATPLOTLIB_TO_PLOTLY[markers[id]] || "circle";
  }

  function labelFor(id, series) {
    const labels = styleMaps().labels;
    return (series && series.label) || labels[id] || id;
  }

  function shortTitle(boardId, board) {
    return BOARD_SHORT_TITLES[boardId] || (board && board.title) || boardId;
  }

  function hashBoardId() {
    const raw = (window.location.hash || "").replace(/^#/, "");
    return raw || null;
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
      if (raw.indexOf("artificialanalysis.ai") !== -1) return "https://artificialanalysis.ai/";
      return "";
    }
    return raw;
  }

  function formatAsOf(payload) {
    const raw = (payload && (payload.as_of_et || payload.as_of)) || "";
    if (!raw) return "";
    return "Updated " + String(raw).replace(" ~", ", ").replace("~", " ");
  }

  function appendSep(parent) {
    const sep = document.createElement("span");
    sep.className = "sep";
    sep.setAttribute("aria-hidden", "true");
    sep.textContent = "·";
    parent.appendChild(sep);
  }

  function showPlaceholder() {
    els.readoutSwatch.hidden = true;
    els.readoutClear.hidden = true;
    els.readoutText.className = "readout-text is-placeholder";
    els.readoutText.textContent = "Hover a point for details. Click to hold it.";
  }

  function showReadout(info, pinned) {
    els.readoutSwatch.hidden = false;
    els.readoutSwatch.style.background = info.color || "transparent";
    els.readoutClear.hidden = !pinned;
    els.readoutText.className = "readout-text";
    els.readoutText.replaceChildren();

    if (pinned) {
      const held = document.createElement("span");
      held.className = "muted";
      held.textContent = "Held";
      els.readoutText.appendChild(held);
      appendSep(els.readoutText);
    }

    const name = document.createElement("span");
    name.className = "readout-name";
    name.textContent = info.label || "Model";
    els.readoutText.appendChild(name);

    const bits = info.bits || [];
    bits.forEach(function (bit) {
      appendSep(els.readoutText);
      const span = document.createElement("span");
      if (bit.muted) span.className = "muted";
      span.textContent = bit.text;
      els.readoutText.appendChild(span);
    });
  }

  function pointInfo(pt) {
    const data = pt.customdata || [];
    const yField = data[5];
    const harness = data[3];
    const bits = [
      { text: effortLabel(data[0]) },
      { text: formatScore(Number(data[1]), yField) },
      { text: formatUsd(Number(data[2])) + " / task" },
    ];
    if (harness) bits.push({ text: harness, muted: true });
    return {
      key: String(pt.data.meta) + "|" + String(data[0]) + "|" + String(data[2]),
      modelId: pt.data.meta,
      color: markerColor(pt),
      label: data[4] || pt.data.name,
      bits: bits,
    };
  }

  function markerColor(pt) {
    const color = pt.data && pt.data.marker ? pt.data.marker.color : "";
    return Array.isArray(color) ? color[0] : color;
  }

  function showPoint(pt, pinned) {
    showReadout(pointInfo(pt), pinned);
  }

  function showModelSummary(entry, index) {
    const board = getBoard(state.boardId);
    const xField = (board && board.x) || "cost_per_task_usd";
    const yField = board && board.y;
    const series = entry.series || {};
    const points = validPoints(series, xField, yField);
    const bits = [{ text: points.length + (points.length === 1 ? " effort" : " efforts") }];
    if (series.harness) bits.push({ text: series.harness, muted: true });
    showReadout(
      {
        label: labelFor(entry.id, series),
        color: colorFor(entry.id, index),
        bits: bits,
      },
      false
    );
  }

  function updateCount() {
    const total = modelEntries(getBoard(state.boardId)).length;
    const selected = state.selected.size;
    els.modelCount.textContent = selected === total ? String(total) : selected + " of " + total;
  }

  function updateSource(board) {
    const href = sourceHref(board);
    if (!href) {
      els.sourceLink.hidden = true;
      els.sourceSep.hidden = true;
      els.sourceLink.removeAttribute("href");
      return;
    }
    els.sourceLink.href = href;
    els.sourceLink.target = "_blank";
    els.sourceLink.rel = "noopener noreferrer";
    els.sourceLink.hidden = false;
    els.sourceSep.hidden = false;
  }

  function updateChrome(board, extraNote) {
    const title = (board && board.title) || shortTitle(state.boardId, board);
    els.boardTitle.textContent = title;
    document.title = shortTitle(state.boardId, board) + " · Cost vs score";
    updateSource(board);
    const notes = [
      "Each line is one model. Points are effort levels, from cheaper to more expensive.",
    ];
    if (board && board.x_scale === "log") notes.push("Cost is on a log scale.");
    if (extraNote) notes.push(extraNote);
    els.chartNote.textContent = notes.join(" ");
  }

  function renderTabs() {
    const ids = boardIds(state.payload);
    els.tabs.replaceChildren();
    ids.forEach(function (id) {
      const board = getBoard(id);
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "tab");
      button.id = "tab-" + id;
      button.dataset.boardId = id;
      button.setAttribute("aria-selected", id === state.boardId ? "true" : "false");
      button.tabIndex = id === state.boardId ? 0 : -1;
      button.setAttribute("aria-controls", "chart");
      button.textContent = shortTitle(id, board);
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

  function renderModels() {
    const board = getBoard(state.boardId);
    const entries = modelEntries(board);
    els.modelList.replaceChildren();
    entries.forEach(function (entry, index) {
      const button = document.createElement("button");
      const swatch = document.createElement("span");
      const text = document.createElement("span");
      button.type = "button";
      button.className = "model-chip";
      button.dataset.modelId = entry.id;
      button.setAttribute("aria-pressed", state.selected.has(entry.id) ? "true" : "false");
      swatch.className = "swatch";
      swatch.style.background = colorFor(entry.id, index);
      text.textContent = labelFor(entry.id, entry.series);
      button.append(swatch, text);
      button.addEventListener("click", function () {
        if (state.selected.has(entry.id)) state.selected.delete(entry.id);
        else state.selected.add(entry.id);
        button.setAttribute("aria-pressed", state.selected.has(entry.id) ? "true" : "false");
        if (state.pinned && state.pinned.modelId === entry.id && !state.selected.has(entry.id)) {
          state.pinned = null;
          showPlaceholder();
        }
        updateCount();
        drawChart();
      });
      button.addEventListener("mouseenter", function () {
        state.hoverModel = entry.id;
        if (!state.pinned) showModelSummary(entry, index);
        applyEmphasis();
      });
      button.addEventListener("mouseleave", function () {
        if (state.hoverModel === entry.id) state.hoverModel = null;
        if (state.pinned) showReadout(state.pinned, true);
        else showPlaceholder();
        applyEmphasis();
      });
      button.addEventListener("focus", function () {
        state.hoverModel = entry.id;
        if (!state.pinned) showModelSummary(entry, index);
        applyEmphasis();
      });
      button.addEventListener("blur", function () {
        if (state.hoverModel === entry.id) state.hoverModel = null;
        if (state.pinned) showReadout(state.pinned, true);
        else showPlaceholder();
        applyEmphasis();
      });
      els.modelList.appendChild(button);
    });
    updateCount();
  }

  function selectAll(on) {
    const board = getBoard(state.boardId);
    state.selected = new Set();
    state.hoverModel = null;
    if (!on) {
      state.pinned = null;
      showPlaceholder();
    }
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
    state.pinned = null;
    state.selected = new Set(
      modelEntries(board).map(function (entry) {
        return entry.id;
      })
    );
    setHash(boardId);
    showPlaceholder();
    updateChrome(board);
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
      plot: dark ? "#121212" : "#ffffff",
      text: dark ? "#e0e0e0" : "#212529",
      heading: dark ? "#f5f5f5" : "#1a1f23",
      grid: dark ? "rgba(255, 255, 255, 0.08)" : "rgba(26, 31, 35, 0.08)",
      line: dark ? "#333333" : "#dee2e6",
      muted: dark ? "#a0a0a0" : "#6c757d",
    };
  }

  function activeModelId() {
    return state.hoverModel || (state.pinned && state.pinned.modelId) || null;
  }

  function applyEmphasis() {
    const graph = els.chart;
    if (typeof Plotly === "undefined" || !graph || !graph.data || !graph.data.length) return;
    const hot = activeModelId();
    const opacities = [];
    const widths = [];
    const modes = [];
    graph.data.forEach(function (trace) {
      const on = !hot || trace.meta === hot;
      const count = (trace.x || []).length;
      opacities.push(on ? 1 : 0.28);
      widths.push(on && hot ? 2.6 : 1.6);
      if (count > 1 && on && hot) modes.push("lines+markers+text");
      else if (count > 1) modes.push("lines+markers");
      else modes.push("markers");
    });
    Plotly.restyle(graph, {
      opacity: opacities,
      "line.width": widths,
      mode: modes,
    });
    const chips = els.modelList.querySelectorAll(".model-chip");
    Array.prototype.forEach.call(chips, function (chip) {
      chip.classList.toggle("is-hot", chip.dataset.modelId === hot);
    });
  }

  function onHover(event) {
    const pt = event.points && event.points[0];
    if (!pt) return;
    const info = pointInfo(pt);
    state.hoverModel = pt.data.meta;
    if (!(state.pinned && state.pinned.key === info.key)) showPoint(pt, false);
    applyEmphasis();
  }

  function onUnhover() {
    state.hoverModel = null;
    if (state.pinned) showReadout(state.pinned, true);
    else showPlaceholder();
    applyEmphasis();
  }

  function onClick(event) {
    const pt = event.points && event.points[0];
    if (!pt) return;
    const info = pointInfo(pt);
    if (state.pinned && state.pinned.key === info.key) {
      state.pinned = null;
      showPoint(pt, false);
    } else {
      state.pinned = info;
      showReadout(info, true);
    }
    applyEmphasis();
  }

  function ensurePlotEvents() {
    if (state.plotEventsBound || !els.chart || typeof els.chart.on !== "function") return;
    state.plotEventsBound = true;
    els.chart.on("plotly_hover", onHover);
    els.chart.on("plotly_unhover", onUnhover);
    els.chart.on("plotly_click", onClick);
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

    const xField = board.x || "cost_per_task_usd";
    const yField = board.y;
    const xScale = board.x_scale === "log" ? "log" : "linear";
    const colors = plotTheme();
    const entries = modelEntries(board);
    const traces = [];
    let plotted = 0;
    let skipped = 0;

    entries.forEach(function (entry, index) {
      if (!state.selected.has(entry.id)) return;
      const series = entry.series || {};
      const points = validPoints(series, xField, yField);
      if (!points.length) {
        skipped += 1;
        return;
      }
      plotted += 1;
      const modelLabel = labelFor(entry.id, series);
      const color = colorFor(entry.id, index);
      traces.push({
        type: "scatter",
        mode: points.length > 1 ? "lines+markers" : "markers",
        name: modelLabel,
        meta: entry.id,
        x: points.map(function (point) {
          return point[xField];
        }),
        y: points.map(function (point) {
          return point[yField];
        }),
        text: points.map(function (point) {
          return effortLabel(point.effort);
        }),
        textposition: "top center",
        textfont: { size: 11, color: colors.muted, family: FONT },
        customdata: points.map(function (point) {
          return [
            point.effort || "",
            point[yField],
            point[xField],
            point.harness || series.harness || "",
            modelLabel,
            yField,
          ];
        }),
        hoverinfo: "none",
        hovertemplate: "",
        cliponaxis: false,
        marker: {
          size: points.length > 1 ? 11 : 13,
          color: color,
          symbol: markerFor(entry.id),
          line: { width: 1, color: colors.paper },
        },
        line: {
          color: color,
          width: 1.6,
        },
      });
    });

    const skippedNote = skipped
      ? skipped + (skipped === 1 ? " model has" : " models have") + " no points on this board."
      : "";
    updateChrome(board, skippedNote);

    const layout = {
      margin: { l: 68, r: 36, t: 28, b: 72 },
      paper_bgcolor: colors.paper,
      plot_bgcolor: colors.plot,
      font: { color: colors.text, family: FONT, size: 13 },
      showlegend: false,
      hovermode: "closest",
      hoverdistance: 28,
      dragmode: false,
      xaxis: {
        title: { text: "Cost per task", font: { family: FONT, size: 13, color: colors.muted } },
        type: xScale,
        showgrid: true,
        gridcolor: colors.grid,
        zeroline: false,
        linecolor: colors.line,
        tickfont: { family: FONT, color: colors.muted, size: 12 },
        tickprefix: "$",
        automargin: true,
        dtick: xScale === "log" ? 1 : undefined,
        tickformat: xScale === "log" ? "~g" : undefined,
      },
      yaxis: {
        title: { text: humanizeField(yField), font: { family: FONT, size: 13, color: colors.muted } },
        showgrid: true,
        gridcolor: colors.grid,
        zeroline: false,
        linecolor: colors.line,
        tickfont: { family: FONT, color: colors.muted, size: 12 },
        automargin: true,
      },
      annotations:
        plotted === 0
          ? [
              {
                text: skipped
                  ? "Selected models have no usable points on this board."
                  : "Select at least one model.",
                showarrow: false,
                xref: "paper",
                yref: "paper",
                x: 0.5,
                y: 0.5,
                font: { color: colors.muted, size: 14, family: FONT },
              },
            ]
          : [],
    };

    Plotly.react(els.chart, traces, layout, {
      displayModeBar: false,
      displaylogo: false,
      responsive: true,
      scrollZoom: false,
    }).then(function () {
      ensurePlotEvents();
      applyEmphasis();
    });

    setStatus("");
  }

  function onResize() {
    if (typeof Plotly === "undefined" || !els.chart || !els.chart.data) return;
    Plotly.Plots.resize(els.chart);
  }

  async function boot() {
    initTheme();
    showPlaceholder();
    els.allBtn.addEventListener("click", function () {
      selectAll(true);
    });
    els.noneBtn.addEventListener("click", function () {
      selectAll(false);
    });
    els.readoutClear.addEventListener("click", function () {
      state.pinned = null;
      state.hoverModel = null;
      showPlaceholder();
      applyEmphasis();
    });
    window.addEventListener("resize", onResize);
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
