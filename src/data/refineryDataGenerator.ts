/**
 * 炼油化工设备内部巡检网络数据生成器
 *
 * 核心设备（蛇形机器人深入内部巡检）：
 * 1. 管壳式换热器 (Shell-and-tube Heat Exchanger)
 * 2. 加热炉/锅炉 (Fired Heater) — 辐射段/对流段炉管
 * 3. 蒸馏塔 (Distillation Column) — 螺旋通道/降液管/抽出管
 *
 * 应用场景：常规和紧急检查，无需昂贵的关闭（在线内检）
 * 机器人类型：蛇形（多关节柔性体，穿越狭窄管内通道）
 */

import type { Fracture, FractureNode, SensorReading } from '../types';

let _seed = 99;
function sr(): number { _seed = (_seed * 16807) % 2147483647; return _seed / 2147483647; }
function rand(min: number, max: number): number { return min + sr() * (max - min); }
function randInt(min: number, max: number): number { return Math.floor(rand(min, max + 1)); }
function pick<T>(arr: T[]): T { return arr[Math.floor(sr() * arr.length)]; }
function r1(v: number): number { return Math.round(v * 10) / 10; }

const CHANNEL_SPECS = {
  heater_tube: { diameter_mm: [100, 168], wall_thickness_mm: [8, 18], operating_temp_c: [400, 750], operating_pressure_mpa: [2, 12], corrosion_rate_mmyear: [0.1, 0.8], material: ['Incoloy 800H', 'P9 Cr9Mo', 'P22 Cr2Mo'], yield_strength_mpa: [170, 450], design_temp_c: [550, 850] },
  exchanger_tube: { diameter_mm: [19, 32], wall_thickness_mm: [2, 3.5], operating_temp_c: [60, 320], operating_pressure_mpa: [0.5, 6], corrosion_rate_mmyear: [0.05, 0.4], material: ['SA-179', 'SS304', 'SS316L'], yield_strength_mpa: [180, 380], design_temp_c: [150, 400] },
  exchanger_shell: { diameter_mm: [600, 1200], wall_thickness_mm: [12, 30], operating_temp_c: [80, 350], operating_pressure_mpa: [0.3, 4], corrosion_rate_mmyear: [0.03, 0.25], material: ['SA-516 Gr.70', 'SA-106 Gr.C'], yield_strength_mpa: [260, 380], design_temp_c: [200, 450] },
  column_internal: { diameter_mm: [80, 400], wall_thickness_mm: [4, 12], operating_temp_c: [80, 380], operating_pressure_mpa: [0.1, 3], corrosion_rate_mmyear: [0.05, 0.5], material: ['SS304', 'SS316L', 'SA-516 Gr.70'], yield_strength_mpa: [205, 410], design_temp_c: [120, 420] },
  process_pipe: { diameter_mm: [150, 600], wall_thickness_mm: [6, 20], operating_temp_c: [100, 420], operating_pressure_mpa: [0.5, 8], corrosion_rate_mmyear: [0.05, 0.35], material: ['SA-106 Gr.C', 'P11', 'SS316L'], yield_strength_mpa: [240, 420], design_temp_c: [200, 500] },
} as const;
type ChannelClass = keyof typeof CHANNEL_SPECS;

function genRefinerySensorReading(cc: ChannelClass): SensorReading {
  const s = CHANNEL_SPECS[cc];
  const wt = +rand(...s.wall_thickness_mm).toFixed(1);
  const temp = +rand(...s.operating_temp_c).toFixed(1);
  const pres = +rand(...s.operating_pressure_mpa).toFixed(2);
  const corr = +rand(...s.corrosion_rate_mmyear).toFixed(3);
  const dtemp = +rand(...s.design_temp_c).toFixed(0);
  const thinning = +(corr * rand(3, 15)).toFixed(1);
  const creep = cc === 'heater_tube' ? +rand(500, 12000).toFixed(0) : +rand(0, 200).toFixed(0);
  const scale = (cc === 'exchanger_tube' || cc === 'exchanger_shell') ? +rand(0.1, 4.5).toFixed(2) : +rand(0, 0.8).toFixed(2);
  const vib = randInt(2, 55);
  const ae = randInt(0, 6000);
  const leak = +(sr() > 0.88 ? rand(3, 28) : rand(0, 2)).toFixed(1);
  const h2s = +(sr() > 0.6 ? rand(10, 800) : rand(0, 40)).toFixed(0);
  const co = +(cc === 'heater_tube' && sr() > 0.7 ? rand(20, 150) : rand(0, 12)).toFixed(0);
  return {
    ch4_pct: leak, co_ppm: co, h2s_ppm: h2s, temperature_c: temp,
    stress_mpa: pres, stress_sigma1: +rand(30, 88).toFixed(0), stress_sigma2: scale, stress_sigma3: dtemp,
    permeability_md: corr, water_pressure_mpa: +rand(0.01, 0.5).toFixed(2), microseismic_count: vib,
    acoustic_emission_mv: ae, humidity_pct: +rand(50, 98).toFixed(1), fracture_aperture_um: Math.round(wt * 1000),
    displacement_mm: +rand(0, 12).toFixed(1), rock_strength_mpa: thinning, pore_pressure_mpa: +rand(0.05, 0.3).toFixed(2),
    porosity_pct: +(100 - thinning).toFixed(1), fluid_ph: +rand(4.5, 9.0).toFixed(1), water_saturation_pct: creep / 100,
  };
}

function hPath(s: [number, number, number], e: [number, number, number], segs = 10): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= segs; i++) { const t = i / segs; const sag = Math.sin(t * Math.PI) * 0.3;
    pts.push([r1(s[0]+(e[0]-s[0])*t), r1(s[1]+(e[1]-s[1])*t-sag), r1(s[2]+(e[2]-s[2])*t)]); }
  return pts;
}
function vPath(b: [number, number, number], top: [number, number, number], segs = 10): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= segs; i++) { const t = i / segs; const sw = Math.sin(t * Math.PI * 2) * 0.2;
    pts.push([r1(b[0]+(top[0]-b[0])*t+sw), r1(b[1]+(top[1]-b[1])*t), r1(b[2]+(top[2]-b[2])*t)]); }
  return pts;
}
function uTube(bA:[number,number,number],tA:[number,number,number],tB:[number,number,number],bB:[number,number,number]): [number,number,number][] {
  const p1 = vPath(bA, tA, 6); const ep: [number,number,number][] = [];
  for (let i=1;i<5;i++){const t=i/5;const a=Math.PI*t;ep.push([r1(tA[0]+(tB[0]-tA[0])*(1-Math.cos(a))/2),r1(tA[1]+2*Math.sin(a)),r1(tA[2]+(tB[2]-tA[2])*(1-Math.cos(a))/2)]);}
  const p2 = vPath(tB, bB, 6).reverse(); return [...p1, ...ep, ...p2];
}
function spiralPath(c:[number,number,number],rad:number,yS:number,yE:number,turns:number,segs=40): [number,number,number][] {
  const pts:[number,number,number][]=[];const ta=turns*Math.PI*2;
  for(let i=0;i<=segs;i++){const t=i/segs;const a=ta*t;pts.push([r1(c[0]+rad*Math.cos(a)),r1(yS+(yE-yS)*t),r1(c[2]+rad*Math.sin(a))]);}
  return pts;
}
function elbowPath(s:[number,number,number],e:[number,number,number]): [number,number,number][] {
  const c:[number,number,number]=[e[0],s[1],e[2]]; return [...hPath(s,c),...hPath(c,e).slice(1)];
}
function pathLen(p:[number,number,number][]):number{let l=0;for(let i=1;i<p.length;i++){const dx=p[i][0]-p[i-1][0],dy=p[i][1]-p[i-1][1],dz=p[i][2]-p[i-1][2];l+=Math.sqrt(dx*dx+dy*dy+dz*dz);}return l;}

let _id = 0;
function buildChannel(path: [number,number,number][], cc: ChannelClass, isMain: boolean, name: string): Fracture {
  const s = CHANNEL_SPECS[cc]; const id = _id++; const dia = Math.round(rand(...s.diameter_mm)); const wt = +rand(...s.wall_thickness_mm).toFixed(1);
  const f: Fracture = {
    id: `R-${String(id).padStart(3,'0')}`, name, type: isMain?'main':'branch', path, length:+pathLen(path).toFixed(1),
    aperture_um: Math.round(wt*1000), porosity: +(dia/1000).toFixed(3), fractal_dim:+(rand(2.01,2.30)).toFixed(4),
    tortuosity:+(rand(1.02,1.25)).toFixed(4), dip_angle:+(rand(0,25)).toFixed(1), azimuth_angle:+(rand(0,360)).toFixed(1),
    roughness_coeff:+(rand(0.01,0.08)).toFixed(3), connectivity: randInt(2,5),
    sensorReading: genRefinerySensorReading(cc), nodes: [], parentFractureId: null,
  };
  const nc = Math.max(3, Math.floor(path.length/3));
  for (let i=0;i<nc;i++){const pi=Math.floor((i/nc)*(path.length-1));
    f.nodes.push({id:`${f.id}-N${i}`,position:path[pi],sensors:genRefinerySensorReading(cc),timestamp:Date.now()-randInt(0,300000),robotId:null});}
  return f;
}

function assignSnakes(channels: Fracture[]) {
  const nodes = channels.flatMap(c => c.nodes); const count = Math.floor(nodes.length * 0.3);
  for (let i=0;i<count;i++){const idx=randInt(0,nodes.length-1);if(!nodes[idx].robotId) nodes[idx].robotId=`SNAKE-${String(randInt(1,120)).padStart(3,'0')}`;}
}

let cachedChannels: Fracture[] | null = null;
let cachedPathPoints: [number,number,number][] = [];
export function getAllRefineryPathPoints(): [number,number,number][] { if(!cachedChannels) generateRefineryNetwork(); return cachedPathPoints; }

export function generateRefineryNetwork(): Fracture[] {
  if (cachedChannels) return cachedChannels;
  _seed = 99; _id = 0; const ch: Fracture[] = [];

  // === 1. 换热器组 (4 台卧式) ===
  const exZ = [-12,-4,4,12]; const exY = -10;
  for (let ei=0; ei<exZ.length; ei++) {
    const z=exZ[ei]; const n=`E-${101+ei}`;
    ch.push(buildChannel(hPath([-30,exY+1.5,z],[-28,exY+1.5,z],4),'exchanger_shell',false,`${n}入口集合管`));
    const tc = 2+ei;
    for (let ti=0;ti<tc;ti++){const ty=exY+ti*0.8;const tz=z+(ti-tc/2)*0.3;
      ch.push(buildChannel(hPath([-28,ty,tz],[-8,ty,tz],14),'exchanger_tube',false,`${n}管束-${String.fromCharCode(65+ti)}`));}
    ch.push(buildChannel(hPath([-28,exY+2.5,z],[-8,exY+2.5,z],14),'exchanger_shell',false,`${n}壳程内部`));
    ch.push(buildChannel(hPath([-8,exY,z],[-6,exY,z],3),'process_pipe',false,`${n}出口管`));
  }

  // === 1b. 换热器入口集合 + 机器人入口 ===
  // 机器人检修入口总管 — 从场景外部接入
  ch.push(buildChannel(hPath([-36,exY+1.5,0],[-30,exY+1.5,0],4),'process_pipe',true,'机器人检修入口总管'));
  // 入口集合总管 — 连接4台换热器入口
  ch.push(buildChannel(hPath([-30,exY+1.5,-12],[-30,exY+1.5,12],14),'process_pipe',true,'换热器入口集合总管'));
  // 出口集合总管 — 汇集4台换热器出口
  ch.push(buildChannel(hPath([-6,exY,-12],[-6,exY,12],14),'process_pipe',true,'换热器出口集合总管'));

  // === 2. 加热炉 H-101 ===
  const hx=-2, hby=-8, hry=2, cy1=4, cy2=6, cy3=8;
  // 立管 — 从出口集合管(y=-10)上升到加热炉入口标高(y=-8)
  ch.push(buildChannel(vPath([-6,exY,0],[-6,hby,0],5),'process_pipe',true,'换热器→加热炉入口立管'));
  // 入口分配管 — 连接到辐射段入口(x=-7处有U型管起点)
  ch.push(buildChannel(hPath([-6,hby,0],[-7,hby,0],3),'process_pipe',true,'加热炉入口分配管'));
  // 辐射段 U 型炉管
  const rads = [['北墙',null,-6],['南墙',null,6],['东墙',4,null],['西墙',-8,null]] as const;
  for (const [wall,x,z] of rads) {
    for (let ui=0;ui<2;ui++) {
      if (z!==null) {
        const xs=hx-5+ui*3;
        ch.push(buildChannel(uTube([xs,hby,z],[xs,hry,z],[xs+1.5,hry,z],[xs+1.5,hby,z]),'heater_tube',true,`H-101辐射管-${wall}-${ui+1}`));
      } else {
        const zs=-4+ui*3;
        ch.push(buildChannel(uTube([x!,hby,zs],[x!,hry,zs],[x!,hry,zs+1.5],[x!,hby,zs+1.5]),'heater_tube',true,`H-101辐射管-${wall}-${ui+1}`));
      }
    }
  }
  // 对流段 3 层
  for (let ci=0;ci<3;ci++){const cy=[cy1,cy2,cy3][ci];
    ch.push(buildChannel(hPath([hx-5,cy,-4],[hx+3,cy,4],14),'heater_tube',true,`H-101对流管-第${ci+1}层`));}
  ch.push(buildChannel(hPath([hx+3,cy3,0],[10,cy3,0],6),'process_pipe',true,'H-101出口总管→蒸馏塔'));

  // === 3. 蒸馏塔 C-101 ===
  const cx=18, cby=-5, cty=35, cr=4, tr=3.2;
  ch.push(buildChannel(elbowPath([10,cy3,0],[cx-cr,12,0]),'process_pipe',true,'C-101进料管（加热炉→蒸馏塔）'));
  ch.push(buildChannel(spiralPath([cx,0,0],tr,14,cty-2,4,40),'column_internal',true,'C-101精馏段螺旋通道'));
  ch.push(buildChannel(spiralPath([cx,0,0],tr*0.85,cby+2,12,3,30),'column_internal',true,'C-101汽提段螺旋通道'));
  ch.push(buildChannel(hPath([cx+cr,cty,0],[cx,cty-3,0],6),'column_internal',true,'C-101回流管'));
  ch.push(buildChannel(hPath([cx,cty,0],[cx+8,cty,0],6),'column_internal',false,'C-101塔顶抽出（石脑油）'));
  ch.push(buildChannel(hPath([cx+cr,18,0],[cx+8,18,0],5),'column_internal',false,'C-101侧线抽出（柴油）'));
  ch.push(buildChannel(hPath([cx+cr,8,0],[cx+8,8,0],5),'column_internal',false,'C-101侧线抽出（煤油）'));
  ch.push(buildChannel(hPath([cx,cby,0],[cx+8,cby,0],5),'column_internal',false,'C-101塔底抽出（重油）'));
  ch.push(buildChannel(vPath([cx-2,22,1],[cx-2,10,1],8),'column_internal',false,'C-101降液管-A'));
  ch.push(buildChannel(vPath([cx+1.5,16,-1.5],[cx+1.5,4,-1.5],8),'column_internal',false,'C-101降液管-B'));

  // === 4. 蒸馏塔→换热器回流（形成闭合回路）===
  // 塔底重油出口汇集管
  ch.push(buildChannel(hPath([cx+8,cby,0],[cx+8,cby,-9],4),'process_pipe',true,'C-101塔底重油回流汇集管'));
  // 回流总管 — 从蒸馏塔底部沿z=-9走回换热器壳程入口
  ch.push(buildChannel(hPath([cx+8,cby,-9],[-30,cby,-9],20),'process_pipe',true,'C-101→换热器回流总管'));
  // 回流管接入换热器壳程入口侧
  ch.push(buildChannel(elbowPath([-30,cby,-9],[-30,exY+2.5,-12]),'process_pipe',true,'回流管→E-101壳程入口'));

  assignSnakes(ch);
  cachedChannels = ch;
  cachedPathPoints = ch.flatMap(c => c.path);
  return ch;
}
