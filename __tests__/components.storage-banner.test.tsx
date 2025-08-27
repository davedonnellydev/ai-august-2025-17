import React from 'react';
import { render, screen } from '@/test-utils';
import StorageStatusBanner from '@/components/StorageStatusBanner';

jest.mock('@/lib/storage', () => ({
  isMemoryFallback: () => true,
  getStorageMode: () => 'memory',
}));

describe('<StorageStatusBanner />', () => {
  test('shows banner when memory fallback is active', async () => {
    render(<StorageStatusBanner />);
    expect(await screen.findByText(/offline mode/i)).toBeInTheDocument();
    expect(screen.getByText(/Mode: memory/i)).toBeInTheDocument();
  });
});
