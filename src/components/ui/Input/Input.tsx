import { useId, type ComponentProps } from 'react';
import { cx } from '@/helpers/cx';
import styles from './Input.module.scss';

interface InputProps extends ComponentProps<'input'> {
  label: string;
  error?: string;
}

// Поле с подписью и текстом ошибки. className — на корень поля (раскладка снаружи), ref и остальные
// атрибуты — на сам <input>.
export function Input({ label, error, id, className, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className={cx(styles.field, className)}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
