export const MISTAKE_TAGS = [
  'overextend',
  'no_vision',
  'bad_back',
  'missed_cs',
  'bad_trade',
  'wave_mgmt',
  'ignored_objective',
  'bad_teamfight',
  'face_check',
  'greedy',
  'no_tracking',
  'tilted',
  'autopilot',
  'matchup_knowledge'
] as const

export const GOOD_TAGS = [
  'good_wave',
  'good_roam',
  'good_vision',
  'good_objective',
  'good_teamfight',
  'good_mental',
  'good_tracking',
  'carried'
] as const

export const isGoodTag = (tag: string) => (GOOD_TAGS as readonly string[]).includes(tag)
