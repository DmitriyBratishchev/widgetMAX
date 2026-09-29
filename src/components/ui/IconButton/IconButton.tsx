import type { ComponentProps, ReactNode } from 'react';
import { cx } from '@/helpers/cx';
import styles from './IconButton.module.scss';

interface IconButtonProps extends Omit<ComponentProps<'button'>, 'aria-label' | 'children'> {
  // Имя для скринридера: текста у кнопки нет, поэтому оно обязательно.
  label: string;
  variant?: 'primary' | 'ghost';
  // Контуры иконки в сетке 24×24 — <path> и т. п.; сам <svg> рисует кнопка.
  children: ReactNode;
}

// Круглая кнопка-иконка, как в web.max.ru: отправка сообщения, «Назад».
export function IconButton({
  label,
  variant = 'primary',
  type = 'button',
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.button, styles[variant], className)}
      aria-label={label}
      {...props}
    >
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}
