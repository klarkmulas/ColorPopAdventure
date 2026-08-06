package com.colorpop.adventure;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private WebView webView;

    private static final String GAME_PATCH =
        "(function(){" +
        "let sharedAudioCtx=null;" +
        "window.getAudioContext=function(){" +
        "if(typeof soundOn!=='undefined'&&!soundOn)return null;" +
        "try{" +
        "if(!sharedAudioCtx){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;sharedAudioCtx=new C();}" +
        "if(sharedAudioCtx.state==='suspended')sharedAudioCtx.resume().catch(function(){});" +
        "return sharedAudioCtx;" +
        "}catch(e){sharedAudioCtx=null;return null;}" +
        "};" +
        "window.beep=function(freq,dur,type,vol){" +
        "freq=freq||440;dur=dur||0.07;type=type||'sine';vol=vol||0.035;" +
        "if(typeof soundOn!=='undefined'&&!soundOn)return;" +
        "const ctx=window.getAudioContext();if(!ctx)return;" +
        "try{const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,ctx.currentTime);" +
        "g.gain.setValueAtTime(Math.max(vol,0.0001),ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+dur);" +
        "o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+dur);o.onended=function(){try{o.disconnect();g.disconnect();}catch(e){}};}catch(e){}" +
        "};" +

        "function seeded(seed){let s=seed>>>0;return function(){s=(s*1664525+1013904223)>>>0;return s/4294967296;};}" +
        "function levelConfig(index){" +
        "if(index<=2)return{colors:3,minRuns:2,maxRuns:2,margin:6-index,label:'Facile'};" +
        "if(index<=6)return{colors:4,minRuns:2,maxRuns:3,margin:Math.max(2,8-index),label:'Normale'};" +
        "if(index<=11)return{colors:4,minRuns:3,maxRuns:3,margin:Math.max(0,11-index),label:'Impegnativo'};" +
        "if(index<=15)return{colors:5,minRuns:3,maxRuns:4,margin:Math.max(0,15-index),label:'Difficile'};" +
        "return{colors:5,minRuns:4,maxRuns:4,margin:Math.max(0,19-index),label:'Esperto'};" +
        "}" +
        "function partitionFor(runs,rnd){" +
        "const p2=[[4,4],[3,5],[5,3],[2,6],[6,2]];" +
        "const p3=[[2,2,4],[2,3,3],[3,2,3],[3,3,2],[2,4,2],[4,2,2]];" +
        "const p4=[[2,2,2,2]];" +
        "const list=runs===2?p2:runs===3?p3:p4;return list[Math.floor(rnd()*list.length)].slice();" +
        "}" +
        "function makeSolvableBoard(index){" +
        "const cfg=levelConfig(index),rnd=seeded(90817+(index+1)*7919);" +
        "const out=Array.from({length:ROWS},function(){return Array(COLS).fill(null);});" +
        "let segments=0;" +
        "for(let c=0;c<COLS;c++){" +
        "const runs=cfg.minRuns+Math.floor(rnd()*(cfg.maxRuns-cfg.minRuns+1));" +
        "const parts=partitionFor(runs,rnd);segments+=parts.length;let bottom=ROWS-1;let previous=-1;" +
        "for(let k=0;k<parts.length;k++){" +
        "const size=parts[k],top=bottom-size+1;let best=[],bestScore=999;" +
        "for(let color=0;color<cfg.colors;color++){" +
        "let penalty=color===previous?50:0;" +
        "if(c>0){for(let r=top;r<=bottom;r++){if(out[r][c-1]&&out[r][c-1].color===color)penalty++;}}" +
        "if(penalty<bestScore){bestScore=penalty;best=[color];}else if(penalty===bestScore)best.push(color);" +
        "}" +
        "const color=best[Math.floor(rnd()*best.length)];" +
        "for(let r=top;r<=bottom;r++)out[r][c]={color:color,special:null,ice:false};" +
        "previous=color;bottom=top-1;" +
        "}" +
        "}" +
        "return{grid:out,optimal:segments,startMoves:segments+cfg.margin,label:cfg.label,colors:cfg.colors};" +
        "}" +

        "window.__levelPlan=null;" +
        "window.buildGrid=function(){" +
        "window.__levelPlan=makeSolvableBoard(currentLevel);grid=window.__levelPlan.grid;moves=window.__levelPlan.startMoves;renderBoard();" +
        "};" +
        "window.startLevel=function(index){" +
        "currentLevel=index;score=0;collected=0;selected=[];dragging=false;lock=false;toolMode=null;" +
        "hammerCount=1;bombCount=1;movesBonusCount=1;levelLabel.textContent=index+1;showScreen('game');" +
        "requestAnimationFrame(function(){buildGrid();updateUI();requestAnimationFrame(function(){renderBoard();updateUI();});});" +
        "};" +
        "window.calculateStars=function(){" +
        "const plan=window.__levelPlan;if(!plan)return 1;const used=plan.startMoves-moves;" +
        "if(used<=plan.optimal)return 3;if(used<=plan.optimal+2)return 2;return 1;" +
        "};" +
        "const originalUpdateUI=window.updateUI;" +
        "if(typeof originalUpdateUI==='function'){window.updateUI=function(){" +
        "originalUpdateUI();const plan=window.__levelPlan;if(plan&&goalEl){goalEl.textContent='Svuota tutto: '+countBalls()+' palline • '+plan.label+' • soluzione garantita';}" +
        "};}" +
        "window.resolveNoMoves=async function(){" +
        "if(countBalls()===0)return;showToast('NESSUNA COMBO');beep(260,.12,'triangle',.04);" +
        "if(goalEl)goalEl.textContent='Nessuna combinazione: usa Mescola, Martello o Bomba';" +
        "};" +
        "const oldRender=window.renderBoard;" +
        "if(typeof oldRender==='function'){window.renderBoard=function(){" +
        "if(!board||board.clientWidth<50||board.clientHeight<50){requestAnimationFrame(window.renderBoard);return;}" +
        "return oldRender();" +
        "};}" +
        "document.addEventListener('pointerdown',function(){const c=window.getAudioContext();if(c&&c.state==='suspended')c.resume().catch(function(){});},{passive:true});" +
        "})();";

    private static final String VISUAL_PATCH =
        "(function(){" +
        "if(document.getElementById('cpa-visual-patch'))return;" +
        "const style=document.createElement('style');" +
        "style.id='cpa-visual-patch';" +
        "style.textContent=`" +
        "#board{isolation:isolate;background:linear-gradient(180deg,rgba(12,5,58,.68),rgba(7,3,37,.78))!important;border:3px solid rgba(213,111,255,.9)!important;box-shadow:0 18px 48px rgba(0,0,0,.45),0 0 28px rgba(190,63,255,.34),inset 0 0 0 2px rgba(87,163,255,.16),inset 0 0 36px rgba(90,51,190,.3)!important;}" +
        "#board::before{content:'';position:absolute;inset:8px;z-index:1;border-radius:17px;pointer-events:none;background-image:linear-gradient(rgba(130,88,224,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(130,88,224,.13) 1px,transparent 1px);background-size:calc(100% / 7) calc(100% / 8);opacity:.5;}" +
        "#board::after{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.72;background-image:url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 700 820'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='%23120a50'/><stop offset='.56' stop-color='%23321a88'/><stop offset='1' stop-color='%23ff9b78'/></linearGradient><linearGradient id='m' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='%23ff8cf5' stop-opacity='.6'/><stop offset='1' stop-color='%23ffbc70' stop-opacity='0'/></linearGradient></defs><rect width='700' height='820' fill='url(%23g)'/><g fill='%23fff'><circle cx='80' cy='75' r='2'/><circle cx='140' cy='120' r='1.8'/><circle cx='220' cy='55' r='1.7'/><circle cx='310' cy='98' r='2'/><circle cx='410' cy='62' r='1.5'/><circle cx='490' cy='110' r='1.8'/><circle cx='585' cy='74' r='2'/><circle cx='650' cy='130' r='1.7'/><circle cx='530' cy='42' r='2.6'/><circle cx='115' cy='36' r='2.6'/><circle cx='350' cy='155' r='1.8'/><circle cx='450' cy='170' r='1.4'/></g><path d='M90 290C250 210 430 210 610 275' fill='none' stroke='url(%23m)' stroke-width='46' stroke-linecap='round'/><path d='M0 650C70 620 130 570 180 520c35 58 84 78 150 92c64-105 132-138 220-154c31 55 82 112 132 150c38-37 75-61 120-85V820H0Z' fill='%23120b46'/><path d='M0 690c70-48 125-69 198-81c31 33 67 59 128 73c45-60 85-94 145-124c66 31 131 78 229 132V820H0Z' fill='%231d0f63'/><path d='M55 510h12v80h-12zM44 590h34v8H44zM84 545h10v45H84zM79 590h24v8H79zM612 505h12v85h-12zM600 590h36v8H600zM640 545h10v45h-10zM634 590h24v8h-24z' fill='%2323126a'/><path d='M61 494l19 16H42zM618 489l20 18h-40zM89 533l14 13H75zM645 533l12 12h-24z' fill='%23ffb85f'/><circle cx='350' cy='690' r='78' fill='%23ffdf95' fill-opacity='.13'/></svg>\");background-size:cover;background-position:center;filter:saturate(1.08) brightness(1.06);}" +
        ".ball{z-index:2!important;border:1px solid rgba(255,255,255,.38)!important;box-shadow:inset 0 10px 13px rgba(255,255,255,.52),inset 0 -12px 16px rgba(0,0,0,.28),0 6px 10px rgba(0,0,0,.32),0 0 12px rgba(255,255,255,.14)!important;}" +
        ".ice{z-index:3!important;}" +
        ".ball.selected{z-index:8!important;filter:brightness(1.22) saturate(1.12)!important;box-shadow:inset 0 10px 13px rgba(255,255,255,.62),inset 0 -12px 16px rgba(0,0,0,.2),0 0 0 5px rgba(255,233,94,.28),0 0 24px #fff,0 0 42px rgba(86,201,255,.86)!important;}" +
        "`;" +
        "document.head.appendChild(style);" +
        "})();";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.parseColor("#171831"));
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#171831"));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (url != null && url.endsWith("index.html")) {
                    view.evaluateJavascript(GAME_PATCH, null);
                    view.evaluateJavascript(VISUAL_PATCH, null);
                }
            }
        });

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);

        setContentView(webView);
        hideSystemBars();

        if (savedInstanceState == null) {
            webView.loadUrl("file:///android_asset/home.html");
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private void hideSystemBars() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            );
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onPause() {
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        hideSystemBars();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
