import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', fullWidth = false, children, ...props }, ref) => {
    
    // Base styles
    let classes = "inline-flex items-center justify-center rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none ";
    
    // Size styles
    if (size === 'sm') classes += "px-3 py-1.5 text-xs ";
    else if (size === 'lg') classes += "px-6 py-3 text-base ";
    else classes += "px-4 py-2 text-sm "; // md
    
    // Width styles
    if (fullWidth) classes += "w-full ";
    
    // Variant styles
    if (variant === 'primary') classes += "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm ";
    else if (variant === 'secondary') classes += "bg-orange-500 text-white hover:bg-orange-600 shadow-sm ";
    else if (variant === 'outline') classes += "border border-slate-200 bg-transparent hover:bg-slate-50 text-slate-900 border-emerald-500 hover:border-emerald-600 ";
    else if (variant === 'ghost') classes += "bg-transparent text-slate-700 hover:bg-slate-100 ";

    return (
      <button ref={ref} className={`${classes} ${className}`} {...props}>
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
