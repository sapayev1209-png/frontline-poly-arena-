import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  Compass,
  Crosshair,
  Info,
  Keyboard,
  Map as MapIcon,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Shield,
  Sliders,
  Smartphone,
  Swords,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { ArenaEngine } from './game/ArenaEngine';
import { Minimap } from './components/Minimap';
import { WeaponPreviewCanvas } from './components/WeaponPreviewCanvas';
import { ARENA_STRUCTURES } from './game/mapData';
import {
  BotDifficulty,
  GameMode,
  GameScreen,
  GameSettings,
  GraphicsQuality,
  HudSnapshot,
  PRIMARY_WEAPON_LIST,
  PrimaryWeaponId,
  SIDEARM_WEAPON_LIST,
  SOLDIER_CLASSES,
  SidearmWeaponId,
  SoldierClassId,
  WEAPON_FINISHES,
  WEAPONS,
  WeaponFinishId,
  WeaponId,
} from './types/game';
import { soundFX } from './utils/sound';

const SETTINGS_STORAGE_KEY = 'frontline_polygon_arena_settings_v3';

const DEFAULT_SETTINGS: GameSettings = {
  sensitivity: 1.0,
  invertY: false,
  cameraPerspective: 'first',
  fov: 75,
  graphicsQuality: 'medium',
  shadows: true,
  botDifficulty: 'veteran',
  teamSize: 5,
  soundEnabled: true,
  masterVolume: 0.75,
  sfxVolume: 0.85,
  touchControlsOrder: 'auto',
  weaponFinish: 'default',
};

function loadSavedSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      return {
        ...DEFAULT_SETTINGS,
        ...JSON.parse(raw),
        cameraPerspective: 'first',
      };
    }
  } catch {
    // Ignore storage restriction
  }
  return DEFAULT_SETTINGS;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

type LoadoutTab = 'primary' | 'sidearm' | 'class' | 'controls';
type InfoModalType = 'none' | 'map' | 'controls' | 'about';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ArenaEngine | null>(null);

  const [screen, setScreen] = useState<GameScreen>('menu');
  const [loadoutTab, setLoadoutTab] = useState<LoadoutTab>('primary');
  const [selectedPrimary, setSelectedPrimary] =
    useState<PrimaryWeaponId>('ar42_vanguard');
  const [selectedSidearm, setSelectedSidearm] =
    useState<SidearmWeaponId>('p6_courier');
  const [selectedClass, setSelectedClass] = useState<SoldierClassId>('assault');
  const [gameMode, setGameMode] = useState<GameMode>('domination');

  const [settings, setSettings] = useState<GameSettings>(loadSavedSettings);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [infoModal, setInfoModal] = useState<InfoModalType>('none');
  const [mapExpanded, setMapExpanded] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [portraitDismissed, setPortraitDismissed] = useState(false);

  // Independent multi-touch tracking identifiers for Android landscape controls
  const joystickTouchId = useRef<number | null>(null);
  const joystickOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [joystickKnob, setJoystickKnob] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const lookTouchId = useRef<number | null>(null);
  const lookLastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const fireTouchId = useRef<number | null>(null);
  const fireLastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const resetTouchTrackers = () => {
    joystickTouchId.current = null;
    lookTouchId.current = null;
    fireTouchId.current = null;
    setJoystickKnob({ x: 0, y: 0 });
    engineRef.current?.setTouchMovement(0, 0);
    engineRef.current?.setTouchFiring(false);
  };

  useEffect(() => {
    const checkViewport = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const hasTouch =
        'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobileViewport(w < 960 || hasTouch);
      setIsPortraitMobile(h > w && w < 768);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    window.addEventListener('blur', resetTouchTrackers);
    return () => {
      window.removeEventListener('resize', checkViewport);
      window.removeEventListener('blur', resetTouchTrackers);
    };
  }, []);

  useEffect(() => {
    if (!canvasMountRef.current) return;
    const initial = loadSavedSettings();
    const engine = new ArenaEngine(
      canvasMountRef.current,
      initial,
      (snapshot) => setHud(snapshot),
      (nextScreen) => {
        setScreen(nextScreen);
        if (nextScreen !== 'playing') {
          resetTouchTrackers();
          setSettingsModalOpen(false);
          setMapExpanded(false);
        }
      },
      () => setMapExpanded((prev) => !prev),
      () => setShowDiagnostics((prev) => !prev)
    );
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const updateGameSettings = (patch: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next: GameSettings = {
        ...prev,
        ...patch,
        cameraPerspective: 'first',
      };
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage error
      }
      engineRef.current?.updateSettings(next);
      return next;
    });
  };

  const handleDeployMatch = () => {
    soundFX.playUiClick();
    soundFX.setConfig(
      settings.soundEnabled,
      settings.masterVolume,
      settings.sfxVolume
    );
    resetTouchTrackers();
    setSettingsModalOpen(false);
    setInfoModal('none');
    setMapExpanded(false);
    setScreen('playing');
    engineRef.current?.startNewMatch({
      primaryWeapon: selectedPrimary,
      sidearmWeapon: selectedSidearm,
      soldierClass: selectedClass,
      gameMode,
    });
  };

  const handleOpenLoadout = (tab: LoadoutTab) => {
    soundFX.playUiClick();
    resetTouchTrackers();
    setLoadoutTab(tab);
    setScreen('loadout');
    engineRef.current?.setScreen('loadout');
  };

  const handleResumeMatch = () => {
    soundFX.playUiClick();
    setSettingsModalOpen(false);
    setScreen('playing');
    engineRef.current?.setScreen('playing');
    engineRef.current?.requestPointerLockSafe();
  };

  const handlePauseMatch = () => {
    soundFX.playUiClick();
    resetTouchTrackers();
    setScreen('paused');
    engineRef.current?.setScreen('paused');
  };

  const handleRestartMatch = () => {
    soundFX.playUiClick();
    resetTouchTrackers();
    setSettingsModalOpen(false);
    setMapExpanded(false);
    setScreen('playing');
    engineRef.current?.startNewMatch({
      primaryWeapon: selectedPrimary,
      sidearmWeapon: selectedSidearm,
      soldierClass: selectedClass,
      gameMode,
    });
  };

  const handleReturnToMenu = () => {
    soundFX.playUiClick();
    resetTouchTrackers();
    setSettingsModalOpen(false);
    setMapExpanded(false);
    setScreen('menu');
    engineRef.current?.setScreen('menu');
  };

  const handleToggleSound = () => {
    updateGameSettings({ soundEnabled: !settings.soundEnabled });
  };

  const showTouchControls =
    screen === 'playing' &&
    (settings.touchControlsOrder === 'always' ||
      (settings.touchControlsOrder === 'auto' && isMobileViewport));

  const activeObjective = hud?.objectives.find(
    (o) => o.id === hud.activeObjectiveId
  );

  const inspectedWeaponId: WeaponId =
    loadoutTab === 'sidearm' ? selectedSidearm : selectedPrimary;
  const inspectedWeapon = WEAPONS[inspectedWeaponId];
  const currentClassSpec = SOLDIER_CLASSES[selectedClass];
  const playerStats = hud?.combatants.find((c) => c.isPlayer);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* Dedicated Isolated 3D WebGL Viewport Container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Red Damage Vignette Overlay */}
      {screen === 'playing' && hud && hud.damageFlashTimer > 0 && (
        <div
          className="absolute inset-0 pointer-events-none z-10 border-[12px] border-rose-500/60 transition-opacity duration-100"
          style={{ opacity: Math.min(1, hud.damageFlashTimer * 3.0) }}
        />
      )}

      {/* Portrait Mode Orientation Notice for Mobile Phones */}
      {isPortraitMobile && !portraitDismissed && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center">
          <Smartphone className="w-12 h-12 text-amber-400 mb-3 animate-pulse rotate-90" />
          <div className="text-xs font-mono-tabular text-amber-400 mb-1">
            ANDROID LANDSHAFT REJIMI TAVSIYA ETILADI
          </div>
          <h2 className="text-xl font-display font-bold text-white mb-2">
            TELEFONNI GORIZONTAL HOLATGA BURANG
          </h2>
          <p className="text-xs text-slate-300 max-w-xs mb-5 leading-relaxed">
            Birinchi shaxs (FPS) otishma boshqaruvi, virtual joystik va taktik
            xarita gorizontal (landshaft) ekranda eng qulay ishlaydi.
          </p>
          <button
            type="button"
            onClick={() => setPortraitDismissed(true)}
            className="px-5 py-2.5 rounded-lg bg-amber-500 text-slate-950 font-display font-bold text-xs cursor-pointer"
          >
            BARIBIR DAVOM ETISH
          </button>
        </div>
      )}

      {/* =====================================================================
          F3 DEVELOPER DIAGNOSTICS OVERLAY (Hidden by default, toggled via F3)
         ===================================================================== */}
      {showDiagnostics && hud && (
        <div className="fixed top-16 left-4 z-50 bg-slate-950/95 border border-amber-500/70 rounded-lg p-3 text-[11px] font-mono-tabular text-slate-200 shadow-2xl max-w-sm pointer-events-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1.5 text-amber-400 font-bold">
            <span>F3 DIAGNOSTIKA PANELI (FPS & ASSET)</span>
            <button
              type="button"
              onClick={() => setShowDiagnostics(false)}
              className="text-slate-400 hover:text-white px-1 cursor-pointer"
            >
              [X]
            </button>
          </div>
          <div className="space-y-0.5">
            <div>
              FPS: <span className="text-emerald-400">{hud.diagnostics.fps}</span>{' '}
              ({hud.diagnostics.frameTimeMs} ms) · Sifat:{' '}
              {hud.diagnostics.graphicsQuality.toUpperCase()}
            </div>
            <div>
              Joylashuv: X:{hud.diagnostics.playerX} Y:{hud.diagnostics.playerY}{' '}
              Z:{hud.diagnostics.playerZ}
            </div>
            <div>
              Tezlik: {hud.diagnostics.speed} m/s (VX:{hud.diagnostics.velocityX}{' '}
              VY:{hud.diagnostics.velocityY} VZ:{hud.diagnostics.velocityZ})
            </div>
            <div>
              Harakat: <span className="text-amber-300">{hud.diagnostics.movementState.toUpperCase()}</span>{' '}
              · Anim: <span className="text-sky-300">{hud.diagnostics.animationState.toUpperCase()}</span>
            </div>
            <div>
              Fizika: {hud.diagnostics.grounded ? 'Yerda' : 'Havoda'} · Nishab:{' '}
              {hud.diagnostics.terrainSlope} · Yuqori bo‘shliq:{' '}
              {hud.diagnostics.overheadClearance ? 'OCHIQ' : 'PAST SHIFT'}
            </div>
            <div>
              Qurol: {hud.diagnostics.currentWeaponId} ({hud.diagnostics.activeSlot.toUpperCase()}) ·{' '}
              {hud.diagnostics.ammoSummary}
            </div>
            <div>
              Sirt: {hud.diagnostics.surfaceType.toUpperCase()} · Balandlik:{' '}
              {hud.diagnostics.terrainHeight} m
            </div>
            <div>Hudud: {hud.diagnostics.currentRegionUz}</div>
            <div>
              Botlar: {hud.diagnostics.activeBotCount} · O‘q izlari:{' '}
              {hud.diagnostics.activeTracerCount} · Zarralar:{' '}
              {hud.diagnostics.activeParticleCount}
            </div>
            <div>
              Kolliziyalar: {hud.diagnostics.collisionObjectCount} · Dinamik:{' '}
              {hud.diagnostics.dynamicObjectCount} · Qutilar:{' '}
              {hud.diagnostics.activePropCount}
            </div>
            <div>
              3D Asset: <span className="text-emerald-300">{hud.diagnostics.assetPipelineMode}</span>
            </div>
            {hud.diagnostics.assetLoadErrors.length > 0 && (
              <div className="text-rose-400 truncate">
                Asset xato: {hud.diagnostics.assetLoadErrors[0]}
              </div>
            )}
            <div className="text-sky-300 pt-0.5 truncate">
              Yaqin AI: {hud.diagnostics.nearestBotInfo}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 1: UZBEK MAIN MENU (ASOSIY MENYU)
         ===================================================================== */}
      {screen === 'menu' && (
        <div className="relative z-20 w-full h-full flex flex-col justify-between p-4 sm:p-8 lg:p-10 pointer-events-none bg-gradient-to-t from-slate-950/92 via-slate-950/35 to-slate-950/80 overflow-y-auto">
          {/* Top Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 pointer-events-auto">
            <div className="flex items-center gap-3.5">
              <svg
                width="44"
                height="44"
                viewBox="0 0 44 44"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="shrink-0"
              >
                <polygon
                  points="22,2 40,12 40,32 22,42 4,32 4,12"
                  fill="#0f172a"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                />
                <polygon
                  points="22,9 33,15.5 33,28.5 22,35 11,28.5 11,15.5"
                  fill="#f59e0b"
                  fillOpacity="0.2"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
                <circle cx="22" cy="22" r="4.5" fill="#f59e0b" />
              </svg>
              <div>
                <div className="text-[11px] font-mono-tabular tracking-widest text-amber-400">
                  BIRINCHI SHAXS (FPS) · G‘ARB FRONTI — TEMIR QISHLOQ (500×500M)
                </div>
                <h1 className="text-2xl sm:text-4xl font-display font-bold tracking-tight text-white">
                  FRONTLINE: POLYGON ARENA
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDiagnostics((prev) => !prev)}
                className="px-3 py-2 rounded-lg bg-slate-900/95 border border-slate-700 text-xs font-mono-tabular text-slate-300 hover:border-amber-400 cursor-pointer"
              >
                [F3] Diagnostika
              </button>

              <button
                type="button"
                onClick={handleToggleSound}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900/95 border border-slate-700 text-xs font-medium text-slate-200 hover:border-amber-400 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {settings.soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-amber-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                )}
                <span>
                  {settings.soundEnabled ? 'Ovoz Yoqilgan' : 'Ovoz O‘chiq'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900/95 border border-slate-700 text-xs font-medium text-slate-200 hover:border-amber-400 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Settings className="w-4 h-4 text-sky-400" />
                <span>SOZLAMALAR</span>
              </button>
            </div>
          </div>

          <div className="my-auto py-3" />

          {/* Bottom Command & Navigation Deck */}
          <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch pointer-events-auto">
            <div className="lg:col-span-8 bg-slate-900/95 border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col justify-between gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <span className="text-xs font-mono-tabular text-amber-400 block">
                    JORIY 1-SHAXS (FPS) JANGOVAR JIHOZLANISH
                  </span>
                  <div className="text-sm sm:text-base font-display font-bold text-white flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="text-sky-400">
                      {currentClassSpec.nameUz}
                    </span>
                    <span>·</span>
                    <span>[1] {WEAPONS[selectedPrimary].name}</span>
                    <span>·</span>
                    <span>[2] {WEAPONS[selectedSidearm].name}</span>
                  </div>
                </div>

                <div className="text-right font-mono-tabular text-xs text-slate-400">
                  <div>
                    REJIM:{' '}
                    <span className="text-emerald-400 font-semibold">
                      {gameMode === 'domination'
                        ? 'HUDUDLARNI EGALLASH'
                        : 'MASHG‘ULOT REJIMI'}
                    </span>
                  </div>
                  <div>QOPLAMA: {WEAPON_FINISHES[settings.weaponFinish].nameUz}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleOpenLoadout('primary')}
                  className="p-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-400 text-left transition-all cursor-pointer"
                >
                  <Swords className="w-4 h-4 text-amber-400 mb-1.5" />
                  <div className="font-display font-bold text-xs text-white">
                    QUROL TANLASH
                  </div>
                  <div className="text-[11px] text-slate-400">
                    14 asosiy + 6 to‘pponcha
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenLoadout('class')}
                  className="p-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-sky-400 text-left transition-all cursor-pointer"
                >
                  <Users className="w-4 h-4 text-sky-400 mb-1.5" />
                  <div className="font-display font-bold text-xs text-white">
                    ASKAR SINFI
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {currentClassSpec.nameUz}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFX.playUiClick();
                    setGameMode((m) =>
                      m === 'domination' ? 'training' : 'domination'
                    );
                  }}
                  className="p-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-400 text-left transition-all cursor-pointer"
                >
                  <Award className="w-4 h-4 text-emerald-400 mb-1.5" />
                  <div className="font-display font-bold text-xs text-white">
                    O‘YIN REJIMI
                  </div>
                  <div className="text-[11px] text-emerald-400 font-medium">
                    {gameMode === 'domination'
                      ? 'Hududlarni egallash'
                      : 'Mashg‘ulot maydoni'}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFX.playUiClick();
                    setInfoModal('map');
                  }}
                  className="p-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-400 text-left transition-all cursor-pointer"
                >
                  <MapIcon className="w-4 h-4 text-amber-400 mb-1.5" />
                  <div className="font-display font-bold text-xs text-white">
                    XARITA
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Temir Qishloq (500m)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFX.playUiClick();
                    setSettingsModalOpen(true);
                  }}
                  className="p-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-sky-400 text-left transition-all cursor-pointer"
                >
                  <Sliders className="w-4 h-4 text-sky-400 mb-1.5" />
                  <div className="font-display font-bold text-xs text-white">
                    SOZLAMALAR
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Grafika, sensor va ovoz
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFX.playUiClick();
                    setInfoModal('controls');
                  }}
                  className="p-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-400 text-left transition-all cursor-pointer"
                >
                  <Keyboard className="w-4 h-4 text-amber-400 mb-1.5" />
                  <div className="font-display font-bold text-xs text-white">
                    BOSHQARUV
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Klaviatura va Android sensor
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFX.playUiClick();
                    setInfoModal('about');
                  }}
                  className="p-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-sky-400 text-left transition-all cursor-pointer col-span-2"
                >
                  <Info className="w-4 h-4 text-sky-400 mb-1.5" />
                  <div className="font-display font-bold text-xs text-white">
                    O‘YIN HAQIDA
                  </div>
                  <div className="text-[11px] text-slate-400">
                    1-shaxs (FPS) tizimi, 20 qurol va 6 hudud qoidalari
                  </div>
                </button>
              </div>
            </div>

            {/* Right 4 Columns: Primary JANGNI BOSHLASH CTA */}
            <div className="lg:col-span-4 bg-slate-900/95 border border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4 shadow-2xl">
              <div>
                <div className="text-xs font-mono-tabular text-sky-400 mb-1">
                  1-SHAXS (FPS) FRONT JANGI
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  G‘arbiy transheya (A), Markaziy vayrona qishloq (B) va Sharqiy
                  sanoat ombori (C) nuqtalarini egallang.{' '}
                  <span className="text-white font-semibold">300 ochko</span>{' '}
                  to‘plagan jamoa g‘alaba qozonadi.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDeployMatch}
                className="w-full py-4 px-6 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-display font-bold text-base tracking-wide flex items-center justify-center gap-2.5 shadow-lg transition-all cursor-pointer whitespace-nowrap"
              >
                <Play className="w-5 h-5 fill-slate-950" />
                <span>JANGNI BOSHLASH</span>
              </button>

              <div className="text-[11px] font-mono-tabular text-slate-400 text-center">
                Kompyuter (WASD + Sichqoncha) va Android Sensorli boshqaruv tayyor
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 2: COMPLETE UZBEK LOADOUT & CLASS SCREEN (QUROL VA SINF TANLASH)
         ===================================================================== */}
      {screen === 'loadout' && (
        <div className="relative z-30 w-full h-full bg-slate-950/92 flex flex-col justify-between p-4 sm:p-8 overflow-y-auto">
          <div className="w-full max-w-6xl mx-auto my-auto bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-5">
              <div>
                <div className="text-[11px] font-mono-tabular text-amber-400">
                  JANGOVAR ARSENAL VA MUTAXASSISLIK (20 TA QUROL)
                </div>
                <h2 className="text-xl sm:text-2xl font-display font-bold text-white">
                  QUROL VA ASKAR SINFINI TANLASH
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {(
                  [
                    {
                      id: 'primary',
                      label: `ASOSIY QUROLLAR (${PRIMARY_WEAPON_LIST.length})`,
                    },
                    {
                      id: 'sidearm',
                      label: `TO‘PPONCHALAR (${SIDEARM_WEAPON_LIST.length})`,
                    },
                    { id: 'class', label: 'ASKAR SINFI (4)' },
                    { id: 'controls', label: 'BOSHQARUV' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      soundFX.playUiClick();
                      setLoadoutTab(t.id);
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-display font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      loadoutTab === t.id
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* TAB 1 & TAB 2: PRIMARY WEAPONS (14) & SIDEARMS (6) */}
            {(loadoutTab === 'primary' || loadoutTab === 'sidearm') && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[430px] overflow-y-auto pr-1">
                  {(loadoutTab === 'primary'
                    ? PRIMARY_WEAPON_LIST
                    : SIDEARM_WEAPON_LIST
                  ).map((w) => {
                    const isEquipped =
                      loadoutTab === 'primary'
                        ? selectedPrimary === w.id
                        : selectedSidearm === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          soundFX.playUiClick();
                          if (w.slot === 'primary') {
                            setSelectedPrimary(w.id as PrimaryWeaponId);
                            engineRef.current?.setLoadout(
                              w.id as PrimaryWeaponId,
                              selectedSidearm,
                              selectedClass
                            );
                          } else {
                            setSelectedSidearm(w.id as SidearmWeaponId);
                            engineRef.current?.setLoadout(
                              selectedPrimary,
                              w.id as SidearmWeaponId,
                              selectedClass
                            );
                          }
                        }}
                        className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                          isEquipped
                            ? 'bg-slate-800 border-amber-400 shadow-md'
                            : 'bg-slate-950/90 border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-display font-bold text-sm text-white">
                            {w.name}
                          </span>
                          <span
                            className={`text-[10px] font-mono-tabular px-1.5 py-0.5 rounded ${
                              isEquipped
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'bg-slate-900 text-slate-400'
                            }`}
                          >
                            {isEquipped
                              ? w.slot === 'primary'
                                ? '1-SLOT TANLANGAN'
                                : '2-SLOT TANLANGAN'
                              : `${w.magazineSize}/${w.reserveAmmo}`}
                          </span>
                        </div>
                        <div className="text-[11px] text-amber-400/90 mb-1">
                          {w.categoryUz}
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2">
                          {w.descriptionUz}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Live 3D Rotating Weapon Inspector, Finish Selector & Detailed Stats */}
                <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-[10px] font-mono-tabular text-amber-400 uppercase">
                        3D KO‘RIK ·{' '}
                        {inspectedWeapon.slot === 'primary'
                          ? '1-SLOT ASOSIY QUROL'
                          : '2-SLOT TO‘PPONCHA'}
                      </span>
                      <h3 className="text-lg font-display font-bold text-white">
                        {inspectedWeapon.name}
                      </h3>
                    </div>
                    <span className="text-xs font-mono-tabular text-sky-400">
                      {inspectedWeapon.magazineSize} /{' '}
                      {inspectedWeapon.reserveAmmo} O‘Q
                    </span>
                  </div>

                  <WeaponPreviewCanvas
                    weaponId={inspectedWeapon.id}
                    finishId={settings.weaponFinish}
                  />

                  {/* Weapon Finish Selector */}
                  <div className="mt-3 mb-3">
                    <div className="text-[10px] font-mono-tabular text-slate-400 mb-1">
                      QUROL QOPLAMASI (FINISH):
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {(Object.keys(WEAPON_FINISHES) as WeaponFinishId[]).map(
                        (fId) => {
                          const fSpec = WEAPON_FINISHES[fId];
                          const active = settings.weaponFinish === fId;
                          return (
                            <button
                              key={fId}
                              type="button"
                              onClick={() =>
                                updateGameSettings({ weaponFinish: fId })
                              }
                              className={`px-2 py-1 rounded border text-[10px] font-mono-tabular truncate cursor-pointer ${
                                active
                                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {fSpec.nameUz}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                    {inspectedWeapon.descriptionUz}
                  </p>

                  <div className="space-y-2 text-xs font-mono-tabular">
                    <div>
                      <div className="flex justify-between text-slate-300 mb-0.5">
                        <span>ZARBA KUCHI (DAMAGE)</span>
                        <span className="text-amber-400">
                          {inspectedWeapon.damage}
                          {inspectedWeapon.pelletCount
                            ? ` × ${inspectedWeapon.pelletCount}`
                            : ''}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400"
                          style={{
                            width: `${Math.min(
                              100,
                              inspectedWeapon.damage *
                                (inspectedWeapon.pelletCount ? 4 : 1.4)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-300 mb-0.5">
                        <span>ANIQLIK (ACCURACY)</span>
                        <span className="text-sky-400">
                          {inspectedWeapon.accuracyRating}/100
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sky-400"
                          style={{
                            width: `${inspectedWeapon.accuracyRating}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-300 mb-0.5">
                        <span>QULAYLIK VA TEZLIK (HANDLING)</span>
                        <span className="text-emerald-400">
                          {inspectedWeapon.handlingSpeed}/100
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400"
                          style={{ width: `${inspectedWeapon.handlingSpeed}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-slate-400 border-t border-slate-800">
                      <span>O‘qlash vaqti: {inspectedWeapon.reloadTime}s</span>
                      <span>
                        Masofa: {inspectedWeapon.effectiveRange}m /{' '}
                        {inspectedWeapon.maxRange}m
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: SOLDIER CLASSES (ASKAR SINFI) */}
            {loadoutTab === 'class' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(Object.keys(SOLDIER_CLASSES) as SoldierClassId[]).map(
                  (cId) => {
                    const cSpec = SOLDIER_CLASSES[cId];
                    const active = selectedClass === cId;
                    return (
                      <button
                        key={cId}
                        type="button"
                        onClick={() => {
                          soundFX.playUiClick();
                          setSelectedClass(cId);
                          engineRef.current?.setLoadout(
                            selectedPrimary,
                            selectedSidearm,
                            cId
                          );
                        }}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          active
                            ? 'bg-slate-800 border-amber-400 shadow-lg'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-display font-bold text-base text-white">
                              {cSpec.nameUz}
                            </span>
                            {active && (
                              <span className="text-[10px] font-mono-tabular bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded">
                                TANLANGAN
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-sky-400 mb-2">
                            {cSpec.roleUz}
                          </div>
                          <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                            {cSpec.descriptionUz}
                          </p>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs space-y-1">
                          <div className="font-semibold text-amber-400">
                            {cSpec.abilityNameUz}
                          </div>
                          <div className="text-slate-400 text-[11px]">
                            {cSpec.abilityDescUz}
                          </div>
                          <div className="text-[11px] font-mono-tabular text-slate-300 pt-1">
                            Sog‘liq: {cSpec.maxHp} HP · Qayta tiklanish:{' '}
                            {cSpec.abilityCooldown}s
                          </div>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            )}

            {/* TAB 4: CONTROLS REFERENCE (BOSHQARUV) */}
            {loadoutTab === 'controls' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono-tabular">
                {[
                  ['WASD / Chap Joystik', 'Harbiy harakatlanish'],
                  ['Shift / YUGURISH tugmasi', 'Tezkor yugurish (Sprint)'],
                  ['Space / SAKRASH tugmasi', 'Sakrash / To‘siqdan oshish'],
                  ['C / Ctrl / O‘TIRISH tugmasi', 'O‘tirish (Aniqlik oshadi)'],
                  ['Chap sichqoncha / O‘T OCHISH', 'Quvoldan o‘t ochish'],
                  ['O‘ng sichqoncha / NISHON', '1-shaxs optik nishonga olish (ADS)'],
                  ['1 va 2 tugmalari', 'Asosiy qurol / To‘pponcha'],
                  ['R / O‘QLASH tugmasi', 'Qurolni qayta o‘qlash (Reload)'],
                  ['Q / MAXSUS tugmasi', 'Askar sinfi qobiliyatini yoqish'],
                  ['E / TA’MINOT tugmasi', 'Nuqtada o‘q-dori va HP to‘ldirish'],
                  ['M / XARITA tugmasi', 'Katta taktik xaritani ochish'],
                  ['F3 tugmasi', 'Fizika va FPS diagnostika paneli'],
                ].map(([keyName, desc]) => (
                  <div
                    key={keyName}
                    className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5"
                  >
                    <span className="text-amber-400 font-bold">{keyName}</span>
                    <span className="text-slate-300">{desc}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono-tabular">
                <div>
                  <span className="text-slate-400">1-SLOT (ASOSIY): </span>
                  <span className="text-white font-bold">
                    {WEAPONS[selectedPrimary].name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">2-SLOT (TO‘PPONCHA): </span>
                  <span className="text-white font-bold">
                    {WEAPONS[selectedSidearm].name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">SINF: </span>
                  <span className="text-sky-400 font-bold">
                    {currentClassSpec.nameUz}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleReturnToMenu}
                  className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm cursor-pointer"
                >
                  ORQAGA QAYTISH
                </button>
                <button
                  type="button"
                  onClick={handleDeployMatch}
                  className="px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm flex items-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>JANGGA KIRISH</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 3: IN-GAME FIRST-PERSON TACTICAL HUD & ANDROID TOUCH CONTROLS
         ===================================================================== */}
      {screen === 'playing' && hud && (
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4">
          {/* Right-Half Independent Camera-Look Touch Surface for Android Landscape */}
          {showTouchControls && (
            <div
              className="fixed top-0 right-0 w-[56%] h-full z-10 pointer-events-auto touch-none"
              onTouchStart={(e) => {
                if (lookTouchId.current !== null) return;
                const t = e.changedTouches[0];
                lookTouchId.current = t.identifier;
                lookLastPos.current = { x: t.clientX, y: t.clientY };
              }}
              onTouchMove={(e) => {
                for (let i = 0; i < e.changedTouches.length; i++) {
                  const t = e.changedTouches[i];
                  if (t.identifier === lookTouchId.current) {
                    const dx = t.clientX - lookLastPos.current.x;
                    const dy = t.clientY - lookLastPos.current.y;
                    lookLastPos.current = { x: t.clientX, y: t.clientY };
                    engineRef.current?.adjustPlayerLook(dx * 2.35, dy * 2.35);
                  }
                }
              }}
              onTouchEnd={(e) => {
                for (let i = 0; i < e.changedTouches.length; i++) {
                  if (e.changedTouches[i].identifier === lookTouchId.current) {
                    lookTouchId.current = null;
                  }
                }
              }}
              onTouchCancel={() => {
                lookTouchId.current = null;
              }}
            />
          )}

          {/* Top Row: Tactical Minimap (Left), Score & Objectives (Center), Killfeed & Controls (Right) */}
          <div className="relative z-20 flex items-start justify-between gap-2">
            {/* Top-Left: Live Tactical Minimap + Region Label */}
            <div className="pointer-events-auto flex flex-col gap-1">
              <Minimap
                combatants={hud.combatants}
                objectives={hud.objectives}
                structures={
                  engineRef.current?.getStructuresSnapshot() || ARENA_STRUCTURES
                }
                reconScanActive={hud.reconScanActive}
                expanded={false}
                onToggleExpand={() => setMapExpanded((prev) => !prev)}
              />
              <div className="bg-slate-950/90 border border-slate-800 rounded px-2 py-0.5 text-[10px] font-mono-tabular text-slate-300 flex items-center gap-1.5">
                <Compass className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="truncate max-w-[145px]">
                  {hud.currentRegionUz}
                </span>
              </div>
            </div>

            {/* Top-Center: Scoreboard, Match Timer & Objective A/B/C Status */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="bg-slate-950/92 border border-slate-800 rounded-xl px-3.5 py-1.5 shadow-lg flex items-center gap-3 sm:gap-6">
                <div className="flex flex-col items-end min-w-[58px]">
                  <span className="text-[10px] font-mono-tabular text-sky-400">
                    ITTIFOQ
                  </span>
                  <span className="text-lg sm:text-2xl font-display font-bold font-mono-tabular text-white leading-tight">
                    {hud.blueScore}
                  </span>
                  <div className="w-14 sm:w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                    <div
                      className="h-full bg-sky-400 transition-all duration-200"
                      style={{
                        width: `${(hud.blueScore / hud.maxScore) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="px-2.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-center">
                  <div className="text-[9px] font-mono-tabular text-slate-400">
                    {hud.gameMode === 'training' ? 'MASHQ' : 'VAQT'}
                  </div>
                  <div className="text-sm sm:text-lg font-mono-tabular font-bold text-amber-400">
                    {formatTime(hud.timeRemaining)}
                  </div>
                </div>

                <div className="flex flex-col items-start min-w-[58px]">
                  <span className="text-[10px] font-mono-tabular text-rose-400">
                    RAQIB
                  </span>
                  <span className="text-lg sm:text-2xl font-display font-bold font-mono-tabular text-white leading-tight">
                    {hud.redScore}
                  </span>
                  <div className="w-14 sm:w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                    <div
                      className="h-full bg-rose-500 transition-all duration-200"
                      style={{
                        width: `${(hud.redScore / hud.maxScore) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Sector A / B / C Badges */}
              <div className="flex items-center gap-1.5">
                {hud.objectives.map((obj) => {
                  const borderColor = obj.contested
                    ? 'border-amber-400'
                    : obj.owner === 'blue'
                    ? 'border-sky-400'
                    : obj.owner === 'red'
                    ? 'border-rose-500'
                    : 'border-slate-600';
                  const bgColor =
                    obj.owner === 'blue'
                      ? 'bg-sky-500/25 text-sky-200'
                      : obj.owner === 'red'
                      ? 'bg-rose-500/25 text-rose-200'
                      : 'bg-slate-900/90 text-slate-300';

                  return (
                    <div
                      key={obj.id}
                      className={`px-2.5 py-0.5 rounded-md border ${borderColor} ${bgColor} text-[11px] font-mono-tabular flex items-center gap-1 shadow`}
                    >
                      <span className="font-bold">{obj.id}</span>
                      <span className="text-[10px] opacity-85">
                        {obj.contested
                          ? 'NIZOLI'
                          : obj.owner === 'blue'
                          ? 'ITTIFOQ'
                          : obj.owner === 'red'
                          ? 'RAQIB'
                          : `${Math.abs(Math.round(obj.progress))}%`}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Active Objective Capture Banner */}
              {activeObjective && (
                <div className="bg-slate-950/95 border border-amber-500/60 rounded-lg px-3.5 py-1 text-center shadow-lg min-w-[210px]">
                  <div className="text-[10px] font-mono-tabular text-amber-300 flex items-center justify-between gap-3">
                    <span>{activeObjective.name}</span>
                    <span>
                      {activeObjective.contested
                        ? 'NIZOLI!'
                        : `${Math.round(activeObjective.progress)}%`}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full transition-all duration-150 ${
                        activeObjective.progress >= 0
                          ? 'bg-sky-400'
                          : 'bg-rose-500'
                      }`}
                      style={{
                        width: `${Math.abs(activeObjective.progress)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Contextual Interaction Prompt (Desktop & Mobile) */}
              {hud.nearbyInteractionPromptUz && (
                <button
                  type="button"
                  onClick={() => engineRef.current?.triggerPlayerInteract()}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    engineRef.current?.triggerPlayerInteract();
                  }}
                  className="pointer-events-auto px-3 py-1 rounded-md bg-emerald-500/25 border border-emerald-400 text-[11px] font-mono-tabular font-bold text-emerald-200 shadow cursor-pointer"
                >
                  {hud.nearbyInteractionPromptUz}
                </button>
              )}
            </div>

            {/* Top-Right: Action Buttons & Activity Feed */}
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setMapExpanded((prev) => !prev)}
                  onTouchStart={(e) => e.stopPropagation()}
                  title="Katta Xarita (M)"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-950/92 border border-slate-700 hover:border-amber-400 text-xs font-mono-tabular text-slate-200 cursor-pointer"
                >
                  <MapIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">XARITA [M]</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleSound}
                  onTouchStart={(e) => e.stopPropagation()}
                  title="Ovoz"
                  className="p-1.5 rounded-lg bg-slate-950/92 border border-slate-700 hover:border-amber-400 text-slate-200 cursor-pointer"
                >
                  {settings.soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-amber-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handlePauseMatch}
                  onTouchStart={(e) => e.stopPropagation()}
                  title="Pauza (Esc)"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/92 border border-slate-700 hover:border-amber-400 text-xs font-mono-tabular text-slate-200 cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                  <span>PAUZA</span>
                </button>
              </div>

              {/* Kill Feed */}
              <div className="hidden sm:flex flex-col items-end gap-1 mt-0.5">
                {hud.killFeed.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-950/88 border border-slate-800 rounded px-2.5 py-0.5 text-[10px] font-mono-tabular flex items-center gap-1.5"
                  >
                    <span
                      className={
                        item.killerTeam === 'blue'
                          ? 'text-sky-400 font-semibold'
                          : 'text-rose-400 font-semibold'
                      }
                    >
                      {item.killerName}
                    </span>
                    <span className="text-slate-500">
                      [{item.weaponName}
                      {item.headshot ? ' · BOSHGA' : ''}]
                    </span>
                    <span
                      className={
                        item.victimTeam === 'blue'
                          ? 'text-sky-400'
                          : 'text-rose-400'
                      }
                    >
                      {item.victimName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Center Dynamic First-Person Crosshair, ADS Reticle, HitMarker & Reload Status */}
          <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-10">
            {hud.playerAlive ? (
              <div className="relative flex items-center justify-center">
                <div
                  className={`rounded-full transition-all duration-75 ${
                    hud.playerAiming
                      ? 'w-1.5 h-1.5 bg-emerald-400 shadow-[0_0_6px_#34d399]'
                      : 'w-1.5 h-1.5 bg-amber-400'
                  }`}
                />
                {!hud.playerAiming && (
                  <>
                    <div
                      className={`absolute h-[1.5px] bg-white/85 transition-all duration-100 ${
                        hud.playerSprinting ? 'w-5 -left-8' : 'w-4 -left-5'
                      }`}
                    />
                    <div
                      className={`absolute h-[1.5px] bg-white/85 transition-all duration-100 ${
                        hud.playerSprinting ? 'w-5 -right-8' : 'w-4 -right-5'
                      }`}
                    />
                    <div
                      className={`absolute w-[1.5px] bg-white/85 transition-all duration-100 ${
                        hud.playerSprinting ? 'h-5 -top-8' : 'h-4 -top-5'
                      }`}
                    />
                    <div
                      className={`absolute w-[1.5px] bg-white/85 transition-all duration-100 ${
                        hud.playerSprinting ? 'h-5 -bottom-8' : 'h-4 -bottom-5'
                      }`}
                    />
                  </>
                )}

                {hud.hitMarkerTimer > 0 && (
                  <svg
                    width="34"
                    height="34"
                    viewBox="0 0 34 34"
                    className="absolute"
                  >
                    <line
                      x1="6"
                      y1="6"
                      x2="13"
                      y2="13"
                      stroke={hud.hitMarkerHeadshot ? '#f59e0b' : '#ffffff'}
                      strokeWidth="2.5"
                    />
                    <line
                      x1="28"
                      y1="6"
                      x2="21"
                      y2="13"
                      stroke={hud.hitMarkerHeadshot ? '#f59e0b' : '#ffffff'}
                      strokeWidth="2.5"
                    />
                    <line
                      x1="6"
                      y1="28"
                      x2="13"
                      y2="21"
                      stroke={hud.hitMarkerHeadshot ? '#f59e0b' : '#ffffff'}
                      strokeWidth="2.5"
                    />
                    <line
                      x1="28"
                      y1="28"
                      x2="21"
                      y2="21"
                      stroke={hud.hitMarkerHeadshot ? '#f59e0b' : '#ffffff'}
                      strokeWidth="2.5"
                    />
                  </svg>
                )}

                {hud.reloading && (
                  <div className="absolute top-9 px-2.5 py-0.5 rounded bg-slate-950/92 border border-amber-400/70 text-[11px] font-mono-tabular text-amber-300 whitespace-nowrap">
                    O‘QLANMOQDA · {Math.round(hud.reloadProgress * 100)}%
                  </div>
                )}

                {!hud.reloading && hud.ammo === 0 && (
                  <div className="absolute top-9 px-2.5 py-0.5 rounded bg-rose-950/90 border border-rose-500 text-[11px] font-mono-tabular text-rose-200 whitespace-nowrap">
                    {hud.reserveAmmo > 0
                      ? '[R] QAYTA O‘QLANG!'
                      : 'O‘Q TUGADI! [1/2] QUROL ALMASHTIRING'}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-950/95 border border-rose-500/70 rounded-xl px-6 py-4 text-center shadow-2xl">
                <div className="text-xs font-mono-tabular text-rose-400 mb-1">
                  SAFDAN CHIQDI · G‘ARBIY SHTABDA QAYTA TIKLANISH
                </div>
                <div className="text-2xl font-display font-bold font-mono-tabular text-white">
                  TIKLANISHGA: {hud.respawnTimer.toFixed(1)} S
                </div>
              </div>
            )}
          </div>

          {/* Expanded Tactical Map Modal (M key) */}
          {mapExpanded && (
            <div className="fixed inset-0 z-40 bg-slate-950/88 flex items-center justify-center p-4 pointer-events-auto">
              <Minimap
                combatants={hud.combatants}
                objectives={hud.objectives}
                structures={
                  engineRef.current?.getStructuresSnapshot() || ARENA_STRUCTURES
                }
                reconScanActive={hud.reconScanActive}
                expanded={true}
                onToggleExpand={() => setMapExpanded(false)}
              />
            </div>
          )}

          {/* =================================================================
              ANDROID LANDSCAPE TOUCHSCREEN CONTROLS (MULTI-TOUCH ISOLATED)
             ================================================================= */}
          {showTouchControls && (
            <div className="fixed inset-x-0 bottom-24 z-30 flex items-end justify-between px-4 pointer-events-none">
              {/* Left Cluster: Sprint Button + Virtual Movement Thumbstick */}
              <div className="flex flex-col items-center gap-2 pointer-events-auto">
                <button
                  type="button"
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    engineRef.current?.toggleTouchSprint();
                  }}
                  onClick={() => engineRef.current?.toggleTouchSprint()}
                  className={`px-3.5 py-1.5 rounded-lg border text-[11px] font-mono-tabular font-bold transition-colors ${
                    hud.playerSprinting
                      ? 'bg-amber-500 border-amber-300 text-slate-950'
                      : 'bg-slate-900/85 border-slate-600 text-slate-200'
                  }`}
                >
                  YUGURISH {hud.playerSprinting ? 'FAOL' : ''}
                </button>

                <div
                  className="w-28 h-28 rounded-full bg-slate-900/75 border-2 border-slate-600 flex items-center justify-center touch-none relative"
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    const t = e.changedTouches[0];
                    joystickTouchId.current = t.identifier;
                    const rect = e.currentTarget.getBoundingClientRect();
                    joystickOrigin.current = {
                      x: rect.left + rect.width / 2,
                      y: rect.top + rect.height / 2,
                    };
                  }}
                  onTouchMove={(e) => {
                    e.stopPropagation();
                    for (let i = 0; i < e.changedTouches.length; i++) {
                      const t = e.changedTouches[i];
                      if (t.identifier === joystickTouchId.current) {
                        const dx = t.clientX - joystickOrigin.current.x;
                        const dy = t.clientY - joystickOrigin.current.y;
                        const maxR = 42;
                        const dist = Math.min(maxR, Math.hypot(dx, dy));
                        const ang = Math.atan2(dy, dx);
                        const kx = Math.cos(ang) * dist;
                        const ky = Math.sin(ang) * dist;
                        setJoystickKnob({ x: kx, y: ky });
                        engineRef.current?.setTouchMovement(
                          kx / maxR,
                          ky / maxR
                        );
                        if (ky / maxR < -0.82) {
                          engineRef.current?.setTouchSprint(true);
                        }
                      }
                    }
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    for (let i = 0; i < e.changedTouches.length; i++) {
                      if (
                        e.changedTouches[i].identifier ===
                        joystickTouchId.current
                      ) {
                        joystickTouchId.current = null;
                        setJoystickKnob({ x: 0, y: 0 });
                        engineRef.current?.setTouchMovement(0, 0);
                      }
                    }
                  }}
                  onTouchCancel={() => {
                    joystickTouchId.current = null;
                    setJoystickKnob({ x: 0, y: 0 });
                    engineRef.current?.setTouchMovement(0, 0);
                  }}
                >
                  <div
                    className="w-11 h-11 rounded-full bg-amber-400/90 shadow-md"
                    style={{
                      transform: `translate(${joystickKnob.x}px, ${joystickKnob.y}px)`,
                    }}
                  />
                </div>
              </div>

              {/* Right Cluster: Ergonomic Action Buttons (ADS, Crouch, Jump, Reload, Ability, Interact, Fire) */}
              <div className="flex flex-col items-end gap-2 pointer-events-auto">
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {hud.nearbyInteractionPromptUz && (
                    <button
                      type="button"
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        engineRef.current?.triggerPlayerInteract();
                      }}
                      onClick={() => engineRef.current?.triggerPlayerInteract()}
                      className="px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs font-mono-tabular font-bold shadow"
                    >
                      [E] TA’MINOT
                    </button>
                  )}

                  <button
                    type="button"
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      engineRef.current?.activatePlayerAbility();
                    }}
                    onClick={() => engineRef.current?.activatePlayerAbility()}
                    className={`px-3 py-2 rounded-lg border text-xs font-mono-tabular font-bold ${
                      hud.abilityCooldownRemaining === 0
                        ? 'bg-slate-900/90 border-emerald-400 text-emerald-300'
                        : 'bg-slate-900/60 border-slate-700 text-slate-500'
                    }`}
                  >
                    [Q]{' '}
                    {hud.abilityCooldownRemaining > 0
                      ? `${hud.abilityCooldownRemaining}s`
                      : 'MAXSUS'}
                  </button>

                  <button
                    type="button"
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      engineRef.current?.toggleTouchAiming();
                    }}
                    onClick={() => engineRef.current?.toggleTouchAiming()}
                    className={`px-3.5 py-2 rounded-lg border text-xs font-mono-tabular font-bold ${
                      hud.playerAiming
                        ? 'bg-sky-400 border-sky-200 text-slate-950'
                        : 'bg-slate-900/90 border-slate-600 text-sky-300'
                    }`}
                  >
                    NISHON
                  </button>

                  <button
                    type="button"
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      engineRef.current?.togglePlayerCrouch();
                    }}
                    onClick={() => engineRef.current?.togglePlayerCrouch()}
                    className={`px-3 py-2 rounded-lg border text-xs font-mono-tabular font-bold ${
                      hud.playerCrouching
                        ? 'bg-amber-500 border-amber-300 text-slate-950'
                        : 'bg-slate-900/90 border-slate-600 text-slate-200'
                    }`}
                  >
                    O‘TIRISH
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      engineRef.current?.triggerTouchJump();
                    }}
                    onClick={() => engineRef.current?.triggerTouchJump()}
                    className="px-3.5 py-2.5 rounded-lg bg-slate-900/90 border border-slate-600 text-xs font-mono-tabular font-bold text-white"
                  >
                    SAKRASH
                  </button>

                  <button
                    type="button"
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      engineRef.current?.triggerManualReload();
                    }}
                    onClick={() => engineRef.current?.triggerManualReload()}
                    className={`px-3.5 py-2.5 rounded-lg border text-xs font-mono-tabular font-bold ${
                      hud.reloading
                        ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                        : 'bg-slate-900/90 border-slate-600 text-amber-400'
                    }`}
                  >
                    {hud.reloading
                      ? `${Math.round(hud.reloadProgress * 100)}%`
                      : 'O‘QLASH'}
                  </button>

                  <button
                    type="button"
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      const t = e.changedTouches[0];
                      fireTouchId.current = t.identifier;
                      fireLastPos.current = { x: t.clientX, y: t.clientY };
                      engineRef.current?.setTouchFiring(true);
                    }}
                    onTouchMove={(e) => {
                      e.stopPropagation();
                      for (let i = 0; i < e.changedTouches.length; i++) {
                        const t = e.changedTouches[i];
                        if (t.identifier === fireTouchId.current) {
                          const dx = t.clientX - fireLastPos.current.x;
                          const dy = t.clientY - fireLastPos.current.y;
                          fireLastPos.current = { x: t.clientX, y: t.clientY };
                          engineRef.current?.adjustPlayerLook(dx * 2.0, dy * 2.0);
                        }
                      }
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      for (let i = 0; i < e.changedTouches.length; i++) {
                        if (
                          e.changedTouches[i].identifier === fireTouchId.current
                        ) {
                          fireTouchId.current = null;
                          engineRef.current?.setTouchFiring(false);
                        }
                      }
                    }}
                    onTouchCancel={() => {
                      fireTouchId.current = null;
                      engineRef.current?.setTouchFiring(false);
                    }}
                    onMouseDown={() => engineRef.current?.setTouchFiring(true)}
                    onMouseUp={() => engineRef.current?.setTouchFiring(false)}
                    className="px-6 py-3.5 rounded-xl bg-amber-500 active:bg-amber-400 text-slate-950 font-display font-bold text-sm shadow-lg touch-none"
                  >
                    O‘T OCHISH
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Row: Health, Stamina & Class Ability (Left) + Dual-Slot Weapon & Ammo Readout (Right) */}
          <div className="relative z-20 flex items-end justify-between gap-3">
            {/* Bottom-Left: Health, Stamina & Class Ability */}
            <div className="bg-slate-950/92 border border-slate-800 rounded-xl p-2.5 sm:p-3.5 min-w-[205px] sm:min-w-[270px] shadow-lg pointer-events-auto">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-mono-tabular text-slate-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-sky-400" />
                  <span>SOG‘LIQ ({hud.soldierClass.nameUz})</span>
                </span>
                <span className="text-base sm:text-lg font-display font-bold font-mono-tabular text-white">
                  {hud.playerHp}{' '}
                  <span className="text-xs text-slate-500">
                    / {hud.playerMaxHp}
                  </span>
                </span>
              </div>

              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-1.5">
                <div
                  className={`h-full transition-all duration-150 ${
                    hud.playerHp > 35 ? 'bg-sky-400' : 'bg-rose-500'
                  }`}
                  style={{
                    width: `${(hud.playerHp / hud.playerMaxHp) * 100}%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono-tabular text-slate-400 mb-1">
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  CHIDAMLILIK
                </span>
                <span>
                  {hud.playerCrouching
                    ? 'O‘TIRGAN [C]'
                    : hud.playerSprinting
                    ? `YUGURISH (${hud.stamina}%)`
                    : `${hud.stamina}%`}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-amber-400 transition-all duration-100"
                  style={{ width: `${hud.stamina}%` }}
                />
              </div>

              <button
                type="button"
                onClick={() => engineRef.current?.activatePlayerAbility()}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  engineRef.current?.activatePlayerAbility();
                }}
                disabled={hud.abilityCooldownRemaining > 0}
                className={`w-full py-1 px-2.5 rounded border text-[10px] font-mono-tabular flex items-center justify-between cursor-pointer transition-colors ${
                  hud.abilityActiveTimer > 0
                    ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                    : hud.abilityCooldownRemaining === 0
                    ? 'bg-slate-900 hover:bg-slate-800 border-amber-500/60 text-amber-300'
                    : 'bg-slate-900/50 border-slate-800 text-slate-500'
                }`}
              >
                <span>{hud.soldierClass.abilityNameUz}</span>
                <span className="font-bold">
                  {hud.abilityActiveTimer > 0
                    ? `FAOL (${hud.abilityActiveTimer.toFixed(0)}s)`
                    : hud.abilityCooldownRemaining === 0
                    ? 'TAYYOR [Q]'
                    : `${hud.abilityCooldownRemaining}s`}
                </span>
              </button>
            </div>

            {/* Bottom-Center Control Hint (Desktop) */}
            <div className="hidden xl:block bg-slate-950/88 border border-slate-800/80 rounded-lg px-3.5 py-1.5 text-[11px] font-mono-tabular text-slate-400">
              [1] Asosiy · [2] To‘pponcha · [R] O‘qlash · [C] O‘tirish · [Q]
              Qobiliyat · [E] Ta’minot · [M] Xarita
            </div>

            {/* Bottom-Right: Dual-Slot Equipment Buttons & Real Magazine/Reserve Ammo Readout */}
            <div className="bg-slate-950/92 border border-slate-800 rounded-xl p-2.5 sm:p-3.5 min-w-[220px] sm:min-w-[285px] shadow-lg pointer-events-auto">
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                <button
                  type="button"
                  onClick={() => engineRef.current?.switchPlayerSlot('primary')}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    engineRef.current?.switchPlayerSlot('primary');
                  }}
                  className={`px-2 py-1 rounded border text-left text-[10px] font-mono-tabular transition-colors cursor-pointer ${
                    hud.activeSlot === 'primary'
                      ? 'bg-amber-500/20 border-amber-400 text-white font-semibold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex justify-between">
                    <span>[1] ASOSIY</span>
                    <span>
                      {hud.primaryMagAmmo}/{hud.primaryReserveAmmo}
                    </span>
                  </div>
                  <div className="truncate font-display font-bold text-xs">
                    {hud.primaryWeapon.name}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    engineRef.current?.switchPlayerSlot('secondary')
                  }
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    engineRef.current?.switchPlayerSlot('secondary');
                  }}
                  className={`px-2 py-1 rounded border text-left text-[10px] font-mono-tabular transition-colors cursor-pointer ${
                    hud.activeSlot === 'secondary'
                      ? 'bg-amber-500/20 border-amber-400 text-white font-semibold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex justify-between">
                    <span>[2] TO‘PPONCHA</span>
                    <span>
                      {hud.sidearmMagAmmo}/{hud.sidearmReserveAmmo}
                    </span>
                  </div>
                  <div className="truncate font-display font-bold text-xs">
                    {hud.sidearmWeapon.name}
                  </div>
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800">
                <div>
                  <div className="text-[10px] font-mono-tabular text-amber-400">
                    {hud.weapon.categoryUz}
                  </div>
                  <div className="text-sm sm:text-base font-display font-bold text-white">
                    {hud.weapon.name}
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`text-2xl sm:text-3xl font-display font-bold font-mono-tabular leading-none ${
                      hud.ammo === 0 ? 'text-rose-400' : 'text-white'
                    }`}
                  >
                    {hud.ammo}
                  </div>
                  <div className="text-[11px] font-mono-tabular text-slate-400 mt-0.5">
                    ZAHIRA: {hud.reserveAmmo}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 4: UZBEK PAUSE MODAL (PAUZA)
         ===================================================================== */}
      {screen === 'paused' && !settingsModalOpen && (
        <div className="absolute inset-0 z-30 bg-slate-950/88 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div>
                <div className="text-[11px] font-mono-tabular text-amber-400">
                  O‘YIN VAQTINCHA TO‘XTATILDI
                </div>
                <h2 className="text-2xl font-display font-bold text-white">
                  TAKTIK QO‘MONDONLIK
                </h2>
              </div>
              <Crosshair className="w-6 h-6 text-amber-400" />
            </div>

            {hud && (
              <div className="grid grid-cols-3 gap-2.5 bg-slate-950 border border-slate-800 rounded-lg p-3 mb-5 text-center font-mono-tabular">
                <div>
                  <div className="text-[10px] text-sky-400">ITTIFOQ</div>
                  <div className="text-lg font-bold text-white">
                    {hud.blueScore}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">VAQT</div>
                  <div className="text-lg font-bold text-amber-400">
                    {formatTime(hud.timeRemaining)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-rose-400">RAQIB</div>
                  <div className="text-lg font-bold text-white">
                    {hud.redScore}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleResumeMatch}
                className="w-full py-3 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>DAVOM ETISH</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenLoadout('primary')}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Swords className="w-4 h-4 text-amber-400" />
                <span>QUROLNI ALMASHTIRISH</span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsModalOpen(true)}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sliders className="w-4 h-4 text-sky-400" />
                <span>SOZLAMALAR</span>
              </button>

              <button
                type="button"
                onClick={handleRestartMatch}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span>BOSHIDAN BOSHLASH</span>
              </button>

              <button
                type="button"
                onClick={() => engineRef.current?.finishMatch()}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trophy className="w-4 h-4 text-emerald-400" />
                <span>JANGNI YAKUNLASH (NATIJALAR)</span>
              </button>

              <button
                type="button"
                onClick={handleReturnToMenu}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-medium text-sm cursor-pointer"
              >
                ASOSIY MENYU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 5: UZBEK SETTINGS MODAL (SOZLAMALAR)
         ===================================================================== */}
      {settingsModalOpen && (
        <div className="absolute inset-0 z-40 bg-slate-950/90 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <div className="text-[11px] font-mono-tabular text-sky-400">
                  TIZIM, SENSOR VA GRAFIKA PARAMETRLARI
                </div>
                <h2 className="text-xl font-display font-bold text-white">
                  SOZLAMALAR
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSettingsModalOpen(false)}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono-tabular text-slate-300 cursor-pointer"
              >
                YOPISH
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Umumiy grafika sifati</span>
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { id: 'low', label: 'PAST' },
                      { id: 'medium', label: 'O‘RTA' },
                      { id: 'high', label: 'YUQORI' },
                    ] as { id: GraphicsQuality; label: string }[]
                  ).map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() =>
                        updateGameSettings({ graphicsQuality: q.id })
                      }
                      className={`px-3 py-1.5 rounded font-semibold cursor-pointer ${
                        settings.graphicsQuality === q.id
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-300">Dinamik soyalar</span>
                <button
                  type="button"
                  onClick={() =>
                    updateGameSettings({ shadows: !settings.shadows })
                  }
                  className={`px-3 py-1.5 rounded font-semibold cursor-pointer ${
                    settings.shadows
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {settings.shadows ? 'YOQILGAN' : 'O‘CHIRILGAN'}
                </button>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">
                    Kamera va sensor sezgirligi
                  </span>
                  <span className="font-mono-tabular text-amber-400">
                    {settings.sensitivity.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="2.5"
                  step="0.1"
                  value={settings.sensitivity}
                  onChange={(e) =>
                    updateGameSettings({
                      sensitivity: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-300">
                  Kamera Y-o‘qini teskari qilish
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateGameSettings({ invertY: !settings.invertY })
                  }
                  className={`px-3 py-1.5 rounded font-semibold cursor-pointer ${
                    settings.invertY
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {settings.invertY ? 'HA' : 'YO‘Q'}
                </button>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">
                    Ko‘rish burchagi (1-shaxs FOV)
                  </span>
                  <span className="font-mono-tabular text-amber-400">
                    {settings.fov}°
                  </span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="95"
                  step="1"
                  value={settings.fov}
                  onChange={(e) =>
                    updateGameSettings({ fov: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-300">AI botlar mahorati</span>
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { id: 'recruit', label: 'Yangi' },
                      { id: 'veteran', label: 'Tajribali' },
                      { id: 'elite', label: 'Elita' },
                    ] as { id: BotDifficulty; label: string }[]
                  ).map((diff) => (
                    <button
                      key={diff.id}
                      type="button"
                      onClick={() =>
                        updateGameSettings({ botDifficulty: diff.id })
                      }
                      className={`px-3 py-1.5 rounded font-semibold cursor-pointer ${
                        settings.botDifficulty === diff.id
                          ? 'bg-sky-400 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {diff.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">Umumiy ovoz balandligi</span>
                  <span className="font-mono-tabular text-amber-400">
                    {Math.round(settings.masterVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.masterVolume}
                  onChange={(e) =>
                    updateGameSettings({
                      masterVolume: parseFloat(e.target.value),
                      soundEnabled: parseFloat(e.target.value) > 0,
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">Effektlar ovozi (SFX)</span>
                  <span className="font-mono-tabular text-amber-400">
                    {Math.round(settings.sfxVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.sfxVolume}
                  onChange={(e) =>
                    updateGameSettings({
                      sfxVolume: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-300">
                  Android sensorli boshqaruv
                </span>
                <div className="flex items-center gap-1.5">
                  {(['auto', 'always', 'off'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() =>
                        updateGameSettings({ touchControlsOrder: mode })
                      }
                      className={`px-2.5 py-1 rounded uppercase font-semibold cursor-pointer ${
                        settings.touchControlsOrder === mode
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {mode === 'auto'
                        ? 'Avto'
                        : mode === 'always'
                        ? 'Doim'
                        : 'O‘chiq'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSettingsModalOpen(false)}
                className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm cursor-pointer"
              >
                SAQLASH VA QAYTISH
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          INFO MODALS (XARITA, BOSHQARUV, O'YIN HAQIDA)
         ===================================================================== */}
      {infoModal !== 'none' && (
        <div className="absolute inset-0 z-40 bg-slate-950/90 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h2 className="text-xl font-display font-bold text-white">
                {infoModal === 'map'
                  ? 'XARITA: G‘ARB FRONTI — TEMIR QISHLOQ (500×500M)'
                  : infoModal === 'controls'
                  ? 'BOSHQARUV TUGMALARI (KOMPYUTER VA ANDROID)'
                  : 'O‘YIN HAQIDA MA’LUMOT'}
              </h2>
              <button
                type="button"
                onClick={() => setInfoModal('none')}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono-tabular text-slate-300 cursor-pointer"
              >
                YOPISH
              </button>
            </div>

            {infoModal === 'map' && hud && (
              <div className="flex flex-col items-center gap-4">
                <Minimap
                  combatants={hud.combatants}
                  objectives={hud.objectives}
                  structures={
                    engineRef.current?.getStructuresSnapshot() ||
                    ARENA_STRUCTURES
                  }
                  reconScanActive={true}
                  expanded={true}
                />
                <p className="text-xs text-slate-300 text-center max-w-lg">
                  Xarita 6 ta bog‘langan taktik hududdan iborat: G‘arbiy mudofaa
                  transheyasi (A), Markaziy vayrona qishloq (B), Shimoliy o‘rmon
                  yo‘li, Janubiy daryo ko‘prigi va Sharqiy sanoat ombori (C).
                </p>
              </div>
            )}

            {infoModal === 'controls' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-mono-tabular">
                {[
                  ['WASD / Chap Joystik', 'Yurish va harakatlanish'],
                  ['Shift / YUGURISH', 'Tezkor yugurish (Sprint)'],
                  ['Probel / SAKRASH', 'Sakrash'],
                  ['C / Ctrl / O‘TIRISH', 'O‘tirish (Crouch)'],
                  ['Sichqoncha Chap / O‘T OCHISH', 'Quvoldan o‘t ochish'],
                  ['Sichqoncha O‘ng / NISHON', '1-shaxs optik nishonga olish'],
                  ['1 va 2 tugmalari', 'Asosiy qurol / To‘pponcha'],
                  ['R / O‘QLASH', '5-bosqichli qayta o‘qlash animatsiyasi'],
                  ['Q / MAXSUS', 'Sinf qobiliyatini yoqish'],
                  ['E / TA’MINOT', 'Nuqtada o‘q-dori va HP to‘ldirish'],
                  ['M / XARITA', 'Katta taktik xarita'],
                  ['F3 tugmasi', 'Texnik diagnostika paneli'],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between bg-slate-950 border border-slate-800 rounded px-3 py-2"
                  >
                    <span className="text-amber-400 font-bold">{k}</span>
                    <span className="text-slate-300">{v}</span>
                  </div>
                ))}
              </div>
            )}

            {infoModal === 'about' && (
              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <p>
                  <strong className="text-white">
                    FRONTLINE: POLYGON ARENA (G‘ARB FRONTI — TEMIR QISHLOQ)
                  </strong>{' '}
                  — Ikkinchi jahon urushi davri atmosferasidan ilhomlangan
                  birinchi shaxs (FPS) jamoaviy taktik shooter o‘yini.
                </p>
                <p>
                  O‘yinda 14 ta asosiy qurol, 6 ta yordamchi to‘pponcha (jami 20
                  ta qurol), 4 ta askar sinfi (Hujumchi, Shifokor, Ta’minotchi,
                  Razvedkachi), to‘liq 1-shaxs qo‘l va o‘qlash animatsiyalari
                  hamda 500×500 o‘lchamli jang maydoni mavjud.
                </p>
                <p>
                  Android telefonlar uchun gorizontal (landshaft) ko‘p barmoqli
                  sensor boshqaruvi hamda kompyuter uchun klaviatura va
                  sichqoncha boshqaruvi to‘liq qo‘llab-quvvatlanadi.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 6: FINAL RESULTS SCREEN (YAKUNIY NATIJALAR)
         ===================================================================== */}
      {screen === 'results' && hud && (
        <div className="absolute inset-0 z-30 bg-slate-950/92 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl my-auto">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <Trophy
                  className={`w-9 h-9 ${
                    hud.blueScore >= hud.redScore
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                />
                <div>
                  <div className="text-xs font-mono-tabular text-slate-400">
                    JANG YAKUNI HISOBOTI · G‘ARB FRONTI — TEMIR QISHLOQ
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-display font-bold text-white">
                    {hud.blueScore >= hud.redScore
                      ? 'G‘ALABA! HUDUDLAR QO‘LGA OLINDI'
                      : 'MAG‘LUBIYAT! CHIZIQ BOY BERILDI'}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-4 font-mono-tabular">
                <div className="text-right">
                  <div className="text-[10px] text-sky-400">ITTIFOQ (KO‘K)</div>
                  <div className="text-2xl font-bold text-white">
                    {hud.blueScore}
                  </div>
                </div>
                <span className="text-slate-600 text-xl font-bold">:</span>
                <div className="text-left">
                  <div className="text-[10px] text-rose-400">RAQIB (QIZIL)</div>
                  <div className="text-2xl font-bold text-white">
                    {hud.redScore}
                  </div>
                </div>
              </div>
            </div>

            {playerStats && (
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 mb-5 text-xs font-mono-tabular">
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                  <div className="text-[10px] text-slate-400">DAVOMIYLIGI</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {formatTime(hud.matchElapsed)}
                  </div>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                  <div className="text-[10px] text-slate-400">ASKAR SINFI</div>
                  <div className="text-sm font-bold text-sky-400 mt-0.5">
                    {hud.soldierClass.nameUz}
                  </div>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                  <div className="text-[10px] text-slate-400">ASOSIY QUROL</div>
                  <div className="text-sm font-bold text-amber-400 truncate mt-0.5">
                    {hud.primaryWeapon.name}
                  </div>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                  <div className="text-[10px] text-slate-400">TO‘PPONCHA</div>
                  <div className="text-sm font-bold text-slate-200 truncate mt-0.5">
                    {hud.sidearmWeapon.name}
                  </div>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                  <div className="text-[10px] text-slate-400">
                    ZARARSIZLANTIRILDI
                  </div>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5">
                    {playerStats.kills} ta
                  </div>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                  <div className="text-[10px] text-slate-400">
                    EGALLANGAN NUQTA / BALL
                  </div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {playerStats.captures} / {playerStats.score}
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto max-h-[260px] overflow-y-auto rounded-lg border border-slate-800 mb-6">
              <table className="w-full text-left border-collapse text-xs font-mono-tabular">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">ASKAR</th>
                    <th className="py-2.5 px-3">GURUH</th>
                    <th className="py-2.5 px-3">QUROL</th>
                    <th className="py-2.5 px-3 text-right">BALL</th>
                    <th className="py-2.5 px-3 text-right">ZARBA</th>
                    <th className="py-2.5 px-3 text-right">YO‘QOTISH</th>
                    <th className="py-2.5 px-3 text-right">NUQTALAR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {[...hud.combatants]
                    .sort((a, b) => b.score - a.score || b.kills - a.kills)
                    .map((c) => (
                      <tr
                        key={c.id}
                        className={
                          c.isPlayer
                            ? 'bg-amber-500/15 text-white font-semibold'
                            : 'text-slate-300'
                        }
                      >
                        <td className="py-2 px-3">{c.name}</td>
                        <td className="py-2 px-3">
                          <span
                            className={
                              c.team === 'blue'
                                ? 'text-sky-400'
                                : 'text-rose-400'
                            }
                          >
                            {c.team === 'blue' ? 'ITTIFOQ' : 'RAQIB'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-400">
                          {WEAPONS[c.weapon].name}
                        </td>
                        <td className="py-2 px-3 text-right">{c.score}</td>
                        <td className="py-2 px-3 text-right">{c.kills}</td>
                        <td className="py-2 px-3 text-right">{c.deaths}</td>
                        <td className="py-2 px-3 text-right">{c.captures}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleReturnToMenu}
                className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm cursor-pointer"
              >
                ASOSIY MENYU
              </button>
              <button
                type="button"
                onClick={handleRestartMatch}
                className="px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>QAYTA O‘YNASH</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
