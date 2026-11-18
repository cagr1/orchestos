# Correcciones de Windows

<a id="win21"></a>

## WIN.21 — Metadatos de plugins de Claude

`chat-cli-commands.ts` separaba con `/` el resultado de `path.relative`. Se usa el separador nativo.
En el PC Windows, el caso CMD.1 volvió a encontrar las descripciones y los nombres de `tools:audit` y
`tools:check`. Evidencia en [pruebas focalizadas](evidence/WIN.18-21-local.md).

Sin delegación: fix de dos líneas. Revisión entre proveedores pendiente por rechazo del control automático.
