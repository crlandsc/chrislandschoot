(function () {
  "use strict";

  const DATA_URL = "data/live-cost-vs-score-latest.json";
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
    status: document.getElementById("status"),
    tabs: document.getElementById("board-tabs"),
    modelList: document.getElementById("model-list"),
    chartTitle: document.getElementById("chart-title"),
    chart: document.getElementById("chart"),
    themeToggle: document.getElementById("theme-toggle"),
    allBtn: document.getElementById("models-all"),
    noneBtn: document.getElementById("models-none"),
  };

  const state = {
    payload: null,
    boardId: null,
    selected: new Set(),
  };

  function setStatus(message, isError) {
    els.status.textContent = message || "";
    els.status.classList.toggle("error", Boolean(isError));
  }

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light";
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

  function formatScore(value) {
    if (!Number.isFinite(value)) return "n/a";
    const rounded = Math.round(value * 100) / 100;
    return String(rounded);
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
    return state.payload && state.payload.boards
      ? state.payload.boards[id]
      : null;
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
            if (nested && typeof nested === "object") {
              return { id: item, series: nested };
            }
            return { id: item, series: { label: item, points: [] } };
          }
          if (item && typeof item === "object") {
            return {
              id: item.id || item.key || "model-" + index,
              series: item,
            };
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
      button.textContent = shortTitle(id, board);
      button.addEventListener("click", function () {
        selectBoard(id);
      });
      els.tabs.appendChild(button);
    });
  }

  function renderModels() {
    const board = getBoard(state.boardId);
    const entries = modelEntries(board);
    els.modelList.replaceChildren();
    entries.forEach(function (entry, index) {
      const id = entry.id;
      const label = document.createElement("label");
      const input = document.createElement("input");
      const swatch = document.createElement("span");
      const text = document.createElement("span");
      input.type = "checkbox";
      input.checked = state.selected.has(id);
      input.dataset.modelId = id;
      swatch.className = "swatch";
      swatch.style.background = colorFor(id, index);
      text.textContent = labelFor(id, entry.series);
      input.addEventListener("change", function () {
        if (input.checked) {
          state.selected.add(id);
        } else {
          state.selected.delete(id);
        }
        drawChart();
      });
      label.append(input, swatch, text);
      els.modelList.appendChild(label);
    });
  }

  function selectAll(on) {
    const board = getBoard(state.boardId);
    state.selected = new Set();
    if (on) {
      modelEntries(board).forEach(function (entry) {
        state.selected.add(entry.id);
      });
    }
    renderModels();
    drawChart();
  }

  function selectBoard(boardId) {
    const board = getBoard(boardId);
    if (!board) return;
    state.boardId = boardId;
    state.selected = new Set(
      modelEntries(board).map(function (entry) {
        return entry.id;
      })
    );
    setHash(boardId);
    renderTabs();
    renderModels();
    drawChart();
  }

  function plotTheme() {
    const dark = currentTheme() === "dark";
    return {
      paper: dark ? "#121212" : "#ffffff",
      plot: dark ? "#121212" : "#ffffff",
      text: dark ? "#e0e0e0" : "#212529",
      grid: dark ? "#333333" : "#dee2e6",
      muted: dark ? "#a0a0a0" : "#6c757d",
    };
  }

  function drawChart() {
    if (typeof Plotly === "undefined") {
      setStatus("Plotly failed to load from CDN.", true);
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
      const harness = series.harness || "";
      const xs = points.map(function (point) {
        return point[xField];
      });
      const ys = points.map(function (point) {
        return point[yField];
      });
      const efforts = points.map(function (point) {
        return point.effort || "";
      });
      const hovertext = points.map(function (point) {
        const lines = [
          modelLabel,
          "Effort: " + (point.effort || "n/a"),
          humanizeField(yField) + ": " + formatScore(point[yField]),
          "$/task: " + formatUsd(point[xField]),
        ];
        const pointHarness = point.harness || harness;
        if (pointHarness) {
          lines.push("Harness: " + pointHarness);
        }
        return lines.join("<br>");
      });
      traces.push({
        type: "scatter",
        mode: points.length > 1 ? "lines+markers+text" : "markers+text",
        name: modelLabel,
        x: xs,
        y: ys,
        text: efforts,
        textposition: "top center",
        textfont: { size: 10, color: colors.muted },
        hovertext: hovertext,
        hoverinfo: "text",
        cliponaxis: false,
        marker: {
          size: 10,
          color: colorFor(entry.id, index),
          symbol: markerFor(entry.id),
          line: { width: 0.5, color: colors.paper },
        },
        line: {
          color: colorFor(entry.id, index),
          width: 2,
        },
      });
    });

    els.chartTitle.textContent = board.title || shortTitle(state.boardId, board);

    const layout = {
      margin: { l: 64, r: 24, t: 16, b: 56 },
      paper_bgcolor: colors.paper,
      plot_bgcolor: colors.plot,
      font: { color: colors.text, family: "system-ui, sans-serif", size: 13 },
      showlegend: false,
      hoverlabel: {
        align: "left",
        bgcolor: colors.paper,
        bordercolor: colors.grid,
        font: { color: colors.text, size: 12 },
      },
      xaxis: {
        title: { text: "Cost per task (USD)" },
        type: xScale,
        showgrid: true,
        gridcolor: colors.grid,
        zeroline: false,
        linecolor: colors.grid,
        tickfont: { color: colors.muted },
        titlefont: { color: colors.text },
        automargin: true,
        // Decade ticks on log boards (SciCode); default 1-2-5 labels get noisy.
        dtick: xScale === "log" ? 1 : undefined,
        tickformat: xScale === "log" ? "~g" : undefined,
      },
      yaxis: {
        title: { text: humanizeField(yField) },
        showgrid: true,
        gridcolor: colors.grid,
        zeroline: false,
        linecolor: colors.grid,
        tickfont: { color: colors.muted },
        titlefont: { color: colors.text },
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
                font: { color: colors.muted, size: 14 },
              },
            ]
          : [],
    };

    Plotly.react(els.chart, traces, layout, {
      displaylogo: false,
      responsive: true,
      modeBarButtonsToRemove: ["lasso2d", "select2d"],
    });

    const bits = [];
    if (xScale === "log") bits.push("log x-axis");
    if (skipped) bits.push(skipped + " model(s) with no points omitted");
    setStatus(bits.join(" · "));
  }

  function onResize() {
    if (typeof Plotly === "undefined" || !els.chart || !els.chart.data) return;
    Plotly.Plots.resize(els.chart);
  }

  async function boot() {
    initTheme();
    els.allBtn.addEventListener("click", function () {
      selectAll(true);
    });
    els.noneBtn.addEventListener("click", function () {
      selectAll(false);
    });
    window.addEventListener("resize", onResize);
    window.addEventListener("hashchange", function () {
      const id = hashBoardId();
      if (id && id !== state.boardId && getBoard(id)) {
        selectBoard(id);
      }
    });

    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }
      state.payload = await response.json();
    } catch (error) {
      setStatus("Could not load " + DATA_URL + ". Serve this folder over HTTP.", true);
      els.asOf.textContent = "";
      return;
    }

    els.asOf.textContent = state.payload.as_of_et
      ? "Snapshot " + state.payload.as_of_et
      : state.payload.as_of
        ? "Snapshot " + state.payload.as_of
        : "";

    const ids = boardIds(state.payload);
    if (!ids.length) {
      setStatus("Snapshot has no boards.", true);
      return;
    }
    const requested = hashBoardId();
    selectBoard(ids.indexOf(requested) >= 0 ? requested : ids[0]);
  }

  boot();
})();
