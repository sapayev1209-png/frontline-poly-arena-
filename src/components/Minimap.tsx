import React, { useEffect, useRef } from 'react';
import { ARENA_HALF_SIZE } from '../game/mapData';
import {
  CombatantStats,
  ObjectiveState,
  StructureCollider,
} from '../types/game';

interface MinimapProps {
  combatants: CombatantStats[];
  objectives: ObjectiveState[];
  structures: StructureCollider[];
  reconScanActive?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export const Minimap: React.FC<MinimapProps> = ({
  combatants,
  objectives,
  structures,
  reconScanActive = false,
  expanded = false,
  onToggleExpand,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const size = expanded ? 480 : 168;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const scale = w / (ARENA_HALF_SIZE * 2);

    const toMapX = (wx: number) => (wx + ARENA_HALF_SIZE) * scale;
    const toMapY = (wz: number) => (wz + ARENA_HALF_SIZE) * scale;

    ctx.clearRect(0, 0, w, h);

    // 1. Wartime Olive-Slate Map Background
    ctx.fillStyle = 'rgba(15, 23, 20, 0.94)';
    ctx.fillRect(0, 0, w, h);

    // 2. Northern Woodland Region Tint
    ctx.fillStyle = 'rgba(22, 101, 52, 0.22)';
    ctx.fillRect(0, 0, w, toMapY(-80));

    // 3. Southern River Channel & Crossing Bridge/Ford
    const riverY = toMapY(104);
    const riverH = 32 * scale;
    ctx.fillStyle = 'rgba(14, 116, 144, 0.45)';
    ctx.fillRect(0, riverY, w, riverH);

    // Stone Bridge at x in [-11, 11]
    ctx.fillStyle = '#a8a29e';
    ctx.fillRect(toMapX(-11), toMapY(96), 22 * scale, 48 * scale);

    // Eastern Ford at x in [92, 118]
    ctx.fillStyle = 'rgba(168, 162, 158, 0.45)';
    ctx.fillRect(toMapX(92), toMapY(102), 26 * scale, 36 * scale);

    // 4. Main Road Network & Western Trench Lines
    ctx.strokeStyle = 'rgba(120, 113, 108, 0.45)';
    ctx.lineWidth = Math.max(2, 12 * scale);
    ctx.beginPath();
    // E-W main road
    ctx.moveTo(toMapX(-165), toMapY(52));
    ctx.lineTo(toMapX(-112), toMapY(-12));
    ctx.lineTo(toMapX(0), toMapY(0));
    ctx.lineTo(toMapX(116), toMapY(16));
    ctx.lineTo(toMapX(165), toMapY(-52));
    // N-S Bridge road
    ctx.moveTo(toMapX(0), toMapY(-30));
    ctx.lineTo(toMapX(0), toMapY(155));
    ctx.stroke();

    // Western Trench Network lines
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.55)';
    ctx.lineWidth = Math.max(1.5, 4.5 * scale);
    ctx.beginPath();
    ctx.moveTo(toMapX(-126), toMapY(-52));
    ctx.lineTo(toMapX(-126), toMapY(48));
    ctx.moveTo(toMapX(-162), toMapY(-12));
    ctx.lineTo(toMapX(-84), toMapY(-12));
    ctx.stroke();

    // 5. Tactical Grid Lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.lineWidth = 1;
    const step = w / 6;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * step);
      ctx.lineTo(w, i * step);
      ctx.stroke();
    }

    // 6. Active Structures & Landmarks
    for (const s of structures) {
      if (s.destroyed) continue;
      const rx = toMapX(s.x - s.width * 0.5);
      const ry = toMapY(s.z - s.depth * 0.5);
      const rw = Math.max(2, s.width * scale);
      const rh = Math.max(2, s.depth * scale);

      ctx.fillStyle =
        s.type === 'tree_trunk'
          ? 'rgba(34, 197, 94, 0.55)'
          : s.type === 'village_house' || s.type === 'ruined_hall' || s.type === 'warehouse'
          ? 'rgba(180, 83, 9, 0.85)'
          : 'rgba(100, 116, 139, 0.85)';
      ctx.fillRect(rx, ry, rw, rh);
    }

    // 7. Team Base Spawn Markers (HQ)
    ctx.font = `${expanded ? 11 : 8}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('HQ-KO‘K', toMapX(-162), toMapY(72));
    ctx.fillStyle = '#f87171';
    ctx.fillText('HQ-QIZIL', toMapX(162), toMapY(-72));

    // 8. Objectives A, B, C
    for (const obj of objectives) {
      const ox = toMapX(obj.x);
      const oy = toMapY(obj.z);
      const orad = Math.max(8, obj.radius * scale * 1.35);

      const color =
        obj.owner === 'blue'
          ? '#38bdf8'
          : obj.owner === 'red'
          ? '#f87171'
          : '#cbd5e1';

      ctx.save();
      ctx.beginPath();
      ctx.arc(ox, oy, orad, 0, Math.PI * 2);
      ctx.fillStyle =
        obj.owner === 'blue'
          ? 'rgba(56, 189, 248, 0.22)'
          : obj.owner === 'red'
          ? 'rgba(248, 113, 113, 0.22)'
          : 'rgba(148, 163, 184, 0.16)';
      ctx.fill();
      ctx.lineWidth = obj.contested ? 2.2 : 1.5;
      ctx.strokeStyle = obj.contested ? '#f59e0b' : color;
      ctx.stroke();

      // Capture progress arc
      if (Math.abs(obj.progress) > 1) {
        const frac = Math.min(1, Math.abs(obj.progress) / 100);
        ctx.beginPath();
        ctx.arc(
          ox,
          oy,
          orad + 2.5,
          -Math.PI / 2,
          -Math.PI / 2 + frac * Math.PI * 2
        );
        ctx.strokeStyle = obj.progress >= 0 ? '#38bdf8' : '#f87171';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${expanded ? 13 : 10}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(obj.id, ox, oy);
      ctx.restore();
    }

    // 9. Region Labels when Expanded (M key)
    if (expanded) {
      ctx.fillStyle = 'rgba(226, 232, 240, 0.55)';
      ctx.font = '600 11px "Chakra Petch", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SHIMOLIY O‘RMON YO‘LI', toMapX(0), toMapY(-150));
      ctx.fillText('G‘ARBIY TRANSHEYA', toMapX(-135), toMapY(-55));
      ctx.fillText('TEMIR QISHLOQ', toMapX(0), toMapY(-46));
      ctx.fillText('SHARQIY SANOAT OMBORI', toMapX(135), toMapY(62));
      ctx.fillText('JANUBIY DARYO KO‘PRIGI', toMapX(0), toMapY(134));
    }

    // 10. Combatants (Allies always visible; Hostiles visible within 115m of any ally or during Recon Scan)
    const player = combatants.find((c) => c.isPlayer);
    const allies = combatants.filter((c) => c.alive && c.team === 'blue');

    for (const c of combatants) {
      if (!c.alive || c.isPlayer) continue;

      if (c.team === 'red' && !reconScanActive) {
        let spotted = false;
        for (const ally of allies) {
          const dSq =
            (ally.x - c.x) * (ally.x - c.x) + (ally.z - c.z) * (ally.z - c.z);
          if (dSq <= 125 * 125) {
            spotted = true;
            break;
          }
        }
        if (!spotted) continue;
      }

      const cx = toMapX(c.x);
      const cy = toMapY(c.z);

      ctx.beginPath();
      ctx.arc(cx, cy, expanded ? 5 : 3.2, 0, Math.PI * 2);
      ctx.fillStyle = c.team === 'blue' ? '#38bdf8' : '#ef4444';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#020617';
      ctx.stroke();
    }

    // 11. Player Position & Directional View Cone
    if (player && player.alive) {
      const px = toMapX(player.x);
      const py = toMapY(player.z);
      const dirAngle = Math.atan2(-Math.cos(player.yaw), -Math.sin(player.yaw));

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, expanded ? 42 : 22, dirAngle - 0.45, dirAngle + 0.45);
      ctx.closePath();
      ctx.fillStyle = 'rgba(245, 158, 11, 0.26)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, expanded ? 6 : 4.2, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();
    }
  }, [combatants, objectives, structures, reconScanActive, expanded, size]);

  return (
    <div className="relative bg-slate-950/92 border border-slate-700/80 rounded-lg p-1.5 shadow-xl select-none">
      <div className="flex items-center justify-between text-[10px] font-mono-tabular text-slate-300 px-1 pb-1 gap-2">
        <span className="text-amber-400 font-semibold">
          {expanded ? 'G‘ARB FRONTI — TEMIR QISHLOQ (500×500M)' : 'TAKTIK XARITA'}
        </span>
        {onToggleExpand && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
          >
            [M] {expanded ? 'YOPISH' : 'KATTA'}
          </button>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        onClick={onToggleExpand}
        title="Kattalashtirish uchun bosing (M)"
        className={`block rounded border border-slate-800 cursor-pointer ${
          expanded
            ? 'w-[310px] h-[310px] sm:w-[460px] sm:h-[460px]'
            : 'w-[128px] h-[128px] sm:w-[164px] sm:h-[164px]'
        }`}
      />
      <div className="flex items-center justify-between text-[10px] font-mono-tabular text-slate-400 px-1 pt-1">
        <span className="text-sky-400">● ITTIFOQ</span>
        <span className="text-amber-400">▲ SIZ</span>
        <span className="text-rose-400">● RAQIB</span>
      </div>
    </div>
  );
};
