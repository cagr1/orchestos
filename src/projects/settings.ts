/** Local project preferences shared by validation and the icon picker. */
export const PROJECT_ICONS = [
  'FolderClosed',
  'Folder',
  'Code',
  'Globe',
  'Server',
  'Database',
  'Smartphone',
  'Bot',
  'Package',
  'Rocket',
  'Wrench',
  'Book',
  'Gamepad2',
] as const
export type ProjectIconName = (typeof PROJECT_ICONS)[number]
