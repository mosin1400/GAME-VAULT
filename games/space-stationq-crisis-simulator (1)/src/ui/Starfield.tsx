/* ============================================================
   Starfield — پس‌زمینه‌ی زنده‌ی ستاره‌ای با drift آرام
   ============================================================ */
import { useEffect, useRef } from "react";

interface Star { x: number; y: number; r: number; v: number; tw: number; }

export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let stars: Star[] = [];
    let raf = 0;
    const resize = () => {
      cv.width = window.innerWidth;
      cv.height = window.innerHeight;
      stars = Array.from({ length: 150 }, () => ({
        x: Math.random() * cv.width,
        y: Math.random() * cv.height,
        r: Math.random() * 1.3 + 0.3,
        v: Math.random() * 0.12 + 0.02,
        tw: Math.random() * Math.PI * 2,
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      stars.forEach((s) => {
        s.x -= s.v;
        s.tw += 0.02;
        if (s.x < -2) s.x = cv.width + 2;
        const a = 0.35 + Math.sin(s.tw) * 0.3;
        ctx.fillStyle = `rgba(180, 235, 210, ${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {/* سحابی‌های محو فسفری / faint phosphor nebulae */}
      <div className="absolute inset-0" style={{
        background:
          "radial-gradient(ellipse 60% 45% at 18% 22%, rgba(20,120,80,.14), transparent 70%)," +
          "radial-gradient(ellipse 50% 40% at 82% 75%, rgba(30,90,140,.12), transparent 70%)," +
          "radial-gradient(ellipse 40% 35% at 65% 15%, rgba(140,60,160,.08), transparent 70%)",
      }} />
      <canvas ref={ref} className="absolute inset-0" />
    </div>
  );
}
