import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { assetLoader } from '../assets/assetLoader';
import {
  ARENA_STRUCTURES,
  BLUE_SPAWN_POINTS,
  INITIAL_DYNAMIC_PROPS,
  INITIAL_OBJECTIVES,
  MAX_STEP_HEIGHT,
  MAX_WALKABLE_SLOPE,
  RED_SPAWN_POINTS,
  getNextWaypointToward,
  getRegionAt,
  getSurfaceTypeAt,
  getTerrainHeight,
  getTerrainSlope,
  hasOverheadClearance,
  raycastStructures,
  resolveArenaCollision,
} from './mapData';
import {
  FirstPersonRig,
  ObjectiveRig,
  SoldierRig,
  createBattlefieldEnvironment,
  createDynamicPropMesh,
  createFirstPersonRig,
  createObjectiveBeacon,
  createSoldierModel,
  equipFirstPersonWeapon,
  equipWeaponOnRig,
  triggerFirstPersonFireImpulse,
  updateFirstPersonRigAnimation,
} from './models';
import {
  CombatantStats,
  DynamicPropState,
  FirstPersonAnimState,
  GameMode,
  GameScreen,
  GameSettings,
  HudSnapshot,
  KillFeedItem,
  ObjectiveState,
  PRIMARY_WEAPON_LIST,
  PlayerMovementState,
  PrimaryWeaponId,
  ReloadStageId,
  SIDEARM_WEAPON_LIST,
  SOLDIER_CLASSES,
  SidearmWeaponId,
  SoldierClassId,
  StructureCollider,
  WEAPONS,
  WeaponId,
  WeaponSlot,
} from '../types/game';
import { soundFX } from '../utils/sound';

interface InternalCombatant extends CombatantStats {
  vx: number;
  vy: number;
  vz: number;
  pitch: number;
  grounded: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  sprintRecoveryTimer: number;
  primaryMagAmmo: number;
  primaryReserveAmmo: number;
  sidearmMagAmmo: number;
  sidearmReserveAmmo: number;
  reloading: boolean;
  reloadTimer: number;
  reloadMidSoundPlayed: boolean;
  fireCooldown: number;
  switchTimer: number;
  switchDuration: number;
  burstRemaining: number;
  burstTimer: number;
  semiTriggerReleased: boolean;
  stamina: number;
  abilityCooldownTimer: number;
  abilityActiveTimer: number;
  resupplyCooldownTimer: number;
  outOfCombatTimer: number;
  hitFlashTimer: number;
  walkCycle: number;
  footstepAccum: number;
  rig: SoldierRig;
  // AI state
  aiTargetObjective: 'A' | 'B' | 'C';
  aiStrafeDir: number;
  aiDecisionTimer: number;
  aiStuckTimer: number;
  aiAvoidAngle: number;
  aiPerceptionTimer: number;
  aiCachedEnemyId: string | null;
}

interface TracerPulse {
  line: THREE.Line;
  mat: THREE.LineBasicMaterial;
  life: number;
  maxLife: number;
}

interface ImpactBurst {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

const _vec3A = new THREE.Vector3();

const ALLIED_NAMES = [
  'TEMUR-2',
  'SARDOR-3',
  'LOCHIN-4',
  'QALQON-5',
  'BO‘RI-6',
  'BURGUT-7',
  'YULDUZ-8',
];
const HOSTILE_NAMES = [
  'VANGUARD-1',
  'REAPER-2',
  'SPECTRE-3',
  'TALON-4',
  'KRONOS-5',
  'VIPER-6',
  'DRAKE-7',
  'TITAN-8',
];

export class ArenaEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private sunLight: THREE.DirectionalLight;
  private fpRig: FirstPersonRig;

  private rafId: number | null = null;
  private disposed = false;
  private lastTime = 0;
  private menuOrbitAngle = 0.4;

  private screen: GameScreen = 'menu';
  private gameMode: GameMode = 'domination';
  private settings: GameSettings;

  private playerClassId: SoldierClassId = 'assault';
  private playerPrimaryId: PrimaryWeaponId = 'ar42_vanguard';
  private playerSidearmId: SidearmWeaponId = 'p6_courier';

  private structures: StructureCollider[] = [];
  private structureMeshes: Map<string, THREE.Group> = new Map();
  private dynamicProps: DynamicPropState[] = [];
  private dynamicPropMeshes: Map<string, THREE.Group> = new Map();
  private combatants: InternalCombatant[] = [];
  private objectives: ObjectiveState[] = [];
  private objectiveRigs: Map<'A' | 'B' | 'C', ObjectiveRig> = new Map();
  private killFeed: KillFeedItem[] = [];

  private blueScore = 0;
  private redScore = 0;
  private readonly maxScore = 300;
  private timeRemaining = 240;
  private matchElapsed = 0;
  private scoreTickAccumulator = 0;
  private reconScanTimer = 0;

  private hitMarkerTimer = 0;
  private hitMarkerHeadshot = false;
  private damageFlashTimer = 0;
  private emptyClickTimer = 0;
  private cameraShake = 0;
  private recoilPitch = 0;
  private smoothedEyeHeight = 1.62;
  private frameLookDeltaX = 0;
  private frameLookDeltaY = 0;

  private tracers: TracerPulse[] = [];
  private impacts: ImpactBurst[] = [];
  private impactGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  private impactMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

  // Input state
  private keysHeld: Set<string> = new Set();
  private mouseDown = false;
  private rightMouseDown = false;
  private pointerLocked = false;
  private isDraggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // Mobile / Android landscape touch state
  private touchMoveX = 0;
  private touchMoveY = 0;
  private touchFiring = false;
  private touchSprinting = false;

  // Performance & Diagnostics
  private frameCount = 0;
  private fpsAccum = 0;
  private currentFps = 60;
  private lastFrameTimeMs = 16.6;
  private hudEmitTimer = 0;

  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private onScreenRequest: (screen: GameScreen) => void;
  private onToggleMap?: () => void;
  private onToggleDiagnostics?: () => void;

  constructor(
    container: HTMLElement,
    initialSettings: GameSettings,
    onHudUpdate: (snapshot: HudSnapshot) => void,
    onScreenRequest: (screen: GameScreen) => void,
    onToggleMap?: () => void,
    onToggleDiagnostics?: () => void
  ) {
    this.container = container;
    this.settings = { ...initialSettings, cameraPerspective: 'first' };
    this.onHudUpdate = onHudUpdate;
    this.onScreenRequest = onScreenRequest;
    this.onToggleMap = onToggleMap;
    this.onToggleDiagnostics = onToggleDiagnostics;

    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless && this.settings.graphicsQuality !== 'low',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const skyHex = 0x1e293b;
    this.scene.background = new THREE.Color(skyHex);
    this.scene.fog = new THREE.FogExp2(skyHex, 0.0034);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    // Near plane set to 0.05 so first-person arms & weapon never clip
    this.camera = new THREE.PerspectiveCamera(
      this.settings.fov,
      (container.clientWidth || window.innerWidth) /
        Math.max(1, container.clientHeight || window.innerHeight),
      0.05,
      460
    );
    this.scene.add(this.camera);

    // Attach dedicated First-Person Viewmodel Rig to camera
    this.fpRig = createFirstPersonRig(
      this.playerClassId,
      this.playerPrimaryId,
      this.settings.weaponFinish
    );
    this.fpRig.root.visible = false;
    this.camera.add(this.fpRig.root);

    const hemiLight = new THREE.HemisphereLight(0xcbd5e1, 0x3b4232, 0.92);
    hemiLight.position.set(0, 120, 0);
    this.scene.add(hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfef3c7, 2.25);
    this.sunLight.position.set(95, 135, 75);
    const d = 165;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 360;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.52);
    rimLight.position.set(-90, 65, -80);
    this.scene.add(rimLight);

    this.applyQualityPreset();
    this.buildArenaGeometry(maxAniso);
    this.initMatchEntities();

    this.renderer.compile(this.scene, this.camera);

    this.bindEvents();
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private applyQualityPreset() {
    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);
    const q = this.settings.graphicsQuality;

    const pixelRatio = isHeadless
      ? 1
      : q === 'low'
      ? Math.min(window.devicePixelRatio || 1, 1.0)
      : q === 'medium'
      ? Math.min(window.devicePixelRatio || 1, 1.5)
      : Math.min(window.devicePixelRatio || 1, 2.0);

    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(
      this.container.clientWidth || window.innerWidth,
      this.container.clientHeight || window.innerHeight
    );

    const enableShadows =
      !isHeadless && this.settings.shadows && q !== 'low';
    this.renderer.shadowMap.enabled = enableShadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.sunLight.castShadow = enableShadows;

    const mapSize = q === 'high' ? 2048 : 1024;
    this.sunLight.shadow.mapSize.set(mapSize, mapSize);
  }

  private buildArenaGeometry(maxAniso: number) {
    this.scene.add(createBattlefieldEnvironment(maxAniso));

    this.structures = ARENA_STRUCTURES.map((s) => ({ ...s, destroyed: false }));
    for (const s of this.structures) {
      const grp = assetLoader.buildStructureInstance(s);
      this.structureMeshes.set(s.id, grp);
      this.scene.add(grp);
    }

    this.dynamicProps = INITIAL_DYNAMIC_PROPS.map((p) => ({
      ...p,
      y: getTerrainHeight(p.x, p.z),
    }));
    for (const dp of this.dynamicProps) {
      const grp = createDynamicPropMesh(dp.kind);
      grp.position.set(dp.x, dp.y, dp.z);
      grp.rotation.set(dp.rotX, dp.rotY, dp.rotZ);
      this.dynamicPropMeshes.set(dp.id, grp);
      this.scene.add(grp);
    }

    this.objectives = INITIAL_OBJECTIVES.map((o) => ({ ...o }));
    for (const obj of this.objectives) {
      const rig = createObjectiveBeacon(obj);
      this.objectiveRigs.set(obj.id, rig);
      this.scene.add(rig.group);
    }
  }

  private clearProjectilesAndEffects() {
    for (const t of this.tracers) {
      this.scene.remove(t.line);
      t.line.geometry.dispose();
      t.mat.dispose();
    }
    this.tracers = [];

    for (const imp of this.impacts) {
      this.scene.remove(imp.mesh);
      (imp.mesh.material as THREE.Material).dispose();
    }
    this.impacts = [];
  }

  private initMatchEntities() {
    this.clearProjectilesAndEffects();

    for (let i = 0; i < ARENA_STRUCTURES.length; i++) {
      this.structures[i] = {
        ...ARENA_STRUCTURES[i],
        destroyed: false,
        hp: ARENA_STRUCTURES[i].maxHp,
      };
      const meshGrp = this.structureMeshes.get(this.structures[i].id);
      if (meshGrp) {
        meshGrp.visible = true;
      }
    }

    for (let i = 0; i < INITIAL_DYNAMIC_PROPS.length; i++) {
      const init = INITIAL_DYNAMIC_PROPS[i];
      const groundY = getTerrainHeight(init.x, init.z);
      this.dynamicProps[i] = {
        ...init,
        y: groundY,
        vx: 0,
        vy: 0,
        vz: 0,
        sleeping: true,
      };
      const grp = this.dynamicPropMeshes.get(init.id);
      if (grp) {
        grp.position.set(init.x, groundY, init.z);
        grp.rotation.set(init.rotX, init.rotY, init.rotZ);
      }
    }

    for (const c of this.combatants) {
      this.scene.remove(c.rig.root);
      c.rig.root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
        }
      });
      c.rig.teamMaterial.dispose();
      c.rig.visorMaterial.dispose();
    }
    this.combatants = [];

    for (let i = 0; i < INITIAL_OBJECTIVES.length; i++) {
      this.objectives[i] = { ...INITIAL_OBJECTIVES[i] };
    }

    this.blueScore = 0;
    this.redScore = 0;
    this.timeRemaining = 240;
    this.matchElapsed = 0;
    this.scoreTickAccumulator = 0;
    this.reconScanTimer = 0;
    this.killFeed = [];
    this.hitMarkerTimer = 0;
    this.damageFlashTimer = 0;
    this.emptyClickTimer = 0;
    this.cameraShake = 0;
    this.recoilPitch = 0;
    this.smoothedEyeHeight = 1.62;

    // 1. Spawn Player (Blue Team)
    const pSpawn = BLUE_SPAWN_POINTS[0];
    this.combatants.push(
      this.createCombatant({
        id: 'player',
        name: 'KOMANDIR (SIZ)',
        team: 'blue',
        isPlayer: true,
        soldierClass: this.playerClassId,
        primaryWeapon: this.playerPrimaryId,
        sidearmWeapon: this.playerSidearmId,
        x: pSpawn.x,
        z: pSpawn.z,
        yaw: -Math.PI * 0.35,
      })
    );

    equipFirstPersonWeapon(
      this.fpRig,
      this.playerPrimaryId,
      this.playerClassId,
      this.settings.weaponFinish
    );

    const classCycle: SoldierClassId[] = [
      'assault',
      'medic',
      'support',
      'recon',
    ];
    const botsPerTeam =
      this.gameMode === 'training'
        ? 3
        : Math.max(3, Math.min(7, this.settings.teamSize || 5));

    // 2. Spawn Allied Blue Bots
    for (let i = 0; i < botsPerTeam; i++) {
      const sp = BLUE_SPAWN_POINTS[(i + 1) % BLUE_SPAWN_POINTS.length];
      const pWeapon = PRIMARY_WEAPON_LIST[i % PRIMARY_WEAPON_LIST.length]
        .id as PrimaryWeaponId;
      const sWeapon = SIDEARM_WEAPON_LIST[i % SIDEARM_WEAPON_LIST.length]
        .id as SidearmWeaponId;
      this.combatants.push(
        this.createCombatant({
          id: `ally_${i}`,
          name: ALLIED_NAMES[i % ALLIED_NAMES.length],
          team: 'blue',
          isPlayer: false,
          soldierClass: classCycle[i % 4],
          primaryWeapon: pWeapon,
          sidearmWeapon: sWeapon,
          x: sp.x,
          z: sp.z,
          yaw: -Math.PI * 0.35,
        })
      );
    }

    // 3. Spawn Hostile Red Bots
    const enemyCount = this.gameMode === 'training' ? 4 : botsPerTeam + 1;
    for (let i = 0; i < enemyCount; i++) {
      const sp = RED_SPAWN_POINTS[i % RED_SPAWN_POINTS.length];
      const pWeapon = PRIMARY_WEAPON_LIST[(i + 2) % PRIMARY_WEAPON_LIST.length]
        .id as PrimaryWeaponId;
      const sWeapon = SIDEARM_WEAPON_LIST[(i + 1) % SIDEARM_WEAPON_LIST.length]
        .id as SidearmWeaponId;
      this.combatants.push(
        this.createCombatant({
          id: `enemy_${i}`,
          name: HOSTILE_NAMES[i % HOSTILE_NAMES.length],
          team: 'red',
          isPlayer: false,
          soldierClass: classCycle[(i + 1) % 4],
          primaryWeapon: pWeapon,
          sidearmWeapon: sWeapon,
          x: sp.x,
          z: sp.z,
          yaw: Math.PI * 0.65,
        })
      );
    }

    this.emitHudSnapshot();
  }

  private createCombatant(params: {
    id: string;
    name: string;
    team: 'blue' | 'red';
    isPlayer: boolean;
    soldierClass: SoldierClassId;
    primaryWeapon: PrimaryWeaponId;
    sidearmWeapon: SidearmWeaponId;
    x: number;
    z: number;
    yaw: number;
  }): InternalCombatant {
    const safeSpawn = resolveArenaCollision(
      params.x,
      params.z,
      0.65,
      this.structures
    );
    const groundY = getTerrainHeight(safeSpawn.x, safeSpawn.z);

    const rig = createSoldierModel(
      params.team,
      params.soldierClass,
      params.primaryWeapon
    );
    rig.root.position.set(safeSpawn.x, groundY, safeSpawn.z);
    rig.root.rotation.y = params.yaw + Math.PI;
    // Hide player's own 3rd-person body mesh so it never blocks the 1st-person camera
    rig.root.visible = !params.isPlayer;
    this.scene.add(rig.root);

    const pSpec = WEAPONS[params.primaryWeapon];
    const sSpec = WEAPONS[params.sidearmWeapon];
    const classSpec = SOLDIER_CLASSES[params.soldierClass];
    const objectivesOrder: ('A' | 'B' | 'C')[] = ['A', 'B', 'C'];

    return {
      id: params.id,
      name: params.name,
      team: params.team,
      isPlayer: params.isPlayer,
      soldierClass: params.soldierClass,
      primaryWeapon: params.primaryWeapon,
      sidearmWeapon: params.sidearmWeapon,
      activeSlot: 'primary',
      weapon: params.primaryWeapon,
      hp: classSpec.maxHp,
      maxHp: classSpec.maxHp,
      alive: true,
      crouching: false,
      aiming: false,
      sprinting: false,
      respawnTimer: 0,
      x: safeSpawn.x,
      y: groundY,
      z: safeSpawn.z,
      yaw: params.yaw,
      kills: 0,
      deaths: 0,
      captures: 0,
      score: 0,
      aiStateLabel: 'PATRUL',
      vx: 0,
      vy: 0,
      vz: 0,
      pitch: 0,
      grounded: true,
      coyoteTimer: 0.14,
      jumpBufferTimer: 0,
      sprintRecoveryTimer: 0,
      primaryMagAmmo: pSpec.magazineSize,
      primaryReserveAmmo: pSpec.reserveAmmo,
      sidearmMagAmmo: sSpec.magazineSize,
      sidearmReserveAmmo: sSpec.reserveAmmo,
      reloading: false,
      reloadTimer: 0,
      reloadMidSoundPlayed: false,
      fireCooldown: 0,
      switchTimer: 0,
      switchDuration: pSpec.switchTime,
      burstRemaining: 0,
      burstTimer: 0,
      semiTriggerReleased: true,
      stamina: 100,
      abilityCooldownTimer: 0,
      abilityActiveTimer: 0,
      resupplyCooldownTimer: 0,
      outOfCombatTimer: 0,
      hitFlashTimer: 0,
      walkCycle: 0,
      footstepAccum: 0,
      rig,
      aiTargetObjective: objectivesOrder[Math.floor(Math.random() * 3)],
      aiStrafeDir: Math.random() > 0.5 ? 1 : -1,
      aiDecisionTimer: Math.random() * 1.2,
      aiStuckTimer: 0,
      aiAvoidAngle: 0,
      aiPerceptionTimer: Math.random() * 0.25,
      aiCachedEnemyId: null,
    };
  }

  private getUnitMagAmmo(unit: InternalCombatant): number {
    return unit.activeSlot === 'primary'
      ? unit.primaryMagAmmo
      : unit.sidearmMagAmmo;
  }

  private getUnitReserveAmmo(unit: InternalCombatant): number {
    return unit.activeSlot === 'primary'
      ? unit.primaryReserveAmmo
      : unit.sidearmReserveAmmo;
  }

  private setUnitMagAndReserve(
    unit: InternalCombatant,
    mag: number,
    reserve: number
  ) {
    if (unit.activeSlot === 'primary') {
      unit.primaryMagAmmo = mag;
      unit.primaryReserveAmmo = reserve;
    } else {
      unit.sidearmMagAmmo = mag;
      unit.sidearmReserveAmmo = reserve;
    }
  }

  public startNewMatch(config?: {
    primaryWeapon?: PrimaryWeaponId;
    sidearmWeapon?: SidearmWeaponId;
    soldierClass?: SoldierClassId;
    gameMode?: GameMode;
  }) {
    if (config?.primaryWeapon) this.playerPrimaryId = config.primaryWeapon;
    if (config?.sidearmWeapon) this.playerSidearmId = config.sidearmWeapon;
    if (config?.soldierClass) this.playerClassId = config.soldierClass;
    if (config?.gameMode) this.gameMode = config.gameMode;

    this.initMatchEntities();
    this.setScreen('playing');
    this.requestPointerLockSafe();
  }

  public setScreen(nextScreen: GameScreen) {
    this.screen = nextScreen;
    this.fpRig.root.visible = nextScreen === 'playing';
    if (nextScreen !== 'playing') {
      this.clearInputs();
      if (document.pointerLockElement === this.renderer.domElement) {
        try {
          document.exitPointerLock();
        } catch {
          // Ignore
        }
      }
    }
    this.emitHudSnapshot();
  }

  public setLoadout(
    primaryWeapon: PrimaryWeaponId,
    sidearmWeapon: SidearmWeaponId,
    soldierClass: SoldierClassId
  ) {
    this.playerPrimaryId = primaryWeapon;
    this.playerSidearmId = sidearmWeapon;
    this.playerClassId = soldierClass;

    const player = this.combatants.find((c) => c.isPlayer);
    if (player) {
      const classSpec = SOLDIER_CLASSES[soldierClass];
      player.soldierClass = soldierClass;
      player.maxHp = classSpec.maxHp;
      player.hp = Math.min(player.hp, player.maxHp);
      player.primaryWeapon = primaryWeapon;
      player.sidearmWeapon = sidearmWeapon;
      player.activeSlot = 'primary';
      player.weapon = primaryWeapon;

      const pSpec = WEAPONS[primaryWeapon];
      const sSpec = WEAPONS[sidearmWeapon];
      player.primaryMagAmmo = pSpec.magazineSize;
      player.primaryReserveAmmo = pSpec.reserveAmmo;
      player.sidearmMagAmmo = sSpec.magazineSize;
      player.sidearmReserveAmmo = sSpec.reserveAmmo;
      player.reloading = false;
      player.reloadTimer = 0;
      player.burstRemaining = 0;

      equipWeaponOnRig(player.rig, player.weapon, this.settings.weaponFinish);
      equipFirstPersonWeapon(
        this.fpRig,
        player.weapon,
        player.soldierClass,
        this.settings.weaponFinish
      );
      this.emitHudSnapshot();
    }
  }

  public switchPlayerSlot(targetSlot?: WeaponSlot) {
    const player = this.combatants.find((c) => c.isPlayer);
    if (!player || !player.alive) return;
    const nextSlot: WeaponSlot =
      targetSlot ?? (player.activeSlot === 'primary' ? 'secondary' : 'primary');
    if (player.activeSlot === nextSlot && player.switchTimer <= 0) return;

    this.switchUnitWeaponSlot(player, nextSlot);
    soundFX.playWeaponSwitch();
    this.emitHudSnapshot();
  }

  private switchUnitWeaponSlot(unit: InternalCombatant, slot: WeaponSlot) {
    unit.activeSlot = slot;
    unit.weapon = slot === 'primary' ? unit.primaryWeapon : unit.sidearmWeapon;
    // Cancel any active reload so ammunition never transfers onto the wrong weapon
    unit.reloading = false;
    unit.reloadTimer = 0;
    unit.reloadMidSoundPlayed = false;
    unit.burstRemaining = 0;
    unit.aiming = false;
    unit.switchDuration = WEAPONS[unit.weapon].switchTime;
    unit.switchTimer = unit.switchDuration;
    equipWeaponOnRig(unit.rig, unit.weapon, this.settings.weaponFinish);
    if (unit.isPlayer && !this.fpRig.weaponData) {
      equipFirstPersonWeapon(
        this.fpRig,
        unit.weapon,
        unit.soldierClass,
        this.settings.weaponFinish
      );
    }
  }

  public activatePlayerAbility() {
    const player = this.combatants.find((c) => c.isPlayer);
    if (!player || !player.alive || player.abilityCooldownTimer > 0) return;

    const classSpec = SOLDIER_CLASSES[player.soldierClass];
    player.abilityCooldownTimer = classSpec.abilityCooldown;
    soundFX.playAbility();

    if (player.soldierClass === 'assault') {
      player.stamina = 100;
      player.abilityActiveTimer = 6.0;
    } else if (player.soldierClass === 'medic') {
      player.hp = Math.min(player.maxHp, player.hp + 55);
      player.abilityActiveTimer = 3.0;
      for (const ally of this.combatants) {
        if (!ally.alive || ally.team !== player.team || ally.isPlayer) continue;
        const d = Math.hypot(ally.x - player.x, ally.z - player.z);
        if (d <= 14) {
          ally.hp = Math.min(ally.maxHp, ally.hp + 50);
        }
      }
    } else if (player.soldierClass === 'support') {
      const pSpec = WEAPONS[player.primaryWeapon];
      const sSpec = WEAPONS[player.sidearmWeapon];
      player.primaryReserveAmmo = Math.min(
        pSpec.reserveAmmo * 2,
        player.primaryReserveAmmo + pSpec.magazineSize * 2
      );
      player.sidearmReserveAmmo = Math.min(
        sSpec.reserveAmmo * 2,
        player.sidearmReserveAmmo + sSpec.magazineSize * 2
      );
      player.hp = Math.min(player.maxHp, player.hp + 25);
      player.abilityActiveTimer = 3.0;
    } else if (player.soldierClass === 'recon') {
      this.reconScanTimer = 10.0;
      player.abilityActiveTimer = 10.0;
    }

    this.emitHudSnapshot();
  }

  /**
   * Field interaction (Key E / Touch Interact button):
   * When inside an Objective zone or near a tactical supply crate, replenishes reserve ammo and +25 HP.
   */
  public triggerPlayerInteract() {
    const player = this.combatants.find((c) => c.isPlayer);
    if (!player || !player.alive || player.resupplyCooldownTimer > 0) return;

    const canInteract = this.canPlayerInteract(player);
    if (!canInteract) return;

    const pSpec = WEAPONS[player.primaryWeapon];
    const sSpec = WEAPONS[player.sidearmWeapon];
    player.primaryReserveAmmo = Math.max(
      player.primaryReserveAmmo,
      pSpec.reserveAmmo
    );
    player.sidearmReserveAmmo = Math.max(
      player.sidearmReserveAmmo,
      sSpec.reserveAmmo
    );
    player.hp = Math.min(player.maxHp, player.hp + 25);
    player.resupplyCooldownTimer = 8.0;
    soundFX.playWeaponSwitch();
    this.emitHudSnapshot();
  }

  private canPlayerInteract(player: InternalCombatant): boolean {
    if (!player.alive || player.resupplyCooldownTimer > 0) return false;
    for (const obj of this.objectives) {
      const dSq =
        (player.x - obj.x) * (player.x - obj.x) +
        (player.z - obj.z) * (player.z - obj.z);
      if (dSq <= obj.radius * obj.radius) {
        return true;
      }
    }
    return false;
  }

  public updateSettings(newSettings: GameSettings) {
    this.settings = { ...newSettings, cameraPerspective: 'first' };
    soundFX.setConfig(
      this.settings.soundEnabled,
      this.settings.masterVolume,
      this.settings.sfxVolume
    );
    this.camera.fov = this.settings.fov;
    this.camera.updateProjectionMatrix();
    this.applyQualityPreset();

    const player = this.combatants.find((c) => c.isPlayer);
    if (player) {
      equipFirstPersonWeapon(
        this.fpRig,
        player.weapon,
        player.soldierClass,
        this.settings.weaponFinish
      );
    }
    this.emitHudSnapshot();
  }

  public toggleCameraPerspective() {
    this.settings.cameraPerspective = 'first';
    this.emitHudSnapshot();
    return this.settings.cameraPerspective;
  }

  public triggerManualReload() {
    const player = this.combatants.find((c) => c.isPlayer);
    if (!player || !player.alive || player.reloading || player.switchTimer > 0)
      return;
    this.startUnitReload(player, true);
  }

  private startUnitReload(unit: InternalCombatant, playAudio: boolean) {
    if (unit.reloading || unit.switchTimer > 0) return;
    const spec = WEAPONS[unit.weapon];
    const mag = this.getUnitMagAmmo(unit);
    const reserve = this.getUnitReserveAmmo(unit);
    if (mag < spec.magazineSize && reserve > 0) {
      unit.reloading = true;
      unit.reloadTimer = spec.reloadTime;
      unit.reloadMidSoundPlayed = false;
      unit.burstRemaining = 0;
      unit.aiming = false;
      if (playAudio) soundFX.playReload();
      if (unit.isPlayer) this.emitHudSnapshot();
    } else if (mag === 0 && reserve === 0 && unit.isPlayer) {
      this.emptyClickTimer = 0.35;
      soundFX.playEmptyClick();
    }
  }

  private completeUnitReload(unit: InternalCombatant) {
    if (!unit.reloading) return;
    const spec = WEAPONS[unit.weapon];
    const mag = this.getUnitMagAmmo(unit);
    const reserve = this.getUnitReserveAmmo(unit);
    const needed = Math.max(0, spec.magazineSize - mag);
    const transfer = Math.min(needed, reserve);
    this.setUnitMagAndReserve(unit, mag + transfer, reserve - transfer);
    unit.reloading = false;
    unit.reloadTimer = 0;
    unit.reloadMidSoundPlayed = false;
    if (unit.isPlayer) {
      soundFX.playReloadComplete();
      this.emitHudSnapshot();
    }
  }

  public triggerTouchJump() {
    const player = this.combatants.find((c) => c.isPlayer);
    if (!player || !player.alive) return;
    if (player.crouching) {
      if (hasOverheadClearance(player.x, player.y, player.z, this.structures)) {
        player.crouching = false;
        this.emitHudSnapshot();
      }
      return;
    }
    if (player.grounded || player.coyoteTimer > 0) {
      player.vy = 9.4;
      player.grounded = false;
      player.coyoteTimer = 0;
      player.jumpBufferTimer = 0;
      soundFX.playJump();
    } else {
      player.jumpBufferTimer = 0.12;
    }
  }

  public togglePlayerCrouch() {
    const player = this.combatants.find((c) => c.isPlayer);
    if (!player || !player.alive) return;
    if (player.crouching) {
      if (!hasOverheadClearance(player.x, player.y, player.z, this.structures)) {
        return;
      }
      player.crouching = false;
    } else {
      player.crouching = true;
      this.touchSprinting = false;
    }
    this.emitHudSnapshot();
  }

  public toggleTouchAiming() {
    const player = this.combatants.find((c) => c.isPlayer);
    if (!player || !player.alive || player.reloading || player.switchTimer > 0)
      return;
    player.aiming = !player.aiming;
    if (player.aiming) {
      this.touchSprinting = false;
    }
    this.emitHudSnapshot();
  }

  public setTouchSprint(sprinting: boolean) {
    const player = this.combatants.find((c) => c.isPlayer);
    if (sprinting && player && player.sprintRecoveryTimer > 0) {
      return;
    }
    this.touchSprinting = sprinting;
    if (sprinting && player) {
      if (hasOverheadClearance(player.x, player.y, player.z, this.structures)) {
        player.crouching = false;
      }
      player.aiming = false;
    }
    this.emitHudSnapshot();
  }

  public toggleTouchSprint() {
    this.setTouchSprint(!this.touchSprinting);
  }

  public setTouchMovement(nx: number, ny: number) {
    this.touchMoveX = Math.max(-1, Math.min(1, nx));
    this.touchMoveY = Math.max(-1, Math.min(1, ny));
    if (Math.hypot(this.touchMoveX, this.touchMoveY) < 0.15) {
      this.touchSprinting = false;
    }
  }

  public setTouchFiring(firing: boolean) {
    this.touchFiring = firing;
    if (!firing) {
      const player = this.combatants.find((c) => c.isPlayer);
      if (player) player.semiTriggerReleased = true;
    }
  }

  public adjustPlayerLook(deltaYaw: number, deltaPitch: number) {
    const player = this.combatants.find((c) => c.isPlayer);
    if (!player || this.screen !== 'playing') return;
    const zoomFactor = player.aiming ? 0.58 : 1.0;
    const sens = 0.0022 * this.settings.sensitivity * zoomFactor;
    const ySign = this.settings.invertY ? -1 : 1;
    player.yaw -= deltaYaw * sens;
    player.pitch = THREE.MathUtils.clamp(
      player.pitch - deltaPitch * sens * ySign,
      -0.78,
      0.78
    );
    this.frameLookDeltaX += deltaYaw;
    this.frameLookDeltaY += deltaPitch;
  }

  public requestPointerLockSafe() {
    try {
      this.renderer.domElement.requestPointerLock?.();
    } catch {
      // Ignored in restricted sandboxes or mobile browsers
    }
  }

  private clearInputs() {
    this.keysHeld.clear();
    this.mouseDown = false;
    this.rightMouseDown = false;
    this.isDraggingLook = false;
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.touchFiring = false;
    this.touchSprinting = false;
    const player = this.combatants.find((c) => c.isPlayer);
    if (player) {
      player.aiming = false;
      player.sprinting = false;
      player.semiTriggerReleased = true;
    }
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'F3') {
      e.preventDefault();
      this.onToggleDiagnostics?.();
      return;
    }

    if (e.code === 'KeyM' && this.screen === 'playing') {
      e.preventDefault();
      this.onToggleMap?.();
      return;
    }

    if (e.code === 'Escape') {
      if (this.screen === 'playing') {
        this.setScreen('paused');
        this.onScreenRequest('paused');
      } else if (this.screen === 'paused') {
        this.setScreen('playing');
        this.onScreenRequest('playing');
      }
      return;
    }

    if (this.screen === 'menu' && (e.code === 'Enter' || e.code === 'Space')) {
      const activeTag = document.activeElement?.tagName;
      if (activeTag !== 'BUTTON' && activeTag !== 'INPUT') {
        e.preventDefault();
        this.startNewMatch();
        this.onScreenRequest('playing');
      }
      return;
    }

    if (this.screen !== 'playing') return;

    this.keysHeld.add(e.code);

    if (e.code === 'Digit1') {
      this.switchPlayerSlot('primary');
    } else if (e.code === 'Digit2') {
      this.switchPlayerSlot('secondary');
    } else if (e.code === 'KeyR') {
      this.triggerManualReload();
    } else if (e.code === 'KeyQ') {
      this.activatePlayerAbility();
    } else if (e.code === 'KeyE' || e.code === 'KeyF') {
      this.triggerPlayerInteract();
    } else if (e.code === 'KeyC' || e.code === 'ControlLeft') {
      this.togglePlayerCrouch();
    } else if (e.code === 'Space') {
      e.preventDefault();
      this.triggerTouchJump();
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keysHeld.delete(e.code);
  };

  private handleWheel = (e: WheelEvent) => {
    if (this.screen !== 'playing') return;
    if (Math.abs(e.deltaY) > 4) {
      const player = this.combatants.find((c) => c.isPlayer);
      if (player) {
        this.switchPlayerSlot(
          player.activeSlot === 'primary' ? 'secondary' : 'primary'
        );
      }
    }
  };

  private handleWindowBlur = () => {
    this.clearInputs();
  };

  private handlePointerLockChange = () => {
    this.pointerLocked =
      document.pointerLockElement === this.renderer.domElement;
    this.emitHudSnapshot();
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (this.screen !== 'playing') return;
    if (e.button === 0) {
      this.mouseDown = true;
      this.isDraggingLook = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      if (!this.pointerLocked) {
        this.requestPointerLockSafe();
      }
    } else if (e.button === 2) {
      this.rightMouseDown = true;
      this.isDraggingLook = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      const player = this.combatants.find((c) => c.isPlayer);
      if (player && !player.reloading && player.switchTimer <= 0) {
        player.aiming = !this.pointerLocked ? !player.aiming : true;
      }
    }
  };

  private handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.mouseDown = false;
      this.isDraggingLook = false;
      const player = this.combatants.find((c) => c.isPlayer);
      if (player) player.semiTriggerReleased = true;
    } else if (e.button === 2) {
      this.rightMouseDown = false;
      this.isDraggingLook = false;
      if (this.pointerLocked) {
        const player = this.combatants.find((c) => c.isPlayer);
        if (player) player.aiming = false;
      }
    }
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (this.screen !== 'playing') return;
    if (this.pointerLocked) {
      this.adjustPlayerLook(e.movementX, e.movementY);
    } else if (this.isDraggingLook) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.adjustPlayerLook(dx * 1.35, dy * 1.35);
    }
  };

  private handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private handleResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private bindEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('wheel', this.handleWheel, { passive: true });
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);

    const dom = this.renderer.domElement;
    dom.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    dom.addEventListener('contextmenu', this.handleContextMenu);
  }

  public dispose() {
    this.disposed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener(
      'pointerlockchange',
      this.handlePointerLockChange
    );

    const dom = this.renderer.domElement;
    dom.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    dom.removeEventListener('contextmenu', this.handleContextMenu);

    this.clearProjectilesAndEffects();
    this.renderer.dispose();
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);

    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    this.lastFrameTimeMs = rawDt * 1000;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    this.frameCount++;
    this.fpsAccum += rawDt;
    if (this.fpsAccum >= 0.5) {
      this.currentFps = Math.round(this.frameCount / this.fpsAccum);
      this.frameCount = 0;
      this.fpsAccum = 0;
    }

    if (this.screen === 'playing') {
      this.updateSimulation(dt);
    } else if (this.screen === 'menu' || this.screen === 'loadout') {
      this.updateMenuShowcase(dt);
    }

    this.updateCameraAndFirstPersonRig(dt);
    this.renderer.render(this.scene, this.camera);

    this.hudEmitTimer += dt;
    if (this.hudEmitTimer >= 0.06) {
      this.hudEmitTimer = 0;
      this.emitHudSnapshot();
    }
  };

  private updateMenuShowcase(dt: number) {
    this.menuOrbitAngle += dt * 0.11;
    for (const [id, rig] of this.objectiveRigs.entries()) {
      rig.coreMesh.rotation.y += dt * 1.4;
      rig.flagMesh.rotation.y =
        Math.sin(this.menuOrbitAngle * 6 + id.charCodeAt(0)) * 0.18;
    }
  }

  private updateSimulation(dt: number) {
    this.matchElapsed += dt;
    if (this.gameMode === 'domination') {
      this.timeRemaining = Math.max(0, this.timeRemaining - dt);
      if (this.timeRemaining <= 0) {
        this.finishMatch();
        return;
      }
    }

    if (this.reconScanTimer > 0)
      this.reconScanTimer = Math.max(0, this.reconScanTimer - dt);
    if (this.hitMarkerTimer > 0)
      this.hitMarkerTimer = Math.max(0, this.hitMarkerTimer - dt);
    if (this.damageFlashTimer > 0)
      this.damageFlashTimer = Math.max(0, this.damageFlashTimer - dt);
    if (this.emptyClickTimer > 0)
      this.emptyClickTimer = Math.max(0, this.emptyClickTimer - dt);
    if (this.cameraShake > 0)
      this.cameraShake = Math.max(0, this.cameraShake - dt * 4.2);

    const player = this.combatants.find((c) => c.isPlayer);
    const recSpeed = player ? WEAPONS[player.weapon].recoilRecovery : 14;
    this.recoilPitch = THREE.MathUtils.damp(this.recoilPitch, 0, recSpeed, dt);

    for (const unit of this.combatants) {
      if (!unit.alive) {
        unit.respawnTimer -= dt;
        if (unit.respawnTimer <= 0) {
          this.respawnCombatant(unit);
        }
        continue;
      }

      if (unit.abilityCooldownTimer > 0) {
        unit.abilityCooldownTimer = Math.max(0, unit.abilityCooldownTimer - dt);
      }
      if (unit.abilityActiveTimer > 0) {
        unit.abilityActiveTimer = Math.max(0, unit.abilityActiveTimer - dt);
      }
      if (unit.resupplyCooldownTimer > 0) {
        unit.resupplyCooldownTimer = Math.max(
          0,
          unit.resupplyCooldownTimer - dt
        );
      }
      if (unit.switchTimer > 0) {
        unit.switchTimer = Math.max(0, unit.switchTimer - dt);
        if (
          unit.isPlayer &&
          unit.switchTimer <= unit.switchDuration * 0.55 &&
          this.fpRig.equippedWeaponId !== unit.weapon
        ) {
          equipFirstPersonWeapon(
            this.fpRig,
            unit.weapon,
            unit.soldierClass,
            this.settings.weaponFinish
          );
        }
      }

      if (unit.hitFlashTimer > 0) {
        unit.hitFlashTimer -= dt;
        if (unit.hitFlashTimer <= 0) {
          unit.rig.teamMaterial.color.copy(unit.rig.baseTeamColor);
          unit.rig.teamMaterial.emissive.setHex(0x000000);
        }
      }

      unit.outOfCombatTimer += dt;
      if (unit.outOfCombatTimer >= 5.0 && unit.hp < unit.maxHp) {
        unit.hp = Math.min(unit.maxHp, unit.hp + 12 * dt);
      }

      if (unit.fireCooldown > 0) unit.fireCooldown -= dt;

      if (unit.reloading) {
        unit.reloadTimer -= dt;
        const spec = WEAPONS[unit.weapon];
        const progress = 1 - unit.reloadTimer / spec.reloadTime;
        if (unit.isPlayer && !unit.reloadMidSoundPlayed && progress >= 0.56) {
          unit.reloadMidSoundPlayed = true;
          soundFX.playReload();
        }
        if (unit.reloadTimer <= 0) {
          this.completeUnitReload(unit);
        }
      }

      // Deterministic burst-fire queue
      if (unit.burstRemaining > 0 && !unit.reloading && unit.switchTimer <= 0) {
        unit.burstTimer -= dt;
        if (unit.burstTimer <= 0) {
          const mag = this.getUnitMagAmmo(unit);
          if (mag > 0) {
            this.executeWeaponShot(unit);
            unit.burstRemaining--;
            unit.burstTimer = 0.068;
          } else {
            unit.burstRemaining = 0;
          }
        }
      }

      if (unit.isPlayer) {
        this.updatePlayerControl(unit, dt);
      } else {
        this.updateBotAI(unit, dt);
      }

      this.updateUnitKinematicsAndAnimation(unit, dt);
    }

    this.updateDynamicProps(dt);
    this.updateObjectivesAndScoring(dt);
    this.updateEffects(dt);
  }

  private updatePlayerControl(player: InternalCombatant, dt: number) {
    if (player.jumpBufferTimer > 0) {
      player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt);
    }
    if (player.sprintRecoveryTimer > 0) {
      player.sprintRecoveryTimer = Math.max(0, player.sprintRecoveryTimer - dt);
    }

    const keyTurnSpeed = 2.0;
    if (this.keysHeld.has('ArrowLeft')) player.yaw += keyTurnSpeed * dt;
    if (this.keysHeld.has('ArrowRight')) player.yaw -= keyTurnSpeed * dt;

    let moveForward = 0;
    let moveRight = 0;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp'))
      moveForward += 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown'))
      moveForward -= 1;
    if (this.keysHeld.has('KeyD')) moveRight += 1;
    if (this.keysHeld.has('KeyA')) moveRight -= 1;

    moveForward += -this.touchMoveY;
    moveRight += this.touchMoveX;

    const len = Math.hypot(moveForward, moveRight);
    if (len > 1) {
      moveForward /= len;
      moveRight /= len;
    }

    const canSprintNow =
      player.sprintRecoveryTimer <= 0 &&
      moveForward > 0.2 &&
      !player.aiming &&
      !player.reloading &&
      player.stamina > (player.sprinting ? 4 : 16);

    const wantsSprint =
      (this.keysHeld.has('ShiftLeft') ||
        this.keysHeld.has('ShiftRight') ||
        this.touchSprinting) &&
      canSprintNow;

    if (player.sprinting && !wantsSprint) {
      player.sprintRecoveryTimer = 0.45;
    }
    player.sprinting = Boolean(wantsSprint);
    if (wantsSprint) {
      if (hasOverheadClearance(player.x, player.y, player.z, this.structures)) {
        player.crouching = false;
      }
      player.stamina = Math.max(0, player.stamina - 22 * dt);
      if (player.stamina <= 5) {
        this.touchSprinting = false;
        player.sprintRecoveryTimer = 0.65;
      }
    } else if (player.sprintRecoveryTimer <= 0) {
      player.stamina = Math.min(100, player.stamina + 18 * dt);
    }

    const classMult = SOLDIER_CLASSES[player.soldierClass].speedMultiplier;
    const abilitySpeedBoost =
      player.soldierClass === 'assault' && player.abilityActiveTimer > 0
        ? 1.25
        : 1.0;
    const weaponMult = WEAPONS[player.weapon].moveSpeedMultiplier;
    const stanceMult = player.crouching
      ? 0.62
      : player.aiming
      ? 0.76
      : wantsSprint
      ? 1.38
      : 1.0;

    const speed = 8.8 * classMult * weaponMult * stanceMult * abilitySpeedBoost;

    const sinY = Math.sin(player.yaw);
    const cosY = Math.cos(player.yaw);

    const targetVx = (-sinY * moveForward + cosY * moveRight) * speed;
    const targetVz = (-cosY * moveForward - sinY * moveRight) * speed;

    player.vx = THREE.MathUtils.damp(player.vx, targetVx, 16, dt);
    player.vz = THREE.MathUtils.damp(player.vz, targetVz, 16, dt);

    // Firing Trigger Logic (cancels sprint when firing)
    const triggerActive = this.mouseDown || this.touchFiring;
    if (triggerActive && !player.reloading && player.switchTimer <= 0) {
      player.sprinting = false;
      const spec = WEAPONS[player.weapon];
      const mag = this.getUnitMagAmmo(player);

      if (mag <= 0) {
        this.startUnitReload(player, true);
      } else if (player.fireCooldown <= 0 && player.burstRemaining === 0) {
        if (spec.fireMode === 'semi' || spec.fireMode === 'spread') {
          if (player.semiTriggerReleased) {
            player.semiTriggerReleased = false;
            this.initiateWeaponAction(player);
          }
        } else {
          this.initiateWeaponAction(player);
        }
      }
    }
  }

  private updateBotAI(bot: InternalCombatant, dt: number) {
    bot.aiDecisionTimer -= dt;
    bot.aiPerceptionTimer -= dt;

    let closestEnemy: InternalCombatant | null = null;
    let closestDistSq = Infinity;

    if (bot.aiPerceptionTimer <= 0) {
      const perceptionInterval =
        this.settings.graphicsQuality === 'low' ? 0.25 : 0.14;
      bot.aiPerceptionTimer = perceptionInterval + Math.random() * 0.06;
      bot.aiCachedEnemyId = null;

      for (const other of this.combatants) {
        if (!other.alive || other.team === bot.team) continue;
        const dx = other.x - bot.x;
        const dz = other.z - bot.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < closestDistSq && dSq < 115 * 115) {
          const los = raycastStructures(
            bot.x,
            bot.y + 1.38,
            bot.z,
            other.x,
            other.y + 1.38,
            other.z,
            this.structures
          );
          if (!los.hit) {
            closestDistSq = dSq;
            closestEnemy = other;
            bot.aiCachedEnemyId = other.id;
          }
        }
      }
    } else if (bot.aiCachedEnemyId) {
      const cached = this.combatants.find(
        (c) => c.id === bot.aiCachedEnemyId && c.alive
      );
      if (cached) {
        closestEnemy = cached;
        closestDistSq =
          (cached.x - bot.x) * (cached.x - bot.x) +
          (cached.z - bot.z) * (cached.z - bot.z);
      }
    }

    if (bot.aiDecisionTimer <= 0) {
      bot.aiDecisionTimer = 2.2 + Math.random() * 1.6;
      bot.aiStrafeDir = Math.random() > 0.5 ? 1 : -1;

      const unowned = this.objectives.filter(
        (o) => o.owner !== bot.team || o.contested
      );
      if (unowned.length > 0) {
        unowned.sort(
          (a, b) =>
            Math.hypot(a.x - bot.x, a.z - bot.z) -
            Math.hypot(b.x - bot.x, b.z - bot.z)
        );
        bot.aiTargetObjective =
          Math.random() < 0.72
            ? unowned[0].id
            : unowned[unowned.length - 1].id;
      } else {
        const ids: ('A' | 'B' | 'C')[] = ['A', 'B', 'C'];
        bot.aiTargetObjective = ids[Math.floor(Math.random() * 3)];
      }
    }

    const targetObj =
      this.objectives.find((o) => o.id === bot.aiTargetObjective) ||
      this.objectives[1];

    const wp = getNextWaypointToward(bot.x, bot.z, targetObj.x, targetObj.z);
    const toWpX = wp.x - bot.x;
    const toWpZ = wp.z - bot.z;
    const distToObj = Math.hypot(targetObj.x - bot.x, targetObj.z - bot.z);

    let desiredDirX = 0;
    let desiredDirZ = 0;
    const botSpeed = 7.4 * WEAPONS[bot.weapon].moveSpeedMultiplier;

    if (distToObj > targetObj.radius * 0.7) {
      bot.aiStateLabel = `NUQTA-${targetObj.id} GA YURISH`;
      let moveAngle = Math.atan2(toWpX, toWpZ) + bot.aiAvoidAngle;
      const probeDist = 4.2;
      const probeX = bot.x + Math.sin(moveAngle) * probeDist;
      const probeZ = bot.z + Math.cos(moveAngle) * probeDist;
      const col = resolveArenaCollision(
        probeX,
        probeZ,
        0.85,
        this.structures
      );

      if (col.hitWall) {
        const leftAngle = moveAngle + 1.15;
        const rightAngle = moveAngle - 1.15;
        const leftCol = resolveArenaCollision(
          bot.x + Math.sin(leftAngle) * probeDist,
          bot.z + Math.cos(leftAngle) * probeDist,
          0.8,
          this.structures
        );
        const rightCol = resolveArenaCollision(
          bot.x + Math.sin(rightAngle) * probeDist,
          bot.z + Math.cos(rightAngle) * probeDist,
          0.8,
          this.structures
        );
        if (!leftCol.hitWall && rightCol.hitWall) bot.aiStrafeDir = 1;
        else if (!rightCol.hitWall && leftCol.hitWall) bot.aiStrafeDir = -1;
        bot.aiAvoidAngle = 1.3 * bot.aiStrafeDir;
        moveAngle = Math.atan2(toWpX, toWpZ) + bot.aiAvoidAngle;
      } else {
        bot.aiAvoidAngle = THREE.MathUtils.damp(bot.aiAvoidAngle, 0, 3.5, dt);
      }

      if (Math.hypot(bot.vx, bot.vz) < 1.2) {
        bot.aiStuckTimer += dt;
        if (bot.aiStuckTimer > 0.65) {
          bot.aiStrafeDir *= -1;
          bot.aiAvoidAngle = 1.6 * bot.aiStrafeDir;
          bot.aiStuckTimer = 0;
        }
      } else {
        bot.aiStuckTimer = 0;
      }

      desiredDirX = Math.sin(moveAngle);
      desiredDirZ = Math.cos(moveAngle);
    } else {
      bot.aiStateLabel = `NUQTA-${targetObj.id} MUDOFAASI`;
      const tangentX = -toWpZ / Math.max(1, distToObj);
      const tangentZ = toWpX / Math.max(1, distToObj);
      desiredDirX = tangentX * bot.aiStrafeDir * 0.6;
      desiredDirZ = tangentZ * bot.aiStrafeDir * 0.6;
    }

    if (closestEnemy) {
      bot.aiStateLabel = `JANG (${closestEnemy.name})`;
      const ex = closestEnemy.x - bot.x;
      const ez = closestEnemy.z - bot.z;
      const targetYaw = Math.atan2(-ex, -ez);

      let diff = targetYaw - bot.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      const aimTurnRate =
        this.settings.botDifficulty === 'elite'
          ? 8.5
          : this.settings.botDifficulty === 'veteran'
          ? 5.8
          : 3.6;
      bot.yaw += diff * Math.min(1, aimTurnRate * dt);

      const dy = closestEnemy.y + 1.2 - (bot.y + 1.35);
      const flatDist = Math.max(1, Math.hypot(ex, ez));
      bot.pitch = THREE.MathUtils.clamp(Math.atan2(dy, flatDist), -0.55, 0.55);

      const wSpec = WEAPONS[bot.weapon];
      if (flatDist < 28 && wSpec.effectiveRange > 100) {
        const rightX = Math.cos(bot.yaw);
        const rightZ = -Math.sin(bot.yaw);
        desiredDirX = rightX * bot.aiStrafeDir * 0.85;
        desiredDirZ = rightZ * bot.aiStrafeDir * 0.85;
      } else if (
        (bot.weapon === 'lm28_bastion' || bot.weapon === 'lm31_titan') &&
        flatDist < 75
      ) {
        desiredDirX *= 0.25;
        desiredDirZ *= 0.25;
      }

      if (!bot.reloading && bot.switchTimer <= 0) {
        const mag = this.getUnitMagAmmo(bot);
        if (mag <= 0) {
          if (
            bot.activeSlot === 'primary' &&
            bot.sidearmMagAmmo > 0 &&
            flatDist < 36
          ) {
            this.switchUnitWeaponSlot(bot, 'secondary');
          } else {
            this.startUnitReload(bot, false);
          }
        } else if (
          Math.abs(diff) < 0.26 &&
          bot.fireCooldown <= 0 &&
          bot.burstRemaining === 0 &&
          flatDist <= wSpec.maxRange * 0.92
        ) {
          this.initiateWeaponAction(bot);
        }
      }
    } else {
      if (bot.activeSlot === 'secondary' && bot.primaryMagAmmo > 0) {
        this.switchUnitWeaponSlot(bot, 'primary');
      } else if (
        !bot.reloading &&
        this.getUnitMagAmmo(bot) < WEAPONS[bot.weapon].magazineSize * 0.4 &&
        this.getUnitReserveAmmo(bot) > 0
      ) {
        this.startUnitReload(bot, false);
      }

      if (Math.hypot(desiredDirX, desiredDirZ) > 0.1) {
        const moveYaw = Math.atan2(-desiredDirX, -desiredDirZ);
        let diff = moveYaw - bot.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        bot.yaw += diff * Math.min(1, 6.0 * dt);
        bot.pitch = THREE.MathUtils.damp(bot.pitch, 0, 6, dt);
      }
    }

    bot.vx = THREE.MathUtils.damp(bot.vx, desiredDirX * botSpeed, 10, dt);
    bot.vz = THREE.MathUtils.damp(bot.vz, desiredDirZ * botSpeed, 10, dt);
  }

  private updateUnitKinematicsAndAnimation(unit: InternalCombatant, dt: number) {
    // Horizontal movement & AABB collision resolution (0.58m radius prevents wall clipping even when crouching)
    const nextX = unit.x + unit.vx * dt;
    const nextZ = unit.z + unit.vz * dt;
    const resolved = resolveArenaCollision(
      nextX,
      nextZ,
      0.58,
      this.structures
    );

    let finalX = resolved.x;
    let finalZ = resolved.z;

    for (const other of this.combatants) {
      if (other.id === unit.id || !other.alive) continue;
      const dx = finalX - other.x;
      const dz = finalZ - other.z;
      const dSq = dx * dx + dz * dz;
      const minSep = 0.95;
      if (dSq < minSep * minSep && dSq > 1e-5) {
        const d = Math.sqrt(dSq);
        const push = (minSep - d) * 0.5;
        finalX += (dx / d) * push;
        finalZ += (dz / d) * push;
      }
    }

    const postPush = resolveArenaCollision(
      finalX,
      finalZ,
      0.58,
      this.structures
    );

    // Smooth wall-sliding: remove velocity component pointing into the wall normal
    if (postPush.hitWall) {
      const intoWall =
        unit.vx * postPush.normalX + unit.vz * postPush.normalZ;
      if (intoWall < 0) {
        unit.vx -= intoWall * postPush.normalX;
        unit.vz -= intoWall * postPush.normalZ;
      }
    }

    // Slope & step-height validation so characters cannot scale vertical cliffs
    const targetGroundY = getTerrainHeight(postPush.x, postPush.z);
    const stepDeltaY = targetGroundY - unit.y;
    const targetSlope = getTerrainSlope(postPush.x, postPush.z);

    if (
      unit.grounded &&
      stepDeltaY > MAX_STEP_HEIGHT &&
      targetSlope > MAX_WALKABLE_SLOPE
    ) {
      unit.vx *= 0.25;
      unit.vz *= 0.25;
    } else {
      unit.x = postPush.x;
      unit.z = postPush.z;
    }

    // Push nearby dynamic barrels / small crates when moving into them
    for (const dp of this.dynamicProps) {
      const dx = dp.x - unit.x;
      const dz = dp.z - unit.z;
      const minR = 0.58 + dp.radius;
      const dSq = dx * dx + dz * dz;
      if (dSq < minR * minR && dSq > 1e-5 && Math.abs(unit.y - dp.y) < 1.5) {
        const d = Math.sqrt(dSq);
        const nx = dx / d;
        const nz = dz / d;
        const pushSpeed = Math.max(2.2, Math.hypot(unit.vx, unit.vz) * 0.85);
        dp.vx += nx * pushSpeed;
        dp.vz += nz * pushSpeed;
        dp.sleeping = false;
      }
    }

    const terrainY = getTerrainHeight(unit.x, unit.z);

    if (!unit.grounded) {
      unit.vy -= 24.5 * dt;
      unit.coyoteTimer = Math.max(0, unit.coyoteTimer - dt);
      unit.y += unit.vy * dt;
      if (unit.y <= terrainY) {
        if (unit.isPlayer && unit.vy < -3.5) {
          soundFX.playLand();
          this.fpRig.landDip = Math.min(0.055, Math.abs(unit.vy) * 0.0045);
        }
        unit.y = terrainY;
        unit.vy = 0;
        unit.grounded = true;
        if (unit.isPlayer && unit.jumpBufferTimer > 0) {
          unit.jumpBufferTimer = 0;
          unit.vy = 9.4;
          unit.grounded = false;
          soundFX.playJump();
        }
      }
    } else {
      unit.coyoteTimer = 0.14;
      unit.y = THREE.MathUtils.damp(unit.y, terrainY, 24, dt);
      if (Math.abs(unit.y - terrainY) < 0.015) {
        unit.y = terrainY;
      }
      unit.vy = 0;
    }

    unit.rig.root.position.set(unit.x, unit.y, unit.z);
    unit.rig.root.rotation.y = unit.yaw + Math.PI;

    // Player's 3rd-person body is ALWAYS hidden during first-person gameplay
    unit.rig.root.visible = unit.alive && !unit.isPlayer;

    const horizSpeed = Math.hypot(unit.vx, unit.vz);
    const crouchOffset = unit.crouching ? -0.32 : 0;

    if (horizSpeed > 0.4 && unit.grounded) {
      unit.walkCycle += horizSpeed * dt * 2.2;
      if (!unit.isPlayer) {
        const swing = Math.sin(unit.walkCycle) * (unit.crouching ? 0.35 : 0.55);
        unit.rig.leftLeg.rotation.x = swing;
        unit.rig.rightLeg.rotation.x = -swing;
        unit.rig.leftArm.rotation.x = -swing * 0.22;
        unit.rig.rightArm.rotation.x = swing * 0.22;
        unit.rig.bodyGroup.position.y =
          crouchOffset + Math.abs(Math.cos(unit.walkCycle)) * 0.045;
      } else {
        unit.footstepAccum += horizSpeed * dt;
        const stepThreshold = unit.sprinting ? 2.9 : 3.3;
        if (unit.footstepAccum >= stepThreshold) {
          unit.footstepAccum = 0;
          soundFX.playFootstep(
            unit.sprinting,
            getSurfaceTypeAt(unit.x, unit.z)
          );
        }
      }
    } else if (!unit.isPlayer) {
      unit.rig.leftLeg.rotation.x = THREE.MathUtils.damp(
        unit.rig.leftLeg.rotation.x,
        unit.crouching ? 0.45 : 0,
        12,
        dt
      );
      unit.rig.rightLeg.rotation.x = THREE.MathUtils.damp(
        unit.rig.rightLeg.rotation.x,
        unit.crouching ? -0.45 : 0,
        12,
        dt
      );
      unit.rig.bodyGroup.position.y = THREE.MathUtils.damp(
        unit.rig.bodyGroup.position.y,
        crouchOffset,
        12,
        dt
      );
    }

    if (!unit.isPlayer) {
      unit.rig.headGroup.rotation.x = -unit.pitch * 0.65;
      const reloadTilt = unit.reloading ? 0.45 : 0;
      unit.rig.weaponSocket.rotation.x = -unit.pitch * 0.85 + reloadTilt;
    }
  }

  private initiateWeaponAction(shooter: InternalCombatant) {
    const spec = WEAPONS[shooter.weapon];
    const cadenceMult = shooter.isPlayer
      ? 1.0
      : this.settings.botDifficulty === 'recruit'
      ? 1.65
      : this.settings.botDifficulty === 'veteran'
      ? 1.25
      : 1.0;

    shooter.fireCooldown = (1.0 / spec.fireRate) * cadenceMult;

    if (spec.fireMode === 'burst' && spec.burstCount) {
      this.executeWeaponShot(shooter);
      shooter.burstRemaining = spec.burstCount - 1;
      shooter.burstTimer = 0.068;
    } else {
      this.executeWeaponShot(shooter);
    }
  }

  private executeWeaponShot(shooter: InternalCombatant) {
    const spec = WEAPONS[shooter.weapon];
    const currentMag = this.getUnitMagAmmo(shooter);
    if (currentMag <= 0) return;

    this.setUnitMagAndReserve(
      shooter,
      currentMag - 1,
      this.getUnitReserveAmmo(shooter)
    );

    const player = this.combatants.find((c) => c.isPlayer);
    const distToPlayer = player
      ? Math.hypot(shooter.x - player.x, shooter.z - player.z)
      : 0;
    if (distToPlayer < 160) {
      soundFX.playGunshot(shooter.weapon, distToPlayer / 160);
    }

    const horizSpeed = Math.hypot(shooter.vx, shooter.vz);
    const moveFactor = horizSpeed > 1.2 ? spec.moveSpreadMult : 1.0;
    const aimFactor = shooter.aiming ? spec.aimSpreadMult : 1.0;
    const crouchFactor = shooter.crouching ? 0.72 : 1.0;
    const botSpreadMult = shooter.isPlayer
      ? 1.0
      : this.settings.botDifficulty === 'recruit'
      ? 2.7
      : this.settings.botDifficulty === 'veteran'
      ? 1.65
      : 1.12;

    const effectiveSpread =
      spec.baseSpread * moveFactor * aimFactor * crouchFactor * botSpreadMult;

    const pellets =
      spec.fireMode === 'spread' && spec.pelletCount ? spec.pelletCount : 1;

    if (shooter.isPlayer) {
      this.recoilPitch = Math.min(0.14, this.recoilPitch + spec.recoilKick);
      this.cameraShake = Math.min(
        0.16,
        this.cameraShake + spec.recoilKick * 1.15
      );
      triggerFirstPersonFireImpulse(
        this.fpRig,
        spec.recoilKick,
        shooter.aiming
      );
    }

    const eyeHeight = shooter.isPlayer
      ? this.smoothedEyeHeight
      : shooter.crouching
      ? 1.14
      : 1.54;
    const originX = shooter.x;
    const originY = shooter.y + eyeHeight;
    const originZ = shooter.z;

    if (shooter.isPlayer && this.fpRig.weaponData) {
      this.camera.updateMatrixWorld(true);
      this.fpRig.weaponData.muzzlePoint.getWorldPosition(_vec3A);
    } else {
      shooter.rig.muzzlePoint.getWorldPosition(_vec3A);
    }

    for (let p = 0; p < pellets; p++) {
      const yawAngle =
        shooter.yaw + (Math.random() - 0.5) * effectiveSpread * 2;
      const pitchAngle =
        shooter.pitch +
        (shooter.isPlayer ? this.recoilPitch : 0) +
        (Math.random() - 0.5) * effectiveSpread * 2;

      const cosP = Math.cos(pitchAngle);
      const dirX = -Math.sin(yawAngle) * cosP;
      const dirY = Math.sin(pitchAngle);
      const dirZ = -Math.cos(yawAngle) * cosP;

      const maxRange = spec.maxRange;
      const endX = originX + dirX * maxRange;
      const endY = originY + dirY * maxRange;
      const endZ = originZ + dirZ * maxRange;

      const wallHit = raycastStructures(
        originX,
        originY,
        originZ,
        endX,
        endY,
        endZ,
        this.structures
      );
      let bestDist = wallHit.hit ? wallHit.fraction * maxRange : maxRange;
      let hitPointX = wallHit.hitX;
      let hitPointY = wallHit.hitY;
      let hitPointZ = wallHit.hitZ;
      let hitStructId = wallHit.hitStructureId;

      if (dirY < -0.01) {
        const approxGroundY = getTerrainHeight(originX, originZ);
        const floorT = (approxGroundY - originY) / dirY;
        if (floorT > 0 && floorT < bestDist) {
          bestDist = floorT;
          hitPointX = originX + dirX * floorT;
          hitPointY =
            getTerrainHeight(hitPointX, originZ + dirZ * floorT) + 0.04;
          hitPointZ = originZ + dirZ * floorT;
          hitStructId = null;
        }
      }

      let hitVictim: InternalCombatant | null = null;
      let isHeadshot = false;

      for (const target of this.combatants) {
        if (
          !target.alive ||
          target.team === shooter.team ||
          target.id === shooter.id
        ) {
          continue;
        }

        const toTargetX = target.x - originX;
        const toTargetZ = target.z - originZ;
        const proj = toTargetX * dirX + toTargetZ * dirZ;
        if (proj < 0 || proj > bestDist) continue;

        const closestX = originX + dirX * proj;
        const closestY = originY + dirY * proj;
        const closestZ = originZ + dirZ * proj;

        const radialDistSq =
          (closestX - target.x) * (closestX - target.x) +
          (closestZ - target.z) * (closestZ - target.z);

        const targetHeight = target.crouching ? 1.52 : 1.92;
        const hitRadius = 0.5;
        if (
          radialDistSq <= hitRadius * hitRadius &&
          closestY >= target.y &&
          closestY <= target.y + targetHeight
        ) {
          bestDist = proj;
          hitVictim = target;
          hitPointX = closestX;
          hitPointY = closestY;
          hitPointZ = closestZ;
          isHeadshot = closestY >= target.y + targetHeight - 0.44;
          hitStructId = null;
        }
      }

      this.spawnTracer(
        _vec3A.x,
        _vec3A.y,
        _vec3A.z,
        hitPointX,
        hitPointY,
        hitPointZ,
        shooter.team === 'blue' ? 0x38bdf8 : 0xf87171
      );
      this.spawnImpactParticles(
        hitPointX,
        hitPointY,
        hitPointZ,
        hitVictim
          ? hitVictim.team === 'blue'
            ? 0x38bdf8
            : 0xf87171
          : 0xfbbf24
      );

      if (hitVictim) {
        let distFactor = 1.0;
        if (bestDist > spec.effectiveRange) {
          const t = Math.min(
            1,
            (bestDist - spec.effectiveRange) /
              Math.max(1, spec.maxRange - spec.effectiveRange)
          );
          distFactor = 1.0 - t * (1.0 - spec.falloffMinMultiplier);
        }
        const dmg = Math.max(
          4,
          Math.round(
            spec.damage *
              distFactor *
              (isHeadshot ? spec.headshotMultiplier : 1.0)
          )
        );
        this.applyDamage(hitVictim, shooter, dmg, isHeadshot);
      } else if (hitStructId) {
        this.damageDestructibleStructure(hitStructId, spec.damage);
      }

      this.impulseDynamicPropsNear(hitPointX, hitPointY, hitPointZ, dirX, dirZ);
    }

    if (shooter.isPlayer) {
      this.emitHudSnapshot();
    }
  }

  private damageDestructibleStructure(structId: string, damage: number) {
    const s = this.structures.find((item) => item.id === structId);
    if (!s || !s.destructible || s.destroyed) return;

    s.hp = (s.hp ?? 80) - damage;
    if (s.hp <= 0) {
      s.destroyed = true;
      const grp = this.structureMeshes.get(s.id);
      if (grp) grp.visible = false;
      soundFX.playPropBreak();
      this.spawnImpactParticles(
        s.x,
        getTerrainHeight(s.x, s.z) + 1.0,
        s.z,
        0xd97706
      );
    }
  }

  private applyDamage(
    victim: InternalCombatant,
    attacker: InternalCombatant,
    damage: number,
    headshot: boolean
  ) {
    victim.hp = Math.max(0, victim.hp - damage);
    victim.outOfCombatTimer = 0;

    victim.hitFlashTimer = 0.09;
    victim.rig.teamMaterial.color.setHex(0xffffff);
    victim.rig.teamMaterial.emissive.setHex(0xf59e0b);

    if (attacker.isPlayer) {
      this.hitMarkerTimer = 0.18;
      this.hitMarkerHeadshot = headshot;
      soundFX.playHitMarker(headshot);
    }

    if (victim.isPlayer) {
      this.damageFlashTimer = 0.24;
      this.cameraShake = Math.min(0.22, this.cameraShake + 0.09);
    }

    if (victim.hp <= 0 && victim.alive) {
      victim.alive = false;
      victim.respawnTimer = 4.0;
      victim.deaths += 1;
      victim.reloading = false;
      victim.reloadTimer = 0;
      victim.reloadMidSoundPlayed = false;
      victim.burstRemaining = 0;
      victim.aiming = false;
      victim.sprinting = false;
      victim.rig.root.visible = false;

      attacker.kills += 1;
      attacker.score += 100 + (headshot ? 50 : 0);

      if (attacker.team === 'blue') {
        this.blueScore = Math.min(this.maxScore, this.blueScore + 3);
      } else {
        this.redScore = Math.min(this.maxScore, this.redScore + 3);
      }

      this.killFeed.unshift({
        id: `${Date.now()}_${Math.random()}`,
        killerName: attacker.name,
        killerTeam: attacker.team,
        victimName: victim.name,
        victimTeam: victim.team,
        weaponName: WEAPONS[attacker.weapon].name,
        headshot,
        timestamp: performance.now(),
      });
      if (this.killFeed.length > 5) {
        this.killFeed.pop();
      }

      if (
        this.gameMode === 'domination' &&
        (this.blueScore >= this.maxScore || this.redScore >= this.maxScore)
      ) {
        this.finishMatch();
      }
    }
  }

  private respawnCombatant(unit: InternalCombatant) {
    const spawns = unit.team === 'blue' ? BLUE_SPAWN_POINTS : RED_SPAWN_POINTS;
    const sp = spawns[Math.floor(Math.random() * spawns.length)];
    const safePos = resolveArenaCollision(
      sp.x + (Math.random() - 0.5) * 3.0,
      sp.z + (Math.random() - 0.5) * 3.0,
      0.65,
      this.structures
    );
    const groundY = getTerrainHeight(safePos.x, safePos.z);

    unit.x = safePos.x;
    unit.y = groundY;
    unit.z = safePos.z;
    unit.vx = 0;
    unit.vy = 0;
    unit.vz = 0;
    unit.grounded = true;
    unit.crouching = false;
    unit.aiming = false;
    unit.sprinting = false;
    unit.coyoteTimer = 0.14;
    unit.yaw = unit.team === 'blue' ? -Math.PI * 0.35 : Math.PI * 0.65;
    unit.pitch = 0;
    unit.maxHp = SOLDIER_CLASSES[unit.soldierClass].maxHp;
    unit.hp = unit.maxHp;
    unit.alive = true;
    unit.activeSlot = 'primary';
    unit.weapon = unit.primaryWeapon;
    unit.reloading = false;
    unit.reloadTimer = 0;
    unit.reloadMidSoundPlayed = false;
    unit.burstRemaining = 0;
    unit.primaryMagAmmo = WEAPONS[unit.primaryWeapon].magazineSize;
    unit.primaryReserveAmmo = WEAPONS[unit.primaryWeapon].reserveAmmo;
    unit.sidearmMagAmmo = WEAPONS[unit.sidearmWeapon].magazineSize;
    unit.sidearmReserveAmmo = WEAPONS[unit.sidearmWeapon].reserveAmmo;
    unit.stamina = 100;
    equipWeaponOnRig(unit.rig, unit.weapon, this.settings.weaponFinish);
    if (unit.isPlayer) {
      equipFirstPersonWeapon(
        this.fpRig,
        unit.weapon,
        unit.soldierClass,
        this.settings.weaponFinish
      );
    }
    unit.rig.teamMaterial.color.copy(unit.rig.baseTeamColor);
    unit.rig.teamMaterial.emissive.setHex(0x000000);
    unit.rig.root.position.set(unit.x, unit.y, unit.z);
    unit.rig.root.visible = !unit.isPlayer;
  }

  private updateObjectivesAndScoring(dt: number) {
    for (const obj of this.objectives) {
      let blueCount = 0;
      let redCount = 0;

      for (const unit of this.combatants) {
        if (!unit.alive) continue;
        const dSq =
          (unit.x - obj.x) * (unit.x - obj.x) +
          (unit.z - obj.z) * (unit.z - obj.z);
        if (dSq <= obj.radius * obj.radius) {
          if (unit.team === 'blue') blueCount++;
          else redCount++;
        }
      }

      obj.blueCount = blueCount;
      obj.redCount = redCount;
      obj.contested = blueCount > 0 && redCount > 0;

      const prevOwner = obj.owner;

      if (!obj.contested) {
        if (blueCount > 0) {
          const rate = 20 * Math.min(3, blueCount);
          obj.progress = Math.min(100, obj.progress + rate * dt);
          if (obj.progress >= 65) {
            obj.owner = 'blue';
          } else if (obj.progress > -20 && obj.owner === 'red') {
            obj.owner = 'neutral';
          }
        } else if (redCount > 0) {
          const rate = 20 * Math.min(3, redCount);
          obj.progress = Math.max(-100, obj.progress - rate * dt);
          if (obj.progress <= -65) {
            obj.owner = 'red';
          } else if (obj.progress < 20 && obj.owner === 'blue') {
            obj.owner = 'neutral';
          }
        }
      }

      if (obj.owner !== prevOwner && obj.owner !== 'neutral') {
        soundFX.playObjectiveCapture(obj.owner === 'blue');
        for (const unit of this.combatants) {
          if (!unit.alive || unit.team !== obj.owner) continue;
          const dSq =
            (unit.x - obj.x) * (unit.x - obj.x) +
            (unit.z - obj.z) * (unit.z - obj.z);
          if (dSq <= obj.radius * obj.radius) {
            unit.captures += 1;
            unit.score += 150;
          }
        }
      }

      const rig = this.objectiveRigs.get(obj.id);
      if (rig) {
        rig.coreMesh.rotation.y += dt * (obj.contested ? 4.2 : 1.6);
        rig.flagMesh.rotation.y =
          Math.sin(performance.now() * 0.004 + obj.x) * 0.22;
        rig.flagMesh.position.y = 4.2 + (Math.abs(obj.progress) / 100) * 3.5;

        const colorHex = obj.contested
          ? 0xf59e0b
          : obj.owner === 'blue'
          ? 0x38bdf8
          : obj.owner === 'red'
          ? 0xef4444
          : 0x94a3b8;

        rig.ringMat.color.setHex(colorHex);
        rig.ringMat.emissive.setHex(colorHex);
        rig.coreMat.color.setHex(colorHex);
        rig.coreMat.emissive.setHex(colorHex);
        rig.beamMat.color.setHex(colorHex);
      }
    }

    if (this.gameMode === 'domination') {
      this.scoreTickAccumulator += dt;
      if (this.scoreTickAccumulator >= 1.0) {
        this.scoreTickAccumulator -= 1.0;
        let blueHeld = 0;
        let redHeld = 0;
        for (const obj of this.objectives) {
          if (obj.owner === 'blue') blueHeld++;
          else if (obj.owner === 'red') redHeld++;
        }
        this.blueScore = Math.min(this.maxScore, this.blueScore + blueHeld);
        this.redScore = Math.min(this.maxScore, this.redScore + redHeld);

        if (this.blueScore >= this.maxScore || this.redScore >= this.maxScore) {
          this.finishMatch();
        }
      }
    }
  }

  public finishMatch() {
    this.setScreen('results');
    soundFX.playMatchEnd(this.blueScore >= this.redScore);
    this.onScreenRequest('results');
  }

  private spawnTracer(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    colorHex: number
  ) {
    if (this.tracers.length > 36) return;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(ax, ay, az),
      new THREE.Vector3(bx, by, bz),
    ]);
    const mat = new THREE.LineBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.9,
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, mat, life: 0.08, maxLife: 0.08 });
  }

  private spawnImpactParticles(
    x: number,
    y: number,
    z: number,
    colorHex: number
  ) {
    const maxParticles =
      this.settings.graphicsQuality === 'low'
        ? 16
        : this.settings.graphicsQuality === 'medium'
        ? 36
        : 64;
    if (this.impacts.length >= maxParticles) return;

    const count = this.settings.graphicsQuality === 'low' ? 2 : 4;
    for (let i = 0; i < count; i++) {
      const mat = this.impactMat.clone();
      mat.color.setHex(colorHex);
      const mesh = new THREE.Mesh(this.impactGeo, mat);
      mesh.position.set(x, y, z);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 4.5 + 1,
        (Math.random() - 0.5) * 6
      );
      this.scene.add(mesh);
      this.impacts.push({ mesh, vel, life: 0.22 });
    }
  }

  private updateEffects(dt: number) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.mat.dispose();
        this.tracers.splice(i, 1);
      } else {
        t.mat.opacity = (t.life / t.maxLife) * 0.9;
      }
    }

    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const imp = this.impacts[i];
      imp.life -= dt;
      if (imp.life <= 0) {
        this.scene.remove(imp.mesh);
        (imp.mesh.material as THREE.Material).dispose();
        this.impacts.splice(i, 1);
      } else {
        imp.vel.y -= 15 * dt;
        imp.mesh.position.addScaledVector(imp.vel, dt);
        imp.mesh.scale.setScalar(Math.max(0.1, imp.life * 4.5));
      }
    }
  }

  private updateCameraAndFirstPersonRig(dt: number) {
    if (this.screen === 'menu' || this.screen === 'loadout') {
      this.fpRig.root.visible = false;
      const radius = 92;
      const camX = Math.sin(this.menuOrbitAngle) * radius;
      const camZ = Math.cos(this.menuOrbitAngle) * radius;
      this.camera.position.set(camX, 32, camZ);
      this.camera.lookAt(0, 2, 0);
      return;
    }

    const player = this.combatants.find((c) => c.isPlayer);
    if (!player) return;

    // Smooth ADS / Sprint FOV transition
    const spec = WEAPONS[player.weapon];
    const targetFov =
      player.aiming && !player.reloading && player.switchTimer <= 0
        ? Math.max(30, this.settings.fov + spec.aimZoomFovOffset)
        : player.sprinting
        ? Math.min(100, this.settings.fov + 4)
        : this.settings.fov;

    if (Math.abs(this.camera.fov - targetFov) > 0.08) {
      this.camera.fov = THREE.MathUtils.damp(
        this.camera.fov,
        targetFov,
        14,
        dt
      );
      this.camera.updateProjectionMatrix();
    }

    // Smooth eye height between standing (1.62m) and crouching (1.14m)
    const targetEye = player.crouching ? 1.14 : 1.62;
    this.smoothedEyeHeight = THREE.MathUtils.damp(
      this.smoothedEyeHeight,
      targetEye,
      14,
      dt
    );

    const pitch = player.pitch + this.recoilPitch;
    const yaw = player.yaw;

    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);

    const fwdX = -sinY * cosP;
    const fwdY = sinP;
    const fwdZ = -cosY * cosP;

    // Restrained camera head-bob and subtle recoil shake
    const horizSpeed = Math.hypot(player.vx, player.vz);
    const camBobY =
      player.grounded && horizSpeed > 0.5 && !player.aiming
        ? Math.sin(player.walkCycle * 2) * (player.sprinting ? 0.028 : 0.014)
        : 0;

    const shakeX = (Math.random() - 0.5) * this.cameraShake * 0.16;
    const shakeY = (Math.random() - 0.5) * this.cameraShake * 0.16;

    // Authoritative First-Person Eye Position
    this.camera.position.set(
      player.x + shakeX,
      player.y + this.smoothedEyeHeight + camBobY + shakeY,
      player.z
    );
    this.camera.lookAt(
      player.x + fwdX * 40,
      player.y + this.smoothedEyeHeight + camBobY + fwdY * 40,
      player.z + fwdZ * 40
    );

    // Update First-Person Arms & Weapon Rig
    const reloadProgress = player.reloading
      ? 1 - player.reloadTimer / spec.reloadTime
      : 0;

    updateFirstPersonRigAnimation(this.fpRig, {
      dt,
      alive: player.alive && this.screen === 'playing',
      horizSpeed,
      vy: player.vy,
      grounded: player.grounded,
      crouching: player.crouching,
      sprinting: player.sprinting,
      aiming: player.aiming,
      reloading: player.reloading,
      reloadProgress,
      switchTimer: player.switchTimer,
      switchDuration: player.switchDuration,
      lookDeltaX: this.frameLookDeltaX,
      lookDeltaY: this.frameLookDeltaY,
      emptyClickTimer: this.emptyClickTimer,
    });

    this.frameLookDeltaX = 0;
    this.frameLookDeltaY = 0;
  }

  private impulseDynamicPropsNear(
    hx: number,
    hy: number,
    hz: number,
    dirX: number,
    dirZ: number
  ) {
    for (const dp of this.dynamicProps) {
      const dx = dp.x - hx;
      const dz = dp.z - hz;
      if (dx * dx + dz * dz <= 1.2 * 1.2 && Math.abs(hy - dp.y) <= 1.5) {
        dp.vx += dirX * 4.5;
        dp.vz += dirZ * 4.5;
        dp.vy = Math.max(dp.vy, 1.8);
        dp.sleeping = false;
      }
    }
  }

  private updateDynamicProps(dt: number) {
    for (const dp of this.dynamicProps) {
      if (dp.sleeping) continue;

      dp.vy -= 22.0 * dt;
      const nextX = dp.x + dp.vx * dt;
      const nextZ = dp.z + dp.vz * dt;
      const col = resolveArenaCollision(
        nextX,
        nextZ,
        dp.radius,
        this.structures
      );
      dp.x = col.x;
      dp.z = col.z;
      if (col.hitWall) {
        dp.vx *= -0.35;
        dp.vz *= -0.35;
      }

      const groundY = getTerrainHeight(dp.x, dp.z);
      dp.y += dp.vy * dt;
      if (dp.y <= groundY) {
        dp.y = groundY;
        dp.vy = 0;
      }

      dp.vx = THREE.MathUtils.damp(dp.vx, 0, 5.5, dt);
      dp.vz = THREE.MathUtils.damp(dp.vz, 0, 5.5, dt);

      const speed = Math.hypot(dp.vx, dp.vz);
      dp.rotZ = THREE.MathUtils.damp(dp.rotZ, -dp.vx * 0.04, 10, dt);
      dp.rotX = THREE.MathUtils.damp(dp.rotX, dp.vz * 0.04, 10, dt);

      const grp = this.dynamicPropMeshes.get(dp.id);
      if (grp) {
        grp.position.set(dp.x, dp.y, dp.z);
        grp.rotation.set(dp.rotX, dp.rotY, dp.rotZ);
      }

      if (speed < 0.06 && Math.abs(dp.vy) < 0.05 && dp.y <= groundY + 0.02) {
        dp.vx = 0;
        dp.vy = 0;
        dp.vz = 0;
        dp.rotX = 0;
        dp.rotZ = 0;
        dp.sleeping = true;
      }
    }
  }

  private getPlayerMovementState(player: InternalCombatant): PlayerMovementState {
    if (!player.grounded) return 'airborne';
    if (player.crouching) return 'crouch';
    if (player.sprinting) return 'sprint';
    const spd = Math.hypot(player.vx, player.vz);
    if (spd > 4.6) return 'run';
    if (spd > 0.4) return 'walk';
    return 'idle';
  }

  private getPlayerReloadStage(player: InternalCombatant): ReloadStageId {
    if (!player.reloading) return 'ready';
    const spec = WEAPONS[player.weapon];
    const p = 1 - player.reloadTimer / spec.reloadTime;
    if (p < 0.16) return 'starting';
    if (p < 0.44) return 'handling_ammo';
    if (p < 0.7) return 'inserting_ammo';
    if (p < 0.88) return 'chambering';
    return 'returning';
  }

  private getPlayerAnimationState(player: InternalCombatant): FirstPersonAnimState {
    if (player.switchTimer > 0) return 'weapon_switch';
    if (player.reloading) return 'reload';
    if (this.emptyClickTimer > 0) return 'empty';
    if (this.fpRig.muzzleFlashTimer > 0 || this.fpRig.recoilZ > 0.012) {
      return 'fire';
    }
    if (!player.grounded) return 'jump';
    if (this.fpRig.landDip > 0.01) return 'land';
    if (player.aiming) return 'aim';
    if (player.sprinting) return 'sprint';
    if (player.crouching) return 'crouch';
    const spd = Math.hypot(player.vx, player.vz);
    if (spd > 4.6) return 'run';
    if (spd > 0.4) return 'walk';
    return 'idle';
  }

  public getStructuresSnapshot(): StructureCollider[] {
    return this.structures;
  }

  private emitHudSnapshot() {
    const player =
      this.combatants.find((c) => c.isPlayer) || this.combatants[0];
    if (!player) return;

    const activeSpec = WEAPONS[player.weapon];
    const primarySpec = WEAPONS[player.primaryWeapon];
    const sidearmSpec = WEAPONS[player.sidearmWeapon];
    const classSpec = SOLDIER_CLASSES[player.soldierClass];

    let activeObjId: 'A' | 'B' | 'C' | null = null;
    for (const obj of this.objectives) {
      const dSq =
        (player.x - obj.x) * (player.x - obj.x) +
        (player.z - obj.z) * (player.z - obj.z);
      if (dSq <= obj.radius * obj.radius) {
        activeObjId = obj.id;
        break;
      }
    }

    const regionInfo = getRegionAt(player.x, player.z);
    const canInteract = this.canPlayerInteract(player);

    let nearestBot: InternalCombatant | null = null;
    let nearestBotDist = Infinity;
    for (const c of this.combatants) {
      if (c.isPlayer || !c.alive) continue;
      const d = Math.hypot(c.x - player.x, c.z - player.z);
      if (d < nearestBotDist) {
        nearestBotDist = d;
        nearestBot = c;
      }
    }

    const activeProps = this.structures.filter(
      (s) => s.destructible && !s.destroyed
    ).length;
    const activeColliders = this.structures.filter((s) => !s.destroyed).length;
    const movState = this.getPlayerMovementState(player);
    const animState = this.getPlayerAnimationState(player);
    const relStage = this.getPlayerReloadStage(player);
    const currentMag = this.getUnitMagAmmo(player);
    const currentRes = this.getUnitReserveAmmo(player);

    this.onHudUpdate({
      playerHp: Math.ceil(player.hp),
      playerMaxHp: player.maxHp,
      playerAlive: player.alive,
      playerCrouching: player.crouching,
      playerAiming: player.aiming,
      playerSprinting: player.sprinting,
      playerMovementState: movState,
      playerAnimationState: animState,
      reloadStage: relStage,
      soldierClass: classSpec,
      abilityCooldownRemaining: Math.ceil(player.abilityCooldownTimer),
      abilityActiveTimer: player.abilityActiveTimer,
      respawnTimer: Math.max(0, player.respawnTimer),
      activeSlot: player.activeSlot,
      weapon: activeSpec,
      primaryWeapon: primarySpec,
      sidearmWeapon: sidearmSpec,
      ammo: currentMag,
      maxAmmo: activeSpec.magazineSize,
      reserveAmmo: currentRes,
      primaryMagAmmo: player.primaryMagAmmo,
      primaryReserveAmmo: player.primaryReserveAmmo,
      sidearmMagAmmo: player.sidearmMagAmmo,
      sidearmReserveAmmo: player.sidearmReserveAmmo,
      reloading: player.reloading,
      reloadProgress: player.reloading
        ? 1 - player.reloadTimer / activeSpec.reloadTime
        : 1,
      stamina: Math.round(player.stamina),
      blueScore: this.blueScore,
      redScore: this.redScore,
      maxScore: this.maxScore,
      timeRemaining: Math.ceil(this.timeRemaining),
      matchElapsed: Math.floor(this.matchElapsed),
      gameMode: this.gameMode,
      objectives: this.objectives.map((o) => ({ ...o })),
      activeObjectiveId: activeObjId,
      nearbyInteractionPromptUz:
        canInteract && activeObjId
          ? `[E] NUQTA-${activeObjId} TA’MINOT QUTISI (O‘Q-DORI +25 HP)`
          : null,
      currentRegionUz: regionInfo.nameUz,
      reconScanActive: this.reconScanTimer > 0,
      combatants: this.combatants.map((c) => ({
        id: c.id,
        name: c.name,
        team: c.team,
        isPlayer: c.isPlayer,
        soldierClass: c.soldierClass,
        primaryWeapon: c.primaryWeapon,
        sidearmWeapon: c.sidearmWeapon,
        activeSlot: c.activeSlot,
        weapon: c.weapon,
        hp: Math.ceil(c.hp),
        maxHp: c.maxHp,
        alive: c.alive,
        crouching: c.crouching,
        aiming: c.aiming,
        sprinting: c.sprinting,
        respawnTimer: c.respawnTimer,
        x: c.x,
        y: c.y,
        z: c.z,
        yaw: c.yaw,
        kills: c.kills,
        deaths: c.deaths,
        captures: c.captures,
        score: c.score,
        aiStateLabel: c.aiStateLabel,
      })),
      killFeed: [...this.killFeed],
      hitMarkerTimer: this.hitMarkerTimer,
      hitMarkerHeadshot: this.hitMarkerHeadshot,
      damageFlashTimer: this.damageFlashTimer,
      emptyClickTimer: this.emptyClickTimer,
      fps: this.currentFps,
      pointerLocked: this.pointerLocked,
      diagnostics: {
        fps: this.currentFps,
        frameTimeMs: Number(this.lastFrameTimeMs.toFixed(1)),
        playerX: Number(player.x.toFixed(1)),
        playerY: Number(player.y.toFixed(2)),
        playerZ: Number(player.z.toFixed(1)),
        velocityX: Number(player.vx.toFixed(1)),
        velocityY: Number(player.vy.toFixed(1)),
        velocityZ: Number(player.vz.toFixed(1)),
        speed: Number(Math.hypot(player.vx, player.vz).toFixed(1)),
        grounded: player.grounded,
        crouching: player.crouching,
        sprinting: player.sprinting,
        movementState: movState,
        animationState: animState,
        reloadStage: relStage,
        currentWeaponId: player.weapon,
        activeSlot: player.activeSlot,
        ammoSummary: `${currentMag}/${currentRes} (${player.reloading ? relStage.toUpperCase() : 'READY'})`,
        surfaceType: getSurfaceTypeAt(player.x, player.z),
        terrainHeight: Number(getTerrainHeight(player.x, player.z).toFixed(2)),
        terrainSlope: Number(getTerrainSlope(player.x, player.z).toFixed(2)),
        overheadClearance: hasOverheadClearance(
          player.x,
          player.y,
          player.z,
          this.structures
        ),
        currentRegionUz: regionInfo.nameUz,
        activeBotCount: this.combatants.filter((c) => !c.isPlayer && c.alive)
          .length,
        activeTracerCount: this.tracers.length,
        activeParticleCount: this.impacts.length,
        activePropCount: activeProps,
        dynamicObjectCount: this.dynamicProps.length,
        collisionObjectCount: activeColliders,
        graphicsQuality: this.settings.graphicsQuality,
        matchState: this.screen.toUpperCase(),
        nearestBotInfo: nearestBot
          ? `${nearestBot.name} (${nearestBotDist.toFixed(0)}m · ${nearestBot.aiStateLabel} · ${WEAPONS[nearestBot.weapon].name})`
          : 'Yo‘q',
        assetPipelineMode: assetLoader.getPipelineModeSummary(),
        assetLoadErrors: assetLoader.getLoadErrors(),
      },
    });
  }
}
