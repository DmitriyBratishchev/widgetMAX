// Склейка className: ложные значения (условный класс, отсутствующий класс CSS-модуля) пропускаются.
export function cx(...classNames: (string | false | null | undefined)[]): string {
  return classNames.filter(Boolean).join(' ');
}
