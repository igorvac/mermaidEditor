interface IconProps {
  name: string;
  size?: number;
  filled?: boolean;
  className?: string;
}

export function Icon({ name, size, filled, className }: IconProps) {
  return (
    <span
      className={`material-symbols-rounded${className ? ` ${className}` : ''}`}
      style={{
        fontSize: size,
        fontVariationSettings: filled ? "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" : undefined
      }}
      aria-hidden
    >
      {name}
    </span>
  );
}
