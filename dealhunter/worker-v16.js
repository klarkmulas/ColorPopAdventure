// DealHunter AI V1.7 — Cloudflare Worker backend
// Secrets required: BRAVE_API_KEY, SCANNER_KEY
// Optional: EBAY_CLIENT_ID, EBAY_CLIENT_SECRET

const CORS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'content-type,x-dealhunter-key',
  'Access-Control-Allow-Methods':'GET,POST,OPTIONS'
};
const json=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...CORS,'content-type':'application/json;charset=utf-8'}});
const money=x=>{if(x===null||x===undefined||x==='')return null;const n=Number(String(x).replace(/\s/g,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.'));return Number.isFinite(n)?n:null};
const med=a=>{a=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;let m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};
const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const accessoryWords=['cover','custodia','supporto','stand','base','ricambio','pellicola','cavo usb','adattatore','case'];
function similar(term,title){let t=norm(term),h=norm(title);if(!t||!h)return false;let toks=t.split(' ').filter(x=>x.length>2),hit=toks.filter(x=>h.includes(x)).length;return hit>=Math.max(2,Math.ceil(toks.length*.55));}
function hostName(u){try{return new URL(u).hostname.replace(/^www\./,'')}catch{return''}}
function resolveUrl(base,u){try{return new URL(u,base).toString()}catch{return base}}
function skipHost(h){return /(^|\.)google\./i.test(h)||/youtube\./i.test(h)||/facebook\./i.test(h)||/instagram\./i.test(h)||/tiktok\./i.test(h)||/pinterest\./i.test(h)||/subito\.it$/i.test(h)}
function walkProducts(v,out=[]){if(!v)return out;if(Array.isArray(v)){for(const x of v)walkProducts(x,out);return out}if(typeof v!=='object')return out;let typ=v['@type'];if((Array.isArray(typ)&&typ.includes('Product'))||typ==='Product')out.push(v);for(const k of ['@graph','mainEntity','itemListElement'])if(v[k])walkProducts(v[k],out);return out}
function firstImage(p){let i=p?.image;if(Array.isArray(i))i=i[0];if(i&&typeof i==='object')i=i.url||i.contentUrl;return typeof i==='string'?i:''}
function parseOffer(o){if(Array.isArray(o))o=o.find(x=>x&&typeof x==='object');if(!o||typeof o!=='object')return null;let price=money(o.price??o.lowPrice??o.highPrice??o.priceSpecification?.price),currency=o.priceCurrency||o.priceSpecification?.priceCurrency||'EUR';if(!price||String(currency).toUpperCase()!=='EUR')return null;let ship=null,sd=o.shippingDetails;if(Array.isArray(sd))sd=sd[0];if(sd){let sr=sd.shippingRate;if(Array.isArray(sr))sr=sr[0];ship=money(sr?.value??sr?.price)}let url=o.url||'';return{price,ship,url,availability:String(o.availability||'')};}
async function pageProducts(url,fallbackTitle,{term='',strictSimilarity=false,max=3}={}){
  let h=hostName(url);if(!h||skipHost(h))return[];
  let r;try{r=await fetch(url,{redirect:'follow',headers:{'user-agent':'Mozilla/5.0 (compatible; DealHunterAI/1.7)','accept':'text/html,application/xhtml+xml'}})}catch{return[]}
  if(!r.ok)return[];let ct=r.headers.get('content-type')||'';if(!ct.includes('text/html'))return[];
  let html=(await r.text()).slice(0,1500000),found=[];
  for(const m of html.matchAll(/<script[^>]*type=[\"']application\/ld\+json[\"'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{walkProducts(JSON.parse(m[1].trim()),found)}catch{}
  }
  const out=[];
  for(const p of found){
    let title=String(p.name||fallbackTitle||'').trim();if(!title)continue;
    if(strictSimilarity&&term&&!similar(term,title))continue;
    if(accessoryWords.some(w=>norm(title).includes(w)) && !accessoryWords.some(w=>norm(term).includes(w)))continue;
    let of=parseOffer(p.offers);if(!of)continue;
    let specific=p.url||of.url||'';
    if(!specific && found.length===1)specific=r.url||url;
    if(!specific)continue;
    specific=resolveUrl(r.url||url,specific);
    out.push({title:title.slice(0,220),url:specific,domain:hostName(specific),ask:of.price,ship:of.ship,image:firstImage(p),availability:of.availability,priceSource:'JSON-LD',shippingVerified:of.ship!==null,source:hostName(specific)});
    if(out.length>=max)break;
  }
  if(!out.length&&strictSimilarity&&similar(term,fallbackTitle)){
    let pm=html.match(/(?:product:price:amount|itemprop=[\"']price[\"'])[^>]*(?:content|value)=[\"']([0-9.,]+)[\"']/i);
    if(pm){let price=money(pm[1]);if(price)out.push({title:fallbackTitle,url:r.url||url,domain:hostName(r.url||url),ask:price,ship:null,image:'',availability:'',priceSource:'META',shippingVerified:false,source:hostName(r.url||url)});}
  }
  return out;
}
async function brave(q,env,count=8){let u='https://api.search.brave.com/res/v1/web/search?country=IT&search_lang=it&ui_lang=it-IT&count='+Math.min(10,count)+'&q='+encodeURIComponent(q);let r=await fetch(u,{headers:{'X-Subscription-Token':env.BRAVE_API_KEY,'Accept':'application/json'}});if(!r.ok)throw new Error('Brave '+r.status);let j=await r.json();return (j.web?.results||[]).map(x=>({title:x.title||'',url:x.url||'',description:x.description||''}));}

const DISCOVERY=[
  'offerte smartphone sconto prezzo Italia',
  'offerte console videogiochi sconto Italia',
  'offerte notebook laptop sconto Italia',
  'offerte tablet smartwatch sconto Italia',
  'offerte fotocamere obiettivi sconto Italia',
  'offerte cuffie auricolari speaker sconto Italia',
  'offerte robot aspirapolvere elettrodomestici sconto Italia',
  'offerte LEGO giochi collezionabili sconto Italia',
  'offerte monitor gaming sconto Italia',
  'offerte SSD hard disk componenti PC sconto Italia',
  'offerte piccoli elettrodomestici cucina sconto Italia',
  'offerte utensili elettrici bricolage sconto Italia'
];

async function marketFor(title,env,excludeUrl=''){
  let results=await brave('"'+title+'" prezzo compra Italia',env,6), prices=[], checked=0;
  for(const x of results.slice(0,4)){
    if(x.url===excludeUrl)continue;
    const ps=await pageProducts(x.url,x.title,{term:title,strictSimilarity:true,max:1});checked++;
    if(ps[0])prices.push(ps[0].ask+(ps[0].ship||0));
  }
  return {median:prices.length>=2?med(prices):null,samples:prices.length,checked};
}

async function searchProduct(q,env){
  const results=await brave('"'+q+'" prezzo offerta compra Italia',env,10),items=[];let pagesChecked=0;
  for(const x of results.slice(0,8)){
    const ps=await pageProducts(x.url,x.title,{term:q,strictSimilarity:true,max:1});pagesChecked++;
    for(const p of ps)items.push(p);
  }
  const totals=items.map(x=>x.ask+(x.ship||0));
  const market=totals.length>=2?med(totals):null;
  const unique=[];const seen=new Set();for(const x of items){if(!seen.has(x.url)){seen.add(x.url);unique.push({...x,term:q,total:x.ask+(x.ship||0),market,marketSource:market?'WEB_COMPARABLE_MEDIAN':null,marketSamples:totals.length});}}
  return {items:unique,stats:{queries:1,searchResults:results.length,pagesChecked,productsParsed:unique.length,marketChecks:0,marketSamples:totals.length}};
}

async function discover(env,offset=0){
  const qs=[];for(let i=0;i<4;i++)qs.push(DISCOVERY[(offset+i)%DISCOVERY.length]);
  let candidates=[],searchResults=0,pagesChecked=0;
  for(const q of qs){
    const rs=await brave(q,env,6);searchResults+=rs.length;
    for(const x of rs.slice(0,4)){
      const ps=await pageProducts(x.url,x.title,{strictSimilarity:false,max:2});pagesChecked++;
      candidates.push(...ps);
    }
  }
  const seen=new Set();candidates=candidates.filter(x=>x.ask&&x.url&&!seen.has(x.url)&&seen.add(x.url));
  candidates.sort((a,b)=>b.ask-a.ask);
  const selected=[];const perDomain={};
  for(const c of candidates){if((perDomain[c.domain]||0)>=2)continue;selected.push(c);perDomain[c.domain]=(perDomain[c.domain]||0)+1;if(selected.length>=5)break;}
  let marketChecks=0,marketSamples=0;
  for(const c of selected){try{const m=await marketFor(c.title,env,c.url);marketChecks++;marketSamples+=m.samples;c.market=m.median;c.marketSource=m.median?'WEB_COMPARABLE_MEDIAN':null;c.marketSamples=m.samples;}catch{c.market=null;c.marketSource=null;c.marketSamples=0}}
  return {items:selected.map(x=>({...x,total:x.ask+(x.ship||0)})),stats:{queries:qs.length+marketChecks,discoveryQueries:qs,searchResults,pagesChecked,productsParsed:candidates.length,selected:selected.length,marketChecks,marketSamples}};
}

export default{async fetch(req,env){
  if(req.method==='OPTIONS')return new Response('',{headers:CORS});
  const u=new URL(req.url);
  if(u.pathname==='/health')return json({ok:true,version:'1.7',brave:!!env.BRAVE_API_KEY,ebay:!!(env.EBAY_CLIENT_ID&&env.EBAY_CLIENT_SECRET)});
  if(req.headers.get('x-dealhunter-key')!==env.SCANNER_KEY)return json({error:'unauthorized'},401);
  if(!env.BRAVE_API_KEY)return json({error:'BRAVE_API_KEY_missing'},500);
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);
  let b=await req.json().catch(()=>({}));
  try{
    if(u.pathname==='/search'){
      let q=String(b.q||'').trim();if(!q)return json({error:'query_missing'},400);
      let r=await searchProduct(q,env);return json({ok:true,version:'1.7',mode:'search',query:q,generatedAt:new Date().toISOString(),...r});
    }
    if(u.pathname==='/discover'){
      let offset=Math.abs(parseInt(b.offset||0,10))%DISCOVERY.length;let r=await discover(env,offset);return json({ok:true,version:'1.7',mode:'discover',offset,generatedAt:new Date().toISOString(),...r});
    }
    return json({error:'not_found'},404);
  }catch(e){return json({error:String(e.message||e)},500)}
}};
