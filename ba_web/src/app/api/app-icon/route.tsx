import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

const SUPPORTED_SIZES = new Set([16, 32, 64, 180, 192, 512]);

export function GET(request: NextRequest) {
  const requestedSize = Number(request.nextUrl.searchParams.get('size'));
  const size = SUPPORTED_SIZES.has(requestedSize) ? requestedSize : 512;
  const scale = size / 512;

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: 'linear-gradient(145deg, #19284a 0%, #071522 50%, #063d35 100%)',
          border: `${Math.max(1, 8 * scale)}px solid #eafff8`,
          borderRadius: 112 * scale,
          display: 'flex',
          height: '100%',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          width: '100%',
        }}
      >
        <div
          style={{
            alignItems: 'center',
            background: 'linear-gradient(145deg, #45f2ad, #087f70)',
            border: `${Math.max(1, 10 * scale)}px solid #b9fff0`,
            borderRadius: 108 * scale,
            display: 'flex',
            height: 356 * scale,
            justifyContent: 'center',
            position: 'relative',
            transform: 'rotate(45deg)',
            width: 356 * scale,
          }}
        >
          <div
            style={{
              background: 'linear-gradient(145deg, #243760, #09111f)',
              border: `${Math.max(1, 10 * scale)}px solid #f0fff9`,
              borderRadius: 92 * scale,
              display: 'flex',
              height: 270 * scale,
              position: 'relative',
              transform: 'rotate(-45deg)',
              width: 360 * scale,
            }}
          >
            <div
              style={{
                background: '#f7fffc',
                borderRadius: 8 * scale,
                height: 82 * scale,
                left: 64 * scale,
                position: 'absolute',
                top: 120 * scale,
                width: 26 * scale,
              }}
            />
            <div
              style={{
                background: '#f7fffc',
                borderRadius: 8 * scale,
                height: 26 * scale,
                left: 36 * scale,
                position: 'absolute',
                top: 148 * scale,
                width: 82 * scale,
              }}
            />
            <div
              style={{
                background: 'radial-gradient(circle at 35% 28%, #ffffff 0 12%, #45f2ad 18%, #08745f 72%)',
                border: `${Math.max(1, 9 * scale)}px solid #06111d`,
                borderRadius: '50%',
                height: 104 * scale,
                left: 128 * scale,
                position: 'absolute',
                top: 20 * scale,
                width: 104 * scale,
              }}
            />
            <div
              style={{
                background: '#eafff8',
                border: `${Math.max(1, 6 * scale)}px solid #06111d`,
                borderRadius: 12 * scale,
                height: 112 * scale,
                left: 162 * scale,
                position: 'absolute',
                top: 102 * scale,
                width: 36 * scale,
              }}
            />
            {[
              ['#6dffd0', 274, 116],
              ['#38cfff', 306, 148],
              ['#f7d758', 242, 148],
              ['#ff6e91', 274, 180],
            ].map(([color, left, top]) => (
              <div
                key={String(color)}
                style={{
                  background: String(color),
                  border: `${Math.max(1, 6 * scale)}px solid #f7fffc`,
                  borderRadius: '50%',
                  height: 32 * scale,
                  left: Number(left) * scale,
                  position: 'absolute',
                  top: Number(top) * scale,
                  width: 32 * scale,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    }
  );
}
