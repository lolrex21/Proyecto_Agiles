# Organización del Refactoring (Proyecto_Agiles)

**⚠️ AVISO IMPORTANTE:** Las propuestas detalladas a continuación son **RECOMENDACIONES**. Siguiendo la directriz de la asignatura, ningún principio debe aplicarse "porque sí". Cada miembro del equipo debe evaluar la necesidad real de la refactorización (ej. corregir un bug, facilitar la adición de una feature, simplificar un componente inmanejable) para evitar la sobreingeniería.

## Criterio de División
Para evitar conflictos en Git y permitir que cada integrante aplique múltiples principios de manera integral con un contexto claro, la división se ha realizado por **Dominios/Módulos**, aislando áreas del sistema con responsabilidades delimitadas.

---

## 🧍 Miembro 1: Dominio de Emergencias y Despacho (Core Flow)
**Objetivo Real (Necesidad):** El panel del guardia y el formulario del estudiante son inmanejables ("God Components" de +500 líneas). Todo está acoplado rígidamente a la base de datos, lo que impide probar la UI sin internet o con datos simulados. Además, se pasan objetos gigantes con funciones complejas a componentes que solo necesitan pintar datos visuales.

**Archivos principales a intervenir:**
- `src/components/Guard/GuardDashboard.tsx`
- `src/components/Student/IncidentReportForm.tsx`
- `src/services/incidentService.ts`
- `src/services/emergencySocket.ts`
- `websocket-server/server.js`

**Posibles Saneamientos Recomendados:**
- **SRP (Single Responsibility) & KISS:** El `GuardDashboard` hace renderizado, maneja sockets, hace consultas directas a DB y pide permisos de navegador. *Recomendación:* Extraer la lógica de conexión y base de datos a hooks/servicios separados. Simplificar a un solo canal de tiempo real (KISS).
- **DIP (Inversión de Dependencias):** Los componentes importan `supabase` directamente. *Recomendación:* Que los componentes dependan de una abstracción (ej. `IIncidentRepository`). Esto permite inyectar datos falsos para testing sin reescribir la UI.
- **ISP (Segregación de Interfaces):** Componentes visuales pequeños reciben el objeto completo `Incident` (que incluye funciones asíncronas de base de datos). *Recomendación:* Crear interfaces específicas y reducidas (ej. `IIncidentDisplay`) para aislar la UI de lógicas pesadas.
- **Illegal States:** El panel maneja estados booleanos sueltos (`incidents`, `activeAlerts`). *Recomendación:* Modelar un estado unificado que impida comportamientos ilógicos.

---

## 🧍 Miembro 2: Dominio de Grupos de Confianza y Notificaciones
**Objetivo Real (Necesidad):** La gestión de grupos y notificaciones tiene fallos silenciosos: si se cae el internet, la UI muestra listas vacías en vez de avisar del error. Hay código duplicado, y existe el riesgo de dejar datos corruptos (grupos sin administradores) si la base de datos falla a la mitad de una operación.

**Archivos principales a intervenir:**
- `src/services/trustGroupService.ts`
- `src/services/notificationService.ts`
- `src/components/TrustGroup*.tsx`
- `src/components/Notification*.tsx`

**Posibles Saneamientos Recomendados:**
- **Fail Fast (No suprimir errores):** Actualmente los servicios atrapan errores en bloques `catch` y devuelven arreglos vacíos `[]` o `false`. *Recomendación:* Dejar de silenciar estos errores. Permitir que lleguen a la UI para informar correctamente al usuario.
- **Illegal States (Atomicidad):** La función `createTrustGroup` crea el grupo y luego inserta al administrador. Si falla el segundo paso, queda un grupo fantasma. *Recomendación:* Asegurar que estos estados incompletos no puedan existir.
- **DRY (Don't Repeat Yourself):** Hay funciones idénticas haciendo la misma consulta de marcar como leído en archivos distintos. *Recomendación:* Centralizar lógica duplicada.
- **DIP (Inversión de Dependencias):** Los servicios de notificaciones están rígidamente acoplados a Supabase. *Recomendación:* Abstraer el acceso a datos para permitir inyección de dependencias.

---

## 🧍 Miembro 3: Dominio de Autenticación, Usuarios y Modelos Base
**Objetivo Real (Necesidad):** Si la universidad pide añadir un nuevo tipo de emergencia (ej. Fuga de Gas), hay que editar 5 archivos distintos a mano porque los datos están quemados. El modelo de usuario cambia obligando a poner parches defensivos (`user?.nombre || user?.name`), y se usan strings simples para datos vulnerables.

**Archivos principales a intervenir:**
- `src/services/authService.ts`
- `src/components/Student/LoginForm.tsx`
- `src/components/Header/Header.tsx` & `App.tsx`
- `src/types/*`
- `src/components/Map/IncidentMap.tsx`
- `src/services/polygonService.ts`

**Posibles Saneamientos Recomendados:**
- **OCP (Abierto/Cerrado):** Los tipos de incidente y colores están quemados en switches (ej. `IncidentMap`). *Recomendación:* Centralizar esta configuración para que añadir nuevos tipos sea cuestión de extender, no de modificar componentes existentes.
- **LSP (Sustitución de Liskov):** El modelo de sesión es inestable. *Recomendación:* Garantizar un contrato estándar `IUser` para que cualquier tipo de sesión (Google, DB local) sea intercambiable sin romper la interfaz.
- **Primitive Obsession & Naming:** En `LoginForm` el correo es una simple cadena y se llama `username`. *Recomendación:* Clarificar semántica e idealmente encapsular el correo o coordenadas en Value Objects seguros.
- **YAGNI (Código Muerto):** La dependencia `bcryptjs` está inactiva y hay funciones vacías. *Recomendación:* Eliminar código que no aporta valor real al sistema hoy.

---

## Flujo de Decisión para el Equipo (Checklist antes de Refactorizar)
Para evitar la **sobreingeniería**, cada vez que tomen un archivo pregúntense:
1. *¿Modificar esto ayuda a resolver un bug latente?*
2. *¿Simplifica la lectura para el resto del equipo en una zona crítica?*
3. *¿Previene que el sistema caiga en estados erróneos que el usuario pueda percibir?*
4. *¿Facilita agregar funcionalidades que ahora mismo obligarían a tocar código delicado (OCP / DIP)?*
> **Si la respuesta a todas es NO, no apliquen el patrón/principio ahí.**
