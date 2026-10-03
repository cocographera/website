const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const API = document.body.dataset.apiBase;
function token(){return localStorage.getItem('cg_token')||''}
function setToken(t){t?localStorage.setItem('cg_token',t):localStorage.removeItem('cg_token')}

async function api(path, {method='GET', json, form}={}) {
  const headers = {};
  if (token()) headers.Authorization = 'Bearer '+token();
  let body;
  if (form) { body = form; }
  else if (json) { headers['Content-Type']='application/json'; body = JSON.stringify(json); }
  const r = await fetch(API+path, {method, headers, body});
  const j = await r.json().catch(()=>({success:false,message:'Risposta non valida dal server'}));
  if (r.status === 401) { setToken(''); showLogin(); throw new Error(j.message||'Sessione scaduta, accedi di nuovo'); }
  if (!r.ok || j.success===false) throw new Error(j.message||'Errore');
  return j;
}

function langValue(p,field,lang){const x=p?.[field];if(x&&typeof x==='object')return x[lang]||x.sq||'';return typeof x==='string'?(lang==='sq'?x:''):''}
function resolveAdminImg(p){if(!p)return p;if(/^(https?:)?\/\//.test(p))return p;if(p.startsWith('/api/'))return API+p;return '../'+p}

// ---------- Pacchetti ----------
async function load(){const j=await api('/api/admin/packages');const g=$('#grid');g.innerHTML='';j.packages.forEach(p=>{const title=langValue(p,'title','sq'),content=langValue(p,'content','sq');const c=document.createElement('article');c.className='panel card';c.innerHTML=`<div class="thumb" style="background-image:url('${esc(resolveAdminImg(p.image))}')"></div><h3>${esc(title)}</h3><div class="price">€${esc(p.price)}</div><div class="desc">${esc(content)}</div><div class="actions"><button class="primary edit">Modifica</button><button class="danger del">Elimina</button></div>`;c.querySelector('.edit').onclick=()=>openEditor(p);c.querySelector('.del').onclick=async()=>{if(!confirm('Eliminare questo pacchetto?'))return;try{await api('/api/admin/packages/delete',{method:'POST',json:{id:p.id}});load()}catch(e){alert(e.message)}};g.append(c)})}
function openEditor(p){$('#modal').classList.add('show');$('#modalTitle').textContent=p?'Modifica pacchetto':'Nuovo pacchetto';$('#id').value=p?.id||'';$('#title_sq').value=langValue(p,'title','sq');$('#title_it').value=langValue(p,'title','it');$('#title_en').value=langValue(p,'title','en');$('#content_sq').value=langValue(p,'content','sq');$('#content_it').value=langValue(p,'content','it');$('#content_en').value=langValue(p,'content','en');$('#price').value=p?.price||'';$('#type').value=p?.type==='photoVideo'?'photo-video':(p?.type||'photo');$('#image').value=p?.image||'';$('#file').value='';$('#preview').innerHTML=p?.image?`<img src="${esc(resolveAdminImg(p.image))}">`:'';$('#status').textContent=''}
function closeEditor(){$('#modal').classList.remove('show')}
$('#add').onclick=()=>openEditor(null);$('#close').onclick=closeEditor;$('#cancel').onclick=closeEditor;

$('#file').onchange=async()=>{if(!$('#file').files[0])return;const f=new FormData;f.append('image',$('#file').files[0]);try{const j=await api('/api/admin/upload',{method:'POST',form:f});$('#image').value=j.path;$('#preview').innerHTML=`<img src="${esc(resolveAdminImg(j.path))}">`}catch(e){alert(e.message)}};
$('#form').onsubmit=async e=>{e.preventDefault();const body={id:$('#id').value||undefined,title:{sq:$('#title_sq').value,it:$('#title_it').value,en:$('#title_en').value},content:{sq:$('#content_sq').value,it:$('#content_it').value,en:$('#content_en').value},price:$('#price').value,type:$('#type').value,image:$('#image').value};try{const j=await api('/api/admin/packages/save',{method:'POST',json:body});$('#status').textContent=j.message;setTimeout(()=>{closeEditor();load()},350)}catch(x){$('#status').textContent=x.message}};

// ---------- Login ----------
$('#loginForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);const pw=fd.get('password');const user=fd.get('username');try{const r=await fetch(API+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:user,password:pw})});const j=await r.json();if(!r.ok||!j.success)throw new Error(j.message||'Errore');setToken(j.token);startApp()}catch(x){$('#loginStatus').textContent=x.message}};
$('#logout').onclick=()=>{setToken('');location.reload()};
function showLogin(){$('#login').classList.remove('hidden');$('#app').classList.add('hidden')}
function startApp(){$('#login').classList.add('hidden');$('#app').classList.remove('hidden');loadTexts();loadStatus()}
if (token()) { api('/api/admin/status').then(startApp).catch(showLogin); }

// ---------- Titoli e testi ----------
const FIELDS=[['Prima pagina',[['hero.eyebrow','Scritta piccola sopra il titolo'],['hero.title1','Titolo principale — riga 1'],['hero.title2','Titolo principale — riga 2 (corsivo)'],['hero.button','Testo del pulsante']]],['Portfolio',[['portfolio.title1','Titolo — riga 1'],['portfolio.title2','Titolo — riga 2 (corsivo)']]],['Servizi',[['services.title1','Titolo — riga 1'],['services.title2','Titolo — riga 2 (corsivo)']]],['Pacchetti',[['packages.title1','Titolo — riga 1'],['packages.title2','Titolo — riga 2 (parola di collegamento)'],['packages.title3','Titolo — riga 2 (corsivo)']]],['Contatti',[['contact.title1','Titolo — riga 1'],['contact.title2','Titolo — riga 2 (corsivo)']]]];
const LANGS=[['sq','🇦🇱 Albanese','al'],['it','🇮🇹 Italiano','it'],['en','🇬🇧 Inglese','en']];
let DEF={},SAVED={};
const dget=(l,k)=>k.split('.').reduce((v,x)=>v&&v[x],DEF[l])||'';
async function loadTexts(){const [d,t]=await Promise.all([fetch('defaults.json').then(r=>r.json()),api('/api/admin/texts')]);DEF=d;SAVED=t.texts||{};renderTexts()}
function renderTexts(reset){$('#textsBox').innerHTML=LANGS.map(([l,name,c])=>`<section class="lang-box ${c}"><h3>${name}</h3>`+FIELDS.map(([g,fs])=>`<div class="tgroup"><h4>${g}</h4>`+fs.map(([k,lab])=>`<label>${lab}</label><input data-l="${l}" data-k="${k}" value="${esc(reset?dget(l,k):(SAVED[l]?.[k]??dget(l,k)))}">`).join('')+'</div>').join('')+'</section>').join('')}
$('#saveTexts').onclick=async()=>{const o={sq:{},it:{},en:{}};document.querySelectorAll('#textsBox input').forEach(i=>{if(i.value!==dget(i.dataset.l,i.dataset.k))o[i.dataset.l][i.dataset.k]=i.value});try{const j=await api('/api/admin/texts/save',{method:'POST',json:{texts:o}});SAVED=o;$('#textsStatus').textContent='✓ '+j.message}catch(e){$('#textsStatus').textContent=e.message}};
$('#resetTexts').onclick=()=>{if(confirm('Riportare tutti i titoli a come erano all’inizio? Ricordati poi di premere “Salva i testi”.'))renderTexts(true)};

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x===b));['texts','faq','packages','settings'].forEach(t=>$('#tab-'+t).classList.toggle('hidden',t!==b.dataset.tab));if(b.dataset.tab==='packages')load();if(b.dataset.tab==='faq')loadFaq()});

// ---------- Impostazioni ----------
async function loadStatus(){const j=await api('/api/admin/status');$('#alert').classList.toggle('hidden',!j.default_password)}
$('#settingsForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);const body=Object.fromEntries(fd.entries());try{const j=await api('/api/admin/settings/save',{method:'POST',json:body});$('#settingsStatus').textContent='✓ '+j.message;e.target.querySelectorAll('[type=password]').forEach(i=>i.value='');loadStatus()}catch(x){$('#settingsStatus').textContent=x.message}};

// ---------- FAQ ----------
let FAQS=[];
function syncFaq(){document.querySelectorAll('#faqBox [data-f]').forEach(i=>{const f=FAQS[+i.dataset.i];(f[i.dataset.f]=f[i.dataset.f]||{})[i.dataset.l]=i.value})}
async function loadFaq(){const j=await api('/api/admin/faq');FAQS=j.faqs||[];renderFaq()}
function renderFaq(){$('#faqBox').innerHTML=FAQS.map((f,i)=>`<article class="panel" style="margin-bottom:16px"><div class="toolbar"><strong>Domanda ${i+1}</strong><span><button class="secondary" data-a="up" data-i="${i}">↑</button> <button class="secondary" data-a="down" data-i="${i}">↓</button> <button class="secondary" data-a="del" data-i="${i}">🗑 Elimina</button></span></div><div class="lang-grid">`+LANGS.map(([l,n,c])=>`<section class="lang-box ${c}"><h3>${n}</h3><label>Domanda</label><input data-i="${i}" data-f="q" data-l="${l}" value="${esc(f.q?.[l])}"><label>Risposta</label><textarea data-i="${i}" data-f="a" data-l="${l}">${esc(f.a?.[l])}</textarea></section>`).join('')+'</div></article>').join('')||'<div class="note">Nessuna domanda: premi “Nuova domanda”.</div>'}
$('#faqBox').onclick=e=>{const b=e.target.closest('[data-a]');if(!b)return;syncFaq();const i=+b.dataset.i,a=b.dataset.a;if(a==='del'){if(!confirm('Eliminare questa domanda in tutte le lingue?'))return;FAQS.splice(i,1)}else{const j=a==='up'?i-1:i+1;if(j<0||j>=FAQS.length)return;[FAQS[i],FAQS[j]]=[FAQS[j],FAQS[i]]}renderFaq()};
$('#addFaq').onclick=()=>{syncFaq();FAQS.push({q:{sq:'',it:'',en:''},a:{sq:'',it:'',en:''}});renderFaq()};
$('#saveFaq').onclick=async()=>{syncFaq();try{const j=await api('/api/admin/faq/save',{method:'POST',json:{faqs:FAQS}});$('#faqStatus').textContent='✓ '+j.message;loadFaq()}catch(e){$('#faqStatus').textContent=e.message}};
