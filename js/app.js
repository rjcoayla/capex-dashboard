/**
 * ================================================================
 * DASHBOARD CAPEX MINERO — Lógica principal (app.js)
 * ================================================================
 *
 * Arquitectura:
 *  1. Estado global (filtros activos)
 *  2. Carga de datos desde capex_data.json
 *  3. Función de filtrado: aplica todos los filtros al dataset
 *  4. Cálculo de KPIs: agrega los registros filtrados
 *  5. Renderizado de gráficos con Chart.js (se destruye y recrea al filtrar)
 *  6. Renderizado de tabla Top 10
 *  7. Event listeners en los selects → disparan actualización completa
 *
 * Filtros combinados: todos los filtros se aplican simultáneamente
 * usando Array.filter() con condiciones AND sobre cada registro.
 */

'use strict';

/* ── Nombres de meses para etiquetas ── */
const MESES_LABELS = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                          'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/* ── Paleta de colores para gráficos ── */
const COLORS = {
  gold:    '#fab93c',
  teal:    '#2dd4bf',
  orange:  '#fb923c',
  red:     '#f87171',
  blue:    '#60a5fa',
  purple:  '#a78bfa',
  green:   '#34d399',
  pink:    '#f472b6',
  slate:   '#94a3b8',
  amber:   '#fbbf24',
};

const PALETTE = Object.values(COLORS);

/* ── Estado global ── */
const estado = {
  datos: null,        // { proyectos: [...], registros: [...] }
  filtros: {
    anio: '',
    mes: '',
    area: '',
    tipo: '',
    estadoProy: '',
    region: '',
  },
};

/* ── Referencias a instancias de Chart.js ── */
const charts = {
  area: null,
  tipo: null,
  linea: null,
  presupuesto: null,
};

/* ================================================================
   1. CARGA DE DATOS
   ================================================================ */
async function cargarDatos() {
  try {
    const resp = await fetch('./data/capex_data.json');
    if (!resp.ok) throw new Error('Error al cargar datos');
    estado.datos = await resp.json();
    inicializarFiltros();
    actualizarDashboard();
  } catch (err) {
    console.error('Error cargando datos:', err);
    mostrarErrorCarga();
  }
}

function mostrarErrorCarga() {
  document.getElementById('main-content').innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">⚠️</div>
      <div class="empty-state-text">No se pudieron cargar los datos.<br>
      Abre este archivo desde un servidor local (no directamente con file://).</div>
    </div>`;
}

/* ================================================================
   2. INICIALIZACIÓN DE FILTROS (poblar los <select>)
   ================================================================ */
function inicializarFiltros() {
  const { proyectos, registros } = estado.datos;

  // Años únicos desde los registros
  const anios = [...new Set(registros.map(r => r.anio))].sort();
  poblarSelect('filtro-anio', anios);

  // Meses únicos
  const meses = [...new Set(registros.map(r => r.mes))].sort((a, b) => a - b);
  poblarSelect('filtro-mes', meses, m => MESES_LABELS[m]);

  // Áreas, tipos, estados, regiones desde proyectos
  const areas = [...new Set(proyectos.map(p => p.area))].sort();
  poblarSelect('filtro-area', areas);

  const tipos = [...new Set(proyectos.map(p => p.tipo))].sort();
  poblarSelect('filtro-tipo', tipos);

  const estados_proy = [...new Set(proyectos.map(p => p.estado))].sort();
  poblarSelect('filtro-estado', estados_proy);

  const regiones = [...new Set(proyectos.map(p => p.region))].sort();
  poblarSelect('filtro-region', regiones);
}

/**
 * Pobla un <select> con opciones
 * @param {string} id - ID del elemento select
 * @param {Array}  valores - array de valores
 * @param {Function} [labelFn] - función para transformar el valor en etiqueta
 */
function poblarSelect(id, valores, labelFn = v => v) {
  const sel = document.getElementById(id);
  if (!sel) return;
  valores.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = labelFn(v);
    sel.appendChild(opt);
  });
}

/* ================================================================
   3. FILTRADO DE DATOS
   ================================================================
   Retorna los registros y proyectos que pasan todos los filtros activos.
   La lógica: join registro → proyecto por id_proyecto, luego filtrar.
   ================================================================ */
function filtrarDatos() {
  const { proyectos, registros } = estado.datos;
  const f = estado.filtros;

  // Mapa rápido de proyecto por ID
  const proyMap = Object.fromEntries(proyectos.map(p => [p.id, p]));

  // Filtrar registros
  const registrosFilt = registros.filter(reg => {
    const proy = proyMap[reg.id_proyecto];
    if (!proy) return false;

    // Cada condición: si el filtro está vacío ("") se ignora (AND implícito)
    if (f.anio       && reg.anio !== parseInt(f.anio))    return false;
    if (f.mes        && reg.mes  !== parseInt(f.mes))     return false;
    if (f.area       && proy.area    !== f.area)          return false;
    if (f.tipo       && proy.tipo    !== f.tipo)          return false;
    if (f.estadoProy && proy.estado  !== f.estadoProy)    return false;
    if (f.region     && proy.region  !== f.region)        return false;

    return true;
  });

  // Proyectos únicos en los registros filtrados
  const idsFiltrados = [...new Set(registrosFilt.map(r => r.id_proyecto))];
  const proyectosFilt = proyectos.filter(p => idsFiltrados.includes(p.id));

  return { registrosFilt, proyectosFilt, proyMap };
}

/* ================================================================
   4. CÁLCULO DE KPIs
   ================================================================ */
function calcularKPIs(registrosFilt, proyectosFilt) {
  const totalPresupuestado = registrosFilt.reduce((s, r) => s + r.presupuestado, 0);
  const totalEjecutado     = registrosFilt.reduce((s, r) => s + r.ejecutado, 0);
  const pctEjecucion       = totalPresupuestado > 0
                             ? (totalEjecutado / totalPresupuestado * 100)
                             : 0;

  // Proyectos activos = estado "En ejecución" dentro del set filtrado
  const activos = proyectosFilt.filter(p => p.estado === 'En ejecución').length;

  return { totalPresupuestado, totalEjecutado, pctEjecucion, activos };
}

/* ================================================================
   5. FORMATEO DE NÚMEROS
   ================================================================ */
function fmtUSD(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtPct(v) { return `${v.toFixed(1)}%`; }

/* ================================================================
   6. RENDER DE KPIs EN EL DOM
   ================================================================ */
function renderKPIs({ totalPresupuestado, totalEjecutado, pctEjecucion, activos }) {
  setText('kpi-presupuestado', fmtUSD(totalPresupuestado));
  setText('kpi-ejecutado',     fmtUSD(totalEjecutado));
  setText('kpi-pct',           fmtPct(pctEjecucion));
  setText('kpi-activos',       activos);

  // Sub-texto dinámico en % ejecución
  const diff = totalEjecutado - totalPresupuestado;
  const subEl = document.getElementById('kpi-pct-sub');
  if (subEl) {
    if (diff > 0) {
      subEl.textContent = `▲ ${fmtUSD(Math.abs(diff))} sobre presupuesto`;
      subEl.style.color = 'var(--red-alert)';
    } else if (diff < 0) {
      subEl.textContent = `▼ ${fmtUSD(Math.abs(diff))} bajo presupuesto`;
      subEl.style.color = 'var(--teal)';
    } else {
      subEl.textContent = 'Exactamente en presupuesto';
      subEl.style.color = 'var(--text-secondary)';
    }
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ================================================================
   7. PREPARACIÓN DE DATOS POR AGRUPACIÓN
   ================================================================ */

/** Agrupa registros por campo de proyecto y suma presupuestado/ejecutado */
function agruparPorCampoProy(registrosFilt, proyMap, campo) {
  const acc = {};
  registrosFilt.forEach(reg => {
    const proy = proyMap[reg.id_proyecto];
    const clave = proy ? proy[campo] : 'N/A';
    if (!acc[clave]) acc[clave] = { presupuestado: 0, ejecutado: 0 };
    acc[clave].presupuestado += reg.presupuestado;
    acc[clave].ejecutado     += reg.ejecutado;
  });
  return acc;
}

/** Agrupa por año+mes para la línea temporal */
function agruparPorMes(registrosFilt) {
  const acc = {};
  registrosFilt.forEach(reg => {
    const key = `${reg.anio}-${String(reg.mes).padStart(2,'0')}`;
    if (!acc[key]) acc[key] = { label: `${MESES_LABELS[reg.mes]} ${reg.anio}`, ejecutado: 0, presupuestado: 0 };
    acc[key].ejecutado     += reg.ejecutado;
    acc[key].presupuestado += reg.presupuestado;
  });
  return Object.entries(acc).sort(([a], [b]) => a.localeCompare(b));
}

/** Top 10 proyectos por ejecutado total (o sobre-ejecución) */
function top10Proyectos(registrosFilt, proyMap) {
  const acc = {};
  registrosFilt.forEach(reg => {
    if (!acc[reg.id_proyecto]) acc[reg.id_proyecto] = { presupuestado: 0, ejecutado: 0 };
    acc[reg.id_proyecto].presupuestado += reg.presupuestado;
    acc[reg.id_proyecto].ejecutado     += reg.ejecutado;
  });

  return Object.entries(acc)
    .map(([id, { presupuestado, ejecutado }]) => ({
      id,
      proy: proyMap[id],
      presupuestado,
      ejecutado,
      pct: presupuestado > 0 ? (ejecutado / presupuestado * 100) : 0,
    }))
    .sort((a, b) => b.ejecutado - a.ejecutado)
    .slice(0, 10);
}

/* ================================================================
   8. RENDER DE GRÁFICOS CON CHART.JS
   ================================================================ */

/** Configuración base compartida para los gráficos */
function baseChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#8b95b3',
          font: { family: 'DM Sans', size: 11 },
          boxWidth: 10,
          padding: 14,
        },
      },
      tooltip: {
        backgroundColor: '#1e2433',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        titleColor: '#f0f4ff',
        bodyColor: '#8b95b3',
        padding: 10,
        callbacks: {
          label: ctx => ` ${fmtUSD(ctx.raw)}`,
        },
      },
    },
    scales: {
      x: {
        ticks:  { color: '#555e7a', font: { family: 'DM Sans', size: 10 } },
        grid:   { color: 'rgba(255,255,255,0.04)' },
      },
      y: {
        ticks:  { color: '#555e7a', font: { family: 'DM Sans', size: 10 },
                  callback: v => fmtUSD(v) },
        grid:   { color: 'rgba(255,255,255,0.04)' },
      },
    },
  };
}

/** Destruye instancia existente y crea nueva */
function crearChart(key, canvasId, config) {
  if (charts[key]) { charts[key].destroy(); charts[key] = null; }
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  charts[key] = new Chart(canvas, config);
}

/* ── 8a. Barras por Área Responsable ── */
function renderChartArea(registrosFilt, proyMap) {
  const agrupado = agruparPorCampoProy(registrosFilt, proyMap, 'area');
  const labels = Object.keys(agrupado);
  const pres   = labels.map(k => agrupado[k].presupuestado);
  const ejec   = labels.map(k => agrupado[k].ejecutado);

  if (labels.length === 0) {
    mostrarVacio('canvas-area'); return;
  }

  const opts = baseChartOptions();
  opts.indexAxis = 'y';  // barras horizontales
  opts.plugins.tooltip.callbacks.label = ctx => ` ${fmtUSD(ctx.raw)}`;

  crearChart('area', 'canvas-area', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Presupuestado',
          data: pres,
          backgroundColor: 'rgba(250,185,60,0.25)',
          borderColor: COLORS.gold,
          borderWidth: 1.5,
          borderRadius: 4,
        },
        {
          label: 'Ejecutado',
          data: ejec,
          backgroundColor: 'rgba(45,212,191,0.25)',
          borderColor: COLORS.teal,
          borderWidth: 1.5,
          borderRadius: 4,
        },
      ],
    },
    options: opts,
  });
}

/* ── 8b. Doughnut por Tipo de CAPEX ── */
function renderChartTipo(registrosFilt, proyMap) {
  const agrupado = agruparPorCampoProy(registrosFilt, proyMap, 'tipo');
  const labels = Object.keys(agrupado);
  const ejec   = labels.map(k => agrupado[k].ejecutado);

  if (labels.length === 0) {
    mostrarVacio('canvas-tipo'); return;
  }

  crearChart('tipo', 'canvas-tipo', {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: ejec,
        backgroundColor: PALETTE.slice(0, labels.length).map(c => c + '55'),
        borderColor:      PALETTE.slice(0, labels.length),
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#8b95b3',
            font: { family: 'DM Sans', size: 10 },
            boxWidth: 10,
            padding: 10,
          },
        },
        tooltip: {
          backgroundColor: '#1e2433',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#f0f4ff',
          bodyColor: '#8b95b3',
          padding: 10,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${fmtUSD(ctx.raw)}`,
          },
        },
      },
    },
  });
}

/* ── 8c. Línea temporal por mes ── */
function renderChartLinea(registrosFilt) {
  const series = agruparPorMes(registrosFilt);

  if (series.length === 0) {
    mostrarVacio('canvas-linea'); return;
  }

  const labels = series.map(([, v]) => v.label);
  const ejec   = series.map(([, v]) => v.ejecutado);
  const pres   = series.map(([, v]) => v.presupuestado);

  const opts = baseChartOptions();
  opts.elements = {
    point: { radius: 4, hoverRadius: 7, borderWidth: 2 },
    line:  { tension: 0.35 },
  };

  crearChart('linea', 'canvas-linea', {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'CAPEX Ejecutado',
          data: ejec,
          borderColor: COLORS.teal,
          backgroundColor: 'rgba(45,212,191,0.06)',
          fill: true,
          pointBackgroundColor: COLORS.teal,
          pointBorderColor: '#1e2433',
        },
        {
          label: 'CAPEX Presupuestado',
          data: pres,
          borderColor: COLORS.gold,
          borderDash: [5, 4],
          backgroundColor: 'transparent',
          pointBackgroundColor: COLORS.gold,
          pointBorderColor: '#1e2433',
        },
      ],
    },
    options: opts,
  });
}

/* ── 8d. Barras Presupuestado vs Ejecutado por proyecto (Top 8) ── */
function renderChartPresupuesto(registrosFilt, proyMap) {
  const top = top10Proyectos(registrosFilt, proyMap).slice(0, 8);

  if (top.length === 0) {
    mostrarVacio('canvas-presupuesto'); return;
  }

  const labels = top.map(t => t.id);
  const pres   = top.map(t => t.presupuestado);
  const ejec   = top.map(t => t.ejecutado);
  const opts   = baseChartOptions();

  crearChart('presupuesto', 'canvas-presupuesto', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Presupuestado',
          data: pres,
          backgroundColor: 'rgba(250,185,60,0.2)',
          borderColor: COLORS.gold,
          borderWidth: 1.5,
          borderRadius: 4,
        },
        {
          label: 'Ejecutado',
          data: ejec,
          backgroundColor: ejec.map((e, i) =>
            e > pres[i] ? 'rgba(248,113,113,0.25)' : 'rgba(45,212,191,0.25)'),
          borderColor: ejec.map((e, i) =>
            e > pres[i] ? COLORS.red : COLORS.teal),
          borderWidth: 1.5,
          borderRadius: 4,
        },
      ],
    },
    options: opts,
  });
}

/* ── Auxiliar: mostrar canvas vacío ── */
function mostrarVacio(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const parent = canvas.parentElement;
  canvas.style.display = 'none';

  // Eliminar vacío previo si existe
  const prev = parent.querySelector('.empty-state');
  if (prev) prev.remove();

  const div = document.createElement('div');
  div.className = 'empty-state';
  div.innerHTML = `<div class="empty-state-icon">📊</div>
    <div class="empty-state-text">Sin datos para los filtros seleccionados</div>`;
  parent.appendChild(div);
}

/* ── Auxiliar: restaurar canvas ── */
function restaurarCanvas(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  canvas.style.display = '';
  const parent = canvas.parentElement;
  const prev = parent.querySelector('.empty-state');
  if (prev) prev.remove();
}

/* ================================================================
   9. RENDER DE LA TABLA TOP 10
   ================================================================ */
function renderTablaTop10(registrosFilt, proyMap) {
  const top = top10Proyectos(registrosFilt, proyMap);
  const tbody = document.getElementById('tabla-top10-body');
  if (!tbody) return;

  if (top.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem;">
      Sin datos para los filtros seleccionados</td></tr>`;
    return;
  }

  tbody.innerHTML = top.map((item, i) => {
    const proy = item.proy || {};
    const pct  = item.pct;
    const sobreEjec = item.ejecutado > item.presupuestado;

    const progClass = pct >= 90 && !sobreEjec ? 'prog-green'
                    : pct < 50 ? 'prog-red'
                    : sobreEjec ? 'prog-red'
                    : 'prog-yellow';

    const pctColor  = pct >= 90 && !sobreEjec ? 'var(--teal)'
                    : pct < 50 || sobreEjec ? 'var(--red-alert)'
                    : 'var(--gold)';

    const estadoBadge = estadoToBadge(proy.estado || '');

    return `
    <tr>
      <td style="color:var(--text-muted);font-size:0.7rem;">${i + 1}</td>
      <td>
        <div style="font-weight:600;color:var(--text-primary)">${proy.nombre || item.id}</div>
        <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px">${item.id} · ${proy.area || ''}</div>
      </td>
      <td>${estadoBadge}</td>
      <td style="color:var(--text-primary)">${fmtUSD(item.presupuestado)}</td>
      <td style="color:${sobreEjec ? 'var(--red-alert)' : 'var(--text-primary)'}">
        ${fmtUSD(item.ejecutado)}
        ${sobreEjec ? '<span style="font-size:0.65rem;margin-left:4px;color:var(--red-alert)">▲ SOBRE</span>' : ''}
      </td>
      <td class="progress-cell">
        <div class="progress-wrap">
          <div class="progress-bar">
            <div class="progress-fill ${progClass}"
                 style="width:${Math.min(pct, 100).toFixed(0)}%"></div>
          </div>
          <span class="progress-pct" style="color:${pctColor}">${pct.toFixed(0)}%</span>
        </div>
      </td>
      <td style="color:var(--text-muted)">${proy.tipo || ''}</td>
      <td style="color:var(--text-muted)">${proy.responsable || ''}</td>
    </tr>`;
  }).join('');
}

function estadoToBadge(estado) {
  const map = {
    'En ejecución':    ['status-activo',  'En ejecución'],
    'Cerrado':         ['status-cerrado', 'Cerrado'],
    'Pausado':         ['status-pausado', 'Pausado'],
    'En planificación':['status-plan',    'En planificación'],
  };
  const [cls, lbl] = map[estado] || ['status-cerrado', estado];
  return `<span class="status-badge ${cls}">${lbl}</span>`;
}

/* ================================================================
   10. ACTUALIZACIÓN COMPLETA DEL DASHBOARD
   ================================================================ */
function actualizarDashboard() {
  const { registrosFilt, proyectosFilt, proyMap } = filtrarDatos();

  const kpis = calcularKPIs(registrosFilt, proyectosFilt);
  renderKPIs(kpis);

  // Restaurar canvas antes de re-renderizar
  ['canvas-area','canvas-tipo','canvas-linea','canvas-presupuesto']
    .forEach(id => restaurarCanvas(id));

  renderChartArea(registrosFilt, proyMap);
  renderChartTipo(registrosFilt, proyMap);
  renderChartLinea(registrosFilt);
  renderChartPresupuesto(registrosFilt, proyMap);
  renderTablaTop10(registrosFilt, proyMap);
  actualizarChips();
}

/* ================================================================
   11. CHIPS DE FILTROS ACTIVOS
   ================================================================ */
function actualizarChips() {
  const container = document.getElementById('active-filters');
  if (!container) return;

  const f = estado.filtros;
  const labels = {
    anio:       f.anio       ? `Año: ${f.anio}` : null,
    mes:        f.mes        ? `Mes: ${MESES_LABELS[f.mes]}` : null,
    area:       f.area       ? `Área: ${f.area}` : null,
    tipo:       f.tipo       ? `Tipo: ${f.tipo}` : null,
    estadoProy: f.estadoProy ? `Estado: ${f.estadoProy}` : null,
    region:     f.region     ? `Región: ${f.region}` : null,
  };

  const chips = Object.values(labels).filter(Boolean);
  container.innerHTML = chips.map(l =>
    `<span class="filter-chip">🔍 ${l}</span>`
  ).join('');
}

/* ================================================================
   12. EVENT LISTENERS DE FILTROS
   ================================================================ */
function bindFiltros() {
  const selectores = [
    { id: 'filtro-anio',   key: 'anio' },
    { id: 'filtro-mes',    key: 'mes' },
    { id: 'filtro-area',   key: 'area' },
    { id: 'filtro-tipo',   key: 'tipo' },
    { id: 'filtro-estado', key: 'estadoProy' },
    { id: 'filtro-region', key: 'region' },
  ];

  selectores.forEach(({ id, key }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', e => {
      estado.filtros[key] = e.target.value;
      actualizarDashboard();
    });
  });

  // Botón "Limpiar filtros"
  const btnClear = document.getElementById('btn-clear-filters');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      Object.keys(estado.filtros).forEach(k => estado.filtros[k] = '');
      selectores.forEach(({ id }) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      actualizarDashboard();
    });
  }

  // Toggle sidebar en móvil
  const btnToggle = document.getElementById('btn-toggle-filters');
  const sidebar   = document.getElementById('filters-sidebar');
  if (btnToggle && sidebar) {
    btnToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      btnToggle.textContent = sidebar.classList.contains('open')
        ? '▲ Ocultar filtros'
        : '▼ Mostrar filtros';
    });
  }
}

/* ================================================================
   INICIALIZACIÓN
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  bindFiltros();
  cargarDatos();
});
