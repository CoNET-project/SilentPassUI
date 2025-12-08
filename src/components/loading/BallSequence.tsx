export default function BallSequence() {
  const delays = ['0s', '0.2s', '0.4s', '0.6s', '0.8s'];
  const colors = [
    'bg-slate-800/35 dark:bg-white/15',
    'bg-emerald-300/35 dark:bg-emerald-500/70',
    'bg-amber-200/35 dark:bg-amber-400/70',
    'bg-sky-300/35 dark:bg-sky-500/70',
    'bg-fuchsia-300/35 dark:bg-fuchsia-500/70',
  ];

  return (
    <>
      <style>{`
        @keyframes ball-drop {
          0% { transform: translateY(-12px); opacity: 1; }
          20% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }

        @keyframes ball-bounce {
          0%   { transform: translateY(0); opacity: 1; }
          5%   { transform: translateY(-16px); opacity: 1; }
          12%  { transform: translateY(-10px); opacity: 1; }
          18%  { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* ⭐ 高度 = h-8，與按鈕條完全一致 */}
      <div className="flex w-full h-8 items-center justify-center">
        <div className="relative flex h-4 w-28 items-end justify-between">

          {/* 桌面線 */}
          <div className="absolute bottom-0 h-px w-full bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent" />

          {/* 五個球 */}
          {delays.map((delay, i) => {
            const animationName = i === 1 ? 'ball-bounce' : 'ball-drop';

            return (
              <div
                key={i}
                className={`absolute h-3 w-3 rounded-full ${colors[i]}`}
                style={{
                  animation: `${animationName} 1s ease-in-out infinite`,
                  animationDelay: delay,
                  bottom: 0,
                  left: `${i * 28}%`,
                }}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}