import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { dashboardRoles, normalizeDashboardTiles } from '../../../lib/dashboard-layout.js';

const respond=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
  const user=await getChatGPTUser();if(!user)return respond({error:'Sign in required'},401);
  if(!env.DB)return respond({error:'Dashboard storage unavailable'},503);
  const role=new URL(request.url).searchParams.get('role')||'trader';
  if(!Object.hasOwn(dashboardRoles,role))return respond({error:'Unknown layout'},400);
  const row=await env.DB.prepare('SELECT tiles_json AS tilesJson FROM dashboard_preferences WHERE owner_id = ? AND role_key = ? LIMIT 1').bind(user.userId,role).first<{tilesJson:string}>();
  let tiles;
  try{tiles=normalizeDashboardTiles(role,row?JSON.parse(row.tilesJson):undefined)}catch{tiles=normalizeDashboardTiles(role,undefined)}
  return respond({role,tiles});
}
export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return respond({error:'Sign in required'},401);
  if(!env.DB)return respond({error:'Dashboard storage unavailable'},503);
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return respond({error:'JSON required'},415);
  const origin=request.headers.get('origin');if(origin&&new URL(origin).host!==new URL(request.url).host)return respond({error:'Origin rejected'},403);
  let input:any;try{input=await request.json()}catch{return respond({error:'Invalid JSON'},400)}
  if(typeof input?.role!=='string'||!Object.hasOwn(dashboardRoles,input.role)||!Array.isArray(input.tiles)||input.tiles.length>50)return respond({error:'Invalid layout'},400);
  const tiles=normalizeDashboardTiles(input.role,input.tiles);
  if(tiles.length!==new Set(input.tiles).size)return respond({error:'Layout contains unavailable modules'},400);
  const now=Date.now();
  await env.DB.prepare('INSERT INTO dashboard_preferences (id,owner_id,role_key,tiles_json,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET tiles_json=excluded.tiles_json,updated_at=excluded.updated_at').bind(`${user.userId}:${input.role}`,user.userId,input.role,JSON.stringify(tiles),now).run();
  return respond({role:input.role,tiles,updatedAt:now});
}
