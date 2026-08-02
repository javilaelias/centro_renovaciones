# 🛠️ Propuesta de Ajustes — Vista de Requerimientos

**Fecha:** 2026-08-01 · **Fuente:** Auditoría funcional sobre los 70 pendientes reales (real_items.json)

> ✅ **A1–A4 implementados el 2026-08-02** (columna Área usuaria, enlace Sharepoint clicable, estados por defecto ampliados con los 9 reales faltantes y columna Empresa/Proveedor).
> ✅ **B1–B5 implementados el 2026-08-02** (filtro por responsable, filtro por estado servicio, indicador de items sin REQ/Área, tooltip de notas completas y ordenamiento de columnas).
> ✅ **C1–C4 implementados el 2026-08-02** (paginación, agrupación por área, contador por área usuaria y exportación con notas completas).
> ✅ **D1–D2 implementados el 2026-08-02** (columnas Ingreso y Prioridad en la tabla, editables desde el modal, incluidas en las exportaciones).
> ✅ **D3–D4 implementados el 2026-08-02** (filtro por tipo y filtro por rango de costo en la vista de Requerimientos).
> ✅ **D5 implementado el 2026-08-02** (acción duplicar requerimiento desde la tabla).
> ✅ **D6 implementado el 2026-08-02** (exportación con plantilla oficial PDF). **La serie D está completa.**
> ✅ **Serie E implementada el 2026-08-02** (E1 responsable editable, E2 comentarios por ítem, E3 exportar TODOS, E4 fecha de creación, E5 responsive, E6 permisos por rol).
> ✅ **Variante TODOS → Oficial añadida el 2026-08-02** (la plantilla oficial PDF también exporta todos los requerimientos ignorando filtros).
> ✅ **Mapeo de cobertura consolidado el 2026-08-02** (sección 4): cada punto de la plantilla de observaciones de analistas tiene su estado frente a la app actual.
> ⏳ **Pendiente:** recoger la plantilla `Observaciones_Analistas_Requerimientos.md` **completada** por los analistas (instancia de pruebas http://10.118.67.55:3005). Al recibirla, fusionar sus observaciones en la sección 4 y ajustar el plan.

---

## 1. Hallazgos de la auditoría (datos reales)

La vista actual muestra solo: REQ, Requerimiento, Tipo, Área, Responsable, Estado, Costo.
Pero las **notas reales contienen 17+ campos**, muchos sin exponer en la vista:

| Campo en las notas | # de ítems que lo tienen | ¿Visible hoy? |
|---|---|---|
| Servicios | 67 | ❌ No |
| Estado servicio | 65 | ❌ No |
| Área usuaria | 59 | ❌ No |
| Comentarios servicio (enlace Sharepoint) | **56** | ❌ No (enlace no clicable) |
| Comentarios | 35 | ❌ No |
| Ejecución (responsable de ejecución) | 32 | ❌ No |
| Empresa / proveedor | 31 | ❌ No |
| Periodo renovación / Monto total / Riesgo | 3 | ❌ No |

**Otros hallazgos:**
- **18 estados reales distintos en los datos** (3 ítems sin estado asignado), pero la lista por defecto solo tiene **11** — estados reales que faltan por defecto: `Revisión OAB` (5), `Sin tramitar` (4), `Revisión área usuaria` (2), `En elaboración` (2), `Estudio de Mercado` (1), `Evaluación de Propuestas` (1), `En ejecución` (1), `Por suscribir contrato` (1), `Contratado` (1)
- ⚠️ **Dato de calidad:** los datos usan `En tramite` (sin tilde) mientras la lista por defecto tiene `En trámite` y `En tramite` como dos estados separados — conviene normalizar acentos para no dividir filtros/chips
- **5 ítems sin código REQ** y **5 sin Área**
- **56 de 70** tienen enlace Sharepoint que hoy no se puede abrir desde la tabla

---

## 2. Ajustes propuestos (ordenados por prioridad)

### 🔴 Alta — completar el flujo funcional
| # | Ajuste | Justificación | Estado |
|---|---|---|---|
| A1 | **Columna "Área usuaria"** | Dato clave para el analista (quién usa el servicio); presente en 59/70 | ✅ Hecho |
| A2 | **Enlace Sharepoint clicable** en la columna Comentarios/Adjunto | 56/70 tienen el enlace; hoy inaccesible desde la vista | ✅ Hecho (columna Adjunto) |
| A3 | **Ampliar estados por defecto** con los 9 reales faltantes (`Revisión OAB`, `Sin tramitar`, `Estudio de Mercado`, `Contratado`, etc.) | El desplegable y los chips no reflejan la realidad sin configuración manual | ✅ Hecho (con migración automática) |
| A4 | **Columna "Empresa / Proveedor"** | Presente en 31/70; útil para seguimiento de contratos | ✅ Hecho |

### 🟡 Media — enriquecer análisis
| # | Ajuste | Justificación |
|---|---|---|
| B1 | **Filtro por Responsable** | Datos tienen responsable en 65/70; hoy solo se busca por texto |
| B2 | **Filtro por "Estado servicio"** | 65/70 lo tienen; distingue avance técnico vs. trámite |
| B3 | **Filtro / indicador de ítems sin REQ y sin Área** | 5+5 ítems invisibles en filtros de "Todos" |
| B4 | **Tooltip o vista de detalle** con las notas completas al pasar el cursor | Hoy las notas largas no se leen desde la tabla |
| B5 | **Ordenar columnas** (clic en encabezado) | Para priorizar por costo, área, responsable |

### 🟢 Baja — pulido y escalabilidad
| # | Ajuste | Justificación |
|---|---|---|
| C1 | **Paginación** (o scroll virtual) | Con ~70+ filas la tabla se vuelve pesada | ✅ Hecho (10/25/50/Todos con persistencia) |
| C2 | **Agrupación por área** | Patrón natural de navegación para el analista | ✅ Hecho (toggle + filas de grupo) |
| C3 | **Contador por área usuaria** en chips resumen | Complementa el desglose actual por estado/área | ✅ Hecho (chips clicables con filtro) |
| C4 | **Exportar incluyendo notas completas** (columna extra en CSV/PDF/XLSX) | Los analistas necesitan el detalle al enviar a OGTI | ✅ Hecho |

---

## 3. Decisiones que requieren validación con los analistas

1. ¿El **flujo de estados** debe ser secuencial obligatorio o libre (actual)? *(ya es configurable en Configuración → flujo secuencial)*
2. ¿Los analistas deben poder **editar cualquier campo** o solo estado/fecha (rol actual)?
3. ¿Se necesita **historial/auditoría** de cambios de estado (quién y cuándo)? *(ya existe historial de estados por ítem)*
4. ¿Algún estado del flujo real (OAB, presupuestal, conformidad) debe tener **color/distinción** propia? *(ya tienen colores propios: purple/cyan/amber…)*
5. ¿La **fecha de vencimiento** que se asigna a un requerimiento debe tener un formato o regla especial?

---

## 4. Cobertura de la plantilla de observaciones de analistas

Mapa de los puntos que evalúa la plantilla `Observaciones_Analistas_Requerimientos.md` frente a la app actual. **Leyenda:** ✅ cubierto · 🟡 cubierto con matiz · ⬜ pendiente de validación con analistas.

| Punto de la plantilla | Qué evalúa | Cobertura actual |
|---|---|---|
| 1.1 | Columnas (REQ, Requerimiento, Tipo, Área, Responsable, Estado, Costo) | ✅ Cubierto y ampliado: + Área usuaria, Ingreso, Estado servicio, Prioridad, Empresa/Proveedor, Hoja de ruta, Adjunto, Notas completas (15 columnas) |
| 1.2 | ¿Falta alguna columna? (fecha de ingreso, prioridad, enlace a documento) | 🟡 Enlace a documento = columna Adjunto (A2). **Fecha de ingreso y prioridad** no existen en los datos → candidatos D1/D2 |
| 1.3 | Datos de Tipo/Área/Responsable/Estado se leen bien de las notas | ✅ parseo validado contra los 70 pendientes reales |
| 1.4 | Requerimientos sin código REQ se identifican | ✅ Badge "Sin REQ" + chip "Datos incompletos" (B3) |
| 1.5 | Orden por código REQ esperado | ✅ Por defecto REQ asc; ordenable por cualquier columna (B5) |
| 2.1 | Búsqueda por nombre, REQ, área, responsable, estado, tipo | ✅ Incluye además estado servicio, empresa y área usuaria; insensible a acentos |
| 2.2 / 2.3 | Filtros por Estado y Área | ✅ Selects + chips resumen |
| 2.4 | Chips resumen (Por estado / Por área) útiles y con conteos correctos | ✅ 5 grupos: estado, área, área usuaria, estado servicio, datos incompletos |
| 2.5 | ¿Faltan filtros? (responsable, tipo, rango de costo, fecha de creación) | ✅ Responsable (B1), Tipo (D3), rango de costo (D4). **Fecha de creación ⬜ (no existe en los datos; campo editable añadido en E4)** |
| 3.1 | Cambio rápido de Estado persiste | ✅ Select inline + historial |
| 3.2 | Lista de estados adecuada y en orden lógico | ✅ 19 estados por defecto (A3), personalizables, flujo secuencial opcional |
| 3.3 | Asignar fecha de vencimiento saca el ítem de pendientes | ✅ Input de fecha en la fila |
| 3.4 | Editar (modal) completo: notas, costo, proveedor | ✅ Modal completo + tooltip de notas (B4) |
| 3.5 | Eliminar pide confirmación | ✅ Confirmación; además solo visible para admin |
| 3.6 | ¿Faltan acciones? (comentarios, duplicar, asignar responsable, prioridad) | ✅ Historial, duplicar (D5), prioridad (D2). **Comentarios ✅ (E2) y responsable editable ✅ (E1)** |
| 4.1–4.3 | Exportación CSV/PDF/XLSX de datos filtrados | ✅ Filtros aplicados + notas completas (C4) + Estado servicio |
| 4.4 | ¿Faltan formatos? (exportar TODOS, plantilla oficial) | ✅ **Exportar TODOS ignorando filtros (E3, CSV/PDF/XLSX)** + plantilla oficial (D6) con su propia variante **TODOS → Oficial** (exporta todos ignorando filtros; el reporte indica que se ignoraron los filtros activos) |
| 5.1 / 5.2 | Estados personalizables desde Configuración | ✅ Editor de estados + flujo, con migración automática |
| 5.3 | ¿Flujo secuencial obligatorio? | 🟡 Opcional configurable (desactivado por defecto) — validar con analistas (decisión 1) |
| 6.1 | Carga rápida con ~70 filas | ✅ Paginación (C1) + orden/agrupación |
| 6.2 | Uso en pantallas pequeñas | ✅ **Responsive mejorado (E5)**: filtros apilados, costos flex, acciones envolventes |
| 6.3 | Mensajes de éxito/error claros | ✅ Toasts en todas las acciones |
| 6.4 | Título y contador (X de Y) comprensibles | ✅ "X de Y ítems" + contador por grupo |
| 6.5 | ¿Paginación o agrupación? | ✅ Ambas: paginación (C1) y agrupación por área (C2) |
| 7.1 / 7.2 | Registro con Gmail y login posterior | ✅ Registro de analistas + login |
| 7.3 | Rol analista con permisos distintos al admin | ✅ **Analista solo estado/fecha en requerimientos (E6)**: edición completa y eliminación exclusivas de admin (frontend + servidor 403) |

**Cobertura:** 31/31 puntos con al menos cobertura parcial · 24 ✅ · 7 🟡 · 0 ⬜

> **Cómo se fusionará:** cuando la plantilla regrese completada, cada observación ✏️ se insertará en la fila correspondiente de esta tabla (columna "Observación del analista") y los ajustes nuevos pasarán a la sección de candidatos D.

## 5. Candidatos a mejoras futuras (series D y E)

Derivados de las preguntas abiertas de la plantilla (no bloqueantes; a priorizar cuando lleguen las observaciones):

| # | Candidato | Origen en la plantilla |
|---|---|---|
| D1 | Columna **Fecha de ingreso** del requerimiento | 1.2 | ✅ Implementado 2026-08-02 |
| D2 | Campo/columna de **Prioridad** (alta/media/baja) | 1.2, 3.6 | ✅ Implementado 2026-08-02 |
| D3 | Filtro por **Tipo** | 2.5 | ✅ Implementado 2026-08-02 |
| D4 | Filtro por **rango de costo** (fecha de creación: no aplica, no existe en los datos) | 2.5 | ✅ Implementado 2026-08-02 |
| D5 | Acción **duplicar requerimiento** | 3.6 | ✅ Implementado 2026-08-02 |
| D6 | Exportación con **plantilla/formatos oficiales** de la entidad | 4.4 | ✅ Implementado 2026-08-02 (+ **variante TODOS → Oficial** 2026-08-02) |
| E1 | Campo **Responsable** editable (datalist con los 12 reales) | 3.6 | ✅ Implementado 2026-08-02 |
| E2 | **Comentarios por requerimiento** (panel + historial en notas) | 3.6 | ✅ Implementado 2026-08-02 |
| E3 | **Exportar TODOS** los pendientes ignorando filtros (CSV/PDF/XLSX) | 4.4 | ✅ Implementado 2026-08-02 |
| E4 | Campo/columna **Fecha de creación** (editable, ordenable y exportado) | 2.5 | ✅ Implementado 2026-08-02 |
| E5 | **Responsive** de la vista Requerimientos (filtros, costos, exportaciones) | 6.2 | ✅ Implementado 2026-08-02 |
| E6 | **Permisos por rol**: analista solo estado/fecha en requerimientos; edición completa y eliminación exclusivas de admin (frontend + 403 en servidor) | 7.3 | ✅ Implementado 2026-08-02 |

**Serie E completa.** Tabla de Requerimientos: 16 columnas (REQ · Requerimiento · Ingreso · **Creado** · Tipo · Área · Área usuaria · Responsable · Estado · Estado servicio · Prioridad · Empresa/Proveedor · Costo · Hoja de ruta · Adjunto · Acciones).

---

*Pendiente: recibir la plantilla completada de los analistas para fusionar sus observaciones (sección 4) y priorizar futuras series.*
