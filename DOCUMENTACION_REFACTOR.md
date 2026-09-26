# Documentación de Refactorización - Proyecto Ágiles

Este documento detalla las refactorizaciones aplicadas por el equipo de desarrollo para mejorar la mantenibilidad, escalabilidad y calidad del código, siguiendo estrictamente los principios de diseño de software (SOLID, DRY, KISS, etc.) sin incurrir en sobreingeniería.

---

## 🧍 Bryan Quitto
**Dominio:** Emergencias y Despacho (Core Flow)

### Problema Inicial
Los componentes principales (`GuardDashboard.tsx` e `IncidentReportForm.tsx`) eran "God Components" (componentes dios) con más de 500 líneas de código cada uno. Mezclaban responsabilidades por completo: dibujaban la interfaz gráfica, se conectaban mediante WebSockets, realizaban peticiones directas a la base de datos (Supabase), solicitaban permisos del navegador y ejecutaban lógica compleja de geolocalización. Esto los hacía sumamente rígidos, difíciles de leer, y propensos a generar estados desincronizados en la vista.

### Principios Aplicados y Razones

1. **SRP (Principio de Responsabilidad Única) y KISS:**
   - **Por qué se aplicó:** Tener lógica de negocio y visual en el mismo archivo impedía la reutilización. Si necesitábamos usar el GPS en otra pantalla, tendríamos que haber duplicado el código. Además, cualquier cambio visual tenía el riesgo de romper operaciones críticas de base de datos.
   - **Cómo se aplicó:** Se aislaron las APIs del navegador y la lógica de negocio en *custom hooks*, dejando a los componentes visuales enfocados exclusivamente en manejar eventos de usuario (clicks, formularios) y dibujar la pantalla de forma simple.

2. **ISP (Segregación de Interfaces) y Encapsulamiento:**
   - **Por qué se aplicó:** Componentes y listas pequeñas de la interfaz recibían el objeto gigante completo del modelo de datos de la base de datos (incluso si la interfaz de usuario no requería gran parte de esos datos).
   - **Cómo se aplicó:** El filtrado, saneamiento y cruce de datos ahora sucede en el controlador (el *hook*), proveyendo a la vista únicamente de la información estricta que necesita renderizar.

3. **Prevención de Estados Ilegales (Illegal States):**
   - **Por qué se aplicó:** El dashboard mantenía variables de estado booleanas y numéricas desconectadas (`currentIncidentId`, `activeAlerts`, `confirmCloseId`). Esto podía causar "bugs silenciosos" donde la interfaz asegurara tener un caso activo, pero la variable de alertas activas no lo tuviera registrado.
   - **Cómo se aplicó:** Se unificó este estado volátil dentro de un manejador central (`useGuardActions`). Ahora es imposible que una alerta se muestre de manera ilógica en pantalla, ya que el estado se actualiza en bloque.

### Resumen de Cambios en el Código

- **`src/services/incidentService.ts`:** Mover los llamados directos a Supabase (como inserciones y actualizaciones) que estaban pegados en los archivos `.tsx` hacia este servicio dedicado. Ahora la interfaz no sabe ni le importa qué base de datos hay detrás.
- **`src/components/Student/IncidentReportForm.tsx`:** Se extrajo toda la lógica de obtención de coordenadas al nuevo hook **`useGeolocation.ts`**.
- **`src/components/Guard/GuardDashboard.tsx`:** Se extrajo el pesado bloque de lógica de toma de incidentes, cierre de casos y peticiones de datos al hook **`useGuardActions.ts`**. Así también, la petición de notificaciones al navegador fue movida a **`useNotificationPermission.ts`**.

---

## Jose Sanchez

### Problema inicial

Los servicios convertían fallos de red o de Supabase en listas vacías, `null`, `false` o contadores en cero. La interfaz confundía una consulta fallida con la ausencia de datos. Algunas escrituras devolvían éxito aunque no afectaran filas; la campana ignoraba el resultado de las invitaciones. La creación del grupo y su administrador eran dos peticiones independientes, y aceptar una invitación separaba la membresía del estado de la solicitud.

### Principios aplicados y razones

1. **Fail Fast:** los errores técnicos se propagan desde los repositorios hasta la interfaz. `[]` representa una lectura exitosa sin registros, `null` representa ausencia y `false` una escritura sin filas o un envío sin destinatarios. Las validaciones esperadas conservan `TrustGroupResult`, con `success` y `message`. No se muestran detalles internos de Supabase al usuario.
2. **Atomicidad / prevención de estados incompletos:** la migración `20260926223000_miembro2_atomicidad.sql` incorpora dos triggers PostgreSQL. Insertar un grupo también inserta al creador como administrador dentro de la misma transacción. Aceptar una invitación también inserta la membresía dentro de la actualización. Si falla el trigger, PostgreSQL revierte toda la sentencia. No se usa una compensación desde el navegador, que también podría fallar.
3. **DRY:** `markNotificationAsRead` pasa a ser un alias de `markGroupNotificationRead`. La consulta vive solamente en el repositorio. Se elimina también la consulta directa a Supabase desde `trustGroupService`: reutiliza `listMembers`.
4. **DIP e ISP:** `createNotificationService` recibe contratos estructurales reducidos para notificaciones, grupos y usuarios. Usa importaciones exclusivamente de tipos; se puede probar sin inicializar Supabase ni configurar `.env`. `notificationService.ts` compone las dependencias reales y conserva los nombres públicos existentes.
5. **KISS:** se reutilizan repositorios, estados y componentes existentes. No se añade un contenedor de inyección, una jerarquía de clases ni una biblioteca de estado.

### Cambios por archivo

| Archivo | Cambio y comportamiento |
| --- | --- |
| `src/services/trustGroupService.ts` | Propaga errores; valida nombre y rol del invitador; elimina las inserciones separadas de administrador y membresía; comprueba el resultado de la respuesta; impide eliminar al único administrador desde este servicio. |
| `src/services/createNotificationService.ts` | Fábrica independiente de Supabase con dependencias inyectables y contratos reducidos. |
| `src/services/notificationService.ts` | Composición de la fábrica con los repositorios reales; mantiene la API de funciones exportadas. |
| `src/db/trustGroupsRepo.ts` | Las escrituras lanzan errores y comprueban filas afectadas. Responder actualiza únicamente solicitudes pendientes. |
| `src/db/notificationsRepo.ts` | No oculta errores de escritura y detecta IDs inexistentes. Envía una fila por grupo: el esquema no tiene destinatario individual, por lo que insertar una por miembro duplicaba el aviso. |
| `src/components/TrustGroupList.tsx` | Estado de error y reintento, con manejo de errores al eliminar; muestra el resultado también en los detalles del grupo. |
| `src/components/TrustGroupForm.tsx` | Captura errores técnicos y libera el botón mediante `finally`; conserva el formulario cuando falla. |
| `src/components/GroupMemberManager.tsx` | Maneja fallos al invitar y libera el estado de envío. |
| `src/components/GroupMembersView.tsx` | Distingue error de lista vacía; permite reintentar y captura fallos de eliminación. |
| `src/components/NotificationBell.tsx` | Maneja fallos de carga y escritura; revisa `success` de invitaciones; deja de actualizar contadores como si una operación fallida hubiera funcionado. |
| `src/components/NotificationPanel.tsx` | Muestra carga, error y reintento; deshabilita acciones durante una escritura. |
| `src/components/Student/IncidentReportForm.tsx` | Ajuste mínimo en el bloque que avisa a los grupos: un error secundario se informa como fallo parcial y conserva la emergencia creada y el formulario de detalles. Intenta avisar a todos los grupos aunque alguno falle. No cambia el despacho, GPS ni sockets. |
| `supabase/migrations/20260926223000_miembro2_atomicidad.sql` | Atomicidad del grupo/administrador y de la aceptación/membresía, con `SECURITY INVOKER`. |
| `tests/miembro2.test.mjs` | 14 pruebas del servicio con dependencias simuladas. |
| `tests/miembro2-sql.mjs` | 5 comprobaciones de integración en PostgreSQL embebido PGlite, con fallos inducidos. |

### Aplicación de los cambios

1. Copiar los archivos modificados y nuevos respetando sus rutas. El ZIP incluye el proyecto reconstruido desde el Repomix, sin `node_modules`, `.env` ni compilados. `CAMBIOS_MIEMBRO_2.patch` permite revisar exactamente las diferencias.
2. Antes de iniciar el frontend nuevo, ejecutar **una sola vez** `supabase/migrations/20260926223000_miembro2_atomicidad.sql` en la base Supabase que utiliza el proyecto. Si se parte de una base vacía, aplicar primero la migración inicial. Coordinar el cambio con el frontend: la versión anterior insertaba manualmente al administrador.
3. Ejecutar `npm install`. Mantener la configuración local de `.env`; para una instalación nueva usar `.env.example` como guía.
4. Ejecutar `npm run build`, `node --test tests/miembro2.test.mjs` y `npm run dev`.
5. Para repetir la prueba SQL aislada, instalar opcionalmente `npm install --no-save --package-lock=false @electric-sql/pglite` y ejecutar `node tests/miembro2-sql.mjs`. Esta prueba crea una base temporal en memoria; no se conecta a Supabase.

### Validación realizada

| Verificación | Resultado |
| --- | --- |
| Compilación TypeScript y Vite | Correcta. Se mantiene el aviso de importación dinámica/estática de `supabaseClient` en el dominio de incidentes. |
| ESLint en los servicios, repositorios y componentes principales intervenidos del miembro 2 | Correcto. Las cargas iniciales usan una excepción local documentada de `set-state-in-effect`; no se cambió la configuración global. |
| Pruebas del servicio | 14/14 correctas: errores de lectura y escritura, fallos del resumen, ausencia real de datos, composición de contadores, grupos vacíos, escritura sin filas y limpieza de suscripción. |
| SQL en PGlite | 5/5 correctas: creación con administrador; rollback si falla su inserción; aceptación fallida conserva pendiente; aceptación crea una sola membresía; una solicitud respondida no cambia de decisión. |
| Supabase real y recorrido visual en navegador | Pendientes de ejecutar con la configuración del equipo; no se dispone de la sesión ni de la base del usuario. |

### Comprobación manual y evidencias

| Caso | Acción | Resultado esperado / evidencia |
| --- | --- | --- |
| Grupo nuevo | Crear un grupo con un usuario válido. | Grupo visible y exactamente una membresía `admin` para su creador. Capturar interfaz y filas. |
| Consulta sin conexión | Activar Offline en herramientas del navegador y volver a abrir grupos o notificaciones. | Mensaje de error, sin presentar el fallo como una lista vacía. |
| Reintento | Restablecer conexión y pulsar Reintentar. | Carga correcta y desaparición del error. |
| Formulario fallido | Crear grupo o invitar sin conexión. | Mensaje visible; botón habilitado al terminar; datos del formulario conservados. |
| Aceptación | Aceptar una invitación pendiente. | Solicitud aceptada y una membresía; contador actualizado tras lectura exitosa. |
| Respuesta repetida | Responder una invitación ya procesada desde otra vista. | Mensaje de solicitud no encontrada o no pendiente, sin éxito falso. |
| Lectura de aviso | Marcar como leída; repetir con un ID inexistente o sin conexión. | Solo se confirma con fila actualizada; los fallos se muestran. |
| Fallo parcial de avisos | Permitir crear el incidente y provocar fallo al consultar/enviar avisos a grupos. | La emergencia conserva su ID y permite agregar detalles; informa el fallo de avisos. |

### Alcance y límites

Se conserva íntegro el apartado de Bryan Quitto y `organizacion.md`. No se implementan tareas de autenticación, modelos base o mapas del miembro 3. El único cambio en un componente de emergencias es el tratamiento del resultado de las notificaciones de grupos, necesario para integrar la propagación de errores.

La migración protege las nuevas creaciones y aceptaciones; no repara automáticamente grupos huérfanos históricos. La comprobación del último administrador en el servicio no es una restricción transaccional para eliminaciones simultáneas desde clientes distintos. La lectura de avisos de grupo continúa siendo compartida (`leida` por grupo), de acuerdo con el esquema original; no se introduce lectura por destinatario. Se conservan la autenticación y las políticas RLS existentes: estos cambios no las sustituyen. Las pruebas embebidas comprueban transacciones SQL, pero no validan permisos, Realtime ni conectividad de la instancia real.

