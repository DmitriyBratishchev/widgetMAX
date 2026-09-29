import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from '@/components/ui/IconButton/IconButton';

const icon = <path d="M3 3h18v18H3z" />;

describe('IconButton', () => {
  it('имя кнопки — из label, иконка скрыта от скринридера', () => {
    render(<IconButton label="Отправить">{icon}</IconButton>);

    const button = screen.getByRole('button', { name: 'Отправить' });
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(button.querySelector('svg path')).toBeInTheDocument();
  });

  it('по умолчанию type=button — не отправляет форму', () => {
    render(<IconButton label="Назад">{icon}</IconButton>);

    expect(screen.getByRole('button', { name: 'Назад' })).toHaveAttribute('type', 'button');
  });

  it('клик вызывает onClick, недоступная кнопка — нет', async () => {
    const onClick = vi.fn<() => void>();
    const user = userEvent.setup();
    const { rerender } = render(
      <IconButton label="Назад" onClick={onClick}>
        {icon}
      </IconButton>,
    );

    await user.click(screen.getByRole('button', { name: 'Назад' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <IconButton label="Назад" onClick={onClick} disabled>
        {icon}
      </IconButton>,
    );
    await user.click(screen.getByRole('button', { name: 'Назад' }));
    expect(screen.getByRole('button', { name: 'Назад' })).toBeDisabled();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ref указывает на <button>', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <IconButton ref={ref} label="Отправить" type="submit">
        {icon}
      </IconButton>,
    );

    expect(ref.current).toBe(screen.getByRole('button', { name: 'Отправить' }));
    expect(ref.current).toHaveAttribute('type', 'submit');
  });
});
