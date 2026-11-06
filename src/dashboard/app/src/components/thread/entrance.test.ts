import { beforeEach, describe, expect, test } from 'bun:test'
import {
  enterSession,
  entranceModes,
  markEntered,
  noteLocalSend,
  noteStreamed,
  resetEntrances,
} from './entrance'

const msg = (id: string, role: string, content: string) => ({ id, role, content })

describe('entranceModes', () => {
  beforeEach(resetEntrances)

  test('el historial al abrir es static', () => {
    const history = [msg('1', 'user', 'hola'), msg('2', 'assistant', 'qué tal')]
    expect([...entranceModes('s', history).values()]).toEqual(['static', 'static'])
  })

  test('un mensaje nuevo en un hilo abierto anima una sola vez', () => {
    const history = [msg('1', 'user', 'hola')]
    markEntered('s', history)
    const next = [...history, msg('2', 'assistant', 'hey')]
    expect(entranceModes('s', next).get('2')).toBe('animate')
    markEntered('s', next)
    expect(entranceModes('s', next).get('2')).toBe('static')
  })

  test('la copia del servidor que reemplaza al optimista no anima', () => {
    noteLocalSend('s')
    const optimistic = [msg('tmp', 'user', 'hola')]
    expect(entranceModes('s', optimistic).get('tmp')).toBe('animate')
    markEntered('s', optimistic)
    expect(entranceModes('s', [msg('srv', 'user', 'hola')]).get('srv')).toBe('static')
  })

  test('la primera carga de historial tras abrir vacío es static; con envío local anima', () => {
    expect(entranceModes('a', [msg('1', 'user', 'x')]).get('1')).toBe('static')
    noteLocalSend('b')
    expect(entranceModes('b', [msg('1', 'user', 'x')]).get('1')).toBe('animate')
  })

  test('el mensaje final tras streaming no anima', () => {
    markEntered('s', [msg('1', 'user', 'hola')])
    noteStreamed('s')
    const done = [msg('1', 'user', 'hola'), msg('2', 'assistant', 'respuesta')]
    expect(entranceModes('s', done).get('2')).toBe('static')
  })

  test('un re-montaje con el registro lleno no re-anima', () => {
    const thread = [msg('1', 'user', 'hola'), msg('2', 'assistant', 'hey')]
    markEntered('s', thread)
    expect([...entranceModes('s', thread).values()]).toEqual(['static', 'static'])
  })

  test('volver a una sesión: la primera lista cargada es historial', () => {
    const a = [msg('1', 'user', 'hola')]
    enterSession('a')
    markEntered('a', a)
    enterSession('b')
    enterSession('a')
    const back = [...a, msg('2', 'assistant', 'llegó mientras estaba en B')]
    expect([...entranceModes('a', back).values()]).toEqual(['static', 'static'])
  })

  test('un hilo abierto vacío y ya cargado anima su primer mensaje', () => {
    enterSession('s')
    markEntered('s', [], false)
    expect(entranceModes('s', [msg('1', 'assistant', 'reporte')]).get('1')).toBe('static')
    markEntered('s', [], true)
    expect(entranceModes('s', [msg('1', 'assistant', 'reporte')]).get('1')).toBe('animate')
  })

  test('reenviar el mismo texto tras un error anima', () => {
    markEntered('s', [msg('1', 'user', 'hola')])
    noteLocalSend('s')
    const optimistic = [msg('1', 'user', 'hola'), msg('tmp', 'user', 'reintento')]
    markEntered('s', optimistic)
    markEntered('s', [msg('1', 'user', 'hola')])
    const retry = [msg('1', 'user', 'hola'), msg('tmp2', 'user', 'reintento')]
    expect(entranceModes('s', retry).get('tmp2')).toBe('animate')
  })
})
