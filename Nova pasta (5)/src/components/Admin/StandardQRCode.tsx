import { QRCodeCanvas } from 'qrcode.react';
import { cn } from '@/lib/utils';
import { useRef } from 'react';

interface StandardQRCodeProps {
  value: string;
}

export function StandardQRCode({ 
  value
}: StandardQRCodeProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div 
        ref={qrRef}
        className="bg-white p-2 border border-neutral-100 rounded-lg shadow-sm"
      >
        <QRCodeCanvas
          value={value}
          size={200}
          level="M"
          includeMargin={true}
          className="w-full h-full max-w-[180px] max-h-[180px]"
        />
      </div>
    </div>
  );
}
