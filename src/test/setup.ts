import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Без `globals: true` RTL не регистрирует автоочистку DOM между тестами.
afterEach(cleanup);
