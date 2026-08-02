# 🛠️ Propuesta de Ajustes — Vista de Requerimientos

**Fecha:** 2026-08-01 · **Fuente:** Auditoría funcional sobre los 70 pendientes reales (real_items.json)

> ✅ **A1–A4 implementados el 2026-08-02** (columna Área usuaria, enlace Sharepoint clicable, estados por defecto ampliados con los 9 reales faltantes y columna Empresa/Proveedor).
> ⏳ **Pendiente:** consolidar las observaciones de los analistas (pegar el contenido de la plantilla `Observaciones_Analistas_Requerimientos.md` completada). Esta propuesta es la **base técnica** validada contra los datos reales.

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
| C1 | **Paginación** (o scroll virtual) | Con ~70+ filas la tabla se vuelve pesada |
| C2 | **Agrupación por área** | Patrón natural de navegación para el analista |
| C3 | **Contador por área usuaria** en chips resumen | Complementa el desglose actual por estado/área |
| C4 | **Exportar incluyendo notas completas** (columna extra en CSV/PDF/XLSX) | Los analistas necesitan el detalle al enviar a OGTI |

---

## 3. Decisiones que requieren validación con los analistas

1. ¿El **flujo de estados** debe ser secuencial obligatorio o libre (actual)?
2. ¿Los analistas deben poder **editar cualquier campo** o solo estado/fecha (rol actual)?
3. ¿Se necesita **historial/auditoría** de cambios de estado (quién y cuándo)?
4. ¿Algún estado del flujo real (OAB, presupuestal, conformidad) debe tener **color/distinción** propia?
5. ¿La **fecha de vencimiento** que se asigna a un requerimiento debe tener un formato o regla especial?

---

*Pendiente: pegar el contenido de la plantilla completada para fusionar las observaciones de los analistas con esta propuesta técnica.*
