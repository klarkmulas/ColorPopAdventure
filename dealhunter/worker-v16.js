// DealHunter AI V1.6 — Cloudflare Worker backend
// Secrets/vars required in Cloudflare dashboard:
// BRAVE_API_KEY (required), SCANNER_KEY (required)
// EBAY_CLIENT_ID + EBAY_CLIENT_SECRET (optional but recommended for resale market reference)

const CORS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'content-type,x-dealhunter-key',
  'Access-Control-Allow-Methods':'GET,POST,OPTIONS'
};
const json=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...CORS,'content-type':'application/json;charset=utf-8'}});
const money=x=>Number.isFinite(+x)?+x:null;
const med=a=>{a=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;let m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};
const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const badWords=['cover','custodia','supporto','stand','base','ricambio','cavo','pellicola','case','accessorio','accessori'];
function similar(term,title){let t=norm(term),h=norm(title);if(!t||!h)return false;let toks=t.split(' ').filter(x=>x.length>2),hit=toks.filter(x=>h.includes(x)).length;return hit>=Math.max(2,Math.ceil(toks.length*.6))&&!badWords.some(w=>h.includes(w)&&!t.includes(w));}
function hostName(u){try{return new URL(u).hostname.replace(/^www\./,'')}catch{return''}}
function isSkipHost(h){return /(^|\.)amazon\./i.test(h)||/(^|\.)ebay\./i.test(h)||/subito\.it$/i.test(h)||/google\./i.test(h)||/youtube\./i.test(h)||/facebook\./i.test(h)||/instagram\./i.test(h)||/tiktok\./i.test(h)}
function walkProducts(v,out=[]){if(!v)return out;if(Array.isArray(v)){for(const x of v)walkProducts(x,out);return out}if(typeof v!=='object')return out;let typ=v['@type'];if((Array.isArray(typ)&&typ.includes('Product'))||typ==='Product'||v.offers)out.push(v);for(const k of ['@graph','mainEntity','itemListElement'])if(v[k])walkProducts(v[k],out);return out}
function firstImage(p){let i=p?.image;if(Array.isArray(i))i=i[0];if(i&&typeof i==='object')i=i.url||i.contentUrl;return typeof i==='string'?i:''}
function parseOffer(o){if(Array.isArray(o))o=o.find(Boolean);if(!o||typeof o!=='object')return null;let price=money(o.price??o.lowPrice??o.priceSpecification?.price),currency=o.priceCurrency||o.priceSpecification?.priceCurrency||'EUR';if(!price||String(currency).toUpperCase()!=='EUR')return null;let ship=null,sd=o.shippingDetails;if(Array.isArray(sd))sd=sd[0];if(sd){let sr=sd.shippingRate;if(Array.isArray(sr))sr=sr[0];ship=money(sr?.value??sr?.price)}return{price,ship,availability:String(o.availability||'')};}
async function extractProduct(term,url,fallbackTitle){
  let h=hostName(url);if(!h||isSkipHost(h))return null;
  let r;try{r=await fetch(url,{redirect:'follow',headers:{'user-agent':'Mozilla/5.0 (compatible; DealHunterAI/1.6; +https://github.com/)','accept':'text/html,application/xhtml+xml'}})}catch{return null}
  if(!r.ok)return null;let ct=r.headers.get('content-type')||'';if(!ct.includes('text/html'))return null;
  let html=(await r.text()).slice(0,1800000),found=[];
  for(const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{let x=JSON.parse(m[1].trim());walkProducts(x,found)}catch{}
  }
  for(const p of found){let title=p.name||fallbackTitle;if(!similar(term,title))continue;let of=parseOffer(p.offers);if(!of)continue;return{title:String(title).slice(0,220),url:r.url||url,domain:hostName(r.url||url),ask:of.price,ship:of.ship,image:firstImage(p),availability:of.availability,priceSource:'JSON-LD',shippingVerified:of.ship!==null};}
  let pm=html.match(/(?:product:price:amount|itemprop=["']price["'])[^>]*(?:content|value)=["']([0-9.,]+)["']/i);if(pm&&similar(term,fallbackTitle)){let price=money(pm[1].replace('.','').replace(',','.'));if(price)return{title:fallbackTitle,url:r.url||url,domain:hostName(r.url||url),ask:price,ship:null,image:'',availability:'',priceSource:'META',shippingVerified:false};}
  return null;
}
async function brave(term,env){let q=`"${term}" (offerta OR prezzo OR compra) -usato`;
  let u='https://api.search.brave.com/res/v1/web/search?country=IT&search_lang=it&ui_lang=it-IT&count=8&q='+encodeURIComponent(q);
  let r=await fetch(u,{headers:{'X-Subscription-Token':env.BRAVE_API_KEY,'Accept':'application/json'}});if(!r.ok)throw new Error('Brave '+r.status);let j=await r.json();return (j.web?.results||[]).map(x=>({title:x.title||term,url:x.url||'',description:x.description||''}));}
let ebayTokenCache={token:'',until:0};
async function ebayToken(env){if(!env.EBAY_CLIENT_ID||!env.EBAY_CLIENT_SECRET)return'';if(ebayTokenCache.token&&Date.now()<ebayTokenCache.until)return ebayTokenCache.token;let basic=btoa(env.EBAY_CLIENT_ID+':'+env.EBAY_CLIENT_SECRET);let r=await fetch('https://api.ebay.com/identity/v1/oauth2/token',{method:'POST',headers:{'Authorization':'Basic '+basic,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials&scope='+encodeURIComponent('https://api.ebay.com/oauth/api_scope')});if(!r.ok)return'';let j=await r.json();ebayTokenCache={token:j.access_token||'',until:Date.now()+Math.max(60000,(j.expires_in||7200)*1000-120000)};return ebayTokenCache.token;}
async function ebayMarket(term,env){let tok=await ebayToken(env);if(!tok)return{median:null,cheap:[]};let u='https://api.ebay.com/buy/browse/v1/item_summary/search?q='+encodeURIComponent(term)+'&limit=20&filter='+encodeURIComponent('buyingOptions:{FIXED_PRICE}');let r=await fetch(u,{headers:{'Authorization':'Bearer '+tok,'X-EBAY-C-MARKETPLACE-ID':'EBAY_IT'}});if(!r.ok)return{median:null,cheap:[]};let j=await r.json(),rows=[];for(const it of j.itemSummaries||[]){if(!similar(term,it.title||''))continue;let ask=money(it.price?.value);if(!ask)continue;let ship=money(it.shippingOptions?.[0]?.shippingCost?.value)||0;rows.push({title:it.title,url:it.itemWebUrl||'',domain:'ebay.it',ask,ship,total:ask+ship,image:it.image?.imageUrl||'',priceSource:'EBAY_API',shippingVerified:true,source:'eBay'});}let median=med(rows.map(x=>x.total));let cheap=median?rows.filter(x=>x.total<=median*.84).slice(0,3):[];return{median,cheap};}
async function oneTerm(term,env){let web=await brave(term,env),eb=await ebayMarket(term,env),cands=[];for(const x of web.slice(0,4)){let p=await extractProduct(term,x.url,x.title);if(p)cands.push({...p,source:p.domain});}
  for(const e of eb.cheap)cands.push(e);
  let webMedian=med(cands.map(x=>(x.ask||0)+(x.ship||0)).filter(x=>x>0)),market=eb.median||webMedian;
  return cands.map((x,i)=>({id:term+'|'+i+'|'+x.url,term,title:x.title,source:x.source||x.domain,domain:x.domain,url:x.url,image:x.image||'',ask:x.ask,ship:x.ship,total:x.ask+(x.ship||0),shippingVerified:!!x.shippingVerified,priceSource:x.priceSource,availability:x.availability||'',market:market?Math.round(market*100)/100:null,marketSource:eb.median?'EBAY_ACTIVE_MEDIAN':'WEB_ACTIVE_MEDIAN'}));}
export default{async fetch(req,env){if(req.method==='OPTIONS')return new Response('',{headers:CORS});let u=new URL(req.url);if(u.pathname==='/health')return json({ok:true,version:'1.6',brave:!!env.BRAVE_API_KEY,ebay:!!(env.EBAY_CLIENT_ID&&env.EBAY_CLIENT_SECRET)});if(req.headers.get('x-dealhunter-key')!==env.SCANNER_KEY)return json({error:'unauthorized'},401);if(u.pathname!='/scan'||req.method!=='POST')return json({error:'not_found'},404);if(!env.BRAVE_API_KEY)return json({error:'BRAVE_API_KEY_missing'},500);let b=await req.json().catch(()=>({})),terms=[...new Set((b.terms||[]).map(x=>String(x).trim()).filter(Boolean))].slice(0,6);if(!terms.length)return json({error:'no_terms'},400);let items=[],errors=[];for(const term of terms){try{items.push(...await oneTerm(term,env))}catch(e){errors.push({term,error:String(e.message||e)})}}let seen=new Set();items=items.filter(x=>x.url&&x.ask&&(!seen.has(x.url)&&seen.add(x.url)));return json({ok:true,version:'1.6',generatedAt:new Date().toISOString(),terms,items,errors,limits:{maxTermsPerScan:6}})}};
