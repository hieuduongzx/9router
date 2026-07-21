"use client";

export default function AnimatedBackground() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `linear-gradient(to right, #3b82f6 1px, transparent 1px), linear-gradient(to bottom, #3b82f6 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />

        <div className="absolute -top-20 left-1/4 h-[600px] w-[600px] animate-blob rounded-full bg-blue-500/20 blur-[120px]" />
        <div className="animate-blob-delayed-1 absolute top-1/3 -right-20 h-[500px] w-[500px] rounded-full bg-indigo-500/15 blur-[120px]" />
        <div className="animate-blob-delayed-2 absolute -bottom-20 left-1/2 h-[550px] w-[550px] rounded-full bg-sky-500/12 blur-[120px]" />

        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(circle at center, transparent 0%, rgba(9, 9, 11, 0.55) 100%)",
          }}
        />
      </div>

      <style jsx global>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 20s ease-in-out infinite;
        }
        .animate-blob-delayed-1 {
          animation: blob 22s ease-in-out 2s infinite;
        }
        .animate-blob-delayed-2 {
          animation: blob 25s ease-in-out 4s infinite;
        }
      `}</style>
    </>
  );
}
