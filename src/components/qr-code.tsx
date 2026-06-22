'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Download } from 'lucide-react';

interface QRCodeProps {
  /** The plant slug to encode in the QR URL */
  slug: string;
  /** Optional plant name for the label */
  plantName?: string;
  /** Whether to show in compact mode (for inline display) */
  compact?: boolean;
  /** Whether to show the download button */
  showDownload?: boolean;
}

/**
 * Generate a plant detail URL for a given slug.
 * Uses the current origin in development, or the Vercel URL in production.
 */
function getPlantUrl(slug: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/plant/${slug}`;
  }
  return `https://plantcaer.vercel.app/plant/${slug}`;
}

export function QRCode({
  slug,
  plantName,
  compact = false,
  showDownload = true,
}: QRCodeProps) {
  const url = getPlantUrl(slug);

  const handleDownload = () => {
    const svg = document.getElementById(`qr-${slug}`);
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    const doDownload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx?.scale(2, 2);
      ctx?.drawImage(img, 0, 0);

      const png = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.download = `plantcaer-${slug}.png`;
      a.href = png;
      a.click();
    };

    img.onload = doDownload;
    img.onerror = doDownload;

    // Safely encode SVG (handle unicode characters)
    const encoded = encodeURIComponent(svgData);
    img.src = `data:image/svg+xml;charset=utf-8,${encoded}`;
  };

  const size = compact ? 80 : 140;

  return (
    <div className={`flex flex-col items-center gap-2 ${compact ? '' : 'p-4'}`}>
      <QRCodeSVG
        id={`qr-${slug}`}
        value={url}
        size={size}
        level="M"
        fgColor="#e2e8f0"
        bgColor="transparent"
        imageSettings={{
          src: '/favicon.ico',
          excavate: true,
          height: size <= 80 ? 12 : 20,
          width: size <= 80 ? 12 : 20,
        }}
      />
      {!compact && plantName && (
        <p className="text-xs text-white/50 text-center max-w-[140px] truncate">
          {plantName}
        </p>
      )}
      {showDownload && !compact && (
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-[10px] text-white/50 hover:text-white hover:bg-white/10 transition-all"
        >
          <Download className="h-3 w-3" />
          Download PNG
        </button>
      )}
    </div>
  );
}
