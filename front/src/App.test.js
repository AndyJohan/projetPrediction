import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the application shell navigation', () => {
  render(<App />);

  expect(screen.getByText(/ASECNA EFP/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /historique/i })).toBeInTheDocument();
});
