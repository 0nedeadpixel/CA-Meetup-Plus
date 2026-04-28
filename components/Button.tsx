
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'niantic' | 'purple';
  fullWidth?: boolean;
  icon?: React.ReactNode;
  watermark?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '',
  icon,
  watermark,
  ...props 
}) => {
  
  const baseStyles = "relative overflow-hidden group z-0 flex items-center justify-center gap-2 px-6 py-4 font-bold transition-all disabled:opacity-50 border uppercase tracking-wider active:translate-x-1 active:translate-y-1 active:shadow-none";
  
  const variants = {
    primary: "bg-primary text-white border-primary-dim shadow-md",
    secondary: "bg-gray-800 text-white border-gray-700 shadow-md",
    danger: "bg-accent text-white border-accent-dim shadow-md",
    ghost: "bg-transparent text-gray-400 border-gray-800 shadow-none hover:text-white hover:bg-gray-900 active:translate-x-0 active:translate-y-0",
    niantic: "bg-niantic text-gray-900 border-niantic-dim shadow-md",
    purple: "bg-purple-600 text-white border-purple-800 shadow-md"
  };

  const widthClass = fullWidth ? "w-full" : "";

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${widthClass} ${className}`}
      {...props}
    >
      {/* Background Watermark Layer */}
      {watermark && (
        <div className="absolute -left-4 -bottom-6 opacity-10 group-hover:scale-125 group-hover:-rotate-12 transition-transform duration-700 pointer-events-none z-0 [&>*]:w-28 [&>*]:h-28 text-current">
          {watermark}
        </div>
      )}
      
      {/* Foreground Content Layer */}
      <span className="relative z-10 flex items-center justify-center gap-2 w-full">
        {icon && <span className="text-xl">{icon}</span>}
        {children}
      </span>
    </button>
  );
};
