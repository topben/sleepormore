import { describe, expect, it } from 'vitest';
import type { CharacterState, GameState, Posture, Role } from '../src/game/types';
import {
  aimEuler,
  ARM_LEN as HAND_REACH,
  ARM_PILLOW_CUDDLE,
  ARM_PILLOW_LIFT,
  basePose,
  reachArm,
  EMBRACE_ARM,
  LIMB_NAMES,
  resolvePose,
  RIG,
  ROLL,
  SPOON_ARM,
  type Euler3,
  type Pose,
} from '../src/scene/postures';
import { Tweens, wrapAngle } from '../src/scene/tween';

const H = Math.PI / 2;

function char(role: Role, posture: Posture, lateral: number): CharacterState {
  return {
    role,
    goal: 'sleep',
    posture,
    eyes: 'open',
    lateral,
    sleep: 0,
    mood: 60,
    annoyance: 0,
    warmth: 60,
    restless: 0,
    lastAction: null,
  };
}

function mk(opts: {
  male?: Posture;
  female?: Posture;
  mLat?: number;
  fLat?: number;
  embrace?: boolean;
  offered?: boolean;
  inUse?: boolean;
}): GameState {
  return {
    turn: 0,
    playerRole: 'male',
    chars: {
      male: char('male', opts.male ?? 'supine', opts.mLat ?? -0.35),
      female: char('female', opts.female ?? 'supine', opts.fLat ?? 0.35),
    },
    blanketOffset: 0,
    intimacy: 10,
    embrace: opts.embrace ?? false,
    armPillow: { offered: opts.offered ?? false, inUse: opts.inUse ?? false, numbness: 0 },
    sleepScore: 0,
    ending: null,
    seed: 1,
    memo: {} as GameState['memo'],
  };
}

// ── 迷你旋轉數學(與 three.js Euler 'XYZ' 相同:R = Rx·Ry·Rz)──
type V3 = [number, number, number];
function rotXYZ([a, b, c]: Euler3, [x, y, z]: V3): V3 {
  // Rz
  let x1 = x * Math.cos(c) - y * Math.sin(c);
  let y1 = x * Math.sin(c) + y * Math.cos(c);
  let z1 = z;
  // Ry
  const x2 = x1 * Math.cos(b) + z1 * Math.sin(b);
  const z2 = -x1 * Math.sin(b) + z1 * Math.cos(b);
  x1 = x2;
  z1 = z2;
  // Rx
  const y3 = y1 * Math.cos(a) - z1 * Math.sin(a);
  const z3 = y1 * Math.sin(a) + z1 * Math.cos(a);
  return [x1, y3, z3];
}
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

const ARM_PIVOT: Record<'armL' | 'armR', V3> = { armL: [0.2, 0.65, 0.06], armR: [-0.2, 0.65, 0.06] };
const ARM_LEN = 0.52;

/** 手臂末端的世界座標(root rotation = (−π/2, roll, 0)) */
function armTip(pose: Pose, lateral: number, arm: 'armL' | 'armR'): V3 {
  const local = add(ARM_PIVOT[arm], rotXYZ(pose.limbs[arm], [0, -ARM_LEN, 0]));
  const world = rotXYZ([RIG.lyingPitch, pose.roll, 0], local);
  return add([lateral * RIG.lateralScale, RIG.rootY + pose.rootYOffset, RIG.rootZ], world);
}

describe('basePose', () => {
  it('supine:roll 0,手臂微外展', () => {
    for (const r of ['male', 'female'] as Role[]) {
      const p = basePose(r, 'supine');
      expect(p.roll).toBe(0);
      expect(p.limbs.armL).toEqual([0, 0, 0.25]);
      expect(p.limbs.armR).toEqual([0, 0, -0.25]);
      expect(p.limbs.legL).toEqual([0, 0, 0.08]);
      expect(p.limbs.head).toEqual([0, 0, 0]);
      expect(p.rootYOffset).toBe(0);
    }
  });

  it('roll 表:男 sideFacing 臉朝 +x、女 sideFacing 臉朝 −x', () => {
    expect(ROLL.male.sideFacing).toBeCloseTo(H);
    expect(ROLL.female.sideFacing).toBeCloseTo(-H);
    expect(ROLL.male.sideAway).toBeCloseTo(-H);
    expect(ROLL.female.sideAway).toBeCloseTo(H);
    expect(ROLL.male.prone).toBeCloseTo(Math.PI);
    // 臉(局部 +z)在世界的 x 分量 = sin(roll)
    expect(Math.sin(ROLL.male.sideFacing)).toBeGreaterThan(0.99);
    expect(Math.sin(ROLL.female.sideFacing)).toBeLessThan(-0.99);
  });

  it('側躺:哪一側在下決定肢體表(兩角色共用)', () => {
    const m = basePose('male', 'sideFacing'); // roll > 0 → L 在下
    expect(m.limbs.armL).toEqual([-1.3, 0, 0.2]);
    expect(m.limbs.armR).toEqual([-1.0, 0, -0.1]);
    expect(m.limbs.legR).toEqual([-0.6, 0, -0.05]);
    expect(m.limbs.head).toEqual([0.1, 0, 0]);
    const f = basePose('female', 'sideFacing'); // roll < 0 → R 在下
    expect(f.limbs.armR).toEqual([-1.3, 0, -0.2]);
    expect(f.limbs.armL).toEqual([-1.0, 0, 0.1]);
    expect(f.limbs.legL).toEqual([-0.6, 0, 0.05]);
    // male sideAway 與 female sideFacing 同一張表
    expect(basePose('male', 'sideAway').limbs).toEqual(f.limbs);
    expect(basePose('female', 'sideAway').limbs).toEqual(m.limbs);
  });

  it('趴睡:仙人掌手,頭轉向對方', () => {
    const m = basePose('male', 'prone');
    expect(m.limbs.armL).toEqual([0, 0, 2.3]);
    expect(m.limbs.armR).toEqual([0, 0, -2.3]);
    expect(m.limbs.head).toEqual([0, -1.1, 0]);
    expect(basePose('female', 'prone').limbs.head).toEqual([0, 1.1, 0]);
  });
});

describe('resolvePose 疊加規則', () => {
  it('沒有 embrace / armPillow → 等於 basePose', () => {
    const s = mk({ male: 'sideFacing', female: 'sideAway' });
    expect(resolvePose('male', s)).toEqual(basePose('male', 'sideFacing'));
    expect(resolvePose('female', s)).toEqual(basePose('female', 'sideAway'));
  });

  it('面對面擁抱:兩人上臂擺抱姿,手越過對方軀幹上方、z 錯開', () => {
    const s = mk({ male: 'sideFacing', female: 'sideFacing', mLat: -0.15, fLat: 0.15, embrace: true });
    const m = resolvePose('male', s);
    const f = resolvePose('female', s);
    expect(m.limbs.armR).toEqual(EMBRACE_ARM.male);
    expect(f.limbs.armL).toEqual(EMBRACE_ARM.female);
    // 下臂不變
    expect(m.limbs.armL).toEqual(basePose('male', 'sideFacing').limbs.armL);
    expect(f.limbs.armR).toEqual(basePose('female', 'sideFacing').limbs.armR);

    const mh = armTip(m, -0.15, 'armR');
    const fh = armTip(f, 0.15, 'armL');
    // 男方的手越過她身體中心、搭在她背上(不壓進她的 torso:她的 torso 在該處表面高度以上)
    const surf = (dx: number) => RIG.rootY + Math.sqrt(Math.max(0, 0.17 ** 2 - dx ** 2));
    expect(mh[0]).toBeGreaterThan(0.15 * RIG.lateralScale);
    expect(mh[1]).toBeGreaterThan(surf(mh[0] - 0.15 * RIG.lateralScale) - 0.03);
    // 女方的手越過他身體中心、搭在他肩背
    expect(fh[0]).toBeLessThan(-0.15 * RIG.lateralScale);
    expect(fh[1]).toBeGreaterThan(surf(fh[0] + 0.15 * RIG.lateralScale) - 0.03);
    // 兩手都在肩膀以下(不橫過臉:頭在 z −0.88..−0.52),z 錯開 >= 0.15 避免中線互穿
    expect(mh[2]).toBeGreaterThan(-0.45);
    expect(fh[2]).toBeGreaterThan(-0.45);
    expect(Math.abs(mh[2] - fh[2])).toBeGreaterThanOrEqual(0.15);
  });

  it('湯匙式:對方 sideAway → 抱的人上臂環過對方腰側,被抱者肢體不變', () => {
    const s = mk({ male: 'sideFacing', female: 'sideAway', mLat: -0.15, fLat: 0.15, embrace: true });
    const m = resolvePose('male', s);
    expect(m.limbs.armR).toEqual(SPOON_ARM.male);
    expect(resolvePose('female', s)).toEqual(basePose('female', 'sideAway'));
    const tip = armTip(m, -0.15, 'armR');
    expect(tip[0]).toBeGreaterThan(0.15 * RIG.lateralScale); // 越過她
    expect(tip[2]).toBeGreaterThan(-0.3); // 腰側,不是脖子
    const s2 = mk({ male: 'sideAway', female: 'sideFacing', embrace: true });
    expect(resolvePose('female', s2).limbs.armL).toEqual(SPOON_ARM.female);
    expect(resolvePose('male', s2)).toEqual(basePose('male', 'sideAway'));
  });

  it('手臂枕(仰躺):armL 朝她、貼著枕頭,末端從她頭下穿過', () => {
    const s = mk({ male: 'supine', female: 'sideFacing', fLat: 0.15, offered: true });
    const m = resolvePose('male', s);
    expect(m.limbs.armL).toEqual([-0.33, 0, 2.2]);
    expect(resolvePose('female', s).rootYOffset).toBe(0); // 只 offered,還沒枕上
    const tip = armTip(m, -0.35, 'armL');
    expect(tip[0]).toBeCloseTo(0.24, 1); // 規格:x ≈ +0.24
    expect(tip[2]).toBeCloseTo(-0.76, 1); // 規格:z ≈ −0.76
    // 她的頭心 x≈0.165、z=−0.70:手臂末端在頭的半徑(0.15)內
    const headX = 0.15 * RIG.lateralScale;
    const headZ = RIG.rootZ - 0.9;
    expect(Math.hypot(tip[0] - headX, tip[2] - headZ)).toBeLessThan(0.15);
    // 貼在枕頭上(枕頭頂 0.65,手臂半徑 0.06),比她抬高後的頭心(0.74+0.05)低 → 在頭下面
    expect(tip[1]).toBeGreaterThan(0.65);
    expect(tip[1]).toBeLessThan(RIG.rootY + ARM_PILLOW_LIFT - 0.05);
  });

  it('手臂枕(側躺面向):在下那隻 armL 貼床朝她;inUse → 女方頭墊高 +0.05', () => {
    const s = mk({ male: 'sideFacing', female: 'sideFacing', fLat: 0.15, offered: true, inUse: true });
    const m = resolvePose('male', s);
    expect(m.limbs.armL).toEqual([-H - 0.35, 0, -0.3]);
    expect(m.limbs.armR).toEqual(basePose('male', 'sideFacing').limbs.armR);
    const f = resolvePose('female', s);
    expect(f.rootYOffset).toBe(ARM_PILLOW_LIFT);
    // 只有上面那隻手改成搭在他胸口,其餘肢體不變
    expect(f.limbs).toEqual({ ...basePose('female', 'sideFacing').limbs, armL: ARM_PILLOW_CUDDLE });
    const hand = armTip(f, 0.15, 'armL');
    expect(hand[0]).toBeLessThan(-0.15); // 越過中線搭到他身上
    expect(hand[2]).toBeGreaterThan(-0.2); // 在胸口(棉被邊緣),不是在臉前
    const tip = armTip(m, -0.35, 'armL');
    expect(tip[0]).toBeGreaterThan(0); // 伸向她那側
    expect(tip[2]).toBeLessThan(-0.5); // 偏向床頭
    expect(tip[1]).toBeGreaterThan(0.62); // 擱在枕頭面上(枕頭頂 0.65),不是埋在枕頭裡
  });

  it('embrace 與 inUse 並存:上臂抱、下臂當枕頭', () => {
    const s = mk({ male: 'sideFacing', female: 'sideFacing', mLat: -0.15, fLat: 0.15, embrace: true, offered: true, inUse: true });
    const m = resolvePose('male', s);
    expect(m.limbs.armR).toEqual(EMBRACE_ARM.male);
    expect(m.limbs.armL).toEqual([-H - 0.35, 0, -0.3]);
    const f = resolvePose('female', s);
    expect(f.limbs.armL).toEqual(EMBRACE_ARM.female);
    expect(f.rootYOffset).toBe(ARM_PILLOW_LIFT);
  });

  it('不可能的組合(男方 sideAway / prone 還 offered)→ 不覆寫手臂', () => {
    for (const p of ['sideAway', 'prone'] as Posture[]) {
      const s = mk({ male: p, offered: true });
      expect(resolvePose('male', s)).toEqual(basePose('male', p));
    }
  });

  it('supine 的角色不會擺抱姿', () => {
    const s = mk({ male: 'supine', female: 'sideFacing', embrace: true });
    expect(resolvePose('male', s)).toEqual(basePose('male', 'supine'));
  });

  it('純函式:每次回傳新陣列,改結果不影響下一次', () => {
    const s = mk({ male: 'sideFacing', female: 'sideFacing', embrace: true, offered: true });
    const a = resolvePose('male', s);
    a.limbs.armL[0] = 99;
    a.limbs.head[1] = 99;
    const b = resolvePose('male', s);
    expect(b.limbs.armL[0]).toBeCloseTo(-H - 0.35);
    expect(b.limbs.armL[2]).toBeCloseTo(-0.3);
    expect(b.limbs.head[1]).toBe(0);
    expect(basePose('male', 'sideFacing').limbs.armL[0]).toBe(-1.3);
  });

  it('所有組合都回傳有限數字', () => {
    const postures: Posture[] = ['supine', 'sideFacing', 'sideAway', 'prone'];
    for (const mp of postures)
      for (const fp of postures)
        for (const embrace of [false, true])
          for (const inUse of [false, true]) {
            const s = mk({ male: mp, female: fp, embrace, offered: inUse, inUse });
            for (const r of ['male', 'female'] as Role[]) {
              const p = resolvePose(r, s);
              expect(Number.isFinite(p.roll)).toBe(true);
              expect(Number.isFinite(p.rootYOffset)).toBe(true);
              for (const l of LIMB_NAMES) for (const v of p.limbs[l]) expect(Number.isFinite(v)).toBe(true);
            }
          }
  });
});

describe('Tweens(SCENE-RIG §4)', () => {
  const run = (tw: Tweens, sec: number, dt = 1 / 60) => {
    for (let t = 0; t < sec - 1e-9; t += dt) tw.update(dt);
  };

  it('easeInOutCubic:到時間就到位,中途在兩端之間', () => {
    const tw = new Tweens();
    tw.snap('a', 0);
    tw.set('a', 1, 0.8);
    run(tw, 0.4);
    expect(tw.get('a')).toBeCloseTo(0.5, 1);
    run(tw, 0.45);
    expect(tw.get('a')).toBe(1);
  });

  it('angular 走最短路徑;noWrap 照給定值整圈翻滾', () => {
    const tw = new Tweens();
    tw.snap('r', 3);
    tw.set('r', -3, 0.5, { angular: true }); // 最短路徑 = 往上跨過 π,不是倒退 6 rad
    run(tw, 0.6);
    expect(tw.get('r')).toBeCloseTo(-3 + 2 * Math.PI, 5);
    expect(wrapAngle(tw.get('r') - -3)).toBeCloseTo(0, 5);
    tw.snap('k', 0.5);
    tw.set('k', 0.5 - 2 * Math.PI, 1.2, { angular: true, noWrap: true });
    run(tw, 0.6);
    expect(tw.get('k')).toBeLessThan(-2); // 真的在轉,不是原地不動
    run(tw, 0.7);
    expect(tw.get('k')).toBeCloseTo(0.5 - 2 * Math.PI, 5);
  });

  it('timid:做到一半停頓 hesitate 秒再完成', () => {
    const tw = new Tweens();
    tw.snap('x', 0);
    tw.set('x', 1, 1.1, { hesitate: 0.15 });
    run(tw, 0.56);
    const mid = tw.get('x');
    expect(mid).toBeCloseTo(0.5, 2);
    run(tw, 0.12);
    expect(tw.get('x')).toBeCloseTo(mid, 5); // 停住
    run(tw, 0.6);
    expect(tw.get('x')).toBe(1);
  });

  it('outBack 會過衝再回到目標', () => {
    const tw = new Tweens();
    tw.snap('x', 0);
    tw.set('x', 1, 0.3, { ease: 'outBack', overshoot: 2 });
    let peak = 0;
    for (let i = 0; i < 30; i++) {
      tw.update(0.01);
      peak = Math.max(peak, tw.get('x'));
    }
    expect(peak).toBeGreaterThan(1.05);
    expect(tw.get('x')).toBe(1);
  });

  it('dur 0 = 立刻到位,即使正在補間中', () => {
    const tw = new Tweens();
    tw.snap('x', 0);
    tw.set('x', 1, 1);
    tw.update(0.2);
    tw.set('x', 1, 0);
    expect(tw.get('x')).toBe(1);
    expect(tw.chan('x').active).toBe(false);
  });
});

describe('reaching (rubber-hose arms)', () => {
  it('aimEuler points a resting arm (−y) along any direction', () => {
    const dirs: V3[] = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0.55, -0.22, 0.2],
      [-0.3, 0.6, 0.5],
      [0.2, -0.9, -0.4],
    ];
    for (const d of dirs) {
      const len = Math.hypot(...d);
      const got = rotXYZ(aimEuler(...d), [0, -1, 0]);
      for (let i = 0; i < 3; i++) expect(got[i]).toBeCloseTo(d[i] / len, 6);
    }
  });

  it('reachArm stretches the hose to the target, within limits', () => {
    const near = reachArm('armL', 0.2, 0.65 - HAND_REACH, 0.06); // 剛好一隻手臂長(肩 → 手心)
    expect(near.stretch).toBeCloseTo(1, 6);
    expect(reachArm('armL', 2, 0.65, 0.06).stretch).toBe(1.45); // 太遠:拉長到上限
    expect(reachArm('armR', -0.2, 0.6, 0.06).stretch).toBe(0.75); // 太近:最短
  });
});
