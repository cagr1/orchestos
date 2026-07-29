---
language: Rust
runtime: rustc
package_manager: Cargo
state: known
last_verified: 2026-07-29
evidence:
  - "Cargo.toml" no existe en OrchestOS
  - "cargo --version" → comando ausente en el entorno
  - "rustc --version" → comando ausente en el entorno
---

# Perfil de lenguaje — Rust

Perfil secundario de ecosistema. Su contenido es `known` porque este repositorio no contiene un
proyecto Rust y el toolchain no está instalado; no se presenta como capacidad verificada de OrchestOS.
La disciplina de arquitectura, QA/seguridad y operación sigue siendo la autoridad para el “qué”.

## Entorno y proyecto — estado: known/missing

- Detectar `Cargo.toml`, `Cargo.lock`, workspace, edition y toolchain fijado antes de elegir comandos.
- `cargo` es package manager, build runner, test runner y entrypoint habitual del proyecto Rust.
- Runtime/entrega pueden ser library, binario CLI, service o componente embebido; detectar el tipo real.
- En OrchestOS: `Cargo.toml`, `cargo` y `rustc` no están presentes; estado `missing`, no `pass`.

## Edición y formato — estado: known

- Preferir `rustfmt`/`cargo fmt --check` cuando el proyecto lo tenga disponible.
- Leer edition, workspace y convenciones antes de editar; no asumir que la edición por defecto coincide
  con el código.

## Compilación y tests — estado: known

- Build reproducible: `cargo build` o el perfil/target declarado por el proyecto.
- Tests: `cargo test`, distinguiendo unit, integration tests en `tests/` y doctests.
- Documentación: `cargo doc` y doctests cuando el crate publique API.
- Si el comando no está instalado o no existe manifest, declarar `missing`/`blocked`.

## Errores y concurrencia — estado: known

- Diseñar tipos `Result`/`Option` y errores de dominio; evitar `unwrap`/`expect` en fronteras externas
  salvo invariantes documentadas.
- Revisar ownership, borrowing, lifetimes, `Send`/`Sync`, threads, async runtime, locks y canales.
- Probar cancelación, timeouts, backpressure y shutdown si es un service o worker concurrente.

## Dependencias y seguridad — estado: known

- Revisar `Cargo.lock`, features, dependencias transitorias y reproducibilidad.
- Detectar `cargo clippy` y auditoría como herramientas disponibles antes de convertirlas en gates.
- `cargo fmt`, `cargo clippy`, `cargo audit` y `cargo deny` no están verificados en este entorno;
  no asumir que existen.
- Revisar unsafe code, parsing, filesystem, subprocesses, red, secretos y límites de memoria junto con
  los roadmaps de disciplina.

## No asumir

- Rust no implica que exista Cargo, clippy, audit, un async runtime o una arquitectura de service.
- `cargo test` no cubre automáticamente integración con DB, red, procesos o E2E.
- Ownership evita algunas clases de bugs, pero no reemplaza pruebas de lógica, deadlocks, starvation,
  races en APIs unsafe ni validación de inputs.
- Detectar el tipo de entrega, target, toolchain y comandos reales antes de marcar una etapa `verified`.

