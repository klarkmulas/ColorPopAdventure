// DealHunter AI V1.9 — stricter product matching and price validation
// Secrets required: BRAVE_API_KEY, SCANNER_KEY

const CORS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'content-type,x-dealhunter-key',
  'Access-Control-Allow-Methods':'GET,POST,OPTIONS'
};
const json=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...CORS,'content-type':'application/json;charset=utf-8'}});
const money=x=>{if(x===null||x===undefined||x==='')return null;let z=String(x).trim().replace(/\s/g,'').replace(/[^0-9.,-]/g,'');if(!z)return null;if(z.includes(',')&&z.includes('.')){if(z.lastIndexOf(',')>z.lastIndexOf('.'))z=z.replace(/\./g,'').replace(',','.');else z=z.replace(/,/g,'')}else if(z.includes(','))z=z.replace(',','.');let n=Number(z);return Number.isFinite(n)?n:null};
const med=a=>{a=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;let m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};
const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const hostName=u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch{return''}};
const resolveUrl=(base,u)=>{try{return new URL(u,base).toString()}catch{return base}};
const ACCESSORY=['cover','custodia','supporto','stand','base','ricambio','pellicola','cavo','adattatore','case','vetro temperato','caricatore','borsa','tracolla','corde'];
const GENERIC_WORDS=['prezzo','prezzi','offerte','offerta','catalogo','categoria','categorie','ricerca','risultati','annunci','prodotti','nuovi e usati','migliori','confronta','shopping'];
function skipHost(h){return /(^|\.)google\./i.test(h)||/youtube\./i.test(h)||/facebook\./i.test(h)||/instagram\./i.test(h)||/tiktok\./i.test(h)||/pinterest\./i.test(h)||/subito\.it$/i.test(h)}
function urlLooksGeneric(u){try{let x=new URL(u),p=(x.pathname+' '+x.search).toLowerCase();return /\/(search|ricerca|catalog|catalogo|category|categoria|listing|list|risultati)(\/|\?|$)/.test(p)||/[?&](q|query|search|keyword)=/.test(p)}catch{return true}}
function genericTitle(title,term=''){let t=norm(title),q=norm(term);if(!t)return true;if(q&&(t===q||t.startsWith(q+' prezzo')||t.startsWith(q+' offerte')||t.startsWith(q+' - ')&&t.split(' ').length<=4))return true;let hits=GENERIC_WORDS.filter(w=>t.includes(w)).length;return hits>=2&&t.split(' ').length<12}
function titleTokens(s){return norm(s).split(' ').filter(x=>x.length>1&&!GENERIC_WORDS.includes(x))}
function modelTokens(s){return titleTokens(s).filter(x=>/\d/.test(x)&&x.length>=2)}
function similarity(base,cand){let a=titleTokens(base),b=titleTokens(cand);if(!a.length||!b.length)return 0;let hit=a.filter(x=>b.includes(x)).length,score=hit/Math.max(2,Math.min(a.length,7));let am=modelTokens(base),bm=modelTokens(cand);if(am.length&&bm.length&&!am.some(x=>bm.includes(x)))score*=0.25;return score}
function relevantToTerm(term,title){let q=titleTokens(term),t=titleTokens(title);if(!q.length||!t.length)return false;let hit=q.filter(x=>t.includes(x)).length;return hit>=Math.max(1,Math.ceil(q.length*.5))}
function accessoryMismatch(term,title){let q=norm(term),t=norm(title);return ACCESSORY.some(w=>t.includes(w))&&!ACCESSORY.some(w=>q.includes(w))}
function cleanTitle(s){return String(s||'').split(/\s+[|–—]\s+/)[0].split(/\s+-\s+(?:Amazon|eBay|MediaWorld|Unieuro|Euronics|Trony|Idealo|Trovaprezzi)\b/i)[0].trim().slice(0,180)}
function walk(v,out=[]){if(!v)return out;if(Array.isArray(v)){for(const x of v)walk(x,out);return out}if(typeof v!=='object')return out;out.push(v);for(const x of Object.values(v))if(x&&typeof x==='object')walk(x,out);return out}
function typeIsProduct(v){let t=v?.['@type']??v?.type;return Array.isArray(t)?t.some(x=>String(x).toLowerCase()==='product'):String(t||'').toLowerCase()==='product'}
function firstImage(p){let i=p?.image??p?.thumbnail??p?.thumbnailUrl;if(Array.isArray(i))i=i[0];if(i&&typeof i==='object')i=i.url||i.contentUrl||i.imageUrl;return typeof i==='string'?i:''}
function parseOffer(o){if(Array.isArray(o))o=o.find(x=>x&&typeof x==='object');if(!o||typeof o!=='object')return null;let price=money(o.price??o.lowPrice??o.sale_price??o.currentPrice??o.priceSpecification?.price),currency=o.priceCurrency||o.priceSpecification?.priceCurrency||o.currency||'EUR';if(!price||price<8||price>20000||String(currency).toUpperCase()!=='EUR')return null;let ship=null,sd=o.shippingDetails;if(Array.isArray(sd))sd=sd[0];if(sd){let sr=sd.shippingRate;if(Array.isArray(sr))sr=sr[0];ship=money(sr?.value??sr?.price)}return{price,ship,url:o.url||o.offerUrl||'',availability:String(o.availability||'')};}
function productObjects(v){return walk(v,[]).filter(typeIsProduct)}
function pageIsSpecific(title,url,term=''){if(!title||!url||urlLooksGeneric(url)||genericTitle(title,term))return false;if(term&&(!relevantToTerm(term,title)||accessoryMismatch(term,title)))return false;return true}

function indexedProduct(x,term=''){
  if(!x?.url||skipHost(hostName(x.url))||urlLooksGeneric(x.url)||genericTitle(x.title,term))return null;
  const pools=[x.product,x.product_cluster,x.schemas,x.deep_results];
  for(const pool of pools){
    if(!pool)continue;
    for(const p of productObjects(pool)){
      let title=cleanTitle(p.name||p.title||x.title);if(!pageIsSpecific(title,p.url||x.url,term))continue;
      let of=parseOffer(p.offers||p.offer||p.priceSpecification);if(!of)continue;
      let u=resolveUrl(x.url,p.url||of.url||x.url);if(urlLooksGeneric(u))continue;
      return{title,url:u,domain:hostName(u),ask:of.price,ship:of.ship,image:firstImage(p)||x.thumbnail?.src||x.thumbnail?.original||'',availability:of.availability,priceSource:'BRAVE_PRODUCT_SCHEMA',shippingVerified:of.ship!==null,source:hostName(u),confidence:'medium'};
    }
  }
  return null;
}

async function pageProduct(x,term=''){
  const start=x.url;if(!pageIsSpecific(x.title,start,term)||skipHost(hostName(start)))return null;
  let r;try{r=await fetch(start,{redirect:'follow',headers:{'user-agent':'Mozilla/5.0 (compatible; DealHunterAI/1.9)','accept':'text/html,application/xhtml+xml'}})}catch{return null}
  if(!r.ok)return null;let ct=r.headers.get('content-type')||'';if(!ct.includes('text/html'))return null;
  let finalUrl=r.url||start;if(urlLooksGeneric(finalUrl))return null;
  let html=(await r.text()).slice(0,1800000),found=[];
  for(const m of html.matchAll(/<script[^>]*type=[\"']application\/ld\+json[\"'][^>]*>([\s\S]*?)<\/script>/gi)){try{found.push(...productObjects(JSON.parse(m[1].trim())))}catch{}}
  for(const p of found){let title=cleanTitle(p.name||x.title);if(!pageIsSpecific(title,p.url||finalUrl,term))continue;let of=parseOffer(p.offers);if(!of)continue;let u=resolveUrl(finalUrl,p.url||of.url||finalUrl);if(urlLooksGeneric(u))continue;return{title,url:u,domain:hostName(u),ask:of.price,ship:of.ship,image:firstImage(p),availability:of.availability,priceSource:'PAGE_PRODUCT_SCHEMA',shippingVerified:of.ship!==null,source:hostName(u),confidence:'high'};}
  let ogProduct=/property=[\"']og:type[\"'][^>]*content=[\"']product[\"']/i.test(html)||/product:price:amount/i.test(html);
  if(ogProduct){let m=html.match(/(?:property=[\"']product:price:amount[\"']|itemprop=[\"']price[\"'])[^>]*(?:content|value)=[\"']([0-9.,]+)[\"']/i);let price=m?money(m[1]):null;if(price&&price>=8&&price<=20000){let title=cleanTitle((html.match(/<title[^>]*>([^<]+)<\/title>/i)||[])[1]||x.title);if(pageIsSpecific(title,finalUrl,term))return{title,url:finalUrl,domain:hostName(finalUrl),ask:price,ship:null,image:'',availability:'',priceSource:'PAGE_PRODUCT_META',shippingVerified:false,source:hostName(finalUrl),confidence:'medium'};}}
  return null;
}

async function brave(q,env,count=10){let u='https://api.search.brave.com/res/v1/web/search?country=IT&search_lang=it&ui_lang=it-IT&count='+Math.min(10,count)+'&extra_snippets=true&text_decorations=false&q='+encodeURIComponent(q);let r=await fetch(u,{headers:{'X-Subscription-Token':env.BRAVE_API_KEY,'Accept':'application/json'}});if(!r.ok)throw new Error('Brave '+r.status);let j=await r.json();return (j.web?.results||[]).map(x=>({title:x.title||'',url:x.url||'',description:x.description||'',thumbnail:x.thumbnail||null,schemas:x.schemas||null,product:x.product||null,product_cluster:x.product_cluster||null,deep_results:x.deep_results||null}));}
async function candidate(x,term=''){let p=await pageProduct(x,term);if(p)return{item:p,via:'page'};let i=indexedProduct(x,term);if(i)return{item:i,via:'index'};return{item:null,via:'none'};}

function marketQueryTitle(title){let t=cleanTitle(title);return t.split(' ').slice(0,9).join(' ')}
async function marketFor(item,env){let base=marketQueryTitle(item.title),rs=await brave('"'+base+'" prezzo acquista Italia',env,8),prices=[],checked=0;for(const x of rs){if(x.url===item.url)continue;let r=await candidate(x,base);checked++;if(!r.item)continue;if(similarity(base,r.item.title)<0.62)continue;let total=r.item.ask+(r.item.ship||0);if(Number.isFinite(total))prices.push(total);if(prices.length>=5)break}if(prices.length<2)return{median:null,samples:prices.length,checked};let m=med(prices),clean=prices.filter(p=>p>=m*.55&&p<=m*1.8);return{median:clean.length>=2?med(clean):null,samples:clean.length,checked};}

async function searchProduct(q,env){
  const rs=await brave(q+' acquista prezzo prodotto Italia -catalogo -categoria',env,10),raw=[];let pagesChecked=0,pageParsed=0,indexFallback=0,rejectedGeneric=0;
  for(const x of rs){if(urlLooksGeneric(x.url)||genericTitle(x.title,q)){rejectedGeneric++;continue}let r=await candidate(x,q);pagesChecked++;if(r.item){raw.push(r.item);if(r.via==='page')pageParsed++;else indexFallback++;}}
  const seen=new Set(),items=[];for(const x of raw){if(seen.has(x.url))continue;seen.add(x.url);items.push(x);if(items.length>=5)break}
  let marketChecks=0,marketSamples=0;for(const x of items){let m=await marketFor(x,env);marketChecks++;marketSamples+=m.samples;x.market=m.median;x.marketSamples=m.samples;x.marketSource=m.median?'SAME_PRODUCT_WEB_MEDIAN':null;x.total=x.ask+(x.ship||0)}
  return{items,stats:{queries:1+marketChecks,searchResults:rs.length,pagesChecked,productsParsed:items.length,pageParsed,indexFallback,rejectedGeneric,marketChecks,marketSamples}};
}

const DISCOVERY=[
  'site:.it offerta smartphone acquista prezzo',
  'site:.it offerta console videogiochi acquista prezzo',
  'site:.it offerta notebook laptop acquista prezzo',
  'site:.it offerta tablet smartwatch acquista prezzo',
  'site:.it offerta fotocamera obiettivo acquista prezzo',
  'site:.it offerta cuffie auricolari acquista prezzo',
  'site:.it offerta robot aspirapolvere acquista prezzo',
  'site:.it offerta LEGO set acquista prezzo',
  'site:.it offerta monitor gaming acquista prezzo',
  'site:.it offerta SSD NVMe acquista prezzo',
  'site:.it offerta elettrodomestico cucina acquista prezzo',
  'site:.it offerta utensile elettrico acquista prezzo'
];
async function discover(env,offset=0){let qs=[];for(let i=0;i<3;i++)qs.push(DISCOVERY[(offset+i)%DISCOVERY.length]);let raw=[],searchResults=0,pagesChecked=0,pageParsed=0,indexFallback=0,rejectedGeneric=0;for(const q of qs){let rs=await brave(q,env,8);searchResults+=rs.length;for(const x of rs){if(urlLooksGeneric(x.url)||genericTitle(x.title,'')){rejectedGeneric++;continue}let r=await candidate(x,'');pagesChecked++;if(r.item){raw.push(r.item);if(r.via==='page')pageParsed++;else indexFallback++;}}}
  const seen=new Set(),items=[],perDomain={};for(const x of raw.sort((a,b)=>a.ask-b.ask)){if(seen.has(x.url)||(perDomain[x.domain]||0)>=2)continue;seen.add(x.url);perDomain[x.domain]=(perDomain[x.domain]||0)+1;items.push(x);if(items.length>=6)break}
  let marketChecks=0,marketSamples=0;for(const x of items){let m=await marketFor(x,env);marketChecks++;marketSamples+=m.samples;x.market=m.median;x.marketSamples=m.samples;x.marketSource=m.median?'SAME_PRODUCT_WEB_MEDIAN':null;x.total=x.ask+(x.ship||0)}
  return{items,stats:{queries:qs.length+marketChecks,discoveryQueries:qs,searchResults,pagesChecked,productsParsed:items.length,pageParsed,indexFallback,rejectedGeneric,marketChecks,marketSamples}};
}

export default{async fetch(req,env){if(req.method==='OPTIONS')return new Response('',{headers:CORS});const u=new URL(req.url);if(u.pathname==='/health')return json({ok:true,version:'1.9',brave:!!env.BRAVE_API_KEY});if(req.headers.get('x-dealhunter-key')!==env.SCANNER_KEY)return json({error:'unauthorized'},401);if(!env.BRAVE_API_KEY)return json({error:'BRAVE_API_KEY_missing'},500);if(req.method!=='POST')return json({error:'method_not_allowed'},405);let b=await req.json().catch(()=>({}));try{if(u.pathname==='/search'){let q=String(b.q||'').trim();if(!q)return json({error:'query_missing'},400);return json({ok:true,version:'1.9',mode:'search',query:q,generatedAt:new Date().toISOString(),...(await searchProduct(q,env))})}if(u.pathname==='/discover'){let offset=Math.abs(parseInt(b.offset||0,10))%DISCOVERY.length;return json({ok:true,version:'1.9',mode:'discover',offset,generatedAt:new Date().toISOString(),...(await discover(env,offset))})}return json({error:'not_found'},404)}catch(e){return json({error:String(e.message||e)},500)}}};
