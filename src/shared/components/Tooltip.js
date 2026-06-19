"use client";

export default function Tooltip({ text, children, position = "top", color }) {
  const posClass = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  }[position];

  const bgStyle = color ? { backgroundColor: color } : {};
  const bgClass = color ? "" : "bg-foreground text-background dark:bg-foreground dark:text-background";

  return (
    <div className="relative inline-flex group">
      {children}
      <div
        className={`pointer-events-none absolute ${posClass} z-50 w-max max-w-56 rounded-md px-2 py-1 text-[11px] font-medium leading-snug ${bgClass} ${color ? "text-white" : ""} opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-normal shadow-pop`}
        style={bgStyle}
      >
        {text}
      </div>
    </div>
  );
}
