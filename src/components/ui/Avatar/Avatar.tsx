import { cx } from '@/helpers/cx';
import styles from './Avatar.module.scss';

interface AvatarProps {
  label: string;
  size?: 'md' | 'sm';
}

// Кружок с короткой подписью. Скрыт от скринридеров: имя собеседника всегда стоит рядом текстом.
export function Avatar({ label, size = 'md' }: AvatarProps) {
  return (
    <span className={cx(styles.avatar, styles[size])} aria-hidden="true">
      {label}
    </span>
  );
}
