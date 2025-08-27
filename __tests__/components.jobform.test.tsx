import React from 'react';
import { render, screen, userEvent, waitFor } from '@/test-utils';
import JobForm from '@/components/JobForm';

// Mock next/navigation useRouter
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe('<JobForm />', () => {
  beforeEach(() => {
    // Mock fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        questionSet: { questions: [{ id: '1', text: 'Q' }] },
      }),
    }) as any;
    // localStorage available in jsdom
    localStorage.clear();
  });

  test('validates required fields', async () => {
    const { container } = render(<JobForm />);
    // Disable native constraint validation to allow onSubmit handler
    const form = container.querySelector('form') as HTMLFormElement | null;
    if (form) form.noValidate = true;
    const submit = screen.getByRole('button', { name: /start practice/i });
    await userEvent.click(submit);
    const errs = await screen.findAllByText(/please enter a role/i);
    expect(errs.length).toBeGreaterThan(0);
  });

  test('submits and calls API when valid', async () => {
    render(<JobForm />);
    await userEvent.type(screen.getByLabelText(/role/i), 'Frontend');
    // Open select by clicking the input then choose option
    const selectInput = screen.getByRole('textbox', {
      name: /interview type/i,
    });
    await userEvent.click(selectInput);
    const option = await screen.findByRole('option', { name: /screening/i });
    await userEvent.click(option);
    await userEvent.click(
      screen.getByRole('button', { name: /start practice/i })
    );
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/generate-questions',
      expect.any(Object)
    );
  });
});
