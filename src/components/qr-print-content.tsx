'use client';

import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import { Printer } from 'lucide-react';

interface QRPrintContentProps {
  plants: { slug: string; common_name: string; nickname: string | null }[];
}

function getPlantUrl(slug: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/plant/${slug}`;
  }
  return `https://plantcaer.vercel.app/plant/${slug}`;
}

export function QRPrintContent({ plants }: QRPrintContentProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <div>
           <h1 className="text-2xl font-bold text-stone-800 sm:text-3xl">QR Pot Stickers</h1>
           <p className="mt-1 text-stone-500">
            {plants.length} sticker{plants.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="glass-card flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100/80 transition-all"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
      </div>

      <div className="glass-card rounded-2xl p-4 sm:p-6 no-print">
        <p className="text-xs text-stone-500">
          These QR codes link to each plant&apos;s detail page. Print, cut, and attach to your pots.
          Each sticker is ~1.5 x 1.5 inches (4 x 4 cm) when printed at full size.
        </p>
      </div>

      {/* Print-optimized grid */}
      <div className="qr-sticker-grid">
        {plants.map((plant) => {
          const url = getPlantUrl(plant.slug);
          const name = plant.nickname || plant.common_name;

          return (
            <div
              key={plant.slug}
              className="qr-sticker"
            >
              <QRCodeSVG
                value={url}
                size={140}
                level="M"
                fgColor="#1a1a1a"
                bgColor="#ffffff"
                imageSettings={{
                  src: '/favicon.ico',
                  excavate: true,
                  height: 20,
                  width: 20,
                }}
              />
              <p className="text-xs font-medium text-gray-900 text-center mt-1 leading-tight max-w-[140px]">
                {name}
              </p>
              <p className="text-[9px] text-gray-500 text-center mt-0.5">
                plantcaer
              </p>
            </div>
          );
        })}
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          @page { margin: 0.5in; }
        }

        .qr-sticker-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 16px;
        }

        @media print {
          .qr-sticker-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
          }
        }

        .qr-sticker {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 12px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          break-inside: avoid;
          page-break-inside: avoid;
        }

        @media print {
          .qr-sticker {
            background: white;
            border: 1px solid #e5e7eb;
            box-shadow: none;
            padding: 8px;
          }
        }
      `}</style>
    </div>
  );
}
