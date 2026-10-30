// The encoder inside the `qrcode` package (no renderers), used by components/QRCode.tsx.
declare module 'qrcode/lib/core/qrcode' {
  export function create(text: string, options?: { errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' }): {
    modules: { size: number; data: Uint8Array | boolean[] };
  };
}
