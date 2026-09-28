/*
 * Invented data for the specimen route. Nothing here comes from a real Drawing Set: the sheet
 * numbers, titles, names and codes follow the seeded demo project of docs/design/m0-screens.md §7.
 * Drawing text and names are data (m0-screens §1.7), so they live here rather than in a catalogue.
 */
import type { Status } from '@/ui/StatusMark'

export interface SpecimenSheet {
  number: string
  title: string
  revision: string
  status: Status
  questionId?: string
  views: [number, number | null]
}

export const SHEETS: readonly SpecimenSheet[] = [
  { number: 'S-01', title: 'GENERAL NOTES', revision: 'R0', status: 'confirmed', views: [1, 1] },
  { number: 'S-02', title: 'PILE LAYOUT PLAN', revision: 'R0', status: 'confirmed', views: [2, 2] },
  { number: 'S-03', title: 'PILE CAP DETAILS', revision: 'R1', status: 'proposal', views: [3, 4] },
  { number: 'S-04', title: 'GROUND FLOOR COLUMN LAYOUT', revision: 'R0', status: 'question', questionId: 'Q3', views: [1, 2] },
  { number: 'S-05', title: 'COLUMN SCHEDULE', revision: 'R0', status: 'proposal', views: [1, 1] },
  { number: 'S-06', title: 'GRADE BEAM LAYOUT PLAN', revision: 'R0', status: 'proposal', views: [2, null] },
  { number: 'S-07', title: 'TYPICAL FLOOR BEAM LAYOUT (LEVEL 2 TO LEVEL 9)', revision: 'R2', status: 'proposal', views: [1, 3] },
  { number: 'S-08', title: 'ROOF SLAB REINFORCEMENT DETAILS', revision: 'R0', status: 'excluded', views: [0, 1] },
]

export const TITLE_OTHER_SCRIPT = 'مخطط الطابق الأرضي'
export const FILE_NAME = 'KR-STR-R0.dwg'
export const PROJECT_NAME = 'Kadam Residence'

export const DEVELOPER = 'Shapla Homes Ltd'
export const PROJECTS_ONE = ['KR-01']
export const PROJECTS_TWO = ['KR-01', 'BP-02']
export const PROJECTS_MANY = ['KR-01', 'BP-02', 'GH-03', 'LM-04']
export const UNTIL = '26 Oct 2026'

/** Grid labels on the canvas specimen, as a sheet writes them. */
export const GRID_X = ['A', 'B', 'C', 'D']
export const GRID_Y = ['1', '2', '3']
