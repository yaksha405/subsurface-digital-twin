import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-medium ring-offset-[#0A0A0F] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE600]/40 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none',
  {
    variants: {
      variant: {
        default: 'bg-[#FFE600]/10 text-[#FFE600] border border-[#FFE600]/30 hover:bg-[#FFE600]/20 hover:border-[#FFE600]/50',
        destructive: 'bg-[#FF3333]/10 text-[#FF3333] border border-[#FF3333]/30 hover:bg-[#FF3333]/20',
        ghost: 'text-[#A0A0B0] hover:bg-white/5 hover:text-[#E0E0E8]',
        outline: 'border border-white/10 bg-transparent text-[#E0E0E8] hover:bg-white/5 hover:border-white/20',
        secondary: 'bg-[#1E3A5F]/30 text-[#6BA3D8] border border-[#1E3A5F]/50 hover:bg-[#1E3A5F]/50',
      },
      size: {
        default: 'h-8 px-3 py-1',
        sm: 'h-7 px-2 text-[11px]',
        lg: 'h-10 px-5 text-sm',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
);
Button.displayName = 'Button';

export { Button, buttonVariants };
