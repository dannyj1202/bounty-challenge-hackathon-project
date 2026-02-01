import React, { useRef, useEffect } from 'react';

/**
 * Flowing dot-field background: wave-like motion, varying density for depth.
 * Dark purple, indigo, muted violet on black. Smooth, slow, elegant.
 */
export default function ParticleBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId;
    let startTime = 0;

    let w = window.innerWidth;
    let h = window.innerHeight;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const colors = [
      'rgba(88, 28, 135, 0.9)',   // violet-900
      'rgba(67, 56, 202, 0.85)',  // indigo-700
      'rgba(99, 102, 241, 0.7)',  // indigo-500
      'rgba(129, 140, 248, 0.6)', // indigo-400
      'rgba(167, 139, 250, 0.5)', // violet-300
    ];

    const spacing = 28;
    const waveSpeed = 0.00018;
    const waveAmp = 0.4;
    const waveFreq = 0.0022;

    function draw(time) {
      if (!canvas.width || !canvas.height) {
        animationId = requestAnimationFrame(draw);
        return;
      }
      if (!startTime) startTime = time;
      const t = (time - startTime) * waveSpeed;

      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, w, h);
      const cols = Math.ceil(w / spacing) + 2;
      const rows = Math.ceil(h / spacing) + 2;

      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          const x = j * spacing - spacing;
          const yBase = i * spacing;
          const phase = x * waveFreq + t;
          const wave = Math.sin(phase) * waveAmp * h + Math.sin(phase * 1.7 + t * 0.5) * waveAmp * 0.5 * h;
          const y = yBase + wave;

          const norm = (Math.sin(phase) + 1) / 2;
          const colorIndex = Math.min(Math.floor(norm * (colors.length - 0.01)), colors.length - 1);
          const alphaScale = 0.4 + norm * 0.6;
          const dotColor = colors[colorIndex].replace(/[\d.]+\)$/, `${alphaScale})`);
          const radius = 1.2 + norm * 0.8;

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = dotColor;
          ctx.fill();
        }
      }

      animationId = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    animationId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ background: '#0a0a0f' }}
      aria-hidden
    />
  );
}
