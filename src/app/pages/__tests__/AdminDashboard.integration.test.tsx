import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminDashboard from '../AdminDashboard';
import { LanguageProvider } from '../../context/LanguageContext';

const mockNavigate = vi.fn();
const mockAddSource = vi.fn();
const mockAddSourcesBatch = vi.fn();
const mockDeleteSource = vi.fn();
const mockGetQueue = vi.fn();
const mockUploadDocument = vi.fn();
const mockGetSources = vi.fn();
const mockGetMetadataTags = vi.fn();
const mockUpdateSourceTags = vi.fn();
const mockGetModelConfig = vi.fn();
const mockUpdateModelConfig = vi.fn();

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
  addSourcesBatch: (...args: unknown[]) => mockAddSourcesBatch(...args),
  deleteSource: (...args: unknown[]) => mockDeleteSource(...args),
  getQueue: (...args: unknown[]) => mockGetQueue(...args),
  uploadDocument: (...args: unknown[]) => mockUploadDocument(...args),
  getSources: (...args: unknown[]) => mockGetSources(...args),
  getMetadataTags: (...args: unknown[]) => mockGetMetadataTags(...args),
  updateSourceTags: (...args: unknown[]) => mockUpdateSourceTags(...args),
  getModelConfig: (...args: unknown[]) => mockGetModelConfig(...args),
  updateModelConfig: (...args: unknown[]) => mockUpdateModelConfig(...args),
}));

describe('AdminDashboard integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('vecinita-language', 'en');
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
    mockAddSource.mockResolvedValue({
      status: 'completed',
      url: 'https://example.com',
      depth: 1,
      tags: ['housing'],
      chunks_inserted: 3,
      chunks_total: 3,
    });
    mockAddSourcesBatch.mockResolvedValue({
      status: 'partial',
      submitted: 2,
      completed: 1,
      failed: 1,
      depth: 1,
      tag_mode: 'auto_infer',
      baseline_tags: ['housing'],
      results: [
        { url: 'https://example.com/new-1', status: 'completed' },
        { url: 'https://example.com/new-2', status: 'failed', error: 'HTTP 500' },
      ],
    });
    mockUpdateSourceTags.mockResolvedValue({
      status: 'updated',
      url: 'https://example.com',
      tags: ['housing', 'food'],
      chunks_updated: 2,
    });
    mockGetModelConfig.mockResolvedValue({
      generation: {
        current: { provider: 'groq', model: 'llama-3.1' },
        available: {
          providers: [{ key: 'groq', label: 'Groq' }],
          models: { groq: ['llama-3.1'] },
        },
      },
      embeddings: {
        current: { provider: 'modal', model: 'bge-small' },
        available: {
          providers: [{ key: 'modal', label: 'Modal' }],
          models: { modal: ['bge-small'] },
        },
      },
    });
  });

  it('adds a source with normalized metadata tags', async () => {
    const user = userEvent.setup();

    render(
      <LanguageProvider>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminDashboard />
        </MemoryRouter>
      </LanguageProvider>
    );

    await waitFor(() => expect(mockGetSources).toHaveBeenCalled());

    await user.type(
      screen.getByPlaceholderText('https://example.com/page'),
      'https://example.com/new'
    );
    await user.type(
      screen.getAllByPlaceholderText('Tags (comma separated, optional)')[0],
      'Housing, Food, food'
    );
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(mockAddSource).toHaveBeenCalledWith('https://example.com/new', 1, ['housing', 'food']);
    });
  });

  it('edits tags for an existing source', async () => {
    const user = userEvent.setup();

    render(
      <LanguageProvider>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminDashboard />
        </MemoryRouter>
      </LanguageProvider>
    );

    await waitFor(() => expect(mockGetSources).toHaveBeenCalled());

    const editButton = await screen.findByTitle('Edit tags');
    await user.click(editButton);

    const editInput = await screen.findByDisplayValue('housing');
    await user.clear(editInput);
    await user.type(editInput, 'housing, food');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockUpdateSourceTags).toHaveBeenCalledWith(
        'https://example.com',
        ['housing', 'food'],
        'en'
      );
    });
  });

  it('submits batch source ingest with auto-infer mode', async () => {
    const user = userEvent.setup();

    render(
      <LanguageProvider>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminDashboard />
        </MemoryRouter>
      </LanguageProvider>
    );

    await waitFor(() => expect(mockGetSources).toHaveBeenCalled());

    await user.type(
      screen.getByPlaceholderText('Paste urls.txt content (one URL per line)'),
      'https://example.com/new-1\nhttps://example.com/new-2'
    );
    await user.type(
      screen.getAllByPlaceholderText('Tags (comma separated, optional)')[1],
      'Housing, food'
    );
    await user.click(screen.getByRole('button', { name: 'Batch ingest' }));

    await waitFor(() => {
      expect(mockAddSourcesBatch).toHaveBeenCalledWith(
        'https://example.com/new-1\nhttps://example.com/new-2',
        1,
        ['housing', 'food'],
        'auto_infer'
      );
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
      <LanguageProvider>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminDashboard />
        </MemoryRouter>
      </LanguageProvider>
    );

    await waitFor(() => expect(mockGetSources).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: /Upload/i }));

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['housing resources'], 'guide.txt', { type: 'text/plain' });
    await user.upload(fileInput, file);
    await user.type(
      screen.getByPlaceholderText('Tags (comma separated, optional)'),
      'housing,benefits'
    );

    await user.click(screen.getByRole('button', { name: 'Upload & Embed' }));

    await waitFor(() => {
      expect(mockUploadDocument).toHaveBeenCalled();
    });

    expect(screen.getByText(/Uploaded: 2 chunks inserted\./i)).toBeInTheDocument();
  });

  it('shows tagging UI text in Spanish', async () => {
    localStorage.setItem('vecinita-language', 'es');

    render(
      <LanguageProvider>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminDashboard />
        </MemoryRouter>
      </LanguageProvider>
    );

    await waitFor(() => expect(mockGetSources).toHaveBeenCalled());

    expect(screen.getByRole('heading', { name: 'Administración' })).toBeInTheDocument();
    expect(screen.getByText('Fuentes')).toBeInTheDocument();
    expect(screen.getByText('Subir')).toBeInTheDocument();
    expect(screen.getByText('Cola')).toBeInTheDocument();
    expect(screen.getByText('Modelos')).toBeInTheDocument();
    expect(
      screen.getAllByPlaceholderText('Etiquetas (separadas por comas, opcional)').length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'Autocompletado con etiquetas existentes. Puedes agregar etiquetas personalizadas.'
      )
    ).toBeInTheDocument();
  });

  it('switches to Queue and Models tabs in Spanish with localized labels', async () => {
    const user = userEvent.setup();
    localStorage.setItem('vecinita-language', 'es');

    render(
      <LanguageProvider>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminDashboard />
        </MemoryRouter>
      </LanguageProvider>
    );

    await waitFor(() => expect(mockGetSources).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Cola' }));
    expect(screen.getByText('Todos los estados')).toBeInTheDocument();
    expect(screen.getByText('Autoactualizar cada 10 s')).toBeInTheDocument();
    expect(screen.getByText('No hay trabajos.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Modelos' }));
    await waitFor(() => expect(mockGetModelConfig).toHaveBeenCalled());
    expect(screen.getByText('Configuración de modelos')).toBeInTheDocument();
    expect(screen.getByText('Modelo de generación')).toBeInTheDocument();
    expect(screen.getByText('Modelo de embeddings')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Guardar configuración de modelos' })
    ).toBeInTheDocument();
  });
});
