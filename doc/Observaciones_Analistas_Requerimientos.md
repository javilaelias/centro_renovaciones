# 📋 Observaciones de Analistas — Vista de Requerimientos

**Instancia de pruebas:** http://10.118.67.55:3005
**Objetivo:** Evaluar la vista **Requerimientos** (Gestión de pendientes) y recopilar observaciones para ajustes funcionales.

**Analista:** ____________________ **Área:** ____________________ **Fecha:** ______________

---

## Cómo acceder

1. Entra a **http://10.118.67.55:3005**
2. En la pantalla de login, pulsa **"Registrarme con Gmail"**
3. Usa tu correo **@gmail.com**, un nombre (opcional) y una contraseña (mín. 6 caracteres)
4. Dentro de la app, pulsa la pestaña **"Requerimientos"** (tercera pestaña, arriba de la lista)

---

## 1. Columnas y datos mostrados

| # | Aspecto a evaluar | ✅ OK | ⚠️ Mejorable | ✏️ Observación |
|---|---|---|---|---|
| 1.1 | Las columnas (REQ, Requerimiento, Tipo, Área, Responsable, Estado, Costo) cubren lo necesario | | | |
| 1.2 | ¿Falta alguna columna? (ej. fecha de ingreso, prioridad, enlace a documento) | | | |
| 1.3 | Los datos de Tipo/Área/Responsable/Estado se leen correctamente desde las notas | | | |
| 1.4 | Los requerimientos sin código REQ se identifican bien ("Sin REQ") | | | |
| 1.5 | El orden (por código REQ) es el esperado | | | |

## 2. Búsqueda y filtros

| # | Aspecto a evaluar | ✅ OK | ⚠️ Mejorable | ✏️ Observación |
|---|---|---|---|---|
| 2.1 | La búsqueda por texto encuentra por nombre, REQ, área, responsable, estado y tipo | | | |
| 2.2 | El filtro por **Estado** funciona correctamente | | | |
| 2.3 | El filtro por **Área** funciona correctamente | | | |
| 2.4 | Los **chips resumen** (Por estado / Por área) son útiles y sus conteos son correctos | | | |
| 2.5 | ¿Faltan filtros? (ej. por responsable, por tipo, por rango de costo, por fecha de creación) | | | |

## 3. Acciones sobre cada requerimiento

| # | Aspecto a evaluar | ✅ OK | ⚠️ Mejorable | ✏️ Observación |
|---|---|---|---|---|
| 3.1 | Cambio rápido de **Estado** desde la tabla funciona y persiste | | | |
| 3.2 | La lista de estados disponibles es adecuada y en orden lógico | | | |
| 3.3 | Asignar **fecha de vencimiento** (saca el ítem de pendientes) es claro | | | |
| 3.4 | **Editar** el requerimiento (modal) es completo (notas, costo, proveedor) | | | |
| 3.5 | **Eliminar** pide confirmación | | | |
| 3.6 | ¿Faltan acciones? (ej. agregar comentarios/historial, duplicar, asignar responsable, marcar prioridad) | | | |

## 4. Exportación

| # | Aspecto a evaluar | ✅ OK | ⚠️ Mejorable | ✏️ Observación |
|---|---|---|---|---|
| 4.1 | **CSV** exporta los datos filtrados correctamente | | | |
| 4.2 | **PDF** genera un reporte presentable | | | |
| 4.3 | **Excel (.xlsx)** abre bien en Excel y las columnas se ven bien | | | |
| 4.4 | ¿Faltan formatos? (ej. exportar TODOS aunque haya filtros, plantilla con formato oficial) | | | |

## 5. Estados personalizables

| # | Aspecto a evaluar | ✅ OK | ⚠️ Mejorable | ✏️ Observación |
|---|---|---|---|---|
| 5.1 | Desde **Configuración → Estados de Requerimientos** se pueden agregar/quitar estados | | | |
| 5.2 | El cambio de estados se refleja en la vista Requerimientos y en el desplegable rápido | | | |
| 5.3 | ¿Se necesita un flujo de estados secuencial obligatorio? (ej. solo avanzar en cierto orden) | | | |

## 6. Usabilidad general

| # | Aspecto a evaluar | ✅ OK | ⚠️ Mejorable | ✏️ Observación |
|---|---|---|---|---|
| 6.1 | La página carga rápido incluso con ~70 filas | | | |
| 6.2 | En pantallas pequeñas la tabla se usa sin problemas | | | |
| 6.3 | Los mensajes de éxito/error son claros | | | |
| 6.4 | El título y el contador (X de Y ítems) son comprensibles | | | |
| 6.5 | ¿Se necesita paginación o agrupación (ej. por área) cuando hay muchos requerimientos? | | | |

## 7. Acceso de analistas (registro con Gmail)

| # | Aspecto a evaluar | ✅ OK | ⚠️ Mejorable | ✏️ Observación |
|---|---|---|---|---|
| 7.1 | El registro con correo @gmail.com funciona (crea cuenta y entra) | | | |
| 7.2 | El login posterior con el mismo correo funciona | | | |
| 7.3 | ¿El rol de analista debería tener permisos distintos al admin? (ej. solo lectura, sin eliminar) | | | |

---

## ✍️ Observaciones adicionales (libre)

```
[Escribe aquí cualquier comentario, idea o problema que no esté cubierto arriba]
```

---

## Priorización sugerida

| Prioridad | Descripción del ajuste | Requerimiento(s) |
|---|---|---|
| 🔴 Alta | | |
| 🟡 Media | | |
| 🟢 Baja | | |

*Gracias por tu colaboración. Devuelve este documento completado al equipo para consolidar los ajustes.*
