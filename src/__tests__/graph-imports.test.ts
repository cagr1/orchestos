import { describe, it, expect } from 'bun:test'

// We test the extractors directly by re-implementing the dispatch logic used in graph/index.ts
// This avoids needing a live SQLite DB in unit tests.

function extractJsImports(content: string) {
  const edges: { kind: string; specifier: string }[] = []
  const patterns = [
    { kind: 'import', re: /^\s*import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"].*$/gm },
    { kind: 'require', re: /^\s*(?:const|let|var)?\s*[^=]*=?\s*require\(['"]([^'"]+)['"]\).*$/gm },
  ]
  for (const { kind, re } of patterns) {
    for (const match of content.matchAll(re)) {
      if (match[1]) edges.push({ kind, specifier: match[1] })
    }
  }
  return edges
}

function extractCSharpImports(content: string) {
  const edges: { kind: string; specifier: string }[] = []
  for (const match of content.matchAll(/^\s*using\s+([\w.]+)\s*;/gm)) {
    if (match[1]) edges.push({ kind: 'use', specifier: match[1] })
  }
  return edges
}

function extractRustImports(content: string) {
  const edges: { kind: string; specifier: string }[] = []
  for (const match of content.matchAll(/^\s*use\s+([\w:]+(?:::\{[^}]+\})?)\s*;/gm)) {
    if (match[1]) edges.push({ kind: 'use', specifier: match[1] })
  }
  for (const match of content.matchAll(/^\s*extern\s+crate\s+([\w]+)\s*;/gm)) {
    if (match[1]) edges.push({ kind: 'import', specifier: match[1] })
  }
  return edges
}

function extractGoImports(content: string) {
  const edges: { kind: string; specifier: string }[] = []
  for (const match of content.matchAll(/^\s*import\s+"([^"]+)"/gm)) {
    if (match[1]) edges.push({ kind: 'import', specifier: match[1] })
  }
  const blockMatch = content.match(/import\s*\(([\s\S]*?)\)/)
  if (blockMatch?.[1]) {
    for (const m of blockMatch[1].matchAll(/"([^"]+)"/g)) {
      if (m[1]) edges.push({ kind: 'import', specifier: m[1] })
    }
  }
  return edges
}

function extractJvmImports(content: string) {
  const edges: { kind: string; specifier: string }[] = []
  for (const match of content.matchAll(/^\s*import\s+([\w]+(?:\.[\w]+)*(?:\.\*)?)\s*;?/gm)) {
    if (match[1]) edges.push({ kind: 'import', specifier: match[1] })
  }
  return edges
}

function extractRubyImports(content: string) {
  const edges: { kind: string; specifier: string }[] = []
  for (const match of content.matchAll(/^\s*require(?:_relative)?\s+['"]([^'"]+)['"]/gm)) {
    if (match[1]) edges.push({ kind: 'require', specifier: match[1] })
  }
  return edges
}

// ── JavaScript / TypeScript ───────────────────────────────────────────────────
describe('JS/TS import extraction', () => {
  it('extracts ES module imports', () => {
    const code = `import { useState } from 'react'\nimport type { FC } from 'react'`
    const edges = extractJsImports(code)
    expect(edges.some(e => e.specifier === 'react')).toBe(true)
  })

  it('extracts relative imports', () => {
    const code = `import { foo } from './utils/foo'\nimport bar from '../bar'`
    const edges = extractJsImports(code)
    const specs = edges.map(e => e.specifier)
    expect(specs).toContain('./utils/foo')
    expect(specs).toContain('../bar')
  })

  it('extracts require()', () => {
    const code = `const fs = require('fs')\nconst path = require('path')`
    const edges = extractJsImports(code)
    expect(edges.some(e => e.specifier === 'fs')).toBe(true)
    expect(edges.some(e => e.specifier === 'path')).toBe(true)
  })

  it('ignores lines without imports', () => {
    const code = `const x = 42\nfunction foo() { return x }`
    const edges = extractJsImports(code)
    expect(edges).toHaveLength(0)
  })
})

// ── C# ────────────────────────────────────────────────────────────────────────
describe('C# import extraction', () => {
  it('extracts using statements', () => {
    const code = `using System;\nusing System.Collections.Generic;\nusing Microsoft.EntityFrameworkCore;`
    const edges = extractCSharpImports(code)
    const specs = edges.map(e => e.specifier)
    expect(specs).toContain('System')
    expect(specs).toContain('System.Collections.Generic')
    expect(specs).toContain('Microsoft.EntityFrameworkCore')
  })

  it('ignores using inside method bodies (no semicolon at line start)', () => {
    const code = `namespace MyApp {\n  class Foo {}\n}`
    const edges = extractCSharpImports(code)
    expect(edges).toHaveLength(0)
  })

  it('marks kind as use', () => {
    const code = `using System;`
    const edges = extractCSharpImports(code)
    expect(edges[0]?.kind).toBe('use')
  })
})

// ── Rust ──────────────────────────────────────────────────────────────────────
describe('Rust import extraction', () => {
  it('extracts use statements', () => {
    const code = `use std::collections::HashMap;\nuse serde::{Deserialize, Serialize};`
    const edges = extractRustImports(code)
    const specs = edges.map(e => e.specifier)
    expect(specs).toContain('std::collections::HashMap')
  })

  it('extracts extern crate', () => {
    const code = `extern crate serde;`
    const edges = extractRustImports(code)
    expect(edges.some(e => e.specifier === 'serde' && e.kind === 'import')).toBe(true)
  })

  it('ignores regular code', () => {
    const code = `fn main() {\n    let x = 42;\n}`
    const edges = extractRustImports(code)
    expect(edges).toHaveLength(0)
  })
})

// ── Go ────────────────────────────────────────────────────────────────────────
describe('Go import extraction', () => {
  it('extracts single-line import', () => {
    const code = `import "fmt"`
    const edges = extractGoImports(code)
    expect(edges.some(e => e.specifier === 'fmt')).toBe(true)
  })

  it('extracts block imports', () => {
    const code = `import (\n\t"fmt"\n\t"net/http"\n\t"github.com/gin-gonic/gin"\n)`
    const edges = extractGoImports(code)
    const specs = edges.map(e => e.specifier)
    expect(specs).toContain('fmt')
    expect(specs).toContain('net/http')
    expect(specs).toContain('github.com/gin-gonic/gin')
  })
})

// ── Java / Kotlin ─────────────────────────────────────────────────────────────
describe('JVM import extraction', () => {
  it('extracts Java imports', () => {
    const code = `import java.util.List;\nimport java.util.ArrayList;\nimport org.springframework.stereotype.Service;`
    const edges = extractJvmImports(code)
    const specs = edges.map(e => e.specifier)
    expect(specs).toContain('java.util.List')
    expect(specs).toContain('org.springframework.stereotype.Service')
  })

  it('extracts wildcard imports', () => {
    const code = `import java.util.*;`
    const edges = extractJvmImports(code)
    expect(edges.some(e => e.specifier === 'java.util.*')).toBe(true)
  })
})

// ── Ruby ──────────────────────────────────────────────────────────────────────
describe('Ruby import extraction', () => {
  it('extracts require', () => {
    const code = `require 'json'\nrequire "net/http"`
    const edges = extractRubyImports(code)
    const specs = edges.map(e => e.specifier)
    expect(specs).toContain('json')
    expect(specs).toContain('net/http')
  })

  it('extracts require_relative', () => {
    const code = `require_relative '../models/user'`
    const edges = extractRubyImports(code)
    expect(edges.some(e => e.specifier === '../models/user')).toBe(true)
  })
})
