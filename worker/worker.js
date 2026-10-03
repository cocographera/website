/* Cocographera — backend Cloudflare Worker (sostituisce PHP)
   Richiede: KV namespace bound come "DATA", secrets ADMIN_PASSWORD e TOKEN_SECRET (vedi README_DEPLOY.md)
   Nessun modulo contatti: i contatti avvengono via Instagram, link già nel sito. */

const ALLOWED_TEXT_KEYS = ['hero.eyebrow','hero.title1','hero.title2','hero.button','portfolio.title1','portfolio.title2','services.title1','services.title2','packages.title1','packages.title2','packages.title3','contact.title1','contact.title2'];

const DEFAULT_PACKAGES = [
 {id:'package-1',type:'photo',title:{sq:'Seti profesional + Banketi',it:'Servizio professionale + Ricevimento',en:'Professional session + Reception'},content:{sq:'Seti profesional i martesës + Banketi',it:'Servizio fotografico professionale + ricevimento',en:'Professional wedding session + reception'},price:'500',image:'assets/bride-portrait.jpg'},
 {id:'package-2',type:'photo',title:{sq:'Seti + Banketi + Ceremonia',it:'Servizio + Ricevimento + Cerimonia',en:'Session + Reception + Ceremony'},content:{sq:'Seti fotografik + banketi + ceremonia',it:'Servizio fotografico + ricevimento + cerimonia',en:'Photo session + reception + ceremony'},price:'600',image:'assets/couple-editorial.jpg'},
 {id:'package-3',type:'photoVideo',title:{sq:'Seti + Klipi + Banketi',it:'Servizio + Video + Ricevimento',en:'Session + Video + Reception'},content:{sq:'Fotografi dhe video për momentet më të rëndësishme.',it:'Fotografia e video per i momenti più importanti.',en:'Photography and video for the most important moments.'},price:'1700',image:'assets/veil-detail.jpg'},
 {id:'package-4',type:'photoVideo',title:{sq:'Seti + Klipi + Ceremonia + Banketi',it:'Servizio + Video + Cerimonia + Ricevimento',en:'Session + Video + Ceremony + Reception'},content:{sq:'Një mbulim më i plotë i gjithë ditës.',it:"Una copertura più completa dell'intera giornata.",en:'A more complete coverage of the whole day.'},price:'2000',image:'assets/wedding-first-dance.jpg'},
 {id:'package-5',type:'photoVideo',title:{sq:'Eksperienca e plotë',it:"L'esperienza completa",en:'The complete experience'},content:{sq:'Seti · Video · Ceremonia · Banketi · Kran',it:'Servizio · Video · Cerimonia · Ricevimento · Kran',en:'Session · Video · Ceremony · Reception · Kran'},price:'2300',image:'assets/wedding-party.jpg'}
];
const DEFAULT_FAQ = {faqs:[
 {q:{sq:'Ku ofroni shërbimet tuaja?',it:'Dove offrite i vostri servizi?',en:'Where do you offer your services?'},a:{sq:'Cocographera ofron fotografi martese në Tiranë dhe në vende të ndryshme në Shqipëri. Fotografja është e disponueshme për zhvendosje; detajet dhe kostot e udhëtimit vlerësohen së bashku.',it:'Cocographera offre fotografia di matrimonio a Tirana e in diverse località dell’Albania. La fotografa è disponibile a spostamenti, da valutare insieme.',en:'Cocographera offers wedding photography in Tirana and across different locations in Albania. The photographer is available to travel; arrangements and any related costs are to be evaluated together.'}}
]};

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {status, headers: {'Content-Type':'application/json; charset=utf-8', ...cors(), ...extra}});
const cors = () => ({'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'});
const bad = (msg, status = 400) => json({success:false, message: msg}, status);

async function kvGet(env, key, fallback) { const v = await env.DATA.get(key, 'json'); return v ?? fallback; }
async function kvPut(env, key, value) { await env.DATA.put(key, JSON.stringify(value)); }

function bufToB64(buf) { let bin=''; const bytes=new Uint8Array(buf); for(let i=0;i<bytes.length;i++) bin+=String.fromCharCode(bytes[i]); return btoa(bin); }
async function sha256Hex(str) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)); return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join(''); }

async function hmac(env, data) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.TOKEN_SECRET), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return bufToB64(sig).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function makeToken(env) { const exp = Date.now()+1000*60*60*12; const payload = `admin.${exp}`; const sig = await hmac(env, payload); return `${payload}.${sig}`; }
async function checkToken(env, token) {
  if (!token) return false;
  const parts = token.split('.'); if (parts.length!==3) return false;
  const payload = `${parts[0]}.${parts[1]}`; const sig = await hmac(env, payload);
  if (sig !== parts[2]) return false;
  return Number(parts[1]) > Date.now();
}
function getAuth(req) { const h = req.headers.get('Authorization')||''; return h.startsWith('Bearer ')? h.slice(7) : null; }
async function requireAuth(req, env) { return await checkToken(env, getAuth(req)); }

async function currentPasswordHash(env) { const auth = await env.DATA.get('auth', 'json'); return auth?.hash || null; }
async function verifyPassword(env, pw) {
  const stored = await currentPasswordHash(env);
  if (stored) return stored === await sha256Hex('v1:'+pw);
  return pw === env.ADMIN_PASSWORD;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/,'') || '/';
    const method = request.method;
    if (method === 'OPTIONS') return new Response(null, {headers: cors()});

    try {
      // ---------- PUBBLICO ----------
      if (path === '/api/packages' && method === 'GET') {
        return json({packages: await kvGet(env, 'packages', DEFAULT_PACKAGES)});
      }
      if (path === '/api/texts' && method === 'GET') {
        return json(await kvGet(env, 'texts', {}));
      }
      if (path === '/api/faq' && method === 'GET') {
        return json(await kvGet(env, 'faq', DEFAULT_FAQ));
      }
      if (path.startsWith('/api/asset/') && method === 'GET') {
        const id = path.split('/').pop();
        const meta = await env.DATA.get('asset-meta:'+id, 'json');
        const buf = await env.DATA.get('asset:'+id, 'arrayBuffer');
        if (!buf || !meta) return new Response('Not found', {status:404, headers: cors()});
        return new Response(buf, {headers: {'Content-Type': meta.contentType||'image/jpeg','Cache-Control':'public, max-age=31536000', ...cors()}});
      }

      // ---------- ADMIN: LOGIN ----------
      if (path === '/api/admin/login' && method === 'POST') {
        const body = await request.json().catch(()=>({}));
        const ok = await verifyPassword(env, String(body.password||''));
        if (!ok) return bad('Password non corretta', 401);
        return json({success:true, token: await makeToken(env)});
      }

      // ---------- ADMIN: tutto il resto richiede token ----------
      if (path.startsWith('/api/admin/')) {
        if (!(await requireAuth(request, env))) return bad('Non autorizzato', 401);

        if (path === '/api/admin/status' && method === 'GET') {
          return json({success:true, default_password: !(await currentPasswordHash(env))});
        }

        if (path === '/api/admin/packages' && method === 'GET') {
          return json({success:true, packages: await kvGet(env, 'packages', DEFAULT_PACKAGES)});
        }
        if (path === '/api/admin/packages/save' && method === 'POST') {
          const body = await request.json().catch(()=>({}));
          if (!body.title?.sq && !body.title?.it) return bad('Titolo mancante');
          const packages = await kvGet(env, 'packages', DEFAULT_PACKAGES);
          const id = body.id || 'package-'+crypto.randomUUID().slice(0,8);
          const clean = {id, type: body.type||'photo', title: body.title||{}, content: body.content||{}, price: String(body.price||''), image: body.image||''};
          const idx = packages.findIndex(p=>p.id===id);
          if (idx>=0) packages[idx]=clean; else packages.push(clean);
          await kvPut(env, 'packages', packages);
          return json({success:true, message:'Pacchetto salvato'});
        }
        if (path === '/api/admin/packages/delete' && method === 'POST') {
          const body = await request.json().catch(()=>({}));
          let packages = await kvGet(env, 'packages', DEFAULT_PACKAGES);
          packages = packages.filter(p=>p.id!==body.id);
          await kvPut(env, 'packages', packages);
          return json({success:true});
        }
        if (path === '/api/admin/upload' && method === 'POST') {
          const form = await request.formData();
          const file = form.get('image');
          if (!file || typeof file === 'string') return bad('Nessun file ricevuto');
          if (file.size > 5*1024*1024) return bad('Immagine troppo grande (max 5MB)');
          const id = crypto.randomUUID();
          const buf = await file.arrayBuffer();
          await env.DATA.put('asset:'+id, buf);
          await env.DATA.put('asset-meta:'+id, JSON.stringify({contentType: file.type||'image/jpeg'}));
          return json({success:true, path: '/api/asset/'+id});
        }

        if (path === '/api/admin/texts' && method === 'GET') return json({success:true, texts: await kvGet(env,'texts',{})});
        if (path === '/api/admin/texts/save' && method === 'POST') {
          const body = await request.json().catch(()=>({}));
          const inTexts = body.texts||{}; const clean={};
          for (const l of ['sq','it','en']) { for (const [k,v] of Object.entries(inTexts[l]||{})) { if (ALLOWED_TEXT_KEYS.includes(k) && typeof v==='string') { const vv=v.slice(0,160); if (vv.trim()!=='') { clean[l]=clean[l]||{}; clean[l][k]=vv; } } } }
          await kvPut(env,'texts',clean);
          return json({success:true, message:'Testi salvati: sono già visibili sul sito'});
        }

        if (path === '/api/admin/faq' && method === 'GET') return json({success:true, faqs: (await kvGet(env,'faq',DEFAULT_FAQ)).faqs});
        if (path === '/api/admin/faq/save' && method === 'POST') {
          const body = await request.json().catch(()=>({}));
          const inList = Array.isArray(body.faqs)?body.faqs:[];
          const faqs=[];
          for (const it of inList) { const row={q:{},a:{}}; let any=false; for (const l of ['sq','it','en']) { for (const f of ['q','a']) { let v=String(it?.[f]?.[l]||'').slice(0, f==='q'?200:1200); row[f][l]=v; if (v.trim()!=='') any=true; } } if (any) faqs.push(row); }
          await kvPut(env,'faq',{faqs});
          return json({success:true, message:'FAQ salvate: sono già visibili sul sito'});
        }

        if (path === '/api/admin/settings/save' && method === 'POST') {
          const body = await request.json().catch(()=>({}));
          const np = String(body.new_password||'');
          if (!np) return bad('Inserisci la nuova password');
          const okCur = await verifyPassword(env, String(body.current_password||''));
          if (!okCur) return bad('La password attuale non è corretta');
          if (np.length < 8) return bad('La nuova password deve avere almeno 8 caratteri');
          if (np !== String(body.confirm_password||'')) return bad('Le due nuove password non coincidono');
          await kvPut(env, 'auth', {hash: await sha256Hex('v1:'+np)});
          return json({success:true, message:'Password aggiornata'});
        }

        return bad('Azione non riconosciuta', 404);
      }

      return bad('Non trovato', 404);
    } catch (e) {
      return bad('Errore interno: '+(e?.message||e), 500);
    }
  }
};
