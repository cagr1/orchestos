import { readPlanDoc } from '../../plan/read-plan-doc.ts'
import { jsonResponse } from '../http.ts'

export function handleApiPlanDoc(root: string): Response {
  return jsonResponse(readPlanDoc(root))
}
