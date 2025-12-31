import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'outline' | 'ghost';
    size?: 'default' | 'sm' | 'lg';
    asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button';

        return (
            <Comp
                className={cn(
                    // Base styles
                    'inline-flex items-center justify-center gap-2 rounded-xl font-medium text-sm transition-all',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20',

                    // Variants
                    variant === 'default' && 'bg-white text-black hover:bg-neutral-200',
                    variant === 'outline' && 'border border-white/10 hover:bg-white/5 text-neutral-400 hover:text-white',
                    variant === 'ghost' && 'hover:bg-white/5 text-neutral-400 hover:text-white',

                    // Sizes
                    size === 'default' && 'h-14 px-8',
                    size === 'sm' && 'h-10 px-4',
                    size === 'lg' && 'h-16 px-10 text-base',

                    className
                )}
                ref={ref}
                {...props}
            />
        );
    }
);

Button.displayName = 'Button';

export { Button };
