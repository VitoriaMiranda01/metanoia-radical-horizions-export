import { cn } from '@/lib/utils';
import { cva } from 'class-variance-authority';
import React from 'react';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-red-600 text-white hover:bg-red-600/80', // Keep as red for destructive
        success:
          'border-transparent bg-green-600 text-white hover:bg-green-600/80', // Added success variant for green
        warning:
          'border-transparent bg-yellow-500 text-black hover:bg-yellow-500/80', // Added warning variant for yellow
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };