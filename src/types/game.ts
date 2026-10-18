export type Team = 'blue' | 'red' | 'neutral';

export type PrimaryWeaponId =
  | 'k9_raptor'
  | 'px9_swift'
  | 'ar42_vanguard'
  | 'v30_ranger'
  | 'b5_comet'
  | 'r41_sentinel'
  | 'd22_longview'
  | 's12_falcon'
  | 'lm28_bastion'
  | 'lm31_titan'
  | 't17_thunder'
  | 'f8_ember'
  | 'k17_breaker'
  | 'v14_striker';

export type SidearmWeaponId =
  | 'p6_courier'
  | 'p11_ironclad'
  | 'p8_swift'
  | 'd4_sparrow'
  | 'p3_ranger'
  | 'k2_compact';

export type WeaponId = PrimaryWeaponId | SidearmWeaponId;

export type WeaponSlot = 'primary' | 'secondary';

export type FireMode = 'auto' | 'semi' | 'burst' | 'spread';

export type WeaponFinishId = 'default' | 'weathered' | 'dark' | 'field_painted';

export interface WeaponFinishSpec {
  id: WeaponFinishId;
  nameUz: string;
  descUz: string;
  bodyTintHex?: number;
  gripTintHex?: number;
  roughnessOffset: number;
  metalnessOffset: number;
}

export const WEAPON_FINISHES: Record<WeaponFinishId, WeaponFinishSpec> = {
  default: {
    id: 'default',
    nameUz: 'Standart Harbiy',
    descUz: 'Zavoddan chiqqan asl po‘lat va yog‘och qoplamasi.',
    roughnessOffset: 0,
    metalnessOffset: 0,
  },
  weathered: {
    id: 'weathered',
    nameUz: 'Jangda Toblangan',
    descUz: 'Front chizig‘ida ishqalangan xira metall va eskirgan sirt.',
    bodyTintHex: 0x52525b,
    gripTintHex: 0x57534e,
    roughnessOffset: 0.18,
    metalnessOffset: -0.1,
  },
  dark: {
    id: 'dark',
    nameUz: 'Qora Taktik',
    descUz: 'Tungi va shahar janglari uchun qoraytirilgan mat qoplama.',
    bodyTintHex: 0x090d16,
    gripTintHex: 0x1e293b,
    roughnessOffset: 0.08,
    metalnessOffset: 0.08,
  },
  field_painted: {
    id: 'field_painted',
    nameUz: 'Dala Kamuflyaji',
    descUz: 'Zaytun va qum rangli himoya bo‘yog‘i bilan qoplangan.',
    bodyTintHex: 0x3f6212,
    gripTintHex: 0x854d0e,
    roughnessOffset: 0.14,
    metalnessOffset: -0.2,
  },
};

export type SoldierClassId = 'assault' | 'medic' | 'support' | 'recon';

export interface SoldierClassSpec {
  id: SoldierClassId;
  nameUz: string;
  roleUz: string;
  descriptionUz: string;
  abilityNameUz: string;
  abilityDescUz: string;
  abilityCooldown: number;
  maxHp: number;
  speedMultiplier: number;
  sleeveColorHex: number;
  cuffAccentHex: number;
  defaultPrimary: PrimaryWeaponId;
  defaultSidearm: SidearmWeaponId;
  accentColor: string;
}

export interface WeaponModelConfig {
  receiverLength: number;
  receiverHeight: number;
  barrelLength: number;
  barrelRadius: number;
  handguardLength?: number;
  stockStyle: 'full' | 'folding' | 'heavy' | 'pistol_grip' | 'carbine';
  magazineStyle:
    | 'curved'
    | 'straight'
    | 'drum'
    | 'box_heavy'
    | 'internal'
    | 'pistol_mag'
    | 'tube';
  opticStyle: 'iron' | 'reflex' | 'scope' | 'aperture';
  bodyHex: number;
  woodOrGripHex: number;
  accentHex: number;
}

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  categoryUz: string;
  descriptionUz: string;
  slot: WeaponSlot;
  fireMode: FireMode;
  burstCount?: number;
  pelletCount?: number;
  damage: number;
  headshotMultiplier: number;
  effectiveRange: number;
  maxRange: number;
  falloffMinMultiplier: number;
  fireRate: number; // actions per second
  magazineSize: number;
  reserveAmmo: number;
  reloadTime: number; // seconds
  baseSpread: number; // radians
  moveSpreadMult: number;
  aimSpreadMult: number;
  recoilKick: number;
  recoilRecovery: number;
  handlingSpeed: number; // 1-100 rating
  accuracyRating: number; // 1-100 rating
  moveSpeedMultiplier: number;
  switchTime: number;
  supportsOpticView: boolean;
  aimZoomFovOffset: number;
  soundPitch: number;
  soundDuration: number;
  uiOrder: number;
  modelConfig: WeaponModelConfig;
}

export const SOLDIER_CLASSES: Record<SoldierClassId, SoldierClassSpec> = {
  assault: {
    id: 'assault',
    nameUz: 'HUJUMCHI',
    roleUz: 'Oldingi chiziq zarbdori',
    descriptionUz:
      'Yuqori harakatchanlik va tezkor hujum uchun mo‘ljallangan piyoda askar. Transheya va qishloq janglarida yetakchilik qiladi.',
    abilityNameUz: 'Jangovar shiddat (Q)',
    abilityDescUz:
      '100% chidamlilikni tiklaydi va 6 soniya davomida harakat tezligini 25% oshiradi.',
    abilityCooldown: 18,
    maxHp: 105,
    speedMultiplier: 1.05,
    sleeveColorHex: 0x334155,
    cuffAccentHex: 0xf59e0b,
    defaultPrimary: 'ar42_vanguard',
    defaultSidearm: 'p6_courier',
    accentColor: '#f59e0b',
  },
  medic: {
    id: 'medic',
    nameUz: 'SHIFOKOR',
    roleUz: 'Maydon tibbiy yordamchisi',
    descriptionUz:
      'Jang maydonida o‘zini va yaqin atrofdagi ittifoqchi askarlarni tezkor davolash qobiliyatiga ega mutaxassis.',
    abilityNameUz: 'Tibbiy paket (Q)',
    abilityDescUz:
      'Darhol +55 sog‘liqni tiklaydi va 14m radiusdagi ittifoqchilarni davolaydi.',
    abilityCooldown: 16,
    maxHp: 100,
    speedMultiplier: 1.02,
    sleeveColorHex: 0x1e3a34,
    cuffAccentHex: 0x10b981,
    defaultPrimary: 'k9_raptor',
    defaultSidearm: 'p8_swift',
    accentColor: '#10b981',
  },
  support: {
    id: 'support',
    nameUz: 'TA’MINOTCHI',
    roleUz: 'Og‘ir o‘t ochish va o‘q-dori',
    descriptionUz:
      'Kuchaytirilgan zirh va o‘q-dori qutisi bilan jihozlangan mudofaa ustasi. Ko‘prik va omborlarni ushlab turishda samarali.',
    abilityNameUz: 'O‘q-dori zahirasi (Q)',
    abilityDescUz:
      'Asosiy qurol va to‘pponcha uchun qo‘shimcha o‘q-dori zahirasini to‘ldiradi (+25 HP zirh).',
    abilityCooldown: 20,
    maxHp: 120,
    speedMultiplier: 0.94,
    sleeveColorHex: 0x27272a,
    cuffAccentHex: 0x38bdf8,
    defaultPrimary: 'lm28_bastion',
    defaultSidearm: 'p11_ironclad',
    accentColor: '#38bdf8',
  },
  recon: {
    id: 'recon',
    nameUz: 'RAZVEDKACHI',
    roleUz: 'Uzoq masofali mergan va kuzatuvchi',
    descriptionUz:
      'Uzoq masofadan aniq nishonga olish va dushman joylashuvini xaritada aniqlashga ixtisoslashgan askar.',
    abilityNameUz: 'Taktik signal (Q)',
    abilityDescUz:
      '10 soniya davomida barcha raqib askarlarini taktik xaritada ko‘rsatadi.',
    abilityCooldown: 22,
    maxHp: 95,
    speedMultiplier: 1.04,
    sleeveColorHex: 0x365314,
    cuffAccentHex: 0xa855f7,
    defaultPrimary: 's12_falcon',
    defaultSidearm: 'p3_ranger',
    accentColor: '#a855f7',
  },
};

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  // =========================================================================
  // 14 PRIMARY WEAPONS (ASOSIY QUROLLAR)
  // =========================================================================
  k9_raptor: {
    id: 'k9_raptor',
    name: 'K-9 Raptor',
    categoryUz: 'Avtomat-pistolet (Yaqin masofa)',
    descriptionUz:
      'Transheya va tor ko‘chalarda yuqori harakatchanlik hamda tezkor o‘t ochish uchun mo‘ljallangan ixcham avtomat.',
    slot: 'primary',
    fireMode: 'auto',
    damage: 20,
    headshotMultiplier: 1.45,
    effectiveRange: 45,
    maxRange: 115,
    falloffMinMultiplier: 0.52,
    fireRate: 11.5,
    magazineSize: 34,
    reserveAmmo: 170,
    reloadTime: 1.55,
    baseSpread: 0.021,
    moveSpreadMult: 1.25,
    aimSpreadMult: 0.52,
    recoilKick: 0.012,
    recoilRecovery: 16,
    handlingSpeed: 92,
    accuracyRating: 66,
    moveSpeedMultiplier: 1.08,
    switchTime: 0.34,
    supportsOpticView: true,
    aimZoomFovOffset: -12,
    soundPitch: 1380,
    soundDuration: 0.08,
    uiOrder: 1,
    modelConfig: {
      receiverLength: 0.42,
      receiverHeight: 0.12,
      barrelLength: 0.24,
      barrelRadius: 0.018,
      stockStyle: 'folding',
      magazineStyle: 'straight',
      opticStyle: 'iron',
      bodyHex: 0x27272a,
      woodOrGripHex: 0x451a03,
      accentHex: 0x38bdf8,
    },
  },

  px9_swift: {
    id: 'px9_swift',
    name: 'PX-9 Swift',
    categoryUz: 'Yengil PDW avtomati (Chaqqon)',
    descriptionUz:
      'Juda yengil korpus va tez almashtirish xususiyatiga ega shaxsiy mudofaa avtomati. Yaqin jangda bir zumda nishonga olinadi.',
    slot: 'primary',
    fireMode: 'auto',
    damage: 18,
    headshotMultiplier: 1.45,
    effectiveRange: 38,
    maxRange: 105,
    falloffMinMultiplier: 0.48,
    fireRate: 13.0,
    magazineSize: 28,
    reserveAmmo: 168,
    reloadTime: 1.35,
    baseSpread: 0.023,
    moveSpreadMult: 1.15,
    aimSpreadMult: 0.55,
    recoilKick: 0.01,
    recoilRecovery: 18,
    handlingSpeed: 96,
    accuracyRating: 62,
    moveSpeedMultiplier: 1.1,
    switchTime: 0.28,
    supportsOpticView: true,
    aimZoomFovOffset: -10,
    soundPitch: 1490,
    soundDuration: 0.075,
    uiOrder: 2,
    modelConfig: {
      receiverLength: 0.36,
      receiverHeight: 0.11,
      barrelLength: 0.2,
      barrelRadius: 0.016,
      stockStyle: 'folding',
      magazineStyle: 'curved',
      opticStyle: 'reflex',
      bodyHex: 0x334155,
      woodOrGripHex: 0x1e293b,
      accentHex: 0x22d3ee,
    },
  },

  ar42_vanguard: {
    id: 'ar42_vanguard',
    name: 'AR-42 Vanguard',
    categoryUz: 'Hujum karabini (Universal)',
    descriptionUz:
      'Muvozanatli zarba kuchi, barqaror aniqlik va o‘rta masofadagi janglar uchun ishonchli umumqo‘shin avtomati.',
    slot: 'primary',
    fireMode: 'auto',
    damage: 26,
    headshotMultiplier: 1.6,
    effectiveRange: 85,
    maxRange: 170,
    falloffMinMultiplier: 0.65,
    fireRate: 8.2,
    magazineSize: 30,
    reserveAmmo: 150,
    reloadTime: 1.8,
    baseSpread: 0.012,
    moveSpreadMult: 1.4,
    aimSpreadMult: 0.38,
    recoilKick: 0.016,
    recoilRecovery: 14,
    handlingSpeed: 78,
    accuracyRating: 80,
    moveSpeedMultiplier: 1.0,
    switchTime: 0.42,
    supportsOpticView: true,
    aimZoomFovOffset: -16,
    soundPitch: 1020,
    soundDuration: 0.1,
    uiOrder: 3,
    modelConfig: {
      receiverLength: 0.56,
      receiverHeight: 0.14,
      barrelLength: 0.38,
      barrelRadius: 0.021,
      stockStyle: 'full',
      magazineStyle: 'curved',
      opticStyle: 'reflex',
      bodyHex: 0x1e293b,
      woodOrGripHex: 0x78350f,
      accentHex: 0xf59e0b,
    },
  },

  v30_ranger: {
    id: 'v30_ranger',
    name: 'V-30 Ranger',
    categoryUz: 'Mobil avto-karabin (Razvedka)',
    descriptionUz:
      'Yengil vaznli, tez nishonga olinadigan va harakat vaqtida yuqori barqarorlikni saqlovchi desant karabini.',
    slot: 'primary',
    fireMode: 'auto',
    damage: 23,
    headshotMultiplier: 1.55,
    effectiveRange: 74,
    maxRange: 155,
    falloffMinMultiplier: 0.62,
    fireRate: 9.4,
    magazineSize: 26,
    reserveAmmo: 130,
    reloadTime: 1.5,
    baseSpread: 0.013,
    moveSpreadMult: 1.18,
    aimSpreadMult: 0.42,
    recoilKick: 0.014,
    recoilRecovery: 16,
    handlingSpeed: 88,
    accuracyRating: 76,
    moveSpeedMultiplier: 1.05,
    switchTime: 0.35,
    supportsOpticView: true,
    aimZoomFovOffset: -15,
    soundPitch: 1210,
    soundDuration: 0.09,
    uiOrder: 4,
    modelConfig: {
      receiverLength: 0.48,
      receiverHeight: 0.13,
      barrelLength: 0.32,
      barrelRadius: 0.019,
      stockStyle: 'carbine',
      magazineStyle: 'curved',
      opticStyle: 'aperture',
      bodyHex: 0x3f3f46,
      woodOrGripHex: 0x854d0e,
      accentHex: 0x22c55e,
    },
  },

  b5_comet: {
    id: 'b5_comet',
    name: 'B-5 Comet',
    categoryUz: 'Taktik karabin (3-o‘qli navbat)',
    descriptionUz:
      'Har bir bosishda uchta ketma-ket o‘q uzuvchi yuqori aniqlikdagi zarbdor taktik karabin.',
    slot: 'primary',
    fireMode: 'burst',
    burstCount: 3,
    damage: 24,
    headshotMultiplier: 1.65,
    effectiveRange: 95,
    maxRange: 180,
    falloffMinMultiplier: 0.7,
    fireRate: 9.5,
    magazineSize: 30,
    reserveAmmo: 150,
    reloadTime: 1.72,
    baseSpread: 0.0085,
    moveSpreadMult: 1.32,
    aimSpreadMult: 0.32,
    recoilKick: 0.015,
    recoilRecovery: 15,
    handlingSpeed: 82,
    accuracyRating: 86,
    moveSpeedMultiplier: 1.01,
    switchTime: 0.4,
    supportsOpticView: true,
    aimZoomFovOffset: -18,
    soundPitch: 1160,
    soundDuration: 0.09,
    uiOrder: 5,
    modelConfig: {
      receiverLength: 0.52,
      receiverHeight: 0.14,
      barrelLength: 0.35,
      barrelRadius: 0.02,
      stockStyle: 'carbine',
      magazineStyle: 'straight',
      opticStyle: 'reflex',
      bodyHex: 0x1f2937,
      woodOrGripHex: 0x57534e,
      accentHex: 0x06b6d4,
    },
  },

  r41_sentinel: {
    id: 'r41_sentinel',
    name: 'R-41 Sentinel',
    categoryUz: 'Xizmat miltig‘i (Yarim-avtomat)',
    descriptionUz:
      'O‘rta va uzoq masofada yuqori aniqlik bilan bittalab o‘t ochuvchi klassik piyoda askar miltig‘i.',
    slot: 'primary',
    fireMode: 'semi',
    damage: 45,
    headshotMultiplier: 1.75,
    effectiveRange: 135,
    maxRange: 230,
    falloffMinMultiplier: 0.78,
    fireRate: 4.2,
    magazineSize: 12,
    reserveAmmo: 72,
    reloadTime: 1.95,
    baseSpread: 0.005,
    moveSpreadMult: 1.65,
    aimSpreadMult: 0.22,
    recoilKick: 0.026,
    recoilRecovery: 12,
    handlingSpeed: 72,
    accuracyRating: 91,
    moveSpeedMultiplier: 0.97,
    switchTime: 0.46,
    supportsOpticView: true,
    aimZoomFovOffset: -22,
    soundPitch: 820,
    soundDuration: 0.14,
    uiOrder: 6,
    modelConfig: {
      receiverLength: 0.64,
      receiverHeight: 0.13,
      barrelLength: 0.48,
      barrelRadius: 0.02,
      stockStyle: 'full',
      magazineStyle: 'internal',
      opticStyle: 'aperture',
      bodyHex: 0x334155,
      woodOrGripHex: 0x92400e,
      accentHex: 0x10b981,
    },
  },

  d22_longview: {
    id: 'd22_longview',
    name: 'D-22 Longview',
    categoryUz: 'Mergan karabini (Optik DMR)',
    descriptionUz:
      'O‘rta-uzoq masofali nishonlar uchun mo‘ljallangan optik moslamali yarim-avtomat mergan karabini.',
    slot: 'primary',
    fireMode: 'semi',
    damage: 54,
    headshotMultiplier: 1.85,
    effectiveRange: 165,
    maxRange: 265,
    falloffMinMultiplier: 0.84,
    fireRate: 2.8,
    magazineSize: 10,
    reserveAmmo: 60,
    reloadTime: 2.05,
    baseSpread: 0.0032,
    moveSpreadMult: 2.1,
    aimSpreadMult: 0.14,
    recoilKick: 0.034,
    recoilRecovery: 11,
    handlingSpeed: 66,
    accuracyRating: 95,
    moveSpeedMultiplier: 0.95,
    switchTime: 0.5,
    supportsOpticView: true,
    aimZoomFovOffset: -28,
    soundPitch: 680,
    soundDuration: 0.16,
    uiOrder: 7,
    modelConfig: {
      receiverLength: 0.66,
      receiverHeight: 0.13,
      barrelLength: 0.52,
      barrelRadius: 0.021,
      stockStyle: 'full',
      magazineStyle: 'straight',
      opticStyle: 'scope',
      bodyHex: 0x1e293b,
      woodOrGripHex: 0x713f12,
      accentHex: 0x38bdf8,
    },
  },

  s12_falcon: {
    id: 's12_falcon',
    name: 'S-12 Falcon',
    categoryUz: 'Uzoq masofali snayper miltig‘i',
    descriptionUz:
      'Kuchli optik nishon bilan jihozlangan maxsus uzoq masofali merganlik quroli. Bitta aniq zarba bilan ustunlik beradi.',
    slot: 'primary',
    fireMode: 'semi',
    damage: 72,
    headshotMultiplier: 2.0,
    effectiveRange: 210,
    maxRange: 310,
    falloffMinMultiplier: 0.9,
    fireRate: 1.75,
    magazineSize: 8,
    reserveAmmo: 48,
    reloadTime: 2.25,
    baseSpread: 0.0018,
    moveSpreadMult: 2.6,
    aimSpreadMult: 0.08,
    recoilKick: 0.044,
    recoilRecovery: 9,
    handlingSpeed: 58,
    accuracyRating: 99,
    moveSpeedMultiplier: 0.92,
    switchTime: 0.55,
    supportsOpticView: true,
    aimZoomFovOffset: -35,
    soundPitch: 580,
    soundDuration: 0.19,
    uiOrder: 8,
    modelConfig: {
      receiverLength: 0.72,
      receiverHeight: 0.13,
      barrelLength: 0.58,
      barrelRadius: 0.022,
      stockStyle: 'full',
      magazineStyle: 'straight',
      opticStyle: 'scope',
      bodyHex: 0x0f172a,
      woodOrGripHex: 0x78350f,
      accentHex: 0xa855f7,
    },
  },

  lm28_bastion: {
    id: 'lm28_bastion',
    name: 'LM-28 Bastion',
    categoryUz: 'Qo‘l pulemyoti (Madad quroli)',
    descriptionUz:
      '60 o‘qli diskli magazinga ega pulemyot. Mudofaa chizig‘ini ushlab turish va uzluksiz o‘t ochish uchun ideal.',
    slot: 'primary',
    fireMode: 'auto',
    damage: 28,
    headshotMultiplier: 1.5,
    effectiveRange: 100,
    maxRange: 195,
    falloffMinMultiplier: 0.72,
    fireRate: 7.5,
    magazineSize: 60,
    reserveAmmo: 180,
    reloadTime: 2.75,
    baseSpread: 0.018,
    moveSpreadMult: 1.8,
    aimSpreadMult: 0.45,
    recoilKick: 0.02,
    recoilRecovery: 10,
    handlingSpeed: 56,
    accuracyRating: 72,
    moveSpeedMultiplier: 0.9,
    switchTime: 0.62,
    supportsOpticView: true,
    aimZoomFovOffset: -14,
    soundPitch: 710,
    soundDuration: 0.13,
    uiOrder: 9,
    modelConfig: {
      receiverLength: 0.66,
      receiverHeight: 0.16,
      barrelLength: 0.46,
      barrelRadius: 0.025,
      stockStyle: 'heavy',
      magazineStyle: 'drum',
      opticStyle: 'iron',
      bodyHex: 0x18181b,
      woodOrGripHex: 0x713f12,
      accentHex: 0xf97316,
    },
  },

  lm31_titan: {
    id: 'lm31_titan',
    name: 'LM-31 Titan',
    categoryUz: 'Og‘ir tayanch pulemyoti (85 o‘q)',
    descriptionUz:
      'Katta sig‘imli quti magazinli og‘ir pulemyot. Harakatni sekinlashtirsa-da, butun bo‘linmani o‘t bilan qoplay oladi.',
    slot: 'primary',
    fireMode: 'auto',
    damage: 31,
    headshotMultiplier: 1.5,
    effectiveRange: 110,
    maxRange: 205,
    falloffMinMultiplier: 0.75,
    fireRate: 6.8,
    magazineSize: 85,
    reserveAmmo: 170,
    reloadTime: 3.2,
    baseSpread: 0.021,
    moveSpreadMult: 2.0,
    aimSpreadMult: 0.48,
    recoilKick: 0.023,
    recoilRecovery: 9,
    handlingSpeed: 46,
    accuracyRating: 68,
    moveSpeedMultiplier: 0.85,
    switchTime: 0.72,
    supportsOpticView: true,
    aimZoomFovOffset: -13,
    soundPitch: 640,
    soundDuration: 0.15,
    uiOrder: 10,
    modelConfig: {
      receiverLength: 0.72,
      receiverHeight: 0.17,
      barrelLength: 0.5,
      barrelRadius: 0.028,
      stockStyle: 'heavy',
      magazineStyle: 'box_heavy',
      opticStyle: 'aperture',
      bodyHex: 0x090d16,
      woodOrGripHex: 0x451a03,
      accentHex: 0xeab308,
    },
  },

  t17_thunder: {
    id: 't17_thunder',
    name: 'T-17 Thunder',
    categoryUz: 'Transheya miltig‘i (Sochma o‘q)',
    descriptionUz:
      'Bitta o‘t ochishda 6 ta sochma zarba yo‘llovchi yaqin masofali shturm quroli. Bino ichi va xandaqlarda tengsiz.',
    slot: 'primary',
    fireMode: 'spread',
    pelletCount: 6,
    damage: 16,
    headshotMultiplier: 1.35,
    effectiveRange: 26,
    maxRange: 65,
    falloffMinMultiplier: 0.35,
    fireRate: 1.65,
    magazineSize: 7,
    reserveAmmo: 42,
    reloadTime: 2.05,
    baseSpread: 0.052,
    moveSpreadMult: 1.2,
    aimSpreadMult: 0.7,
    recoilKick: 0.045,
    recoilRecovery: 11,
    handlingSpeed: 76,
    accuracyRating: 54,
    moveSpeedMultiplier: 1.03,
    switchTime: 0.44,
    supportsOpticView: true,
    aimZoomFovOffset: -10,
    soundPitch: 520,
    soundDuration: 0.17,
    uiOrder: 11,
    modelConfig: {
      receiverLength: 0.58,
      receiverHeight: 0.14,
      barrelLength: 0.42,
      barrelRadius: 0.028,
      stockStyle: 'full',
      magazineStyle: 'tube',
      opticStyle: 'iron',
      bodyHex: 0x292524,
      woodOrGripHex: 0x9a3412,
      accentHex: 0xef4444,
    },
  },

  f8_ember: {
    id: 'f8_ember',
    name: 'F-8 Ember',
    categoryUz: 'Past tepkili stabil karabin',
    descriptionUz:
      'Tepkisi minimal darajaga tushirilgan zamonaviy taktik karabin. Ketma-ket o‘t ochishda nishondan og‘maydi.',
    slot: 'primary',
    fireMode: 'auto',
    damage: 21,
    headshotMultiplier: 1.55,
    effectiveRange: 82,
    maxRange: 165,
    falloffMinMultiplier: 0.64,
    fireRate: 9.0,
    magazineSize: 32,
    reserveAmmo: 160,
    reloadTime: 1.6,
    baseSpread: 0.0095,
    moveSpreadMult: 1.22,
    aimSpreadMult: 0.32,
    recoilKick: 0.009,
    recoilRecovery: 19,
    handlingSpeed: 86,
    accuracyRating: 88,
    moveSpeedMultiplier: 1.03,
    switchTime: 0.38,
    supportsOpticView: true,
    aimZoomFovOffset: -16,
    soundPitch: 1280,
    soundDuration: 0.085,
    uiOrder: 12,
    modelConfig: {
      receiverLength: 0.5,
      receiverHeight: 0.135,
      barrelLength: 0.34,
      barrelRadius: 0.02,
      stockStyle: 'carbine',
      magazineStyle: 'straight',
      opticStyle: 'reflex',
      bodyHex: 0x334155,
      woodOrGripHex: 0x475569,
      accentHex: 0xf43f5e,
    },
  },

  k17_breaker: {
    id: 'k17_breaker',
    name: 'K-17 Breaker',
    categoryUz: 'Og‘ir yarim-avtomat jangovar miltiq',
    descriptionUz:
      'Yirik kalibrli yarim-avtomat zarbdor miltiq. Qattiq tepkiga ega bo‘lsa-da, har bir o‘qi zirhli nishonlarni teshib o‘tadi.',
    slot: 'primary',
    fireMode: 'semi',
    damage: 52,
    headshotMultiplier: 1.8,
    effectiveRange: 145,
    maxRange: 240,
    falloffMinMultiplier: 0.82,
    fireRate: 3.1,
    magazineSize: 15,
    reserveAmmo: 75,
    reloadTime: 2.15,
    baseSpread: 0.0045,
    moveSpreadMult: 1.85,
    aimSpreadMult: 0.2,
    recoilKick: 0.036,
    recoilRecovery: 10,
    handlingSpeed: 64,
    accuracyRating: 92,
    moveSpeedMultiplier: 0.94,
    switchTime: 0.5,
    supportsOpticView: true,
    aimZoomFovOffset: -20,
    soundPitch: 660,
    soundDuration: 0.155,
    uiOrder: 13,
    modelConfig: {
      receiverLength: 0.66,
      receiverHeight: 0.15,
      barrelLength: 0.46,
      barrelRadius: 0.024,
      stockStyle: 'heavy',
      magazineStyle: 'straight',
      opticStyle: 'aperture',
      bodyHex: 0x27272a,
      woodOrGripHex: 0x7c2d12,
      accentHex: 0xf59e0b,
    },
  },

  v14_striker: {
    id: 'v14_striker',
    name: 'V-14 Striker',
    categoryUz: 'Maxsus shturm karabini',
    descriptionUz:
      'Yuqori aniqlikdagi dioptrik nishon va uzaytirilgan stvol qoplamasiga ega maxsus bo‘linma avtomati.',
    slot: 'primary',
    fireMode: 'auto',
    damage: 25,
    headshotMultiplier: 1.65,
    effectiveRange: 92,
    maxRange: 180,
    falloffMinMultiplier: 0.68,
    fireRate: 8.6,
    magazineSize: 28,
    reserveAmmo: 140,
    reloadTime: 1.68,
    baseSpread: 0.0105,
    moveSpreadMult: 1.3,
    aimSpreadMult: 0.34,
    recoilKick: 0.014,
    recoilRecovery: 16,
    handlingSpeed: 84,
    accuracyRating: 84,
    moveSpeedMultiplier: 1.02,
    switchTime: 0.39,
    supportsOpticView: true,
    aimZoomFovOffset: -17,
    soundPitch: 1090,
    soundDuration: 0.095,
    uiOrder: 14,
    modelConfig: {
      receiverLength: 0.54,
      receiverHeight: 0.14,
      barrelLength: 0.37,
      barrelRadius: 0.021,
      stockStyle: 'full',
      magazineStyle: 'curved',
      opticStyle: 'aperture',
      bodyHex: 0x1e293b,
      woodOrGripHex: 0x365314,
      accentHex: 0x10b981,
    },
  },

  // =========================================================================
  // 6 SECONDARY SIDEARMS (TO‘PPONCHALAR)
  // =========================================================================
  p6_courier: {
    id: 'p6_courier',
    name: 'P-6 Courier',
    categoryUz: 'Xizmat to‘pponchasi (Muvozanatli)',
    descriptionUz:
      'Tez sug‘urib olinadigan, ishonchli va barcha masofalarda barqaror yordamchi ofitser to‘pponchasi.',
    slot: 'secondary',
    fireMode: 'semi',
    damage: 25,
    headshotMultiplier: 1.55,
    effectiveRange: 38,
    maxRange: 95,
    falloffMinMultiplier: 0.55,
    fireRate: 5.5,
    magazineSize: 12,
    reserveAmmo: 60,
    reloadTime: 1.15,
    baseSpread: 0.013,
    moveSpreadMult: 1.2,
    aimSpreadMult: 0.45,
    recoilKick: 0.014,
    recoilRecovery: 18,
    handlingSpeed: 94,
    accuracyRating: 78,
    moveSpeedMultiplier: 1.1,
    switchTime: 0.22,
    supportsOpticView: true,
    aimZoomFovOffset: -10,
    soundPitch: 1520,
    soundDuration: 0.07,
    uiOrder: 15,
    modelConfig: {
      receiverLength: 0.24,
      receiverHeight: 0.09,
      barrelLength: 0.1,
      barrelRadius: 0.014,
      stockStyle: 'pistol_grip',
      magazineStyle: 'pistol_mag',
      opticStyle: 'iron',
      bodyHex: 0x334155,
      woodOrGripHex: 0x78350f,
      accentHex: 0x38bdf8,
    },
  },

  p11_ironclad: {
    id: 'p11_ironclad',
    name: 'P-11 Ironclad',
    categoryUz: 'Og‘ir to‘pponcha (Yuqori zarba)',
    descriptionUz:
      'Katta kalibrli og‘ir yordamchi qurol. Kamroq o‘t ochish tezligiga ega bo‘lsa-da, har bir zarbasi juda kuchli.',
    slot: 'secondary',
    fireMode: 'semi',
    damage: 42,
    headshotMultiplier: 1.75,
    effectiveRange: 48,
    maxRange: 110,
    falloffMinMultiplier: 0.65,
    fireRate: 3.1,
    magazineSize: 7,
    reserveAmmo: 42,
    reloadTime: 1.4,
    baseSpread: 0.01,
    moveSpreadMult: 1.45,
    aimSpreadMult: 0.35,
    recoilKick: 0.03,
    recoilRecovery: 13,
    handlingSpeed: 84,
    accuracyRating: 84,
    moveSpeedMultiplier: 1.07,
    switchTime: 0.26,
    supportsOpticView: true,
    aimZoomFovOffset: -12,
    soundPitch: 920,
    soundDuration: 0.12,
    uiOrder: 16,
    modelConfig: {
      receiverLength: 0.29,
      receiverHeight: 0.11,
      barrelLength: 0.15,
      barrelRadius: 0.018,
      stockStyle: 'pistol_grip',
      magazineStyle: 'pistol_mag',
      opticStyle: 'iron',
      bodyHex: 0x18181b,
      woodOrGripHex: 0x92400e,
      accentHex: 0xf59e0b,
    },
  },

  p8_swift: {
    id: 'p8_swift',
    name: 'P-8 Swift',
    categoryUz: 'Ixcham to‘pponcha (Tezkor)',
    descriptionUz:
      'Favqulodda vaziyatlarda bir zumda qo‘lga olinadigan va juda yuqori sur’atda o‘q uzadigan yengil to‘pponcha.',
    slot: 'secondary',
    fireMode: 'semi',
    damage: 19,
    headshotMultiplier: 1.45,
    effectiveRange: 30,
    maxRange: 80,
    falloffMinMultiplier: 0.48,
    fireRate: 8.0,
    magazineSize: 16,
    reserveAmmo: 80,
    reloadTime: 1.0,
    baseSpread: 0.018,
    moveSpreadMult: 1.12,
    aimSpreadMult: 0.55,
    recoilKick: 0.01,
    recoilRecovery: 20,
    handlingSpeed: 98,
    accuracyRating: 70,
    moveSpeedMultiplier: 1.12,
    switchTime: 0.18,
    supportsOpticView: true,
    aimZoomFovOffset: -8,
    soundPitch: 1740,
    soundDuration: 0.06,
    uiOrder: 17,
    modelConfig: {
      receiverLength: 0.2,
      receiverHeight: 0.085,
      barrelLength: 0.08,
      barrelRadius: 0.013,
      stockStyle: 'pistol_grip',
      magazineStyle: 'pistol_mag',
      opticStyle: 'iron',
      bodyHex: 0x475569,
      woodOrGripHex: 0x27272a,
      accentHex: 0x10b981,
    },
  },

  d4_sparrow: {
    id: 'd4_sparrow',
    name: 'D-4 Sparrow',
    categoryUz: 'Avto-to‘pponcha (3-o‘qli navbat)',
    descriptionUz:
      'Qisqa 3-o‘qli navbat bilan o‘t ochuvchi shturm to‘pponchasi. Yaqin masofada asosiy qurol o‘rnini bosa oladi.',
    slot: 'secondary',
    fireMode: 'burst',
    burstCount: 3,
    damage: 17,
    headshotMultiplier: 1.4,
    effectiveRange: 28,
    maxRange: 75,
    falloffMinMultiplier: 0.45,
    fireRate: 10.5,
    magazineSize: 21,
    reserveAmmo: 84,
    reloadTime: 1.3,
    baseSpread: 0.022,
    moveSpreadMult: 1.25,
    aimSpreadMult: 0.52,
    recoilKick: 0.013,
    recoilRecovery: 17,
    handlingSpeed: 90,
    accuracyRating: 66,
    moveSpeedMultiplier: 1.09,
    switchTime: 0.24,
    supportsOpticView: true,
    aimZoomFovOffset: -9,
    soundPitch: 1620,
    soundDuration: 0.065,
    uiOrder: 18,
    modelConfig: {
      receiverLength: 0.25,
      receiverHeight: 0.095,
      barrelLength: 0.12,
      barrelRadius: 0.015,
      stockStyle: 'pistol_grip',
      magazineStyle: 'straight',
      opticStyle: 'reflex',
      bodyHex: 0x1e293b,
      woodOrGripHex: 0x44403c,
      accentHex: 0xec4899,
    },
  },

  p3_ranger: {
    id: 'p3_ranger',
    name: 'P-3 Ranger',
    categoryUz: 'Mergan to‘pponchasi (Uzun stvolli)',
    descriptionUz:
      'Uzaytirilgan stvol va yuqori aniqlikka ega razvedka to‘pponchasi. O‘rta masofada ham aniq nishonga oladi.',
    slot: 'secondary',
    fireMode: 'semi',
    damage: 34,
    headshotMultiplier: 1.7,
    effectiveRange: 62,
    maxRange: 130,
    falloffMinMultiplier: 0.7,
    fireRate: 3.8,
    magazineSize: 9,
    reserveAmmo: 54,
    reloadTime: 1.25,
    baseSpread: 0.006,
    moveSpreadMult: 1.35,
    aimSpreadMult: 0.25,
    recoilKick: 0.022,
    recoilRecovery: 15,
    handlingSpeed: 88,
    accuracyRating: 92,
    moveSpeedMultiplier: 1.08,
    switchTime: 0.24,
    supportsOpticView: true,
    aimZoomFovOffset: -15,
    soundPitch: 1180,
    soundDuration: 0.095,
    uiOrder: 19,
    modelConfig: {
      receiverLength: 0.27,
      receiverHeight: 0.09,
      barrelLength: 0.18,
      barrelRadius: 0.014,
      stockStyle: 'pistol_grip',
      magazineStyle: 'pistol_mag',
      opticStyle: 'aperture',
      bodyHex: 0x27272a,
      woodOrGripHex: 0x713f12,
      accentHex: 0xa855f7,
    },
  },

  k2_compact: {
    id: 'k2_compact',
    name: 'K-2 Compact',
    categoryUz: 'Ultra-ixcham zaxira to‘pponcha',
    descriptionUz:
      'Juda kichik o‘lchamli va yengil cho‘ntak to‘pponchasi. Asosiy qurol o‘qi tugagan zahoti 0.15 soniyada sug‘uriladi.',
    slot: 'secondary',
    fireMode: 'semi',
    damage: 22,
    headshotMultiplier: 1.5,
    effectiveRange: 26,
    maxRange: 72,
    falloffMinMultiplier: 0.45,
    fireRate: 7.2,
    magazineSize: 10,
    reserveAmmo: 60,
    reloadTime: 0.9,
    baseSpread: 0.016,
    moveSpreadMult: 1.08,
    aimSpreadMult: 0.48,
    recoilKick: 0.011,
    recoilRecovery: 22,
    handlingSpeed: 99,
    accuracyRating: 74,
    moveSpeedMultiplier: 1.14,
    switchTime: 0.15,
    supportsOpticView: true,
    aimZoomFovOffset: -8,
    soundPitch: 1820,
    soundDuration: 0.055,
    uiOrder: 20,
    modelConfig: {
      receiverLength: 0.18,
      receiverHeight: 0.08,
      barrelLength: 0.065,
      barrelRadius: 0.012,
      stockStyle: 'pistol_grip',
      magazineStyle: 'pistol_mag',
      opticStyle: 'iron',
      bodyHex: 0x18181b,
      woodOrGripHex: 0x3f3f46,
      accentHex: 0xfacc15,
    },
  },
};

export const PRIMARY_WEAPON_LIST: WeaponSpec[] = Object.values(WEAPONS)
  .filter((w) => w.slot === 'primary')
  .sort((a, b) => a.uiOrder - b.uiOrder);

export const SIDEARM_WEAPON_LIST: WeaponSpec[] = Object.values(WEAPONS)
  .filter((w) => w.slot === 'secondary')
  .sort((a, b) => a.uiOrder - b.uiOrder);

export type GameScreen = 'menu' | 'loadout' | 'playing' | 'paused' | 'results';

export type GameMode = 'domination' | 'training';

export type CameraPerspective = 'first' | 'third';

export type BotDifficulty = 'recruit' | 'veteran' | 'elite';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export type SurfaceType =
  | 'earth'
  | 'wood'
  | 'stone'
  | 'water'
  | 'interior'
  | 'grass';

export type PlayerMovementState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sprint'
  | 'crouch'
  | 'airborne';

export type ReloadStageId =
  | 'ready'
  | 'starting'
  | 'handling_ammo'
  | 'inserting_ammo'
  | 'chambering'
  | 'returning';

export type FirstPersonAnimState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sprint'
  | 'crouch'
  | 'aim'
  | 'fire'
  | 'reload'
  | 'weapon_switch'
  | 'jump'
  | 'land'
  | 'empty';

export type WeaponReloadProfileId =
  | 'rifle_standard'
  | 'smg_compact'
  | 'lmg_heavy'
  | 'sniper_precision'
  | 'shotgun_shell'
  | 'pistol_sidearm';

export interface GameSettings {
  sensitivity: number;
  invertY: boolean;
  cameraPerspective: CameraPerspective;
  fov: number;
  graphicsQuality: GraphicsQuality;
  shadows: boolean;
  botDifficulty: BotDifficulty;
  teamSize: number;
  soundEnabled: boolean;
  masterVolume: number;
  sfxVolume: number;
  touchControlsOrder: 'auto' | 'always' | 'off';
  touchControlScale?: number;
  weaponFinish: WeaponFinishId;
}

export type RegionId =
  | 'western_trenches'
  | 'central_village'
  | 'northern_woodland'
  | 'southern_bridge'
  | 'eastern_industry'
  | 'command_outpost'
  | 'open_battlefield';

export interface StructureCollider {
  id: string;
  nameUz?: string;
  region: RegionId;
  type:
    | 'bunker'
    | 'tower'
    | 'wall'
    | 'crate'
    | 'pillar'
    | 'depot'
    | 'village_house'
    | 'ruined_hall'
    | 'warehouse'
    | 'bridge_pier'
    | 'sandbag'
    | 'truck_wreck'
    | 'rock_outcrop'
    | 'tree_trunk'
    | 'supply_station'
    | 'village_well';
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  ceilingHeight?: number;
  assetId?: string;
  colorVariant?:
    | 'slate'
    | 'sand'
    | 'steel'
    | 'accent'
    | 'brick'
    | 'wood'
    | 'olive';
  destructible?: boolean;
  interactiveSupply?: boolean;
  hp?: number;
  maxHp?: number;
  destroyed?: boolean;
}

export interface DynamicPropState {
  id: string;
  kind: 'barrel' | 'small_crate';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  radius: number;
  height: number;
  sleeping: boolean;
}

export interface NavWaypoint {
  id: string;
  x: number;
  z: number;
  region: RegionId;
  connections: string[];
}

export interface ObjectiveState {
  id: 'A' | 'B' | 'C';
  name: string;
  regionUz: string;
  x: number;
  z: number;
  radius: number;
  progress: number;
  owner: Team;
  contested: boolean;
  blueCount: number;
  redCount: number;
}

export interface CombatantStats {
  id: string;
  name: string;
  team: 'blue' | 'red';
  isPlayer: boolean;
  soldierClass: SoldierClassId;
  primaryWeapon: PrimaryWeaponId;
  sidearmWeapon: SidearmWeaponId;
  activeSlot: WeaponSlot;
  weapon: WeaponId;
  hp: number;
  maxHp: number;
  alive: boolean;
  crouching: boolean;
  aiming: boolean;
  sprinting: boolean;
  respawnTimer: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  kills: number;
  deaths: number;
  captures: number;
  score: number;
  aiStateLabel?: string;
}

export interface KillFeedItem {
  id: string;
  killerName: string;
  killerTeam: 'blue' | 'red';
  victimName: string;
  victimTeam: 'blue' | 'red';
  weaponName: string;
  headshot: boolean;
  timestamp: number;
}

export interface DiagnosticData {
  fps: number;
  frameTimeMs: number;
  playerX: number;
  playerY: number;
  playerZ: number;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  speed: number;
  grounded: boolean;
  crouching: boolean;
  sprinting: boolean;
  movementState: PlayerMovementState;
  animationState: FirstPersonAnimState;
  reloadStage: ReloadStageId;
  currentWeaponId: WeaponId;
  activeSlot: WeaponSlot;
  ammoSummary: string;
  surfaceType: SurfaceType;
  terrainHeight: number;
  terrainSlope: number;
  overheadClearance: boolean;
  currentRegionUz: string;
  activeBotCount: number;
  activeTracerCount: number;
  activeParticleCount: number;
  activePropCount: number;
  dynamicObjectCount: number;
  collisionObjectCount: number;
  graphicsQuality: GraphicsQuality;
  matchState: string;
  nearestBotInfo: string;
  assetPipelineMode: string;
  assetLoadErrors: string[];
}

export interface HudSnapshot {
  playerHp: number;
  playerMaxHp: number;
  playerAlive: boolean;
  playerCrouching: boolean;
  playerAiming: boolean;
  playerSprinting: boolean;
  playerMovementState?: PlayerMovementState;
  playerAnimationState?: FirstPersonAnimState;
  reloadStage?: ReloadStageId;
  soldierClass: SoldierClassSpec;
  abilityCooldownRemaining: number;
  abilityActiveTimer: number;
  respawnTimer: number;
  activeSlot: WeaponSlot;
  weapon: WeaponSpec;
  primaryWeapon: WeaponSpec;
  sidearmWeapon: WeaponSpec;
  ammo: number;
  maxAmmo: number;
  reserveAmmo: number;
  primaryMagAmmo: number;
  primaryReserveAmmo: number;
  sidearmMagAmmo: number;
  sidearmReserveAmmo: number;
  reloading: boolean;
  reloadProgress: number;
  stamina: number;
  blueScore: number;
  redScore: number;
  maxScore: number;
  timeRemaining: number;
  matchElapsed: number;
  gameMode: GameMode;
  objectives: ObjectiveState[];
  activeObjectiveId: 'A' | 'B' | 'C' | null;
  nearbyInteractionPromptUz: string | null;
  currentRegionUz: string;
  reconScanActive: boolean;
  combatants: CombatantStats[];
  killFeed: KillFeedItem[];
  hitMarkerTimer: number;
  hitMarkerHeadshot: boolean;
  damageFlashTimer: number;
  emptyClickTimer: number;
  fps: number;
  pointerLocked: boolean;
  diagnostics: DiagnosticData;
}
