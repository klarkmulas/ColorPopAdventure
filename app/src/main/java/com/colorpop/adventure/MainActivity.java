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
        "if(typeof startLevel==='function'){window.startLevel=function(index){" +
        "currentLevel=index;score=0;collected=0;moves=LEVELS[index].moves;selected=[];dragging=false;lock=false;toolMode=null;" +
        "hammerCount=1;bombCount=1;movesBonusCount=1;levelLabel.textContent=index+1;showScreen('game');" +
        "requestAnimationFrame(function(){buildGrid();updateUI();requestAnimationFrame(function(){renderBoard();updateUI();});});" +
        "};}" +
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
