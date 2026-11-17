# CMD.1 — Sonda local de comandos CLI

Fecha: 2026-11-17. Fuente: `/private/tmp/chk1/slash-probe.md`. Sin cambios al código, al plan ni commits.
Resultado parcial: descubrimiento y transporte verificados; la respuesta PROBE-OK de Claude no se pudo verificar por falta de autenticación en el entorno aislado.

## Matriz

| CLI | Listar comandos | Ejecutar personalizado | Internos útiles (compactar/revisar/costo) | Internos que no aplican o límites |
|---|---|---|---|---|
| Claude Code 2.1.325, `claude -p` | **Verificado**: `-p /context --output-format stream-json --verbose` emite `system/init.slash_commands`, `skills` y `terminal_slash_commands`; incluye `probe`, `userprobe` y `projectprobe`. Evidencia C1. | **Descubrimiento verificado; respuesta no verificada**: `.claude/commands/probe.md` y skills de usuario/proyecto aparecen en init. `/probe`, `/userprobe` y `/projectprobe` terminan `Not logged in · Please run /login`, exit 1, costo 0. No se obtuvo PROBE-OK. C2–C4. | **Verificado** `/context`: `local_command=context`, 0 turnos, costo 0. `/config` también funciona sin TUI: devuelve ayuda `key=value`, no abre un diálogo. `compact` y `usage` figuran en el catálogo, pero no se ejecutaron; no se atribuye a `/cost` compatibilidad no probada. C1, C5. | `terminal_slash_commands` declara `doctor`, `color`, `focus`, `reload-plugins`; no se ejecutaron y no se afirma su resultado headless. `/config` **sí aplica** en esta versión, contradiciendo la hipótesis de que sería solo terminal. C1, C5. |
| Codex 0.167.2, `app-server` | **Verificado**: el binario genera JSON Schema; `skills/list` responde por RPC. El esquema enumera métodos, no un catálogo de slash commands. `prompts/list` devuelve error -32600, método desconocido. X1–X3. | **No verificado**: se sembró `$CODEX_HOME/prompts/probe.md`, pero no hay método de prompts en el esquema normal generado y `prompts/list` falla. No se probó expansión de `/prompts:probe`. No confundir skills con prompts guardados. X1–X3. | **Contrato publicado**: `thread/compact/start {threadId}`; `review/start {threadId,target,delivery?}` con targets uncommittedChanges/baseBranch/commit/custom y delivery inline. `account/usage/read`, `account/rateLimits/read` figuran en el esquema; no se verificaron sus respuestas ni precios. X1, X2. | **Verificado a nivel de transporte**: enviar `/review` en `turn/start` produjo `item/started` y `item/completed` de tipo `userMessage`, contenido literal `/review`. Se interrumpió enseguida para evitar gasto; no se verificó la respuesta del modelo ni una revisión completa. No equivale a haber invocado `review/start`. X3. |
| OpenCode 2.3.0, servidor HTTP | **Verificado**: `GET /api/command` autenticado devuelve JSON con `init`, `review`, `goal`; `GET /openapi.json` publica el contrato. `GET /command` devuelve HTML, no una lista JSON. O1–O3. | **Endpoint verificado en esquema; ejecución no verificada**: `POST /api/session/{sessionID}/command` con `{name,text,files?,agents?,skills?,delivery?}` devuelve 204 según esquema. No se creó ni ejecutó un personalizado: los comandos listados pueden disparar trabajo y el spec permite omitir un turno largo. O3, O4. | **Contrato publicado**: `POST /api/session/{sessionID}/compact` admite `{id?,delivery?}` y encola compactación durable. `review` está en la lista de comandos. `/api/experimental/usage/limits` describe límites/presupuestos de Console y puede devolver null sin login; no es costo por sesión y no se invocó. O3, O4. | Las rutas sin `/api` no son intercambiables con las del adaptador: `/command` y `/doc` devuelven el HTML de la app; `/api/doc` devuelve 404. Un HTTP 200 no prueba soporte JSON. La UI/TUI y sus otros comandos no se verificaron. O2, O3. |

## Aislamiento y límites

- Directorio nuevo con `mktemp -d`: `/private/tmp/slash-probe.VFyU0s`; todos los CLI se ejecutaron desde su subdirectorio `work`, nunca desde el repo.
- Se redirigieron `CLAUDE_CONFIG_DIR`, `CODEX_HOME` y `XDG_DATA_HOME/STATE_HOME/CACHE_HOME/CONFIG_HOME` a ese temporal. HOME no se cambió. No se editaron configuraciones del usuario.
- Se buscó `.credentials.json` para copiarla al directorio aislado si existía; aun así Claude declaró `apiKeySource=none`. No se inició login ni se extrajeron credenciales del llavero. El aislamiento difiere de la sesión autenticada normal de OrchestOS; no permite afirmar éxito de comandos que necesitan modelo.
- Para Codex se copió `auth.json` desde el CODEX_HOME efectivo si existía; no se copió la configuración del usuario. El hilo fue efímero y read-only, y el turno fue interrumpido inmediatamente. Hubo fallos de conexión en stderr; no se probó la respuesta de inferencia.
- Los skills de Claude se probaron en las rutas equivalentes bajo el directorio de configuración aislado y en `.claude/skills` del proyecto temporal. El árbol real `~/.claude/skills` no se invocó ni se modificó.
- OpenCode falló al abrir su log real antes del aislamiento; luego el sandbox impidió escuchar. Con ejecución aprobada fuera del sandbox, tanto un puerto libre explícito como `--port 0` funcionaron. No atribuir el primer fallo al puerto 0 del producto.
- La primera prueba `/config` heredó stdin del arnés Python y devolvió un error de argumentos contaminado. Se descarta como prueba funcional y se repitió con stdin `/dev/null`; la evidencia válida es C5. Esta contaminación no produjo un cambio de configuración.
- No se ejecutaron revisión ni compactación con inferencia. No se verificaron comandos exclusivos de TUI, precios ni el catálogo completo de cada instalación real.
- La referencia `feedback-deteccion-generica-no-por-cli` figura en PLAN.md, pero una búsqueda literal en el vault no devolvió coincidencias (exit 1). No se inventa su contenido.

## Recomendación de diseño (propuesta; no implementación)

1. Definir una capa común de capacidades con nombre, descripción, origen y tipo de ejecución: prompt, operación de protocolo o terminal.
2. Hacer que cada adaptador descubra lo que su proceso publica y conserve la versión observada; no deducir compatibilidad por la marca.
3. En Claude, capturar `system/init` y sus listas; usar un comando local como `/context` para descubrir sin pagar un turno de modelo, sujeto a esta versión probada.
4. En Codex, enlazar compactación y revisión a sus RPC específicos; `/review` escrito como texto no sustituye ese contrato.
5. Tratar prompts guardados de Codex como una capacidad aparte: implementar lectura/expansión solo tras verificar su contrato, sin anunciarlos como RPC disponibles.
6. En OpenCode 2.3.0, descubrir por `/api/command` y ejecutar por `/api/session/{id}/command`, respetando los cuerpos y autenticación de su OpenAPI.
7. Mostrar disponibilidad y fallos según evidencia; un comando listado, uno ejecutado localmente y uno dependiente de inferencia tienen garantías diferentes.
8. Conservar comandos propios de OrchestOS y resolver colisiones de nombres de forma explícita; para funciones terminales usar una salida informativa o la terminal, según capacidad descubierta.

## Gates — salida cruda

```text
$ node ~/.agent-method/hooks/writer-lock.js check
[stdout y stderr vacíos]
exit=0

$ bun run agent:preflight -- --item CMD.1 --agent codex
$ bun run scripts/agent-preflight.ts --item "CMD.1" --agent codex
✓ Preflight CMD.1 · agente: codex
Reglas leídas requeridas: AGENTS.md · CLAUDE.md · docs/agent-work-protocol.md · PLAN.md
Estado actual (cambios existentes se consideran ajenos hasta verificarlo):
## master...origin/master
Siguiente gate: bunx tsc --noEmit + suite relevante antes de editar
exit=0

$ bunx tsc --noEmit
[stdout y stderr vacíos]
exit=0
```

No se corrieron lint, cobertura ni gates UI: esta sonda no cambia archivos del repo y sus pruebas relevantes son las llamadas CLI/HTTP documentadas abajo. No se presenta como cierre de CMD.1 ni como validación del producto.

## Evidencia cruda por celda

Las salidas siguientes son fragmentos literales o salidas completas, con cada recorte indicado. Los secretos temporales de servidor se omiten; nunca se imprime el archivo auth.json.

### C1 — Descubrimiento y /context

```text
$ claude -p /context --output-format stream-json --no-session-persistence --tools  --strict-mcp-config --setting-sources user,project --max-budget-usd 0.1 --verbose < /dev/null
exit=0
{"type":"system","subtype":"init","cwd":"/private/tmp/slash-probe.VFyU0s/work","session_id":"a8d63711-a7cd-4cd3-bca9-1e87f4bea7b5","tools":[],"mcp_servers":[],"model":"claude-opus-5-5","permissionMode":"default","slash_commands":["userprobe","projectprobe","probe","design","doctor","plugin-authoring","agents","auto-mode-setup","autocompact","clear","color","compact","config","output-style","context","effort","fast","focus","heapdump","init","mcp","model","__remote-workflow","workflow-launch-exec","reload-plugins","reload-skills","rename","security-review","usage","insights","recap","goal","design-consent","design-revoke","list-agents","team-onboarding"],"terminal_slash_commands":["doctor","color","focus","reload-plugins"],"apiKeySource":"none","claude_code_version":"2.1.325","output_style":"default","agents":["claude","claude-code-guide","Explore","general-purpose","Plan","statusline-setup"],"skills":["userprobe","projectprobe","design","doctor","plugin-authoring"],"plugins":[{"name":"cc-plugin-agents-md","path":"builtin","source":"cc-plugin-agents-md@builtin"},{"name":"cc-plugin-telemetry","path":"builtin","source":"cc-plugin-telemetry@builtin"},{"name":"cc-plugin-privacy","path":"builtin","source":"cc-plugin-privacy@builtin"},{"name":"cc-plugin-plugin-authoring","path":"builtin","source":"cc-plugin-plugin-authoring@builtin"}],"capabilities":["interrupt_receipt_v1","interrupt_cancel_queued_v1","interrupt_send_now_v1","interrupt_requeue_taken_v1","msg_lifecycle_v1","request_marker_lists_v1","ask_user_question_unanswered_v1","lifecycle_wakeup_source_v1","sdk_mcp_tools_list_changed","sdk_mcp_manifests","mcp_read_resource_v1","mcp_tool_ui_meta_v1","ui_surface_v1","mcp_call_result_not_for_model_v1","mcp_call_check_permissions_v1","voice_call_talk_line_v1","withdrawn_files_note_v2","ui_pane_widget_v1","reload_plugins_refuse_if_busy_v1"],"analytics_disabled":false,"product_feedback_disabled":false,"uuid":"8c76bdd5-65e3-46a2-8e66-0eaaab48f83d","memory_paths":{"auto":"/private/tmp/slash-probe.VFyU0s/claude/projects/-private-tmp-slash-probe-VFyU0s-work/memory/"},"original_cwd":"/private/tmp/slash-probe.VFyU0s/work","additional_directories":[],"fast_mode_state":"off","fast_mode_disabled_reason":"sdk_opt_in_required","per_turn_effort_active":true,"ultrathink_available":false,"ultrathink_typed_raises":false,"view_mode":"default","startup_timing":{"entrypoint":"claude-desktop","warm_spare_claimed":false,"plugin_full_loads":0,"user_context_builds":1,"sdk_mcp_dial_runs":0,"sdk_mcp_servers_dialed":0,"flag_fetch_kick":"settings_pending_empty","flag_fetch_kick_judged_at_ms":56,"hooks_init_source":"startup","phases":{"node_boot_ms":39,"settings_load_ms":0,"pre_action_mdm_keychain_ms":1,"pre_action_init_ms":14,"pre_action_client_data_url_ms":0,"pre_action_migrations_ms":0,"pre_action_managed_settings_ms":1,"pre_action_ms":18,"mcp_policy_settings_wait_ms":16802,"permission_context_ms":42,"setup_import_ms":0,"setup_uds_dir_ms":4,"setup_uds_messaging_ms":7,"setup_hooks_snapshot_ms":0,"setup_file_watcher_ms":0,"skills_load_ms":9,"setup_release_notes_ms":2,"setup_ms":8,"growthbook_init_ms":0,"tools_commands_load_ms":2,"model_catalog_decision_ms":4,"mcp_config_wait_ms":1,"mcp_config_load_ms":1,"mcp_connect_ms":0,"hooks_init_ms":2,"print_import_ms":5,"grove_check_ms":0,"headless_prologue_ms":1,"initial_messages_load_ms":0,"headless_post_load_ms":1,"input_ready_ms":16943,"first_message_read_ms":16945,"sdk_mcp_update_ms":0,"first_message_handle_ms":0,"first_message_handle_cpu_ms":0,"first_message_handle_loop_lag_ms":0,"mcp_prewait_ms":0,"qe_system_prompt_ms":14,"qe_plugin_skills_load_ms":0,"init_emit_ms":0},"time_origin_ms":1794935314604.813,"phase_start_ms":{"node_boot_ms":0,"settings_load_ms":40,"pre_action_mdm_keychain_ms":41,"pre_action_init_ms":42,"pre_action_client_data_url_ms":56,"pre_action_migrations_ms":56,"pre_action_managed_settings_ms":56,"pre_action_ms":41,"mcp_policy_settings_wait_ms":61,"permission_context_ms":16865,"setup_import_ms":16907,"setup_uds_dir_ms":16911,"setup_uds_messaging_ms":16909,"setup_hooks_snapshot_ms":16916,"setup_file_watcher_ms":16916,"skills_load_ms":16910,"setup_release_notes_ms":16916,"setup_ms":16910,"growthbook_init_ms":16919,"tools_commands_load_ms":16920,"model_catalog_decision_ms":16922,"mcp_config_wait_ms":16928,"mcp_connect_ms":16932,"hooks_init_ms":16930,"print_import_ms":16932,"grove_check_ms":16938,"headless_prologue_ms":16938,"initial_messages_load_ms":16938,"headless_post_load_ms":16939,"input_ready_ms":0,"first_message_read_ms":0,"sdk_mcp_update_ms":16945,"first_message_handle_ms":16945,"mcp_prewait_ms":16945,"qe_system_prompt_ms":16949,"qe_plugin_skills_load_ms":16971,"init_emit_ms":16971}}}
{"type":"assistant","message":{"diagnostics":null,"id":"6a8194e2-e617-43fc-ae5e-2c52a82d7594","container":null,"model":"<synthetic>","role":"assistant","stop_details":null,"stop_reason":"end_turn","stop_sequence":null,"type":"message","usage":{"output_tokens_details":null,"input_tokens":0,"output_tokens":0,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"server_tool_use":{"web_search_requests":0,"web_fetch_requests":0},"service_tier":null,"cache_creation":{"ephemeral_1h_input_tokens":0,"ephemeral_5m_input_tokens":0},"inference_geo":null,"iterations":null,"speed":null,"fallback_credit":null},"content":[{"type":"text","text":"## Context Usage\n\n**Model:** claude-opus-5-5  \n**Tokens:** 1.9k / 1m (0%)\n\n### Estimated usage by category\n\n| Category | Tokens | Percentage |\n|----------|--------|------------|\n| System prompt | 1.9k | 0.2% |\n| Free space | 965.1k | 96.5% |\n| Autocompact buffer | 33k | 3.3% |"}],"context_management":null},"parent_tool_use_id":null,"local_command_source":"<local-command-stdout>## Context Usage\n\n**Model:** claude-opus-5-5  \n**Tokens:** 1.9k / 1m (0%)\n\n### Estimated usage by category\n\n| Category | Tokens | Percentage |\n|----------|--------|------------|\n| System prompt | 1.9k | 0.2% |\n| Free space | 965.1k | 96.5% |\n| Autocompact buffer | 33k | 3.3% |\n\n</local-command-stdout>","session_id":"a8d63711-a7cd-4cd3-bca9-1e87f4bea7b5","uuid":"27389606-ab1b-48f8-af4d-498575d2725a","timestamp":"2026-11-17T17:08:51.574Z","context_usage":{"model":"claude-opus-5-5","total_tokens":1885,"raw_max_tokens":1000000,"percentage":0,"categories":[{"name":"System prompt","tokens":1885,"kind":"used"},{"name":"Autocompact buffer","tokens":33000,"kind":"buffer"},{"name":"Free space","tokens":965115,"kind":"free"}],"mcp_tools":[],"memory_files":[],"agents":[]},"local_command_run":{"command":"context","args":""}}
{"is_error":false,"duration_api_ms":0,"num_turns":0,"stop_reason":null,"session_id":"a8d63711-a7cd-4cd3-bca9-1e87f4bea7b5","total_cost_usd":0,"usage":{"output_tokens_details":{"thinking_tokens":0},"input_tokens":0,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":0,"server_tool_use":{"web_search_requests":0,"web_fetch_requests":0},"service_tier":"standard","cache_creation":{"ephemeral_1h_input_tokens":0,"ephemeral_5m_input_tokens":0},"inference_geo":"","iterations":[],"speed":"standard","fallback_credit":null},"modelUsage":{},"permission_denials":[],"fast_mode_state":"off","fast_mode_disabled_reason":"sdk_opt_in_required","subagent_stats":{"spawned":0,"requested":{"background":0,"foreground":0,"unset":0},"started_in_background":0,"max_depth":0,"spawned_by_subagents":0,"completed":0,"failed":0,"killed":{"parent":0,"user":0,"system":0},"refused":{"depth_limit":0,"concurrency_limit":0,"budget":0},"by_type":{}},"safety_stops":0,"subtype":"success","result":"## Context Usage\n\n**Model:** claude-opus-5-5  \n**Tokens:** 1.9k / 1m (0%)\n\n### Estimated usage by category\n\n| Category | Tokens | Percentage |\n|----------|--------|------------|\n| System prompt | 1.9k | 0.2% |\n| Free space | 965.1k | 96.5% |\n| Autocompact buffer | 33k | 3.3% |\n\n","local_command":"context","type":"result","duration_ms":26,"uuid":"65ef9f07-d20d-4a73-9bc7-a4f04dcd5fce","queued_turn_count":0,"result_index":0,"model_usage_since_last_result":{}}

```

### C2 — Comando personalizado /probe

```text
$ claude -p /probe --output-format json --no-session-persistence --tools  --strict-mcp-config --setting-sources user,project --max-budget-usd 0.1
exit=1
{"duration_api_ms":0,"stop_reason":"stop_sequence","session_id":"510539c2-4d4c-44b8-a389-19e11a1f1a9f","total_cost_usd":0,"usage":{"output_tokens_details":{"thinking_tokens":0},"input_tokens":0,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":0,"server_tool_use":{"web_search_requests":0,"web_fetch_requests":0},"service_tier":"standard","cache_creation":{"ephemeral_1h_input_tokens":0,"ephemeral_5m_input_tokens":0},"inference_geo":"","iterations":[],"speed":"standard","fallback_credit":null},"modelUsage":{},"permission_denials":[],"terminal_reason":"api_error","fast_mode_state":"off","fast_mode_disabled_reason":"sdk_opt_in_required","subagent_stats":{"spawned":0,"requested":{"background":0,"foreground":0,"unset":0},"started_in_background":0,"max_depth":0,"spawned_by_subagents":0,"completed":0,"failed":0,"killed":{"parent":0,"user":0,"system":0},"refused":{"depth_limit":0,"concurrency_limit":0,"budget":0},"by_type":{}},"safety_stops":0,"is_error":true,"num_turns":1,"subtype":"success","api_error_status":null,"result":"Not logged in · Please run /login","type":"result","duration_ms":36,"uuid":"ef2794c9-9c24-4493-b139-3c31d2450a16","queued_turn_count":0,"result_index":0}

```

### C3 — Skill de proyecto

```text
$ claude -p /projectprobe --output-format json --no-session-persistence --tools  --strict-mcp-config --setting-sources user,project --max-budget-usd 0.1
exit=1
{"duration_api_ms":0,"stop_reason":"stop_sequence","session_id":"1376bb55-6a87-4b19-b78c-1b0d66b8014a","total_cost_usd":0,"usage":{"output_tokens_details":{"thinking_tokens":0},"input_tokens":0,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":0,"server_tool_use":{"web_search_requests":0,"web_fetch_requests":0},"service_tier":"standard","cache_creation":{"ephemeral_1h_input_tokens":0,"ephemeral_5m_input_tokens":0},"inference_geo":"","iterations":[],"speed":"standard","fallback_credit":null},"modelUsage":{},"permission_denials":[],"terminal_reason":"api_error","fast_mode_state":"off","fast_mode_disabled_reason":"sdk_opt_in_required","subagent_stats":{"spawned":0,"requested":{"background":0,"foreground":0,"unset":0},"started_in_background":0,"max_depth":0,"spawned_by_subagents":0,"completed":0,"failed":0,"killed":{"parent":0,"user":0,"system":0},"refused":{"depth_limit":0,"concurrency_limit":0,"budget":0},"by_type":{}},"safety_stops":0,"is_error":true,"num_turns":1,"subtype":"success","api_error_status":null,"result":"Not logged in · Please run /login","type":"result","duration_ms":36,"uuid":"e6f99b3e-4bab-448a-a22c-80d4dc9716d3","queued_turn_count":0,"result_index":0}

```

### C4 — Skill de usuario

```text
$ claude -p /userprobe --output-format json --no-session-persistence --tools  --strict-mcp-config --setting-sources user,project --max-budget-usd 0.1
exit=1
{"duration_api_ms":0,"stop_reason":"stop_sequence","session_id":"eaf122e7-b8ba-41dd-9d5a-6ee8023d68bb","total_cost_usd":0,"usage":{"output_tokens_details":{"thinking_tokens":0},"input_tokens":0,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":0,"server_tool_use":{"web_search_requests":0,"web_fetch_requests":0},"service_tier":"standard","cache_creation":{"ephemeral_1h_input_tokens":0,"ephemeral_5m_input_tokens":0},"inference_geo":"","iterations":[],"speed":"standard","fallback_credit":null},"modelUsage":{},"permission_denials":[],"terminal_reason":"api_error","fast_mode_state":"off","fast_mode_disabled_reason":"sdk_opt_in_required","subagent_stats":{"spawned":0,"requested":{"background":0,"foreground":0,"unset":0},"started_in_background":0,"max_depth":0,"spawned_by_subagents":0,"completed":0,"failed":0,"killed":{"parent":0,"user":0,"system":0},"refused":{"depth_limit":0,"concurrency_limit":0,"budget":0},"by_type":{}},"safety_stops":0,"is_error":true,"num_turns":1,"subtype":"success","api_error_status":null,"result":"Not logged in · Please run /login","type":"result","duration_ms":35,"uuid":"eddb4cc1-e17a-46c2-b2cb-22f9e3865e7d","queued_turn_count":0,"result_index":0}

```

### C5 — /config con stdin vacío

```text
$ claude -p /config --output-format json --no-session-persistence --tools  --strict-mcp-config --setting-sources user,project --max-budget-usd 0.1 < /dev/null
exit=0
{"is_error":false,"duration_api_ms":0,"num_turns":0,"stop_reason":null,"session_id":"37b5e84a-95d7-461f-8b39-9d24b9da037d","total_cost_usd":0,"usage":{"output_tokens_details":{"thinking_tokens":0},"input_tokens":0,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":0,"server_tool_use":{"web_search_requests":0,"web_fetch_requests":0},"service_tier":"standard","cache_creation":{"ephemeral_1h_input_tokens":0,"ephemeral_5m_input_tokens":0},"inference_geo":"","iterations":[],"speed":"standard","fallback_credit":null},"modelUsage":{},"permission_denials":[],"fast_mode_state":"off","fast_mode_disabled_reason":"sdk_opt_in_required","subagent_stats":{"spawned":0,"requested":{"background":0,"foreground":0,"unset":0},"started_in_background":0,"max_depth":0,"spawned_by_subagents":0,"completed":0,"failed":0,"killed":{"parent":0,"user":0,"system":0},"refused":{"depth_limit":0,"concurrency_limit":0,"budget":0},"by_type":{}},"safety_stops":0,"subtype":"success","result":"Usage: /config key=value [key=value ...]\n  autoCompact=true|false\n  autoConnectIde=true|false\n  autoScroll=true|false\n  checkpoints=true|false\n  copyFullResponse=true|false\n  copyOnSelect=true|false\n  defaultToAgentsView=true|false\n  editor=normal|vim\n  externalEditorContext=true|false\n  gitignore=true|false\n  idleCompaction=true|false\n  language=<value>\n  leftArrowOpensAgents=true|false\n  model=default|sonnet|opus|haiku|fable|best|sonnet[1m]|opus[1m]|fable[1m]|opusplan\n  notifChannel=auto|iterm2|terminal_bell|iterm2_with_bell|kitty|ghostty|notifications_disabled\n  outputStyle=default|Proactive|Concise|Explanatory|Learning\n  permissionMode=default|plan|acceptEdits|auto|dontAsk\n  prStatus=true|false\n  progressBar=true|false\n  recap=true|false\n  reduceMotion=true|false\n  switchModelsOnFlag=Switch automatically|Ask each time\n  theme=auto|dark|light|light-daltonized|dark-daltonized|light-ansi|dark-ansi\n  thinking=true|false\n  timeFormat=auto|12-hour|24-hour|24-hour-utc\n  tips=true|false\n  turnDuration=true|false\n  useAutoModeDuringPlan=true|false\n  verbose=true|false\n  workflowKeywordTriggerEnabled=true|false\n  workflowSizeGuideline=unrestricted|small|medium|large\n  workflows=true|false\n  worktreeBaseRef=fresh|head","local_command":"config","type":"result","duration_ms":27,"uuid":"54dfa70c-f22b-45a6-85bf-0c3d8f71e7dd","queued_turn_count":0,"result_index":0}

```

### X1 — Generación de esquema

```text
$ codex app-server generate-json-schema --out /private/tmp/slash-probe.VFyU0s/schema
exit=0

```

### X2 — Métodos y contratos publicados

```text
ClientRequest method enum:
[
  "initialize",
  "thread/start",
  "thread/resume",
  "thread/fork",
  "thread/archive",
  "thread/delete",
  "thread/unsubscribe",
  "thread/name/set",
  "thread/goal/set",
  "thread/goal/get",
  "thread/goal/clear",
  "thread/metadata/update",
  "thread/attachment/add",
  "thread/attachment/list",
  "thread/attachmentOwner/list",
  "thread/attachment/remove",
  "thread/section/move",
  "thread/unarchive",
  "thread/compact/start",
  "thread/shellCommand",
  "thread/approveGuardianDeniedAction",
  "thread/revert",
  "thread/list",
  "threadSection/list",
  "threadSection/create",
  "threadSection/update",
  "threadSection/delete",
  "thread/loaded/list",
  "thread/read",
  "thread/turns/list",
  "thread/items/list",
  "thread/inject_items",
  "skills/list",
  "skills/extraRoots/set",
  "hooks/list",
  "marketplace/add",
  "marketplace/remove",
  "marketplace/upgrade",
  "plugin/list",
  "plugin/installed",
  "plugin/reconcile",
  "plugin/read",
  "plugin/skill/read",
  "plugin/share/save",
  "plugin/share/updateTargets",
  "plugin/share/list",
  "plugin/share/checkout",
  "plugin/share/delete",
  "app/read",
  "app/list",
  "app/installed",
  "fs/readFile",
  "fs/writeFile",
  "fs/createDirectory",
  "fs/getMetadata",
  "fs/readDirectory",
  "fs/remove",
  "fs/copy",
  "fs/watch",
  "fs/unwatch",
  "skills/config/write",
  "plugin/install",
  "plugin/uninstall",
  "turn/start",
  "turn/steer",
  "turn/interrupt",
  "review/start",
  "model/list",
  "account/gatewayOAuth/read",
  "account/gatewayOAuth/login",
  "account/gatewayOAuth/cancel",
  "modelProvider/capabilities/read",
  "experimentalFeature/list",
  "permissionProfile/list",
  "experimentalFeature/enablement/set",
  "mcpServer/oauth/login",
  "config/mcpServer/reload",
  "mcpServerStatus/list",
  "mcpServer/resource/read",
  "mcpServer/tool/call",
  "windowsSandbox/setupStart",
  "windowsSandbox/readiness",
  "account/login/start",
  "account/login/cancel",
  "account/logout",
  "account/rateLimits/read",
  "account/rateLimitResetCredit/consume",
  "account/usage/read",
  "account/workspaceMessages/read",
  "account/sendAddCreditsNudgeEmail",
  "feedback/upload",
  "feedback/save",
  "command/exec",
  "command/exec/write",
  "command/exec/terminate",
  "command/exec/resize",
  "config/read",
  "externalAgentConfig/detect",
  "externalAgentConfig/import",
  "externalAgentConfig/import/recordHistory",
  "externalAgentConfig/import/readHistories",
  "config/value/write",
  "config/batchWrite",
  "configRequirements/read",
  "account/read",
  "fuzzyFileSearch"
]
v2/ReviewStartParams.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "ReviewDelivery": {
      "enum": [
        "inline"
      ],
      "type": "string"
    },
    "ReviewTarget": {
      "oneOf": [
        {
          "description": "Review the working tree: staged, unstaged, and untracked files.",
          "properties": {
            "type": {
              "enum": [
                "uncommittedChanges"
              ],
              "title": "UncommittedChangesReviewTargetType",
              "type": "string"
            }
          },
          "required": [
            "type"
          ],
          "title": "UncommittedChangesReviewTarget",
          "type": "object"
        },
        {
          "description": "Review changes between the current branch and the given base branch.",
          "properties": {
            "branch": {
              "type": "string"
            },
            "type": {
              "enum": [
                "baseBranch"
              ],
              "title": "BaseBranchReviewTargetType",
              "type": "string"
            }
          },
          "required": [
            "branch",
            "type"
          ],
          "title": "BaseBranchReviewTarget",
          "type": "object"
        },
        {
          "description": "Review the changes introduced by a specific commit.",
          "properties": {
            "sha": {
              "type": "string"
            },
            "title": {
              "description": "Optional human-readable label (e.g., commit subject) for UIs.",
              "type": [
                "string",
                "null"
              ]
            },
            "type": {
              "enum": [
                "commit"
              ],
              "title": "CommitReviewTargetType",
              "type": "string"
            }
          },
          "required": [
            "sha",
            "type"
          ],
          "title": "CommitReviewTarget",
          "type": "object"
        },
        {
          "description": "Arbitrary instructions, equivalent to the old free-form prompt.",
          "properties": {
            "instructions": {
              "type": "string"
            },
            "type": {
              "enum": [
                "custom"
              ],
              "title": "CustomReviewTargetType",
              "type": "string"
            }
          },
          "required": [
            "instructions",
            "type"
          ],
          "title": "CustomReviewTarget",
          "type": "object"
        }
      ]
    }
  },
  "properties": {
    "delivery": {
      "anyOf": [
        {
          "$ref": "#/definitions/ReviewDelivery"
        },
        {
          "type": "null"
        }
      ],
      "default": null,
      "description": "Reviews run inline on the supplied thread. Omit this field or pass `inline`. To review on a separate thread, start a thread first and use its id."
    },
    "target": {
      "$ref": "#/definitions/ReviewTarget"
    },
    "threadId": {
      "type": "string"
    }
  },
  "required": [
    "target",
    "threadId"
  ],
  "title": "ReviewStartParams",
  "type": "object"
}
v2/ThreadCompactStartParams.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "properties": {
    "threadId": {
      "type": "string"
    }
  },
  "required": [
    "threadId"
  ],
  "title": "ThreadCompactStartParams",
  "type": "object"
}
```

### X3 — RPC real y /review como texto

```text
> {"id": 1, "method": "initialize", "params": {"clientInfo": {"name": "slash_probe", "version": "1"}}}
< {"id":1,"result":{"userAgent":"slash_probe/0.167.2 (Mac OS 26.7.3; arm64) dumb (slash_probe; 1)","codexHome":"/private/tmp/slash-probe.VFyU0s/codex","platformFamily":"unix","platformOs":"macos"}}
> {"method": "initialized"}
> {"id": 2, "method": "skills/list", "params": {"cwds": ["/private/tmp/slash-probe.VFyU0s/work"]}}
< {"method":"remoteControl/status/changed","params":{"status":"disabled","serverName":"Carloss-MacBook-Pro-2.local","installationId":"9e25018a-181c-4b95-a974-7fb8861dfeb4","environmentId":null},"emittedAtMs":1794935266977}
< {"id":2,"result":{"data":[{"cwd":"/private/tmp/slash-probe.VFyU0s/work","skills":[{"name":"imagegen","description":"Generate or edit raster images when the task benefits from AI-created bitmap visuals such as photos, illustrations, textures, sprites, mockups, or transparent-background cutouts. Use when Codex should create a brand-new image, transform an existing image, or derive visual variants from references, and the output should be a bitmap asset rather than repo-native code or vector. Do not use when the task is better handled by editing existing SVG/vector/code-native assets, extending an established icon or logo system, or building the visual directly in HTML/CSS/canvas.","interface":{"displayName":"Image Gen","shortDescription":"Generate or edit images for websites, games, and more","iconSmall":"/private/tmp/slash-probe.VFyU0s/codex/skills/.system/imagegen/assets/imagegen-small.svg","iconLarge":"/private/tmp/slash-probe.VFyU0s/codex/skills/.system/imagegen/assets/imagegen.png","iconSmallUrl":null,"iconLargeUrl":null,"brandColor":null,"defaultPrompt":"Use $imagegen to make or edit an image for this project."},"path":"/private/tmp/slash-probe.VFyU0s/codex/skills/.system/imagegen/SKILL.md","scope":"system","enabled":true,"pluginId":null},{"name":"openai-docs","description":"Use for Codex models/pricing, scheduled tasks, skills, settings, setup, troubleshooting, customization, automations, and self-knowledge—including 'you,' 'your,' 'this app,' or 'this coding agent' when they refer to Codex—and for OpenAI APIs/products and ChatGPT Work. Also use for model choice/migration, prompting, SDKs, Responses, Realtime, agents, evals, and Chat/Work/Codex comparisons. Do not use for generic app/software tasks that merely mention Codex.","shortDescription":"Codex models/pricing, scheduled tasks, skills, settings, setup, troubleshooting, and self-knowledge; OpenAI APIs and ChatGPT Work. 'You'/'this app' means Codex only.","interface":{"displayName":"OpenAI Docs","shortDescription":"OpenAI and Codex docs for models, skills, tasks, and setup","iconSmall":"/private/tmp/slash-probe.VFyU0s/codex/skills/.system/openai-docs/assets/openai-small.svg","iconLarge":"/private/tmp/slash-probe.VFyU0s/codex/skills/.system/openai-docs/assets/openai.png","iconSmallUrl":null,"iconLargeUrl":null,"brandColor":null,"defaultPrompt":"Use OpenAI Docs for official docs lookup, questions about Codex itself or Codex surfaces, model selection, model migration, and prompt-upgrade work."},"path":"/private/tmp/slash-probe.VFyU0s/codex/skills/.system/openai-docs/SKILL.md","scope":"system","enabled":true,"pluginId":null},{"name":"review-agent","description":"Perform a read-only, defect-first review of a specified code change and return every actionable finding. Use when another agent delegates review of uncommitted changes, a base-branch diff, a commit, or custom review instructions.","interface":{"displayName":"Review Agent","shortDescription":"Find actionable bugs in code changes","iconSmall":null,"iconLarge":null,"iconSmallUrl":null,"iconLargeUrl":null,"brandColor":null,"defaultPrompt":"Use $review-agent to review the requested code changes and return actionable findings."},"path":"/private/tmp/slash-probe.VFyU0s/codex/skills/.system/review-agent/SKILL.md","scope":"system","enabled":true,"pluginId":null},{"name":"skill-creator","description":"Create or update a Codex skill with appropriately scoped instructions and any needed supporting resources.","shortDescription":"Create or update a skill","interface":{"displayName":"Skill Creator","shortDescription":"Create or update a skill","iconSmall":"/private/tmp/slash-probe.VFyU0s/codex/skills/.system/skill-creator/assets/skill-creator-small.svg","iconLarge":"/private/tmp/slash-probe.VFyU0s/codex/skills/.system/skill-creator/assets/skill-creator.png","iconSmallUrl":null,"iconLargeUrl":null,"brandColor":null,"defaultPrompt":null},"path":"/private/tmp/slash-probe.VFyU0s/codex/skills/.system/skill-creator/SKILL.md","scope":"system","enabled":true,"pluginId":null},{"name":"skill-installer","description":"Install Codex skills into $CODEX_HOME/skills from a curated list or a GitHub repo path. Use when a user asks to list installable skills, install a curated skill, or install a skill from another repo (including private repos).","shortDescription":"Install curated skills from openai/skills or other repos","interface":{"displayName":"Skill Installer","shortDescription":"Install curated skills from openai/skills or other repos","iconSmall":"/private/tmp/slash-probe.VFyU0s/codex/skills/.system/skill-installer/assets/skill-installer-small.svg","iconLarge":"/private/tmp/slash-probe.VFyU0s/codex/skills/.system/skill-installer/assets/skill-installer.png","iconSmallUrl":null,"iconLargeUrl":null,"brandColor":null,"defaultPrompt":null},"path":"/private/tmp/slash-probe.VFyU0s/codex/skills/.system/skill-installer/SKILL.md","scope":"system","enabled":true,"pluginId":null}],"errors":[]}]}}
> {"id": 3, "method": "prompts/list", "params": {}}
< {"error":{"code":-32600,"message":"Invalid request: unknown variant `prompts/list`, expected one of `initialize`, `server/diagnostics`, `userVerification/status`, `userVerification/enroll`, `userVerification/delete`, `userVerification/verify`, `userVerification/cancel`, `thread/start`, `thread/resume`, `thread/fork`, `thread/sample`, `thread/sample/cancel`, `thread/archive`, `thread/delete`, `thread/unsubscribe`, `thread/increment_elicitation`, `thread/decrement_elicitation`, `thread/name/set`, `thread/prediction/request`, `thread/goal/set`, `thread/goal/get`, `thread/goal/clear`, `thread/queue/add`, `thread/queue/list`, `thread/queue/update`, `thread/queue/delete`, `thread/queue/reorder`, `thread/queue/start`, `thread/metadata/update`, `thread/attachment/add`, `thread/attachment/list`, `thread/attachmentOwner/list`, `thread/attachment/remove`, `thread/section/move`, `thread/settings/update`, `thread/memoryMode/set`, `thread/memory/read`, `memory/status`, `memory/reset`, `rollout/compress`, `thread/unarchive`, `thread/compact/start`, `thread/shellCommand`, `thread/approveGuardianDeniedAction`, `thread/backgroundTerminals/clean`, `thread/backgroundTerminals/list`, `thread/backgroundTerminals/terminate`, `thread/revert`, `thread/list`, `project/list`, `project/read`, `project/create`, `project/import`, `project/update`, `project/move`, `project/delete`, `threadSection/list`, `threadSection/create`, `threadSection/update`, `threadSection/delete`, `thread/search`, `thread/searchOccurrences`, `thread/loaded/list`, `thread/read`, `thread/readState/update`, `thread/turns/list`, `thread/items/list`, `thread/items/read`, `thread/guardianReview`, `thread/inject_items`, `skills/list`, `skills/extraRoots/set`, `hooks/list`, `marketplace/add`, `marketplace/remove`, `marketplace/upgrade`, `plugin/list`, `plugin/search`, `plugin/installed`, `plugin/reconcile`, `plugin/read`, `plugin/skill/read`, `plugin/share/save`, `plugin/share/updateTargets`, `plugin/share/list`, `plugin/share/checkout`, `plugin/share/delete`, `app/read`, `app/list`, `app/installed`, `fs/readFile`, `fs/writeFile`, `fs/createDirectory`, `fs/getMetadata`, `fs/readDirectory`, `fs/remove`, `fs/copy`, `fs/watch`, `fs/unwatch`, `skills/config/write`, `plugin/install`, `plugin/uninstall`, `turn/start`, `turn/settings/update`, `turn/steer`, `turn/interrupt`, `thread/realtime/start`, `thread/realtime/appendAudio`, `thread/realtime/appendText`, `thread/realtime/appendSpeech`, `thread/realtime/stop`, `thread/timeline/list`, `thread/realtime/listVoices`, `review/start`, `model/list`, `account/gatewayOAuth/read`, `account/gatewayOAuth/login`, `account/gatewayOAuth/cancel`, `modelProvider/capabilities/read`, `experimentalFeature/list`, `permissionProfile/list`, `experimentalFeature/enablement/set`, `remoteControl/enable`, `remoteControl/disable`, `remoteControl/status/read`, `remoteControl/pairing/start`, `remoteControl/pairing/status`, `remoteControl/client/list`, `remoteControl/client/revoke`, `collaborationMode/list`, `mock/experimentalMethod`, `environment/add`, `environment/info`, `environment/status`, `mcpServer/oauth/login`, `config/mcpServer/reload`, `mcpServerStatus/list`, `mcpServer/resource/read`, `mcpServer/event/stream/start`, `mcpServer/event/stream/stop`, `mcpServer/tool/call`, `windowsSandbox/setupStart`, `windowsSandbox/readiness`, `account/login/start`, `account/bedrock/discover`, `account/bedrock/setup`, `account/gcp/setup`, `account/bedrock/checkGovCloudRequirements`, `account/login/cancel`, `accountSession/list`, `accountSession/switch`, `account/logout`, `account/rateLimits/read`, `account/rateLimitResetCredit/consume`, `account/usage/read`, `account/workspaceMessages/read`, `account/sendAddCreditsNudgeEmail`, `feedback/upload`, `feedback/save`, `command/exec`, `command/exec/write`, `command/exec/terminate`, `command/exec/resize`, `process/spawn`, `process/writeStdin`, `process/kill`, `process/resizePty`, `config/read`, `externalAgentConfig/detect`, `externalAgentConfig/import`, `externalAgentConfig/import/recordHistory`, `externalAgentConfig/import/readHistories`, `config/value/write`, `config/batchWrite`, `configRequirements/read`, `account/read`, `getConversationSummary`, `gitDiffToRemote`, `getAuthStatus`, `fuzzyFileSearch`, `fuzzyFileSearch/sessionStart`, `fuzzyFileSearch/sessionUpdate`, `fuzzyFileSearch/sessionStop`"},"id":3}
> {"id": 4, "method": "thread/start", "params": {"cwd": "/private/tmp/slash-probe.VFyU0s/work", "ephemeral": true, "sandbox": "read-only", "approvalPolicy": "never", "baseInstructions": "Sonda de transporte. No uses herramientas. Responde solo PROBE-OK."}}
< {"id":4,"result":{"thread":{"id":"01a1ea7a-9ea9-72c1-98ef-073bf2f17d4e","environments":[{"environmentId":"local","cwd":"/private/tmp/slash-probe.VFyU0s/work","runtimeWorkspaceRoots":["/private/tmp/slash-probe.VFyU0s/work"]}],"extra":null,"sessionId":"01a1ea7a-9ea9-72c1-98ef-073bf2f17d4e","forkedFromId":null,"parentThreadId":null,"preview":"","ephemeral":true,"section":null,"sectionEnteredAt":null,"projectId":null,"historyMode":"paginated","modelProvider":"openai","model":"gpt-6.1-sol","reasoningEffort":null,"createdAt":1794935272,"updatedAt":1794935272,"recencyAt":1794935272,"status":{"type":"idle"},"path":null,"cwd":"/private/tmp/slash-probe.VFyU0s/work","cliVersion":"0.167.2","originator":"slash_probe","source":"vscode","canAcceptDirectInput":true,"threadSource":null,"agentNickname":null,"agentRole":null,"gitInfo":null,"name":null,"daybreakEnabled":null,"turns":[]},"model":"gpt-6.1-sol","modelProvider":"openai","serviceTier":null,"disabledPluginIds":[],"cwd":"/private/tmp/slash-probe.VFyU0s/work","runtimeWorkspaceRoots":["/private/tmp/slash-probe.VFyU0s/work"],"instructionSources":[],"approvalPolicy":"never","approvalsReviewer":"user","sandbox":{"type":"readOnly","networkAccess":false},"activePermissionProfile":null,"reasoningEffort":null,"multiAgentMode":"explicitRequestOnly"}}
> {"id": 5, "method": "turn/start", "params": {"threadId": "01a1ea7a-9ea9-72c1-98ef-073bf2f17d4e", "input": [{"type": "text", "text": "/review"}]}}
< {"method":"thread/started","params":{"thread":{"id":"01a1ea7a-9ea9-72c1-98ef-073bf2f17d4e","environments":[{"environmentId":"local","cwd":"/private/tmp/slash-probe.VFyU0s/work","runtimeWorkspaceRoots":["/private/tmp/slash-probe.VFyU0s/work"]}],"extra":null,"sessionId":"01a1ea7a-9ea9-72c1-98ef-073bf2f17d4e","forkedFromId":null,"parentThreadId":null,"preview":"","ephemeral":true,"section":null,"sectionEnteredAt":null,"projectId":null,"historyMode":"paginated","modelProvider":"openai","model":"gpt-6.1-sol","reasoningEffort":null,"createdAt":1794935272,"updatedAt":1794935272,"recencyAt":1794935272,"status":{"type":"idle"},"path":null,"cwd":"/private/tmp/slash-probe.VFyU0s/work","cliVersion":"0.167.2","originator":"slash_probe","source":"vscode","canAcceptDirectInput":true,"threadSource":null,"agentNickname":null,"agentRole":null,"gitInfo":null,"name":null,"daybreakEnabled":null,"turns":[]}},"emittedAtMs":1794935272910}
< {"method":"mcpServer/startupStatus/updated","params":{"threadId":"01a1ea7a-9ea9-72c1-98ef-073bf2f17d4e","name":"codex_apps","status":"starting","error":null,"failureReason":null},"emittedAtMs":1794935272910}
< {"id":5,"result":{"turn":{"id":"01a1ea7a-b5d2-72d0-80d5-31960d3ce3f9","rootTurnId":"01a1ea7a-b5d2-72d0-80d5-31960d3ce3f9","items":[],"itemsView":"notLoaded","status":"inProgress","error":null,"startedAt":null,"completedAt":null,"durationMs":null}}}
> {"id": 6, "method": "turn/interrupt", "params": {"threadId": "01a1ea7a-9ea9-72c1-98ef-073bf2f17d4e", "turnId": "01a1ea7a-b5d2-72d0-80d5-31960d3ce3f9"}}
< {"method":"thread/status/changed","params":{"threadId":"01a1ea7a-9ea9-72c1-98ef-073bf2f17d4e","status":{"type":"active","activeFlags":[]}},"emittedAtMs":1794935272917}
< {"method":"turn/started","params":{"threadId":"01a1ea7a-9ea9-72c1-98ef-073bf2f17d4e","turn":{"id":"01a1ea7a-b5d2-72d0-80d5-31960d3ce3f9","rootTurnId":"01a1ea7a-b5d2-72d0-80d5-31960d3ce3f9","items":[],"itemsView":"notLoaded","status":"inProgress","error":null,"startedAt":1794935272,"completedAt":null,"durationMs":null}},"emittedAtMs":1794935272917}
< {"method":"item/started","params":{"item":{"type":"userMessage","id":"01a1ea7a-b5d5-7433-87df-2f83f4d6a425","clientId":null,"content":[{"type":"text","text":"/review","text_elements":[]}],"startedAtMs":1794935272918,"completedAtMs":null},"threadId":"01a1ea7a-9ea9-72c1-98ef-073bf2f17d4e","turnId":"01a1ea7a-b5d2-72d0-80d5-31960d3ce3f9","startedAtMs":1794935272918},"emittedAtMs":1794935272918}
< {"method":"item/completed","params":{"item":{"type":"userMessage","id":"01a1ea7a-b5d5-7433-87df-2f83f4d6a425","clientId":null,"content":[{"type":"text","text":"/review","text_elements":[]}],"startedAtMs":1794935272918,"completedAtMs":1794935272918},"threadId":"01a1ea7a-9ea9-72c1-98ef-073bf2f17d4e","turnId":"01a1ea7a-b5d2-72d0-80d5-31960d3ce3f9","completedAtMs":1794935272918},"emittedAtMs":1794935272918}
< {"id":6,"result":{}}
server exit=0
STDERR
2026-11-17T17:07:49.967027Z ERROR codex_models_manager::manager: failed to refresh available models: Connection failed: error sending request
2026-11-17T17:07:49.986116Z ERROR codex_models_manager::manager: failed to refresh available models: Connection failed: error sending request
2026-11-17T17:07:52.894729Z ERROR codex_models_manager::manager: failed to refresh available models: Connection failed: error sending request
2026-11-17T17:07:52.906862Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when Client(HttpRequest(HttpRequest("http/request failed: error sending request for url (https://chatgpt.com/backend-api/ps/mcp)")))

```

### O1 — Ayuda del servidor

```text
$ opencode serve --help
exit=0
DESCRIPTION
  Start the v2 API and web server

USAGE
  opencode serve [flags]

FLAGS
  --hostname string    
  --port integer       
  --cors string        Additional allowed CORS origin (repeat for multiple origins)
  --service            
  --stdio              

GLOBAL FLAGS
  --help, -h                                                          Show help information
  --version, -v                                                       Show version information
  --wizard                                                            Start wizard mode for a command
  --completions <bash|zsh|fish|powershell|sh|pwsh>                    Print shell completion script (choices: bash, zsh, fish, powershell, sh, pwsh)
  --log-level <all|trace|debug|info|warn|warning|error|fatal|none>    Sets the minimum log level (choices: all, trace, debug, info, warn, warning, error, fatal, none)
  --print-logs                                                        Print logs to stderr (server logs require --standalone)

```

### O2 — Primera escucha denegada por sandbox

```text
$ opencode serve --hostname 127.0.0.1 --port 0
ServeError: 
    at U (/$bunfs/root/chunk-815w63gv.js:52:10000)
    at applyHandlers (node:events:64:20)
    at emitError (node:events:44:27)
    at emitListenErrorNextTick (node:_http_server:166:12)
    at processTicksAndRejections (native:7:39) {
  [cause]: Error: Failed to start server. Is port 0 in use?
      at serve (unknown)
      at <anonymous> (node:_http_server:438:35)
      at <anonymous> (node:_http_server:410:33)
      at <anonymous> (/$bunfs/root/chunk-815w63gv.js:52:10038)
}

server exit=1
```

### O3 — HTTP autenticado y listado

```text
$ opencode serve --hostname 127.0.0.1 --port 0
server listening on http://127.0.0.1:53199

GET /openapi.json HTTP 200 Content-Type: application/json
{"openapi":"3.1.0","info":{"title":"opencode HttpApi","version":"0.0.1","description":"Experimental HttpApi surface for selected instance routes."},"paths":{"/api/info":{"get":{"tags":["server"],"operationId":"server.info","parameters":[],"security":[],"responses":{"200":{"description":"ServerInfo","content":{"application/json":{"schema":{"$ref":"#/components/schemas/ServerInfo"}}}},"400":{"description":"InvalidRequestError","content":{"application/json":{"schema":{"$ref":"#/components/schemas/InvalidRequestErrorEncoded"}}}},"401":{"description":"UnauthorizedError","content":{"application/json":{"schema":{"$ref":"#/components/schemas/UnauthorizedErrorEncoded"}}}}},"description":"Return the server identity, connection URLs, paths, and readiness status.","summary":"Get server info"}},"/api/pair":{"post":{"tags":["server"],"operationId":"server.pair","parameters":[],"security":[],"responses":{"200":{"description":"PairingCode","content":{"application/json":{"schema":{"$ref":"#/components/schemas/PairingCode"}}}},"400":{"description":"InvalidRequestError","content":{"application/json":{"schema":{"$ref":"#/components/schemas/InvalidRequestErrorEncoded"}}}},"401":{"description":"Unauthor
GET /api/command HTTP 200 Content-Type: application/json
{"location":{"directory":"/private/tmp/slash-probe.VFyU0s/work"},"data":[{"name":"init","description":"guided AGENTS.md setup"},{"name":"review","description":"review changes [commit|branch|pr], defaults to uncommitted"},{"name":"goal","description":"keep working until an objective is met [pause|resume|clear]"}]}
GET /api/session/command HTTP 400
{"_tag":"InvalidRequestError","message":"Expected a string starting with \"ses\"\n  at [\"sessionID\"]","kind":"Params"}
GET /api/doc HTTP 404

server exit=143
```

### O3b — Rutas sin /api y autenticación

```text
$ opencode serve --hostname 127.0.0.1 --port 53189
server listening on http://127.0.0.1:53189
server password [OMITIDO: credencial efímera destruida]

GET /command HTTP 200
<!doctype html>
<html lang="en" style="background-color: var(--v2-background-bg-deep, #fafafa)">
[recorte del cuerpo HTML]

GET /doc HTTP 200
<!doctype html>
<html lang="en" style="background-color: var(--v2-background-bg-deep, #fafafa)">
[recorte del cuerpo HTML]

GET /openapi.json <HTTPError 401: 'Unauthorized'>
server exit=143
```

### O4 — Extracto literal de OpenAPI del servidor vivo

Fuente: GET /openapi.json autenticado, HTTP 200. Solo paths pertinentes; no se ejecutaron estas operaciones.

```json
{
  "/api/session/{sessionID}/command": {
    "post": {
      "tags": [
        "session"
      ],
      "operationId": "session.command",
      "parameters": [
        {
          "name": "sessionID",
          "in": "path",
          "schema": {
            "$ref": "#/components/schemas/Session.ID"
          },
          "required": true
        }
      ],
      "security": [],
      "responses": {
        "204": {
          "description": "<No Content>"
        },
        "400": {
          "description": "InvalidRequestError",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/InvalidRequestErrorEncoded"
              }
            }
          }
        },
        "401": {
          "description": "UnauthorizedError",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UnauthorizedErrorEncoded"
              }
            }
          }
        },
        "404": {
          "description": "SessionNotFoundError | CommandNotFoundError | LocationNotFoundError",
          "content": {
            "application/json": {
              "schema": {
                "anyOf": [
                  {
                    "$ref": "#/components/schemas/SessionNotFoundErrorEncoded"
                  },
                  {
                    "$ref": "#/components/schemas/CommandNotFoundErrorEncoded"
                  },
                  {
                    "$ref": "#/components/schemas/LocationNotFoundErrorEncoded"
                  }
                ]
              }
            }
          }
        },
        "500": {
          "description": "CommandExecutionError",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CommandExecutionErrorEncoded"
              }
            }
          }
        }
      },
      "description": "Execute a slash command callback immediately.",
      "summary": "Run command",
      "requestBody": {
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "name": {
                  "type": "string"
                },
                "text": {
                  "type": "string"
                },
                "files": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/PromptInput.FileAttachment"
                  }
                },
                "agents": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Prompt.AgentAttachment"
                  }
                },
                "skills": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/PromptInput.SkillAttachment"
                  }
                },
                "delivery": {
                  "anyOf": [
                    {
                      "$ref": "#/components/schemas/Session.Inbox.Delivery"
                    },
                    {
                      "type": "null"
                    }
                  ]
                }
              },
              "required": [
                "name",
                "text"
              ],
              "additionalProperties": false
            }
          }
        },
        "required": true
      }
    }
  },
  "/api/session/{sessionID}/compact": {
    "post": {
      "tags": [
        "session"
      ],
      "operationId": "session.compact",
      "parameters": [
        {
          "name": "sessionID",
          "in": "path",
          "schema": {
            "$ref": "#/components/schemas/Session.ID"
          },
          "required": true
        }
      ],
      "security": [],
      "responses": {
        "200": {
          "description": "Success",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "data": {
                    "$ref": "#/components/schemas/Session.Inbox.Compaction"
                  }
                },
                "required": [
                  "data"
                ],
                "additionalProperties": false
              }
            }
          }
        },
        "400": {
          "description": "InvalidRequestError",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/InvalidRequestErrorEncoded"
              }
            }
          }
        },
        "401": {
          "description": "UnauthorizedError",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UnauthorizedErrorEncoded"
              }
            }
          }
        },
        "404": {
          "description": "SessionNotFoundError",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SessionNotFoundErrorEncoded"
              }
            }
          }
        },
        "409": {
          "description": "ConflictError",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ConflictErrorEncoded"
              }
            }
          }
        }
      },
      "description": "Durably admit a session compaction request. Steers by default: it runs at the next step boundary instead of waiting behind queued prompts.",
      "summary": "Compact session",
      "requestBody": {
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "id": {
                  "anyOf": [
                    {
                      "$ref": "#/components/schemas/Session.Message.ID"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "delivery": {
                  "anyOf": [
                    {
                      "$ref": "#/components/schemas/Session.Inbox.Delivery"
                    },
                    {
                      "type": "null"
                    }
                  ]
                }
              },
              "additionalProperties": false
            }
          }
        },
        "required": true
      }
    }
  },
  "/api/command": {
    "get": {
      "tags": [
        "command"
      ],
      "operationId": "command.list",
      "parameters": [
        {
          "name": "location",
          "in": "query",
          "schema": {
            "type": "object",
            "properties": {
              "directory": {
                "anyOf": [
                  {
                    "type": "string"
                  },
                  {
                    "type": "null"
                  }
                ]
              }
            },
            "additionalProperties": false
          },
          "required": false,
          "style": "deepObject",
          "explode": true
        }
      ],
      "security": [],
      "responses": {
        "200": {
          "description": "Success",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "location": {
                    "$ref": "#/components/schemas/Location.PublicRef"
                  },
                  "data": {
                    "type": "array",
                    "items": {
                      "$ref": "#/components/schemas/Command.Info"
                    }
                  }
                },
                "required": [
                  "location",
                  "data"
                ],
                "additionalProperties": false
              }
            }
          }
        },
        "400": {
          "description": "InvalidRequestError",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/InvalidRequestErrorEncoded"
              }
            }
          }
        },
        "401": {
          "description": "UnauthorizedError",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UnauthorizedErrorEncoded"
              }
            }
          }
        },
        "404": {
          "description": "LocationNotFoundError",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/LocationNotFoundErrorEncoded"
              }
            }
          }
        }
      },
      "description": "Retrieve currently registered commands.",
      "summary": "List commands"
    }
  },
  "/api/experimental/usage/limits": {
    "get": {
      "tags": [
        "usage"
      ],
      "operationId": "experimental.usage.limits",
      "parameters": [
        {
          "name": "location",
          "in": "query",
          "schema": {
            "type": "object",
            "properties": {
              "directory": {
                "anyOf": [
                  {
                    "type": "string"
                  },
                  {
                    "type": "null"
                  }
                ]
              }
            },
            "additionalProperties": false
          },
          "required": false,
          "style": "deepObject",
          "explode": true
        }
      ],
      "security": [],
      "responses": {
        "200": {
          "description": "Success",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "location": {
                    "$ref": "#/components/schemas/Location.PublicRef"
                  },
                  "data": {
                    "anyOf": [
                      {
                        "$ref": "#/components/schemas/UsageLimits.Info"
                      },
                      {
                        "type": "null"
                      }
                    ]
                  }
                },
                "required": [
                  "location",
                  "data"
                ],
                "additionalProperties": false
              }
            }
          }
        },
        "400": {
          "description": "InvalidRequestError",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/InvalidRequestErrorEncoded"
              }
            }
          }
        },
        "401": {
          "description": "UnauthorizedError",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UnauthorizedErrorEncoded"
              }
            }
          }
        },
        "404": {
          "description": "LocationNotFoundError",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/LocationNotFoundErrorEncoded"
              }
            }
          }
        },
        "503": {
          "description": "ServiceUnavailableError",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ServiceUnavailableErrorEncoded"
              }
            }
          }
        }
      },
      "description": "Return the OpenCode Go allowance and Console budgets of the OpenCode Console workspace the location is signed in to, or null when it isn't signed in.",
      "summary": "Get usage limits"
    }
  }
}
```

## Diff del repo

```text
$ git status --short
[sin salida]
exit=0
$ git diff --stat
[sin salida]
exit=0
```

El único entregable nuevo es este informe fuera del repo. El preflight registra su estado operativo ignorado por git.

## Limpieza verificada

Todos los procesos lanzados se terminaron por su grupo/PID y se esperó su salida (servidores OpenCode exit 143 por SIGTERM; Codex exit 0).

```text
$ lsof -nP +D /private/tmp/slash-probe.VFyU0s
[sin salida]
exit=1
$ python: shutil.rmtree(temporal); assert not temporal.exists()
exit=0
$ git status --short
[sin salida]
exit=0
$ git diff --exit-code
[sin salida]
exit=0
```

Temporal eliminado, incluidas las copias de autenticación y los esquemas. El informe es el único entregable que permanece.
