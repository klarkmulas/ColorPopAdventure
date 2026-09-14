// DealHunter AI V1.8 — Cloudflare Worker backend
// Secrets required: BRAVE_API_KEY, SCANNER_KEY
// Optional: EBAY_CLIENT_ID, EBAY_CLIENT_SECRET

const CORS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'content-type,x-dealhunter-key',
  'Access-Control-Allow-Methods':'GET,POST,OPTIONS'
};
const json=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...CORS,'content-type':'application/json;charset=utf-8'}});
const money=x=>{if(x===null||x===undefined||x==='')return null;let z=String(x).trim().replace(/\s/g,'');if(!z)return null;z=z.replace(/[^0-9.,-]/g,'');if(!z)return null;if(z.includes(',')&&z.includes('.')){if(z.lastIndexOf(',')>z.lastIndexOf('.'))z=z.replace(/\./g,'').replace(',','.');else z=z.replace(/,/g,'')}else if(z.includes(','))z=z.replace(',','.');const n=Number(z);return Number.isFinite(n)?n:null};
const med=a=>{a=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;let m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};
const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const accessoryWords=['cover','custodia','supporto','stand','base','ricambio','pellicola','cavo usb','adattatore','case','vetro temperato','caricatore'];
function similar(term,title){let t=norm(term),h=norm(title);if(!t||!h)return false;let toks=t.split(' ').filter(x=>x.length>2),hit=toks.filter(x=>h.includes(x)).length;return hit>=Math.max(1,Math.ceil(toks.length*.5));}
function hostName(u){try{return new URL(u).hostname.replace(/^www\./,'')}catch{return''}}
function resolveUrl(base,u){try{return new URL(u,base).toString()}catch{return base}}
function skipHost(h){return /(^|\.)google\./i.test(h)||/youtube\./i.test(h)||/facebook\./i.test(h)||/instagram\./i.test(h)||/tiktok\./i.test(h)||/pinterest\./i.test(h)||/subito\.it$/i.test(h)}
function walkObjects(v,out=[]){if(!v)return out;if(Array.isArray(v)){for(const x of v)walkObjects(x,out);return out}if(typeof v!=='object')return out;out.push(v);for(const x of Object.values(v))if(x&&typeof x==='object')walkObjects(x,out);return out}
function walkProducts(v,out=[]){if(!v)return out;if(Array.isArray(v)){for(const x of v)walkProducts(x,out);return out}if(typeof v!=='object')return out;let typ=v['@type'];if((Array.isArray(typ)&&typ.some(t=>String(t).toLowerCase()==='product'))||String(typ||'').toLowerCase()==='product'||v.offers)out.push(v);for(const x of Object.values(v))if(x&&typeof x==='object')walkProducts(x,out);return out}
function firstImage(p){let i=p?.image??p?.thumbnail??p?.thumbnailUrl;if(Array.isArray(i))i=i[0];if(i&&typeof i==='object')i=i.url||i.contentUrl||i.imageUrl;return typeof i==='string'?i:''}
function parseOffer(o){if(Array.isArray(o))o=o.find(x=>x&&typeof x==='object');if(!o||typeof o!=='object')return null;let price=money(o.price??o.lowPrice??o.highPrice??o.priceSpecification?.price??o.sale_price??o.currentPrice??o.value),currency=o.priceCurrency||o.priceSpecification?.priceCurrency||o.currency||'EUR';if(!price||price<2||price>20000||String(currency).toUpperCase()!=='EUR')return null;let ship=null,sd=o.shippingDetails;if(Array.isArray(sd))sd=sd[0];if(sd){let sr=sd.shippingRate;if(Array.isArray(sr))sr=sr[0];ship=money(sr?.value??sr?.price)}let url=o.url||o.offerUrl||'';return{price,ship,url,availability:String(o.availability||'')};}
function priceFromText(txt){txt=String(txt||'').replace(/\u00a0/g,' ');const pats=[/(?:€|EUR)\s*([0-9]{1,5}(?:[.,][0-9]{2})?)/gi,/([0-9]{1,5}(?:[.,][0-9]{2})?)\s*(?:€|EUR)\b/gi];let vals=[];for(const re of pats){for(const m of txt.matchAll(re)){let n=money(m[1]);if(n>=5&&n<=10000)vals.push(n)}}return vals.length?vals[0]:null}
function braveStructured(x,term='',strictSimilarity=false){
  const title=String(x.title||'').trim();if(!title||!x.url)return null;
  if(strictSimilarity&&term&&!similar(term,title))return null;
  const nt=norm(title),nterm=norm(term);
  if(accessoryWords.some(w=>nt.includes(w))&&!accessoryWords.some(w=>nterm.includes(w)))return null;
  const pools=[x.product,x.product_cluster,x.schemas,x.deep_results];
  for(const pool of pools){
    if(!pool)continue;
    const prods=walkProducts(pool,[]);
    for(const p of prods){
      let nm=String(p.name||p.title||title).trim();
      if(strictSimilarity&&term&&!similar(term,nm))continue;
      let of=parseOffer(p.offers||p.offer||p.priceSpecification||p);
      if(!of)continue;
      let u=resolveUrl(x.url,p.url||of.url||x.url);
      return{title:nm.slice(0,220),url:u,domain:hostName(u),ask:of.price,ship:of.ship,image:firstImage(p)||x.thumbnail?.src||x.thumbnail?.original||'',availability:of.availability,priceSource:'BRAVE_SCHEMA',shippingVerified:of.ship!==null,source:hostName(u),confidence:'medium'};
    }
    for(const o of walkObjects(pool,[])){
      let price=money(o.price??o.lowPrice??o.sale_price??o.currentPrice??o.value);
      if(!price||price<5||price>10000)continue;
      let nm=String(o.name||o.title||title).trim();if(strictSimilarity&&term&&!similar(term,nm))continue;
      let u=resolveUrl(x.url,o.url||x.url);
      return{title:nm.slice(0,220),url:u,domain:hostName(u),ask:price,ship:null,image:firstImage(o)||x.thumbnail?.src||'',availability:'',priceSource:'BRAVE_SCHEMA',shippingVerified:false,source:hostName(u),confidence:'medium'};
    }
  }
  const text=[title,x.description,...(x.extra_snippets||[])].filter(Boolean).join(' · ');
  const price=priceFromText(text);
  if(price){
    return{title:title.slice(0,220),url:x.url,domain:hostName(x.url),ask:price,ship:null,image:x.thumbnail?.src||x.thumbnail?.original||'',availability:'',priceSource:'BRAVE_SNIPPET',shippingVerified:false,source:hostName(x.url),confidence:'low'};
  }
  return null;
}
async function pageProducts(url,fallbackTitle,{term='',strictSimilarity=false,max=3}={}){
  let h=hostName(url);if(!h||skipHost(h))return[];
  let r;try{r=await fetch(url,{redirect:'follow',headers:{'user-agent':'Mozilla/5.0 (compatible; DealHunterAI/1.8)','accept':'text/html,application/xhtml+xml'}})}catch{return[]}
  if(!r.ok)return[];let ct=r.headers.get('content-type')||'';if(!ct.includes('text/html'))return[];
  let html=(await r.text()).slice(0,1800000),found=[];
  for(const m of html.matchAll(/<script[^>]*type=[\"']application\/ld\+json[\"'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{walkProducts(JSON.parse(m[1].trim()),found)}catch{}
  }
  const out=[];
  for(const p of found){
    let title=String(p.name||fallbackTitle||'').trim();if(!title)continue;
    if(strictSimilarity&&term&&!similar(term,title))continue;
    if(accessoryWords.some(w=>norm(title).includes(w))&&!accessoryWords.some(w=>norm(term).includes(w)))continue;
    let of=parseOffer(p.offers);if(!of)continue;
    let specific=p.url||of.url||r.url||url;specific=resolveUrl(r.url||url,specific);
    out.push({title:title.slice(0,220),url:specific,domain:hostName(specific),ask:of.price,ship:of.ship,image:firstImage(p),availability:of.availability,priceSource:'PAGE_JSONLD',shippingVerified:of.ship!==null,source:hostName(specific),confidence:'high'});
    if(out.length>=max)break;
  }
  if(!out.length){
    let textPrice=null;
    const metaPatterns=[/(?:product:price:amount|itemprop=[\"']price[\"'])[^>]*(?:content|value)=[\"']([0-9.,]+)[\"']/i,/property=[\"']og:price:amount[\"'][^>]*content=[\"']([0-9.,]+)[\"']/i,/name=[\"']twitter:data1[\"'][^>]*content=[\"'](?:€\s*)?([0-9.,]+)/i];
    for(const re of metaPatterns){let m=html.match(re);if(m){textPrice=money(m[1]);if(textPrice)break}}
    if(!textPrice)textPrice=priceFromText(html.slice(0,250000));
    if(textPrice&&(!strictSimilarity||similar(term,fallbackTitle))){out.push({title:fallbackTitle,url:r.url||url,domain:hostName(r.url||url),ask:textPrice,ship:null,image:'',availability:'',priceSource:'PAGE_META',shippingVerified:false,source:hostName(r.url||url),confidence:'medium'});}
  }
  return out;
}
async function brave(q,env,count=8){
  let u='https://api.search.brave.com/res/v1/web/search?country=IT&search_lang=it&ui_lang=it-IT&count='+Math.min(10,count)+'&extra_snippets=true&text_decorations=false&q='+encodeURIComponent(q);
  let r=await fetch(u,{headers:{'X-Subscription-Token':env.BRAVE_API_KEY,'Accept':'application/json'}});if(!r.ok)throw new Error('Brave '+r.status);let j=await r.json();
  return (j.web?.results||[]).map(x=>({title:x.title||'',url:x.url||'',description:x.description||'',extra_snippets:x.extra_snippets||[],thumbnail:x.thumbnail||null,schemas:x.schemas||null,product:x.product||null,product_cluster:x.product_cluster||null,deep_results:x.deep_results||null}));
}

const DISCOVERY=[
  'offerte smartphone sconto prezzo Italia acquista',
  'offerte console videogiochi sconto Italia acquista',
  'offerte notebook laptop sconto Italia acquista',
  'offerte tablet smartwatch sconto Italia acquista',
  'offerte fotocamere obiettivi sconto Italia acquista',
  'offerte cuffie auricolari speaker sconto Italia acquista',
  'offerte robot aspirapolvere elettrodomestici sconto Italia acquista',
  'offerte LEGO giochi collezionabili sconto Italia acquista',
  'offerte monitor gaming sconto Italia acquista',
  'offerte SSD hard disk componenti PC sconto Italia acquista',
  'offerte piccoli elettrodomestici cucina sconto Italia acquista',
  'offerte utensili elettrici bricolage sconto Italia acquista'
];

async function candidateFromResult(x,opts={}){
  const page=await pageProducts(x.url,x.title,opts);
  if(page[0])return{item:page[0],via:'page'};
  const idx=braveStructured(x,opts.term||'',!!opts.strictSimilarity);
  if(idx)return{item:idx,via:'index'};
  return{item:null,via:'none'};
}
async function marketFor(title,env,excludeUrl=''){
  let results=await brave('"'+title+'" prezzo compra Italia',env,8),prices=[],checked=0,indexed=0,page=0;
  for(const x of results.slice(0,6)){
    if(x.url===excludeUrl)continue;
    const r=await candidateFromResult(x,{term:title,strictSimilarity:true,max:1});checked++;
    if(r.item){prices.push(r.item.ask+(r.item.ship||0));if(r.via==='page')page++;else indexed++;}
    if(prices.length>=4)break;
  }
  return{median:prices.length>=2?med(prices):null,samples:prices.length,checked,indexed,page};
}
async function searchProduct(q,env){
  const results=await brave('"'+q+'" prezzo offerta compra Italia',env,10),items=[];let pagesChecked=0,indexFallback=0,pageParsed=0;
  for(const x of results.slice(0,10)){
    const r=await candidateFromResult(x,{term:q,strictSimilarity:true,max:1});pagesChecked++;
    if(r.item){items.push(r.item);if(r.via==='page')pageParsed++;else indexFallback++;}
  }
  const seen=new Set();let unique=items.filter(x=>x.ask&&x.url&&!seen.has(x.url)&&seen.add(x.url));
  const totals=unique.map(x=>x.ask+(x.ship||0)).filter(Number.isFinite);
  const market=totals.length>=2?med(totals):null;
  unique=unique.map(x=>({...x,term:q,total:x.ask+(x.ship||0),market,marketSource:market?'WEB_COMPARABLE_MEDIAN':null,marketSamples:totals.length}));
  return{items:unique,stats:{queries:1,searchResults:results.length,pagesChecked,productsParsed:unique.length,pageParsed,indexFallback,marketChecks:0,marketSamples:totals.length}};
}
async function discover(env,offset=0){
  const qs=[];for(let i=0;i<4;i++)qs.push(DISCOVERY[(offset+i)%DISCOVERY.length]);
  let candidates=[],searchResults=0,pagesChecked=0,indexFallback=0,pageParsed=0;
  for(const q of qs){
    const rs=await brave(q,env,8);searchResults+=rs.length;
    for(const x of rs.slice(0,6)){
      const r=await candidateFromResult(x,{strictSimilarity:false,max:1});pagesChecked++;
      if(r.item){candidates.push(r.item);if(r.via==='page')pageParsed++;else indexFallback++;}
    }
  }
  const seen=new Set();candidates=candidates.filter(x=>x.ask&&x.url&&!seen.has(x.url)&&seen.add(x.url));
  candidates.sort((a,b)=>a.ask-b.ask);
  const selected=[],perDomain={};
  for(const c of candidates){if((perDomain[c.domain]||0)>=2)continue;selected.push(c);perDomain[c.domain]=(perDomain[c.domain]||0)+1;if(selected.length>=8)break;}
  let marketChecks=0,marketSamples=0,marketIndexFallback=0,marketPageParsed=0;
  for(const c of selected){
    try{const m=await marketFor(c.title,env,c.url);marketChecks++;marketSamples+=m.samples;marketIndexFallback+=m.indexed;marketPageParsed+=m.page;c.market=m.median;c.marketSource=m.median?'WEB_COMPARABLE_MEDIAN':null;c.marketSamples=m.samples;}catch{c.market=null;c.marketSource=null;c.marketSamples=0}
  }
  return{items:selected.map(x=>({...x,total:x.ask+(x.ship||0)})),stats:{queries:qs.length+marketChecks,discoveryQueries:qs,searchResults,pagesChecked,productsParsed:candidates.length,pageParsed,indexFallback,selected:selected.length,marketChecks,marketSamples,marketIndexFallback,marketPageParsed}};
}

export default{async fetch(req,env){
  if(req.method==='OPTIONS')return new Response('',{headers:CORS});
  const u=new URL(req.url);
  if(u.pathname==='/health')return json({ok:true,version:'1.8',brave:!!env.BRAVE_API_KEY,ebay:!!(env.EBAY_CLIENT_ID&&env.EBAY_CLIENT_SECRET)});
  if(req.headers.get('x-dealhunter-key')!==env.SCANNER_KEY)return json({error:'unauthorized'},401);
  if(!env.BRAVE_API_KEY)return json({error:'BRAVE_API_KEY_missing'},500);
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);
  let b=await req.json().catch(()=>({}));
  try{
    if(u.pathname==='/search'){
      let q=String(b.q||'').trim();if(!q)return json({error:'query_missing'},400);
      let r=await searchProduct(q,env);return json({ok:true,version:'1.8',mode:'search',query:q,generatedAt:new Date().toISOString(),...r});
    }
    if(u.pathname==='/discover'){
      let offset=Math.abs(parseInt(b.offset||0,10))%DISCOVERY.length;let r=await discover(env,offset);return json({ok:true,version:'1.8',mode:'discover',offset,generatedAt:new Date().toISOString(),...r});
    }
    return json({error:'not_found'},404);
  }catch(e){return json({error:String(e.message||e)},500)}
}};
