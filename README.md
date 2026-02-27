# ⛏ Dashboard CAPEX Minero

Dashboard web interactivo y responsive para el monitoreo de inversiones de capital (CAPEX) en proyectos mineros. Construido con HTML, CSS y JavaScript puro + Chart.js.

![Tecnologías](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![Tecnologías](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![Tecnologías](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Tecnologías](https://img.shields.io/badge/Chart.js-FF6384?style=flat&logo=chartdotjs&logoColor=white)

---

## 📋 Descripción

Este dashboard permite a la gerencia de una operación minera:

- **Monitorear el CAPEX** presupuestado vs ejecutado por proyecto, área y tipo de gasto.
- **Identificar proyectos sobre-presupuestados** o con bajo avance de ejecución.
- **Ver la evolución mensual** del CAPEX ejecutado a lo largo del tiempo (2024–2026).
- **Filtrar** los datos por Año, Mes, Área Responsable, Tipo de CAPEX, Estado del Proyecto y Región.

Los datos son simulados con valores realistas para operaciones mineras (montos entre $200K y $5M USD por registro).

---

## 🚀 Cómo ejecutar localmente

> **Importante:** El dashboard carga los datos desde un archivo JSON usando `fetch()`.  
> Debes servirlo desde un servidor local (no funciona abriendo `index.html` directamente con `file://`).

### Opción 1 — Python (recomendado)
```bash
# Desde la carpeta raíz del proyecto:
python -m http.server 8080
# Luego abre en el navegador: http://localhost:8080
```

### Opción 2 — Node.js (npx)
```bash
npx serve .
# Luego sigue el enlace que muestra en consola
```

### Opción 3 — VS Code Live Server
Instala la extensión **Live Server** y haz clic derecho en `index.html` → *Open with Live Server*.

---

## 📂 Estructura de carpetas

```
capex-dashboard/
├── index.html              ← Estructura HTML del dashboard
├── README.md               ← Este archivo
├── css/
│   └── styles.css          ← Todos los estilos (variables, grid, responsive, animaciones)
├── js/
│   └── app.js              ← Lógica JS: filtrado, KPIs, renderizado de gráficos
└── data/
    └── capex_data.json     ← Datos simulados de proyectos y registros CAPEX
```

---

## 🧱 Tecnologías usadas

| Tecnología | Uso |
|---|---|
| **HTML5 semántico** | Estructura del dashboard (header, aside, main, section) |
| **CSS3 + CSS Grid / Flexbox** | Layout responsive 4/2/1 cols, variables CSS, animaciones |
| **JavaScript ES2020 (vanilla)** | Lógica de filtrado, cálculo de KPIs, DOM manipulation |
| **Chart.js v4** | Gráficos: barras, doughnut, línea temporal |
| **Google Fonts** | Barlow Condensed (títulos) + DM Sans (cuerpo) |

---

## 📊 Contenido del dashboard

### Tarjetas KPI
| KPI | Cálculo |
|---|---|
| CAPEX Presupuestado Total | `SUM(registros.presupuestado)` filtrado |
| CAPEX Ejecutado Total | `SUM(registros.ejecutado)` filtrado |
| % Ejecución Global | `Ejecutado / Presupuestado × 100` |
| Proyectos Activos | `COUNT(proyectos WHERE estado = "En ejecución")` |

### Gráficos
- **Barras horizontales** — CAPEX por Área Responsable (Presupuestado vs Ejecutado)
- **Doughnut** — Distribución del ejecutado por Tipo de CAPEX
- **Línea temporal** — Evolución mensual del CAPEX (Ejecutado y Presupuestado)
- **Barras comparativas** — Top 8 proyectos: Presupuestado vs Ejecutado (rojo = sobre-ejecución)

### Tabla Top 10
Proyectos ordenados por monto ejecutado, con barra de progreso coloreada:
- 🟢 Verde: Avance ≥ 90% sin sobre-ejecución
- 🟡 Amarillo: Avance entre 50%–90%
- 🔴 Rojo: Avance < 50% o sobre-ejecución

---

## 🔍 Lógica de filtrado

Los filtros se almacenan en el objeto `estado.filtros`:

```javascript
estado.filtros = {
  anio: '', mes: '', area: '', tipo: '', estadoProy: '', region: ''
}
```

La función `filtrarDatos()` hace un **join implícito** entre `registros` y `proyectos` por `id_proyecto`, luego aplica todas las condiciones activas con `AND`:

```javascript
const registrosFilt = registros.filter(reg => {
  const proy = proyMap[reg.id_proyecto];
  if (f.anio && reg.anio !== parseInt(f.anio)) return false;
  if (f.area && proy.area !== f.area)           return false;
  // ... etc
  return true;
});
```

Cada vez que un `<select>` cambia, se actualiza `estado.filtros` y se llama a `actualizarDashboard()`, que recalcula KPIs, destruye y recrea los gráficos, y vuelve a generar la tabla.

El botón **"Limpiar"** resetea todos los filtros a `''` y restaura la vista global.

---

## 📱 Diseño Responsive

| Dispositivo | Breakpoint | KPIs | Gráficos |
|---|---|---|---|
| Desktop | `> 1200px` | 4 por fila | 4 cols (línea = 2 cols) |
| Tablet | `768–1200px` | 2 por fila | 2 cols (línea = 1 fila entera) |
| Móvil | `< 768px` | 1 por fila | 1 por fila, sidebar colapsado |

---

## 🎨 Paleta de colores

| Color | Uso |
|---|---|
| `#fab93c` Dorado | KPI principal, presupuestado |
| `#2dd4bf` Teal | Ejecutado, proyectos activos |
| `#fb923c` Naranja | % ejecución |
| `#f87171` Rojo | Alertas, sobre-ejecución |
| `#0f1117` Azul oscuro | Fondo base |

---

## 📄 Licencia

Proyecto de demostración con datos simulados. Libre para uso educativo y referencia técnica.
