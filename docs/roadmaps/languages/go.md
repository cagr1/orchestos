---
language: Go
runtime: go
package_manager: Go modules
state: detected
last_verified: 2026-07-29
evidence:
  - "tests/fixtures/graph/go/go.mod" existe como fixture; no hay "go.mod" en la raíz del proyecto
  - "go version" → comando ausente en el entorno
  - "gofmt", "go test" y "go vet" → no disponibles en el entorno
---

# Perfil de lenguaje — Go

Perfil secundario de ecosistema. El lenguaje está `detected` solo por un fixture del resolver (`tests/
fixtures/graph/go/go.mod`); no existe un proyecto Go de producción en este repo y el toolchain no está
instalado. No se convierte ningún comando en gate hasta detectarlo y ejecutarlo en el proyecto real.

## Entorno y proyecto — estado: known/missing

- Detectar `go.mod`, `go.sum`, versión de Go, workspace `go.work`, módulos y entrypoints.
- Go modules es el gestor habitual; `go env` y `go list` ayudan a confirmar el entorno real.
- La entrega puede ser library, CLI, HTTP service, worker o binario; detectar cuál aplica.
- En OrchestOS: existe un `go.mod` de fixture, pero no en la raíz; `go` no existe. Toolchain de
  producción: `missing`, no `pass`.

## Formato y compilación — estado: known

- Formato: `gofmt`/`go fmt ./...` cuando estén disponibles.
- Build: `go build ./...` o el target declarado por el proyecto.
- Static analysis: detectar `go vet`, `staticcheck` u otra herramienta antes de exigirla.

## Tests — estado: known

- Unit/integration: `go test ./...` distingue paquetes y puede combinarse con fixtures reales.
- Concurrencia: `go test -race ./...` cuando el proyecto y entorno lo soporten.
- Cobertura: `go test -cover ./...` o configuración equivalente; no asumir que `go test` la mide.
- E2E, DB y red deben declararse aparte; la suite unitaria no los sustituye.

## Errores y concurrencia — estado: known

- Propagar errores explícitamente y envolverlos con contexto; revisar `errors.Is`/`errors.As` cuando
  importe conservar identidad.
- Revisar goroutines, channels, mutexes, ownership lógico, leaks, races, deadlocks y shutdown.
- En servicios, verificar context cancellation, deadlines, timeouts, retries y límites de recursos.

## Dependencias y seguridad — estado: known

- Revisar `go.mod`/`go.sum`, módulos indirectos, versiones y comandos de auditoría disponibles.
- Detectar `govulncheck`, `staticcheck` u otros checks; ausencia significa `missing`/`blocked`.
- Revisar parsing, HTTP, SSRF, auth, secrets, filesystem, subprocesses y exposición de debug junto
  con los roadmaps de seguridad.

## No asumir

- Go no implica que existan `gofmt`, `go vet`, race detector, `staticcheck` o `govulncheck`.
- `go test ./...` no prueba automáticamente carga, integración externa, E2E ni comportamiento en
  producción.
- La facilidad de goroutines no elimina problemas de lifecycle, backpressure, leaks o carreras.
- Detectar versión, módulos, tipo de entrega y comandos ejecutables antes de marcar `verified`.
