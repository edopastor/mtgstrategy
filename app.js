<script>
const SUPA_URL='https://owhsqvkqhqoqmvhprldw.supabase.co';
const SUPA_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93aHNxdmtxaHFvcW12aHBybGR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4OTMyMTcsImV4cCI6MjA5MjQ2OTIxN30.BxVtOpZP_PohnJPjr2Tddj8ack8UwArZYBRLINoU-Wc';
const CATS={theory:'theory',deckbuilding:'deckbuilding',limited:'limited',tournament:'tournament',mental:'mental game',history:'history & culture'};

let A=[], votes={}, myVotes={}, cat='all', topIds=new Set();

function getFingerprint(){
  let fp=localStorage.getItem('mtg_fp');
  if(!fp){fp=Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem('mtg_fp',fp);}
  return fp;
}
const FP=getFingerprint();

async function sbFetch(path,opts={}){
  const r=await fetch(SUPA_URL+'/rest/v1/'+path,{
    headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,'Content-Type':'application/json','Prefer':opts.prefer||'',...opts.headers},
    method:opts.method||'GET',
    body:opts.body?JSON.stringify(opts.body):undefined
  });
  if(r.status===204||r.status===201)return null;
  return r.json();
}

async function loadVotes(){
  const [data, mine] = await Promise.all([
    sbFetch('votes?select=article_id'),
    sbFetch('votes?fingerprint=eq.'+encodeURIComponent(FP)+'&select=article_id')
  ]);
  if(data&&Array.isArray(data)) data.forEach(r=>{votes[r.article_id]=(votes[r.article_id]||0)+1;});
  if(mine&&Array.isArray(mine)) mine.forEach(r=>{myVotes[r.article_id]=true;});
}

function getV(id){return votes[id]||0;}

function buildTopIds(){
  const sorted=[...A].sort((a,b)=>getV(b.id)-getV(a.id));
  topIds=new Set(sorted.slice(0,10).map(a=>a.id));
}

async function castVote(id){
  if(myVotes[id]){
await sbFetch('votes?article_id=eq.'+id+'&fingerprint=eq.'+encodeURIComponent(FP),{method:'DELETE',prefer:'return=minimal',headers:{'x-fingerprint':FP}});    delete myVotes[id];
    votes[id]=Math.max(0,(votes[id]||1)-1);
  } else {
    await sbFetch('votes',{method:'POST',prefer:'return=minimal',body:{article_id:id,fingerprint:FP}});
    myVotes[id]=true;
    votes[id]=(votes[id]||0)+1;
  }
  buildTopIds();
  if(document.getElementById('apage').style.display==='block') renderA(document.getElementById('aname').textContent);
  else render();
}

async function init(){
  try{
    const r=await fetch('articles.json');
    if(!r.ok) throw new Error('HTTP '+r.status);
    A=await r.json();
  }catch(e){
    document.getElementById('list').innerHTML='<p style="padding:16px;color:#888;font-size:.85em;">Could not load articles.json: '+e.message+'</p>';
    return;
  }
  buildAuthorFilter();
await loadVotes();
buildTopIds();
  render();
document.getElementById('footwrap').style.display='';
}

function buildAuthorFilter(){
  const authors=[...new Set(A.map(a=>a.author))].sort();
  const sel=document.getElementById('authorFilter');
  authors.forEach(au=>{const o=document.createElement('option');o.value=au;o.textContent=au;sel.appendChild(o);});
}

function setCat(c){
  cat=c;
  document.querySelectorAll('.ctab').forEach(b=>b.classList.toggle('on',b.dataset.c===c));
  render();
}
function setCatD(c,el){
  cat=c;
  document.querySelectorAll('.ctab').forEach(b=>b.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('catmob').value=c;
  render();
}

function getList(){
  const q = document.getElementById('q')?.value.toLowerCase().trim() || '';
  const au = document.getElementById('authorFilter')?.value;
  
  // Get the page type from the body tag
  const pageType = document.body.dataset.type || 'home';
  const pageValue = document.body.dataset.value || '';

  return A.filter(a => {
    // Page specific filtering
    if(pageType === 'category' && a.cat !== pageValue) return false;
    if(pageType === 'author' && a.author !== pageValue) return false;
    
    // Normal UI filtering
    if(q && !a.title.toLowerCase().includes(q) && !a.author.toLowerCase().includes(q)) return false;
    if(au && a.author !== au) return false;
    return true;
  }).sort((a,b)=>getV(b.id)-getV(a.id)||a.title.localeCompare(b.title));
}

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function rowHTML(a, i, isFeatured = false){
  const v = getV(a.id), on = myVotes[a.id], top = topIds.has(a.id);
  
  const rowClass = isFeatured ? 'row featured' : 'row';
  const numHtml = isFeatured ? '<span class="rnum star">★</span>' : `<span class="rnum">${i + 1}.</span>`;
  const badgeHtml = isFeatured ? '<span class="badge-recent">Recently Added</span>' : '';

  return `<div class="${rowClass}">
    ${numHtml}
    <button class="vbtn${(top)?' on':''}" onclick="castVote(${a.id})" aria-pressed="${!!on}">▲</button>
    <span class="vcnt">${v||''}</span>
    <span class="rbody">
      ${badgeHtml}
      <a class="rtitle" href="${esc(a.orig)}" target="_blank" rel="noopener">${esc(a.title)}</a>
      <div class="rmeta">
        <button class="rauth" data-author="${esc(a.author)}">${esc(a.author)}</button>
        <span class="rsep">·</span>${CATS[a.cat]||a.cat}
      </div>
    </span>
  </div>`;
}
  
function render(){
  let L = getList();
  let html = '';

  // Separate the list into recently added and normal arrays
  const featured = L.filter(a => a.is_new);
  const normal = L.filter(a => !a.is_new);

  // Render all recently added articles at the top
  featured.forEach((a, i) => {
    html += rowHTML(a, i, true);
  });

  // Render the remaining articles below them
  normal.forEach((a, i) => {
    html += rowHTML(a, i, false); 
  });

  document.getElementById('list').innerHTML = html || '<p style="padding:20px 0;color:#888;font-size:.85em;">No articles match.</p>';
}

document.addEventListener('click',function(e){
  const btn=e.target.closest('.rauth');
  if(btn)showA(btn.dataset.author);
});

init();
</script>
