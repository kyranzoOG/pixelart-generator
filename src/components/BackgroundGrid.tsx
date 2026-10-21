import React, { useEffect, useRef } from 'react';

export const BackgroundGrid: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse coordinates with smoothing
    const mouse = {
      x: width / 2,
      y: height / 3,
      targetX: width / 2,
      targetY: height / 3,
      radius: 320,
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('resize', handleResize);

    const gridSize = 32;
    let time = 0;

    const render = () => {
      time += 0.015;
      // Smooth mouse movement
      mouse.x += (mouse.targetX - mouse.x) * 0.12;
      mouse.y += (mouse.targetY - mouse.y) * 0.12;

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // Ambient background pulsing glow circles
      const glow1X = width * 0.25 + Math.sin(time * 0.7) * 80;
      const glow1Y = height * 0.3 + Math.cos(time * 0.5) * 60;
      const ambientGlow1 = ctx.createRadialGradient(glow1X, glow1Y, 0, glow1X, glow1Y, 400);
      ambientGlow1.addColorStop(0, 'rgba(190, 242, 100, 0.12)');
      ambientGlow1.addColorStop(1, 'rgba(190, 242, 100, 0)');
      ctx.fillStyle = ambientGlow1;
      ctx.fillRect(0, 0, width, height);

      const glow2X = width * 0.75 + Math.cos(time * 0.6) * 90;
      const glow2Y = height * 0.7 + Math.sin(time * 0.8) * 70;
      const ambientGlow2 = ctx.createRadialGradient(glow2X, glow2Y, 0, glow2X, glow2Y, 450);
      ambientGlow2.addColorStop(0, 'rgba(190, 242, 100, 0.1)');
      ambientGlow2.addColorStop(1, 'rgba(190, 242, 100, 0)');
      ctx.fillStyle = ambientGlow2;
      ctx.fillRect(0, 0, width, height);

      // Base grid lines in visible pistachio green
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(190, 242, 100, 0.18)';

      ctx.beginPath();
      for (let x = 0; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Interactive radial glow over grid around mouse
      const gradient = ctx.createRadialGradient(
        mouse.x,
        mouse.y,
        0,
        mouse.x,
        mouse.y,
        mouse.radius
      );
      gradient.addColorStop(0, 'rgba(190, 242, 100, 0.28)');
      gradient.addColorStop(0.4, 'rgba(190, 242, 100, 0.12)');
      gradient.addColorStop(1, 'rgba(190, 242, 100, 0)');

      ctx.save();
      ctx.fillStyle = gradient;
      ctx.fillRect(
        mouse.x - mouse.radius,
        mouse.y - mouse.radius,
        mouse.radius * 2,
        mouse.radius * 2
      );
      ctx.restore();

      // Highlighted grid lines near cursor
      const startX = Math.floor((mouse.x - mouse.radius) / gridSize) * gridSize;
      const endX = Math.ceil((mouse.x + mouse.radius) / gridSize) * gridSize;
      const startY = Math.floor((mouse.y - mouse.radius) / gridSize) * gridSize;
      const endY = Math.ceil((mouse.y + mouse.radius) / gridSize) * gridSize;

      for (let x = startX; x <= endX; x += gridSize) {
        for (let y = startY; y <= endY; y += gridSize) {
          const dx = x - mouse.x;
          const dy = y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouse.radius) {
            const intensity = 1 - dist / mouse.radius;
            // Draw bright intersection dots
            ctx.fillStyle = `rgba(190, 242, 100, ${intensity * 0.85})`;
            ctx.fillRect(x - 2, y - 2, 4, 4);
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ display: 'block' }}
    />
  );
};
