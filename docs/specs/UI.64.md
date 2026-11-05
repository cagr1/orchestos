# UI.64 — El (+) de proyecto y el clip de adjuntar abren un menú antes de actuar

## Decisión de Carlos (2026-11-05)
- (+) de proyecto: menú con abrir carpeta y clonar desde URL. Para clonar se pide la URL y una carpeta de destino
  elegible (por defecto, la que contiene los proyectos); el clon se registra y queda activo.
- Clip de adjuntar en Chat y Dev: menú con "Upload from computer" y "File from project", en vez de abrir directo el
  selector del sistema.

## Referencias (verificadas en el bundle de `/Applications/Orca.app` y en el código de `pingdotgg/t3code`)
- Orca "Add a project": entradas "Browse folder" (Local project, Git repo, or folder with many repos), "Clone from
  URL" (Clone a remote Git repository) y "Create new project". El diálogo de clonar tiene "Git URL" y "Clone
  location" con "Choose folder", texto de ayuda "Enter the Git URL and choose where to clone it.", botón "Clone"
  ("Cloning..." mientras corre) y el error "Destination folder already exists". No pide rama.
- T3 Code: Git URL → "Continue" → "Select where to clone" → "Clone". El destino por defecto es la carpeta base de
  proyectos o `~/`. Tampoco pide rama.
- Orca y T3 abren directo el selector del sistema al adjuntar; el menú de adjuntar es decisión propia de Carlos.

## Qué cambiar
1. **Menú del (+) de proyecto.** Los dos call sites usan el mismo componente: `ShellSidebar.tsx:218` (`onNewProject`)
   y `OrchestSettingsView.tsx:1666` (`onAddProject`), los dos cableados a `handleNewProject` (`App.tsx:901`). Entradas:
   - "Open folder": lo que hace hoy `handleNewProject` (`chooseProject()`).
   - "Clone from URL": abre el diálogo del punto 2.
   Usar el menú o dropdown de shadcn que ya usa la app (el mismo que el selector de modelo del composer), con
   className literal y sin sumar CSS a `styles.css`. Texto de UI en inglés.
2. **Diálogo "Clone from URL".** Campos: "Git URL" y "Clone location". La ubicación por defecto es la carpeta padre
   del proyecto activo; si no hay proyecto activo, `~/`. Junto al campo, un botón "Choose folder" con el selector
   nativo de carpetas (reusar `nativeChooseProjectFolder`, `src/dashboard/handlers/projects.ts`). Se muestra la ruta
   final `<ubicación>/<nombre del repo>`. Botón "Clone"; mientras corre dice "Cloning..." y queda deshabilitado. Un
   error se muestra en el diálogo, que no se cierra. Si sale bien: se registra el proyecto, se recarga la lista, el
   proyecto queda activo (lo mismo que hace `handleNewProject` tras elegir carpeta) y el diálogo se cierra.
3. **API `POST /api/projects/clone` `{ url, parentDir }`** en `src/dashboard/handlers/projects.ts`:
   - Valida que la URL sea `https://…`, `ssh://…` o `git@host:owner/repo(.git)`. Cualquier otra cosa da 400, y
     rechaza también las que empiezan por `-`.
   - El nombre del repo es el último segmento de la URL sin `.git`. Si queda vacío, `.` o `..`, da 400.
   - `parentDir` debe existir y ser un directorio. Si `<parentDir>/<nombre>` ya existe, da 409 con el mensaje
     "Destination folder already exists".
   - Corre `git clone -- <url> <destino>` con un array de args, sin shell, detrás de una sonda inyectable como
     `ChooseProjectFolder`, para que los tests nunca lancen `git`. Tiene timeout y, si falla, devuelve el stderr
     acotado (≤2 KB) y borra el destino parcial solo si lo creó este clon.
   - Si sale bien: `ensureProject(realpath(destino))` y responde `publicProjectRow`.
   - Añadir el endpoint a la lista de rutas del dashboard igual que `handleApiProjectChoose`.
   - Endpoint para el destino por defecto o cálculo en el front: lo que exija menos código. No se crea config nueva.
4. **Clip del composer** (`AgentComposer.tsx:901-908`, compartido por Chat `OrchestChatView.tsx:588` y Dev
   `OrchestDevWorkspace.tsx:444`): el clic abre un menú con:
   - "Upload from computer": `fileInputRef.current?.click()`, lo de hoy.
   - "File from project": inserta `@` en el cursor y abre el selector de archivos de `@` que ya existe
     (`AgentComposer.tsx:30`, `:383`). Solo si hay `projectId`; sin proyecto, la entrada no aparece.
   Arrastrar y pegar archivos sigue igual.
5. **Tests y gate.**
   - Tests del handler: URL válida e inválida, `-` inicial, nombre vacío, destino existente (409), fallo de la sonda
     con limpieza, éxito que registra el proyecto. Todo con la sonda inyectada.
   - Un flow `scripts/ui-gate/flows/project-add-menu.mjs` en navegador real:
     - el (+) abre el menú con las dos entradas;
     - "Clone from URL" clona un repo local `file://` creado en el fixture, con identidad git propia;
     - el proyecto aparece activo;
     - el clip abre el menú y "File from project" abre el selector de `@`.
     Como `file://` no pasa la validación del punto 3, el gate inyecta la sonda o habilita `file://` solo con un
     flag de test que no se expone en la UI. Elegir uno y justificarlo en el reporte.

## Qué no tocar
`chooseProject`/`handleApiProjectChoose` (solo se reusan), el resto del composer y Settings fuera del botón. No crear
"Create new project" ni proyectos por SSH. No commitear ni tocar `PLAN.md`/`NEXT.md`.

## Cómo se verifica
- `bun run typecheck`, `bun run lint`, `bun run test:coverage`.
- `bun run ui:gate project-add-menu project-tabs smoke` fuera del sandbox, en verde, con capturas del menú del (+),
  del diálogo de clonar y del menú del clip en el `runDir`. Pegar las rutas.
