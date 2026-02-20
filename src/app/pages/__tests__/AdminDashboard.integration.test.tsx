import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminDashboard from '../AdminDashboard';

const mockNavigate = vi.fn();
const mockAddSource = vi.fn();
const mockDeleteSource = vi.fn();
const mockGetQueue = vi.fn();
const mockUploadDocument = vi.fn();
const mockGetSources = vi.fn();
const mockGetMetadataTags = vi.fn();
const mockUpdateSourceTags = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    isAdmin: true,
  }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../services/adminService', () => ({
  addSource: (...args: unknown[]) => mockAddSource(...args),
  deleteSource: (...args: unknown[]) => mockDeleteSource(...args),
  getQueue: (...args: unknown[]) => mockGetQueue(...args),
  uploadDocument: (...args: unknown[]) => mockUploadDocument(...args),
  getSources: (...args: unknown[]) => mockGetSources(...args),
  getMetadataTags: (...args: unknown[]) => mockGetMetadataTags(...args),
  updateSourceTags: (...args: unknown[]) => mockUpdateSourceTags(...args),
}));

describe('AdminDashboard integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQueue.mockResolvedValue({ jobs: [], total: 0 });
    mockGetMetadataTags.mockResolvedValue({ tags: ['housing', 'food'], total: 2 });
    mockGetSources.mockResolvedValue({
      sources: [
        {
          url: 'https://example.com',
          source_domain: 'example.com',
          total_chunks: 2,
          tags: ['housing'],
        },
      ],
      total: 1,
    });
    mockAddSource.mockResolvedValue({ status: 'queued', url: 'https://example.com', depth: 1, tags: ['housing'] });
    mockUpdateSourceTags.mockResolvedValue({ status: 'updated', url: 'https://example.com', tags: ['housing', 'food'], chunks_updated: 2 });
  });

  it('adds a source with normalized metadata tags', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AdminDashboard />
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetSources).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText('https://example.com/page'), 'https://example.com/new');
    await user.type(screen.getByPlaceholderText('Tags (comma separated, optional)'), 'Housing, Food, food');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(mockAddSource).toHaveBeenCalledWith('https://example.com/new', 1, ['housing', 'food']);
    });
  });

  it('edits tags for an existing source', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AdminDashboard />
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetSources).toHaveBeenCalled());

    const editButton = await screen.findByTitle('Edit tags');
    await user.click(editButton);

    const editInput = await screen.findByDisplayValue('housing');
    await user.clear(editInput);
    await user.type(editInput, 'housing, food');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockUpdateSourceTags).toHaveBeenCalledWith('https://example.com', ['housing', 'food']);
    });
  });

  it('uploads a document from the Upload tab', async () => {
    const user = userEvent.setup();
    mockUploadDocument.mockResolvedValue({
      status: 'ok',
      filename: 'guide.txt',
      chunks_total: 2,
      chunks_inserted: 2,
      errors: [],
    });

    const { container } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AdminDashboard />
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetSources).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: /Upload/i }));

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['housing resources'], 'guide.txt', { type: 'text/plain' });
    await user.upload(fileInput, file);
    await user.type(screen.getByPlaceholderText('Tags (comma separated, optional)'), 'housing,benefits');

    await user.click(screen.getByRole('button', { name: 'Upload & Embed' }));

    await waitFor(() => {
      expect(mockUploadDocument).toHaveBeenCalled();
    });

    expect(screen.getByText(/Uploaded: 2 chunks inserted\./i)).toBeInTheDocument();
  });
});
