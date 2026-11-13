"use client";

import { useEffect, useRef } from "react";

export function QrScanner({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
  const id = "sayola-qr-reader";
  const handled = useRef(false);

  useEffect(() => {
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;
    let cancelled = false;
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled) return;
      const instance = new Html5Qrcode(id);
      scanner = instance;
      instance
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 220 },
          (text) => {
            if (handled.current) return;
            handled.current = true;
            onScan(text);
          },
          () => {},
        )
        .catch(() => onClose());
    });
    return () => {
      cancelled = true;
      scanner?.stop().then(() => scanner?.clear()).catch(() => {});
    };
  }, [onScan, onClose]);

  return (
    <div className="space-y-2">
      <div id={id} className="overflow-hidden rounded-xl bg-black" />
      <button className="text-sm text-stone-600 underline" onClick={onClose}>
        إغلاق الكاميرا
      </button>
    </div>
  );
}
