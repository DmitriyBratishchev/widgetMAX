import type { ComponentProps } from 'react';
import { cx } from '@/helpers/cx';
import styles from './Button.module.scss';

interface ButtonProps extends ComponentProps<'button'> {
  variant?: 'primary' | 'secondary';
}

export function Button({ variant = 'primary', type = 'button', className, ...props }: ButtonProps) {
  return (
    <button type={type} className={cx(styles.button, styles[variant], className)} {...props} />
  );
}
