import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-[#FFE600]/30 bg-[#FFE600]/10 text-[#FFE600]',
        danger: 'border-[#FF3333]/30 bg-[#FF3333]/10 text-[#FF3333]',
        info: 'border-[#1E3A5F]/50 bg-[#1E3A5F]/20 text-[#6BA3D8]',
        neutral: 'border-white/10 bg-white/5 text-[#A0A0B0]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
