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

*(Nota: Los apartados de los siguientes miembros del equipo se irán añadiendo conforme se ejecuten sus refactorizaciones).*
