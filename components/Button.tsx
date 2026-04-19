
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'niantic' | 'purple';
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '',
  icon,
  ...props 
}) => {
  
  const baseStyles = "flex items-center justify-center gap-2 px-6 py-4 font-bold transition-all disabled:opacity-50 border uppercase tracking-wider active:translate-x-1 active:translate-y-1 active:shadow-none";
  
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
      {icon && <span className="text-xl">{icon}</span>}
      {children}
    </button>
  );
};
