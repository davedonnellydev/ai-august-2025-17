import { render, screen, userEvent } from '@/test-utils';
import { Welcome } from './Welcome';

// Mock the ClientRateLimiter
jest.mock('../../app/lib/utils/api-helpers', () => ({
  ClientRateLimiter: {
    getRemainingRequests: jest.fn(() => 10),
    checkLimit: jest.fn(() => true),
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe('Welcome component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the welcome title', () => {
    render(<Welcome />);
    expect(screen.getByText(/Welcome to your/)).toBeInTheDocument();
    expect(screen.getByText('Starter')).toBeInTheDocument();
  });

  it('renders input field and buttons', () => {
    render(<Welcome />);
    expect(screen.getByLabelText('Ask a Question')).toBeInTheDocument();
    expect(screen.getByText('Ask Question')).toBeInTheDocument();
    expect(screen.getByText('Reset')).toBeInTheDocument();
  });

  it('displays remaining requests count', () => {
    render(<Welcome />);
    expect(screen.getByText(/You have \d+ questions remaining/)).toBeInTheDocument();
  });

  it('allows user to type in input field', async () => {
    const user = userEvent.setup();
    render(<Welcome />);

    const input = screen.getByLabelText('Ask a Question');
    await user.type(input, 'Hello world');

    expect(input).toHaveValue('Hello world');
  });

  it('shows error when trying to submit empty input', async () => {
    const user = userEvent.setup();
    render(<Welcome />);

    const submitButton = screen.getByText('Ask Question');
    await user.click(submitButton);

    expect(screen.getByText('Error: Please enter some text to translate')).toBeInTheDocument();
  });

  it('resets form when reset button is clicked', async () => {
    const user = userEvent.setup();
    render(<Welcome />);

    const input = screen.getByLabelText('Ask a Question');
    const resetButton = screen.getByText('Reset');

    await user.type(input, 'Test input');
    await user.click(resetButton);

    expect(input).toHaveValue('');
  });
});
