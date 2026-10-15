import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

/** An iPhone-style on/off toggle. */
export default function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      dir='ltr'
      data-slot='switch'
      className={cn(
        'peer inline-flex h-[30px] w-[50px] shrink-0 cursor-pointer items-center rounded-full p-[2px] transition-colors duration-200',
        'data-[state=checked]:bg-[#34C759] data-[state=unchecked]:bg-[#E3DED5]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot='switch-thumb'
        className={cn(
          'pointer-events-none block h-[26px] w-[26px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.2)] transition-transform duration-200',
          'data-[state=checked]:translate-x-[20px] data-[state=unchecked]:translate-x-0',
        )}
      />
    </SwitchPrimitive.Root>
  );
}
