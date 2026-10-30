import { useEffect, useRef } from 'react';

const POINT_COLOR = '36, 107, 253';
const PIXELS_PER_POINT = 9000;
const MIN_POINTS = 70;
const MAX_POINTS = 220;

interface Point {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
}

// Stejné pozadí jako na webu Scanity: pomalu plující body jako surová data ze skenu.
// Na dotykových zařízeních se nekreslí, stačí tam gradient pozadí.
export function PointCloud() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || matchMedia('(pointer: coarse)').matches) return;

    const isStatic = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let points: Point[] = [];
    let pointerX = 0;
    let pointerY = 0;
    let frame: number | null = null;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(MIN_POINTS, Math.min(MAX_POINTS, Math.round((width * height) / PIXELS_PER_POINT)));
      points = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random(),
        vx: (Math.random() - 0.5) * 0.06,
        vy: (Math.random() - 0.5) * 0.06,
      }));
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      for (const point of points) {
        const parallax = (point.z - 0.5) * 26;
        context.beginPath();
        context.arc(point.x + pointerX * parallax, point.y + pointerY * parallax, 0.6 + point.z * 1.6, 0, Math.PI * 2);
        context.fillStyle = `rgba(${POINT_COLOR}, ${0.08 + point.z * 0.22})`;
        context.fill();
      }
    };

    const step = () => {
      for (const point of points) {
        point.x = (point.x + point.vx + width) % width;
        point.y = (point.y + point.vy + height) % height;
      }
      draw();
      frame = requestAnimationFrame(step);
    };

    const stop = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    };
    const start = () => {
      if (isStatic) draw();
      else if (frame === null) frame = requestAnimationFrame(step);
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onPointerMove = (event: PointerEvent) => {
      pointerX = event.clientX / width - 0.5;
      pointerY = event.clientY / height - 0.5;
    };
    const onResize = () => {
      resize();
      if (isStatic) draw();
    };

    resize();
    start();
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas className="point-cloud" ref={canvasRef} aria-hidden="true" />;
}
