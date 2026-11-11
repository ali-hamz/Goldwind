import { useEffect, useRef, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

/** Shown once each time the site is opened, then it leaves on its own. */
export function InstallPrompt() {
  const [open, setOpen] = useState(false);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as BeforeInstallPromptEvent;
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    setOpen(true);
    const hide = window.setTimeout(() => setOpen(false), 4000);
    return () => {
      window.clearTimeout(hide);
      window.removeEventListener('beforeinstallprompt', onPrompt);
    };
  }, []);

  if (!open) return null;

  return (
    <div className="install-pop-wrap">
      <div className="install-pop" role="dialog" aria-label="Install as an app">
        <img src="/brand/icon-192.png?v=2" alt="" />
        <div className="install-copy">
          <b>Install as an app</b>
          <span>Add Starah IPP 2GW to this device</span>
        </div>
        <button
          type="button"
          className="install-go"
          onClick={() => {
            const pending = promptRef.current;
            if (!pending) return;
            void pending.prompt();
            setOpen(false);
          }}
        >
          Install
        </button>
      </div>
    </div>
  );
}
