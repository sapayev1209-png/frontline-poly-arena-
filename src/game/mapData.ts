import {
  DynamicPropState,
  NavWaypoint,
  ObjectiveState,
  RegionId,
  StructureCollider,
  SurfaceType,
} from '../types/game';

export const ARENA_HALF_SIZE = 240; // 480m x 480m playable battlefield (~500x500 world units)
export const MAX_WALKABLE_SLOPE = 0.72; // ~36 deg maximum walkable terrain slope
export const MAX_STEP_HEIGHT = 0.48; // Maximum step-up height for ramps/curbs/duckboards

/**
 * Returns the Uzbek region name for any (x, z) world coordinate.
 */
export function getRegionAt(x: number, z: number): { id: RegionId; nameUz: string } {
  if (z >= 90 && z <= 155 && Math.abs(x) <= 75) {
    return { id: 'southern_bridge', nameUz: 'JANUBIY DARYO KO‘PRIGI' };
  }
  if (z <= -80 && Math.abs(x) <= 120) {
    return { id: 'northern_woodland', nameUz: 'SHIMOLIY O‘RMON YO‘LI' };
  }
  if (x <= -75 && Math.abs(z) <= 85) {
    return { id: 'western_trenches', nameUz: 'G‘ARBIY MUDOFAA TRANSHEYASI' };
  }
  if (x >= 75 && Math.abs(z) <= 85) {
    return { id: 'eastern_industry', nameUz: 'SHARQIY SANOAT OMBORI' };
  }
  if (Math.abs(x) <= 68 && Math.abs(z) <= 68) {
    return { id: 'central_village', nameUz: 'TEMIR QISHLOQ MARKAZI' };
  }
  return { id: 'open_battlefield', nameUz: 'G‘ARB FRONTI · OCHIQ MAYDON' };
}

/**
 * Centralized 6-category surface classification ('earth', 'wood', 'stone', 'water', 'interior', 'grass')
 */
export function getSurfaceTypeAt(x: number, z: number): SurfaceType {
  // Southern river & bridge
  if (Math.abs(z - 120) < 20) {
    if (Math.abs(x) <= 10.5) return 'wood';
    if (x >= 92 && x <= 118) return 'stone';
    return 'water';
  }
  // Western trench timber duckboards
  if (Math.abs(x - -126) < 3.6 && z > -52 && z < 48) return 'wood';
  if (Math.abs(z - -12) < 3.6 && x > -162 && x < -84) return 'wood';
  // Ruined building/warehouse interior floors & courtyards
  if (
    (Math.abs(x - 0) <= 14 && Math.abs(z - 0) <= 14) ||
    (Math.abs(x - 116) <= 14 && Math.abs(z - 16) <= 14)
  ) {
    return 'interior';
  }
  // Paved village roads & industrial concrete pads
  if ((Math.abs(x) <= 55 && Math.abs(z) <= 55) || (x >= 80 && Math.abs(z) <= 75)) {
    return 'stone';
  }
  // Northern woodland & grassy meadows
  if (z < -72 || (Math.abs(x) > 65 && Math.abs(z) > 60 && z < 88)) {
    return 'grass';
  }
  return 'earth';
}

/**
 * Authoritative continuous heightfield for "G'ARB FRONTI — TEMIR QISHLOQ".
 * Supports walkable trenches, rolling woodland hills, a river valley, and a walkable bridge deck.
 */
export function getTerrainHeight(x: number, z: number): number {
  // 1. Southern River & Bridge Crossing (river center at z = 120)
  const distToRiver = Math.abs(z - 120);
  if (distToRiver < 24) {
    // Central Stone & Timber Bridge deck: x in [-11, 11], z in [96, 144]
    if (Math.abs(x) <= 10.5) {
      const bridgePhase = Math.cos(((z - 120) / 24) * (Math.PI * 0.5));
      return 0.95 * bridgePhase;
    }
    // Eastern Shallow Stone Ford: x in [92, 118]
    if (x >= 92 && x <= 118) {
      const fordFactor = Math.cos(((z - 120) / 24) * (Math.PI * 0.5));
      return -0.25 * fordFactor;
    }
    // Riverbed depression with smooth walkable banks
    const bankT = Math.cos((distToRiver / 24) * (Math.PI * 0.5));
    return -1.45 * bankT;
  }

  // 2. Western Defensive Trench Network:
  // Main N-S Trench along x = -126, z in [-52, 48]
  const dxTrenchNS = Math.abs(x - -126);
  if (dxTrenchNS < 4.8 && z > -56 && z < 52) {
    const xFactor = dxTrenchNS < 2.2 ? 1.0 : 1.0 - (dxTrenchNS - 2.2) / 2.6;
    let zFactor = 1.0;
    if (z < -44) zFactor = Math.max(0, (z - -56) / 12);
    else if (z > 40) zFactor = Math.max(0, (52 - z) / 12);
    return -1.35 * xFactor * zFactor;
  }

  // Connecting E-W Communication Trench along z = -12, x in [-162, -84]
  const dzTrenchEW = Math.abs(z - -12);
  if (dzTrenchEW < 4.5 && x > -166 && x < -80) {
    const zFactor = dzTrenchEW < 2.1 ? 1.0 : 1.0 - (dzTrenchEW - 2.1) / 2.4;
    let xFactor = 1.0;
    if (x < -154) xFactor = Math.max(0, (x - -166) / 12);
    else if (x > -92) xFactor = Math.max(0, (-80 - x) / 12);
    return -1.35 * zFactor * xFactor;
  }

  // 3. Northern Woodland gentle hills (z < -75)
  if (z < -75) {
    const northBlend = Math.min(1, (-75 - z) / 45);
    const hillWave =
      (Math.sin(x * 0.032) * Math.cos(z * 0.035) + 0.6) * 1.45 * northBlend;
    return hillWave;
  }

  // 4. Subtle battlefield undulations and craters outside flat village/industrial pads
  const distFromCenter = Math.hypot(x, z);
  const villageFlatMask = Math.min(1, Math.max(0, (distFromCenter - 48) / 30));
  const undulation =
    Math.sin(x * 0.024) * Math.cos(z * 0.024) * 0.45 * villageFlatMask;

  return undulation;
}

export const INITIAL_OBJECTIVES: ObjectiveState[] = [
  {
    id: 'A',
    name: 'A · G‘ARBIY TRANSHEYA VA RADAR',
    regionUz: 'G‘arbiy Mudofaa Chizig‘i',
    x: -112,
    z: -12,
    radius: 13,
    progress: 0,
    owner: 'neutral',
    contested: false,
    blueCount: 0,
    redCount: 0,
  },
  {
    id: 'B',
    name: 'B · TEMIR QISHLOQ MAYDONI',
    regionUz: 'Markaziy Vayrona Qishloq',
    x: 0,
    z: 0,
    radius: 14,
    progress: 0,
    owner: 'neutral',
    contested: false,
    blueCount: 0,
    redCount: 0,
  },
  {
    id: 'C',
    name: 'C · SHARQIY SANOAT OMBORI',
    regionUz: 'Sharqiy Sanoat Sektori',
    x: 116,
    z: 16,
    radius: 13,
    progress: 0,
    owner: 'neutral',
    contested: false,
    blueCount: 0,
    redCount: 0,
  },
];

export const ARENA_STRUCTURES: StructureCollider[] = [
  // =========================================================================
  // TEAM SPAWN COMMAND BUNKERS (Protected West-South & East-North Bases)
  // =========================================================================
  {
    id: 'blue_hq_bunker',
    nameUz: 'Ittifoqchi G‘arbiy Shtabi',
    region: 'western_trenches',
    type: 'bunker',
    x: -178,
    z: 68,
    width: 16,
    depth: 8,
    height: 4.8,
    colorVariant: 'olive',
  },
  {
    id: 'blue_hq_sandbags_n',
    region: 'western_trenches',
    type: 'sandbag',
    x: -164,
    z: 54,
    width: 9,
    depth: 2.2,
    height: 1.5,
    colorVariant: 'sand',
  },
  {
    id: 'blue_hq_sandbags_e',
    region: 'western_trenches',
    type: 'sandbag',
    x: -158,
    z: 72,
    width: 2.2,
    depth: 9,
    height: 1.5,
    colorVariant: 'sand',
  },

  {
    id: 'red_hq_bunker',
    nameUz: 'Raqib Sharqiy Shtabi',
    region: 'eastern_industry',
    type: 'bunker',
    x: 178,
    z: -68,
    width: 16,
    depth: 8,
    height: 4.8,
    colorVariant: 'slate',
  },
  {
    id: 'red_hq_sandbags_s',
    region: 'eastern_industry',
    type: 'sandbag',
    x: 164,
    z: -54,
    width: 9,
    depth: 2.2,
    height: 1.5,
    colorVariant: 'sand',
  },
  {
    id: 'red_hq_sandbags_w',
    region: 'eastern_industry',
    type: 'sandbag',
    x: 158,
    z: -72,
    width: 2.2,
    depth: 9,
    height: 1.5,
    colorVariant: 'sand',
  },

  // =========================================================================
  // REGION A: WESTERN DEFENSIVE LINE (G'arbiy Mudofaa Chizig'i)
  // =========================================================================
  {
    id: 'west_obs_tower',
    nameUz: 'G‘arbiy Kuzatuv Minorasi',
    region: 'western_trenches',
    type: 'tower',
    x: -138,
    z: -28,
    width: 7.5,
    depth: 7.5,
    height: 8.5,
    colorVariant: 'wood',
  },
  {
    id: 'west_command_pillbox',
    region: 'western_trenches',
    type: 'bunker',
    x: -98,
    z: -32,
    width: 10,
    depth: 7,
    height: 4.0,
    colorVariant: 'slate',
  },
  {
    id: 'west_trench_parapet_1',
    region: 'western_trenches',
    type: 'sandbag',
    x: -116,
    z: 12,
    width: 2.4,
    depth: 12,
    height: 1.4,
    colorVariant: 'sand',
  },
  {
    id: 'west_trench_parapet_2',
    region: 'western_trenches',
    type: 'sandbag',
    x: -102,
    z: -2,
    width: 8,
    depth: 2.2,
    height: 1.4,
    colorVariant: 'sand',
  },
  {
    id: 'west_supply_depot',
    region: 'western_trenches',
    type: 'depot',
    x: -144,
    z: 20,
    width: 11,
    depth: 6,
    height: 3.8,
    colorVariant: 'olive',
  },
  {
    id: 'west_destructible_crate_1',
    region: 'western_trenches',
    type: 'crate',
    x: -106,
    z: -18,
    width: 2.6,
    depth: 2.6,
    height: 2.1,
    colorVariant: 'wood',
    destructible: true,
    hp: 90,
    maxHp: 90,
  },
  {
    id: 'west_destructible_crate_2',
    region: 'western_trenches',
    type: 'crate',
    x: -118,
    z: -5,
    width: 2.5,
    depth: 2.5,
    height: 2.0,
    colorVariant: 'wood',
    destructible: true,
    hp: 90,
    maxHp: 90,
  },

  // =========================================================================
  // REGION B: CENTRAL RUINED VILLAGE (Markaziy Vayrona Qishloq)
  // =========================================================================
  // Accessible Ruined Civic Hall (North of Square: 3 walls leaving wide Southern & Eastern doorways)
  {
    id: 'village_civic_north_wall',
    nameUz: 'Eski Hokimiyat Binolar Majmuasi',
    region: 'central_village',
    type: 'ruined_hall',
    x: 0,
    z: -34,
    width: 22,
    depth: 2.4,
    height: 6.8,
    colorVariant: 'brick',
  },
  {
    id: 'village_civic_west_wall',
    region: 'central_village',
    type: 'ruined_hall',
    x: -10,
    z: -26,
    width: 2.4,
    depth: 14,
    height: 6.2,
    colorVariant: 'brick',
  },
  {
    id: 'village_civic_belltower',
    region: 'central_village',
    type: 'tower',
    x: 11,
    z: -31,
    width: 6.5,
    depth: 6.5,
    height: 11.5,
    colorVariant: 'brick',
  },

  // Village Houses around Square
  {
    id: 'village_house_nw',
    region: 'central_village',
    type: 'village_house',
    x: -34,
    z: -24,
    width: 12,
    depth: 9,
    height: 5.4,
    colorVariant: 'brick',
  },
  {
    id: 'village_house_sw',
    region: 'central_village',
    type: 'village_house',
    x: -30,
    z: 24,
    width: 13,
    depth: 9.5,
    height: 5.2,
    colorVariant: 'sand',
  },
  {
    id: 'village_house_ne',
    region: 'central_village',
    type: 'village_house',
    x: 34,
    z: -20,
    width: 11,
    depth: 10,
    height: 5.5,
    colorVariant: 'brick',
  },
  {
    id: 'village_house_se',
    region: 'central_village',
    type: 'village_house',
    x: 28,
    z: 28,
    width: 14,
    depth: 9,
    height: 5.0,
    colorVariant: 'sand',
  },

  // Village Square Cover Walls & Destructible Crates
  {
    id: 'village_square_wall_w',
    region: 'central_village',
    type: 'wall',
    x: -14,
    z: 2,
    width: 2.2,
    depth: 9.5,
    height: 2.4,
    colorVariant: 'slate',
  },
  {
    id: 'village_square_wall_e',
    region: 'central_village',
    type: 'wall',
    x: 14,
    z: -2,
    width: 2.2,
    depth: 9.5,
    height: 2.4,
    colorVariant: 'slate',
  },
  {
    id: 'village_square_sandbag_s',
    region: 'central_village',
    type: 'sandbag',
    x: 0,
    z: 15,
    width: 8.5,
    depth: 2.2,
    height: 1.5,
    colorVariant: 'sand',
  },
  {
    id: 'village_crate_1',
    region: 'central_village',
    type: 'crate',
    x: -6,
    z: 7,
    width: 2.4,
    depth: 2.4,
    height: 1.9,
    colorVariant: 'wood',
    destructible: true,
    hp: 80,
    maxHp: 80,
  },
  {
    id: 'village_crate_2',
    region: 'central_village',
    type: 'crate',
    x: 7,
    z: -6,
    width: 2.4,
    depth: 2.4,
    height: 1.9,
    colorVariant: 'wood',
    destructible: true,
    hp: 80,
    maxHp: 80,
  },
  {
    id: 'village_truck_wreck',
    region: 'central_village',
    type: 'truck_wreck',
    x: -22,
    z: -2,
    width: 7.5,
    depth: 3.4,
    height: 2.9,
    colorVariant: 'olive',
  },

  // =========================================================================
  // REGION C: NORTHERN WOODLAND (Shimoliy O'rmon Yo'li)
  // =========================================================================
  {
    id: 'north_rock_1',
    region: 'northern_woodland',
    type: 'rock_outcrop',
    x: -56,
    z: -115,
    width: 8.5,
    depth: 7.5,
    height: 4.5,
    colorVariant: 'slate',
  },
  {
    id: 'north_rock_2',
    region: 'northern_woodland',
    type: 'rock_outcrop',
    x: -14,
    z: -135,
    width: 10,
    depth: 8,
    height: 5.2,
    colorVariant: 'slate',
  },
  {
    id: 'north_rock_3',
    region: 'northern_woodland',
    type: 'rock_outcrop',
    x: 42,
    z: -120,
    width: 9,
    depth: 7,
    height: 4.8,
    colorVariant: 'slate',
  },
  {
    id: 'north_logging_cabin',
    region: 'northern_woodland',
    type: 'depot',
    x: 8,
    z: -102,
    width: 10,
    depth: 7,
    height: 4.2,
    colorVariant: 'wood',
  },
  {
    id: 'north_tree_grove_w',
    region: 'northern_woodland',
    type: 'tree_trunk',
    x: -36,
    z: -96,
    width: 3.2,
    depth: 3.2,
    height: 9.0,
    colorVariant: 'wood',
  },
  {
    id: 'north_tree_grove_e',
    region: 'northern_woodland',
    type: 'tree_trunk',
    x: 28,
    z: -94,
    width: 3.2,
    depth: 3.2,
    height: 9.0,
    colorVariant: 'wood',
  },

  // =========================================================================
  // REGION D: SOUTHERN BRIDGE & RIVER (Janubiy Daryo va Ko'prik)
  // =========================================================================
  // Bridge Parapet Guardrails (keep vehicles/infantry on bridge deck while allowing N-S crossing)
  {
    id: 'bridge_rail_west',
    region: 'southern_bridge',
    type: 'bridge_pier',
    x: -11.5,
    z: 120,
    width: 1.6,
    depth: 42,
    height: 2.1,
    colorVariant: 'slate',
  },
  {
    id: 'bridge_rail_east',
    region: 'southern_bridge',
    type: 'bridge_pier',
    x: 11.5,
    z: 120,
    width: 1.6,
    depth: 42,
    height: 2.1,
    colorVariant: 'slate',
  },
  {
    id: 'bridge_north_checkpoint',
    region: 'southern_bridge',
    type: 'bunker',
    x: -22,
    z: 86,
    width: 8,
    depth: 6,
    height: 3.8,
    colorVariant: 'slate',
  },
  {
    id: 'bridge_south_checkpoint',
    region: 'southern_bridge',
    type: 'bunker',
    x: 20,
    z: 154,
    width: 8,
    depth: 6,
    height: 3.8,
    colorVariant: 'olive',
  },
  {
    id: 'bridge_crate_cover',
    region: 'southern_bridge',
    type: 'crate',
    x: -4,
    z: 118,
    width: 2.4,
    depth: 2.4,
    height: 1.8,
    colorVariant: 'wood',
    destructible: true,
    hp: 85,
    maxHp: 85,
  },

  // =========================================================================
  // REGION E: EASTERN INDUSTRIAL SECTOR (Sharqiy Sanoat Ombori)
  // =========================================================================
  {
    id: 'east_main_warehouse',
    nameUz: 'Temiryo‘l Yuk Ombori',
    region: 'eastern_industry',
    type: 'warehouse',
    x: 138,
    z: 18,
    width: 16,
    depth: 26,
    height: 7.4,
    colorVariant: 'brick',
  },
  {
    id: 'east_loading_dock',
    region: 'eastern_industry',
    type: 'depot',
    x: 108,
    z: 42,
    width: 18,
    depth: 7.5,
    height: 4.2,
    colorVariant: 'steel',
  },
  {
    id: 'east_rail_office',
    region: 'eastern_industry',
    type: 'bunker',
    x: 96,
    z: -14,
    width: 10,
    depth: 8,
    height: 4.5,
    colorVariant: 'slate',
  },
  {
    id: 'east_truck_wreck_1',
    region: 'eastern_industry',
    type: 'truck_wreck',
    x: 122,
    z: -12,
    width: 8,
    depth: 3.6,
    height: 3.0,
    colorVariant: 'olive',
  },
  {
    id: 'east_cargo_crate_1',
    region: 'eastern_industry',
    type: 'crate',
    x: 106,
    z: 12,
    width: 3.0,
    depth: 3.0,
    height: 2.4,
    colorVariant: 'accent',
    destructible: true,
    hp: 100,
    maxHp: 100,
  },
  {
    id: 'east_cargo_crate_2',
    region: 'eastern_industry',
    type: 'crate',
    x: 120,
    z: 26,
    width: 2.8,
    depth: 2.8,
    height: 2.2,
    colorVariant: 'wood',
    destructible: true,
    hp: 90,
    maxHp: 90,
  },

  // =========================================================================
  // REGION F: CONNECTING ROAD BERMS & MID-FIELD POSITIONS
  // =========================================================================
  {
    id: 'mid_west_berm',
    region: 'open_battlefield',
    type: 'sandbag',
    x: -64,
    z: -8,
    width: 3.0,
    depth: 11,
    height: 1.9,
    colorVariant: 'sand',
  },
  {
    id: 'mid_east_berm',
    region: 'open_battlefield',
    type: 'sandbag',
    x: 64,
    z: 8,
    width: 3.0,
    depth: 11,
    height: 1.9,
    colorVariant: 'sand',
  },
];

export const BLUE_SPAWN_POINTS = [
  { x: -162, z: 62 },
  { x: -152, z: 56 },
  { x: -168, z: 48 },
  { x: -146, z: 66 },
  { x: -156, z: 40 },
  { x: -140, z: 50 },
  { x: -172, z: 36 },
  { x: -136, z: 36 },
];

export const RED_SPAWN_POINTS = [
  { x: 162, z: -62 },
  { x: 152, z: -56 },
  { x: 168, z: -48 },
  { x: 146, z: -66 },
  { x: 156, z: -40 },
  { x: 140, z: -50 },
  { x: 172, z: -36 },
  { x: 136, z: -36 },
];

/**
 * Connected Navigation Waypoint Graph enabling AI bots to traverse trenches,
 * village streets, woodland flanks, and the southern bridge without getting stuck.
 */
export const NAV_WAYPOINTS: NavWaypoint[] = [
  { id: 'wp_blue_base', x: -152, z: 52, region: 'western_trenches', connections: ['wp_trench_south', 'wp_sw_road'] },
  { id: 'wp_trench_south', x: -126, z: 32, region: 'western_trenches', connections: ['wp_blue_base', 'wp_obj_a', 'wp_village_west'] },
  { id: 'wp_obj_a', x: -112, z: -12, region: 'western_trenches', connections: ['wp_trench_south', 'wp_west_road', 'wp_north_west'] },
  { id: 'wp_west_road', x: -58, z: -18, region: 'open_battlefield', connections: ['wp_obj_a', 'wp_obj_b', 'wp_village_west'] },
  { id: 'wp_village_west', x: -24, z: 12, region: 'central_village', connections: ['wp_trench_south', 'wp_west_road', 'wp_obj_b', 'wp_bridge_north'] },
  { id: 'wp_obj_b', x: 0, z: 0, region: 'central_village', connections: ['wp_west_road', 'wp_village_west', 'wp_village_east', 'wp_north_mid', 'wp_bridge_north'] },
  { id: 'wp_village_east', x: 24, z: -10, region: 'central_village', connections: ['wp_obj_b', 'wp_east_road', 'wp_bridge_north'] },
  { id: 'wp_east_road', x: 68, z: -4, region: 'open_battlefield', connections: ['wp_village_east', 'wp_obj_c', 'wp_red_base'] },
  { id: 'wp_obj_c', x: 116, z: 16, region: 'eastern_industry', connections: ['wp_east_road', 'wp_red_base', 'wp_ford_north'] },
  { id: 'wp_red_base', x: 152, z: -52, region: 'eastern_industry', connections: ['wp_obj_c', 'wp_east_road', 'wp_north_east'] },
  // Northern Woodland Route
  { id: 'wp_north_west', x: -75, z: -85, region: 'northern_woodland', connections: ['wp_obj_a', 'wp_north_mid'] },
  { id: 'wp_north_mid', x: -4, z: -88, region: 'northern_woodland', connections: ['wp_north_west', 'wp_north_east', 'wp_obj_b'] },
  { id: 'wp_north_east', x: 75, z: -85, region: 'northern_woodland', connections: ['wp_north_mid', 'wp_red_base'] },
  // Southern Bridge & River Crossing Route
  { id: 'wp_sw_road', x: -70, z: 82, region: 'open_battlefield', connections: ['wp_blue_base', 'wp_bridge_north'] },
  { id: 'wp_bridge_north', x: 0, z: 88, region: 'southern_bridge', connections: ['wp_sw_road', 'wp_village_west', 'wp_obj_b', 'wp_bridge_center', 'wp_ford_north'] },
  { id: 'wp_bridge_center', x: 0, z: 120, region: 'southern_bridge', connections: ['wp_bridge_north', 'wp_bridge_south'] },
  { id: 'wp_bridge_south', x: 0, z: 150, region: 'southern_bridge', connections: ['wp_bridge_center'] },
  { id: 'wp_ford_north', x: 104, z: 82, region: 'southern_bridge', connections: ['wp_obj_c', 'wp_bridge_north'] },
];

/**
 * Finds the next intermediate waypoint along the shortest graph path toward targetPos.
 */
export function getNextWaypointToward(
  fromX: number,
  fromZ: number,
  targetX: number,
  targetZ: number
): { x: number; z: number } {
  const directDist = Math.hypot(targetX - fromX, targetZ - fromZ);
  if (directDist < 38) {
    return { x: targetX, z: targetZ };
  }

  let startWp = NAV_WAYPOINTS[0];
  let endWp = NAV_WAYPOINTS[0];
  let bestStartD = Infinity;
  let bestEndD = Infinity;

  for (const wp of NAV_WAYPOINTS) {
    const ds = (wp.x - fromX) * (wp.x - fromX) + (wp.z - fromZ) * (wp.z - fromZ);
    if (ds < bestStartD) {
      bestStartD = ds;
      startWp = wp;
    }
    const de = (wp.x - targetX) * (wp.x - targetX) + (wp.z - targetZ) * (wp.z - targetZ);
    if (de < bestEndD) {
      bestEndD = de;
      endWp = wp;
    }
  }

  if (startWp.id === endWp.id) {
    return { x: targetX, z: targetZ };
  }

  // BFS shortest path on NAV_WAYPOINTS
  const queue: string[][] = [[startWp.id]];
  const visited = new Set<string>([startWp.id]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const currentId = path[path.length - 1];
    if (currentId === endWp.id) {
      const nextId = path.length > 1 ? path[1] : path[0];
      const nextNode = NAV_WAYPOINTS.find((w) => w.id === nextId);
      if (nextNode) {
        // If already very close to startWp, step to path[1], otherwise head to startWp
        if (bestStartD < 14 * 14 && path.length > 1) {
          return { x: nextNode.x, z: nextNode.z };
        }
        return { x: startWp.x, z: startWp.z };
      }
    }

    const node = NAV_WAYPOINTS.find((w) => w.id === currentId);
    if (!node) continue;
    for (const connId of node.connections) {
      if (!visited.has(connId)) {
        visited.add(connId);
        queue.push([...path, connId]);
      }
    }
  }

  return { x: targetX, z: targetZ };
}

/**
 * Returns the terrain slope gradient magnitude at (x, z).
 */
export function getTerrainSlope(x: number, z: number): number {
  const eps = 0.6;
  const dhx = (getTerrainHeight(x + eps, z) - getTerrainHeight(x - eps, z)) / (2 * eps);
  const dhz = (getTerrainHeight(x, z + eps) - getTerrainHeight(x, z - eps)) / (2 * eps);
  return Math.hypot(dhx, dhz);
}

/**
 * Checks whether a character at (x, y, z) has enough vertical clearance (1.82m)
 * to transition from crouching to standing without intersecting an overhead beam or lintel.
 */
export function hasOverheadClearance(
  x: number,
  y: number,
  z: number,
  structures: StructureCollider[] = ARENA_STRUCTURES
): boolean {
  const standingTopY = y + 1.82;
  for (let i = 0; i < structures.length; i++) {
    const s = structures[i];
    if (s.destroyed || !s.ceilingHeight) continue;
    const halfW = s.width * 0.5 + 0.35;
    const halfD = s.depth * 0.5 + 0.35;
    if (Math.abs(x - s.x) <= halfW && Math.abs(z - s.z) <= halfD) {
      const baseY = getTerrainHeight(s.x, s.z);
      if (standingTopY > baseY + s.ceilingHeight) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Resolves a circle (x, z, radius) against all active (non-destroyed) AABB structures
 * and battlefield boundaries, returning resolved coordinates and wall-slide contact normal.
 */
export function resolveArenaCollision(
  x: number,
  z: number,
  radius: number,
  structures: StructureCollider[] = ARENA_STRUCTURES
): {
  x: number;
  z: number;
  hitWall: boolean;
  normalX: number;
  normalZ: number;
} {
  let nextX = x;
  let nextZ = z;
  let hitWall = false;
  let normalX = 0;
  let normalZ = 0;

  const limit = ARENA_HALF_SIZE - radius;
  if (nextX < -limit) {
    nextX = -limit;
    hitWall = true;
    normalX = 1;
  } else if (nextX > limit) {
    nextX = limit;
    hitWall = true;
    normalX = -1;
  }

  if (nextZ < -limit) {
    nextZ = -limit;
    hitWall = true;
    normalZ = 1;
  } else if (nextZ > limit) {
    nextZ = limit;
    hitWall = true;
    normalZ = -1;
  }

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < structures.length; i++) {
      const s = structures[i];
      if (s.destroyed) continue;

      const halfW = s.width * 0.5;
      const halfD = s.depth * 0.5;
      const minX = s.x - halfW;
      const maxX = s.x + halfW;
      const minZ = s.z - halfD;
      const maxZ = s.z + halfD;

      const closestX = Math.max(minX, Math.min(nextX, maxX));
      const closestZ = Math.max(minZ, Math.min(nextZ, maxZ));

      const dx = nextX - closestX;
      const dz = nextZ - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        hitWall = true;
        if (distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const overlap = radius - dist;
          const nx = dx / dist;
          const nz = dz / dist;
          nextX += nx * overlap;
          nextZ += nz * overlap;
          normalX += nx;
          normalZ += nz;
        } else {
          const penLeft = Math.abs(nextX - minX);
          const penRight = Math.abs(maxX - nextX);
          const penTop = Math.abs(nextZ - minZ);
          const penBottom = Math.abs(maxZ - nextZ);
          const minPen = Math.min(penLeft, penRight, penTop, penBottom);
          if (minPen === penLeft) {
            nextX = minX - radius;
            normalX -= 1;
          } else if (minPen === penRight) {
            nextX = maxX + radius;
            normalX += 1;
          } else if (minPen === penTop) {
            nextZ = minZ - radius;
            normalZ -= 1;
          } else {
            nextZ = maxZ + radius;
            normalZ += 1;
          }
        }
      }
    }
  }

  const nLen = Math.hypot(normalX, normalZ);
  if (nLen > 1e-5) {
    normalX /= nLen;
    normalZ /= nLen;
  }

  return { x: nextX, z: nextZ, hitWall, normalX, normalZ };
}

/**
 * Checks if a 3D segment (ax, ay, az) -> (bx, by, bz) intersects any active structure AABB.
 * Accounts for local terrain elevation at each structure's base.
 */
export function raycastStructures(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  structures: StructureCollider[] = ARENA_STRUCTURES
): {
  hit: boolean;
  fraction: number;
  hitX: number;
  hitY: number;
  hitZ: number;
  hitStructureId: string | null;
} {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;

  let bestT = 1.0;
  let hit = false;
  let hitStructureId: string | null = null;

  for (let i = 0; i < structures.length; i++) {
    const s = structures[i];
    if (s.destroyed) continue;

    const baseY = getTerrainHeight(s.x, s.z);
    const minX = s.x - s.width * 0.5;
    const maxX = s.x + s.width * 0.5;
    const minY = baseY - 0.5;
    const maxY = baseY + s.height;
    const minZ = s.z - s.depth * 0.5;
    const maxZ = s.z + s.depth * 0.5;

    let tmin = 0.0;
    let tmax = bestT;

    if (Math.abs(dx) < 1e-6) {
      if (ax < minX || ax > maxX) continue;
    } else {
      const invD = 1.0 / dx;
      let t1 = (minX - ax) * invD;
      let t2 = (maxX - ax) * invD;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }

    if (Math.abs(dy) < 1e-6) {
      if (ay < minY || ay > maxY) continue;
    } else {
      const invD = 1.0 / dy;
      let t1 = (minY - ay) * invD;
      let t2 = (maxY - ay) * invD;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }

    if (Math.abs(dz) < 1e-6) {
      if (az < minZ || az > maxZ) continue;
    } else {
      const invD = 1.0 / dz;
      let t1 = (minZ - az) * invD;
      let t2 = (maxZ - az) * invD;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }

    if (tmin <= tmax && tmin < bestT && tmin >= 0) {
      bestT = tmin;
      hit = true;
      hitStructureId = s.id;
    }
  }

  return {
    hit,
    fraction: bestT,
    hitX: ax + dx * bestT,
    hitY: ay + dy * bestT,
    hitZ: az + dz * bestT,
    hitStructureId,
  };
}

/**
 * Bounded set of lightweight dynamic physics props (12 barrels and small field crates)
 * that respond to player/bot impacts and weapon fire and settle cleanly on the terrain.
 */
export const INITIAL_DYNAMIC_PROPS: DynamicPropState[] = [
  { id: 'dyn_barrel_1', kind: 'barrel', x: -106, y: 0, z: -8, vx: 0, vy: 0, vz: 0, rotX: 0, rotY: 0.2, rotZ: 0, radius: 0.48, height: 1.15, sleeping: true },
  { id: 'dyn_barrel_2', kind: 'barrel', x: -105, y: 0, z: -6.5, vx: 0, vy: 0, vz: 0, rotX: 0, rotY: 1.1, rotZ: 0, radius: 0.48, height: 1.15, sleeping: true },
  { id: 'dyn_crate_1', kind: 'small_crate', x: -116, y: 0, z: -18, vx: 0, vy: 0, vz: 0, rotX: 0, rotY: 0.4, rotZ: 0, radius: 0.52, height: 0.85, sleeping: true },
  { id: 'dyn_barrel_3', kind: 'barrel', x: -8, y: 0, z: -6, vx: 0, vy: 0, vz: 0, rotX: 0, rotY: 0.7, rotZ: 0, radius: 0.48, height: 1.15, sleeping: true },
  { id: 'dyn_crate_2', kind: 'small_crate', x: 7, y: 0, z: 5, vx: 0, vy: 0, vz: 0, rotX: 0, rotY: 0.3, rotZ: 0, radius: 0.52, height: 0.85, sleeping: true },
  { id: 'dyn_barrel_4', kind: 'barrel', x: 12, y: 0, z: -11, vx: 0, vy: 0, vz: 0, rotX: 0, rotY: 2.1, rotZ: 0, radius: 0.48, height: 1.15, sleeping: true },
  { id: 'dyn_crate_3', kind: 'small_crate', x: -14, y: 0, z: 12, vx: 0, vy: 0, vz: 0, rotX: 0, rotY: 1.5, rotZ: 0, radius: 0.52, height: 0.85, sleeping: true },
  { id: 'dyn_barrel_5', kind: 'barrel', x: -4, y: 0, z: 92, vx: 0, vy: 0, vz: 0, rotX: 0, rotY: 0.5, rotZ: 0, radius: 0.48, height: 1.15, sleeping: true },
  { id: 'dyn_crate_4', kind: 'small_crate', x: 5, y: 0, z: 93, vx: 0, vy: 0, vz: 0, rotX: 0, rotY: 0.9, rotZ: 0, radius: 0.52, height: 0.85, sleeping: true },
  { id: 'dyn_barrel_6', kind: 'barrel', x: 110, y: 0, z: 12, vx: 0, vy: 0, vz: 0, rotX: 0, rotY: 1.8, rotZ: 0, radius: 0.48, height: 1.15, sleeping: true },
  { id: 'dyn_crate_5', kind: 'small_crate', x: 122, y: 0, z: 21, vx: 0, vy: 0, vz: 0, rotX: 0, rotY: 0.6, rotZ: 0, radius: 0.52, height: 0.85, sleeping: true },
  { id: 'dyn_barrel_7', kind: 'barrel', x: 118, y: 0, z: 8, vx: 0, vy: 0, vz: 0, rotX: 0, rotY: 2.6, rotZ: 0, radius: 0.48, height: 1.15, sleeping: true },
];
