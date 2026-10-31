"use client";
/**
 * "Install PUNCH Canteen" banner, ported from v63.
 * Android/desktop Chrome: shown when the browser offers installation.
 * iPhone: shown once per visit with Add-to-Home-Screen instructions.
 * v63 linked a manifest that didn't exist (404), so installation never
 * worked; the rebuild serves a real one (app/manifest.ts).
 */
import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };

const DISMISS_KEY = "pwaInstallDismissed";

export function InstallBanner() {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  const [deferred, setDeferred] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (standalone || sessionStorage.getItem(DISMISS_KEY)) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    // Defer the state update a tick so it never runs during render.
    const t = isIos ? setTimeout(() => { setIos(true); setShow(true); }, 0) : null;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPrompt);
      setShow(true);
    };
    const onInstalled = () => setShow(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return setShow(false);
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShow(false);
  }

  function later() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  return (
    <div id="pwa-install" role="dialog" aria-label="Install PUNCH Canteen" className={show ? "show" : ""}>
      <div className="pwa-mark">P</div>
      <div className="pwa-copy">
        <strong>Install PUNCH Canteen</strong>
        <small>{ios ? "On iPhone: tap Share, then “Add to Home Screen”." : "Add the canteen app to your phone for faster access."}</small>
      </div>
      <div className="pwa-actions">
        <button id="pwa-install-btn" type="button" onClick={ios ? later : install}>
          {ios ? "Got it" : "Install"}
        </button>
        <button id="pwa-dismiss" type="button" onClick={later}>
          Later
        </button>
      </div>
    </div>
  );
}
