import { forwardRef, type InputHTMLAttributes } from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, id, ...props }, ref) => {
        const inputId = id ?? label?.toLowerCase().replace(/\s/g, '-');

        return (
            <div className="space-y-2">
                {label && (
                    <LabelPrimitive.Root
                        htmlFor={inputId}
                        className="text-xs font-medium text-neutral-500 uppercase tracking-wider block"
                    >
                        {label}
                    </LabelPrimitive.Root>
                )}
                <input
                    id={inputId}
                    className={cn(
                        // Glass input styles
                        'w-full h-14 px-6 rounded-xl text-lg text-white',
                        'bg-white/[0.03] backdrop-blur-xl',
                        'border border-white/10',
                        'placeholder:text-neutral-600',
                        'outline-none transition-all',
                        // Focus states
                        'focus:bg-white/[0.05] focus:border-white/20',
                        'focus:shadow-[0_0_0_4px_rgba(255,255,255,0.05)]',
                        // Error state
                        error && 'border-red-500/50 focus:border-red-500',
                        // Disabled
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        className
                    )}
                    ref={ref}
                    {...props}
                />
                {error && (
                    <p className="text-sm text-red-400">{error}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export { Input };
