import { ImageResponse } from 'next/og';

export const alt = 'Radar — Find the roles you’re missing. Explore the interactive demo by Tom Green.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(<div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', padding: '64px 76px', color: '#ecf5fc', background: 'linear-gradient(135deg, #183853, #091827)', fontFamily: 'sans-serif' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: '#aecedc' }}><span>RADAR</span><span>tomgreen.ai</span></div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}><div style={{ fontSize: 76, lineHeight: 1.06, letterSpacing: '-3px', maxWidth: 900 }}>Find the roles you’re missing.</div><div style={{ fontSize: 26, color: '#b9d0df' }}>Your context. Market signals. A considered next move.</div></div>
    <div style={{ display: 'flex', borderTop: '1px solid #476176', paddingTop: 24, fontSize: 21, color: '#b9d0df' }}>Explore the interactive demo →</div>
  </div>, size);
}
