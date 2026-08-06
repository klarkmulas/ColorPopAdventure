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
                view.evaluateJavascript(GAME_PATCH, null);
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
            webView.loadUrl("file:///android_asset/index.html");
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
