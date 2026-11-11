import { useState, type FormEvent } from 'react';
import type { Tables } from '../types/database.generated';
import { supabase } from '../lib/supabase';

type Evidence = Tables<'erp_evidence'>;
type Client = NonNullable<typeof supabase>;
type TaskResult = { error: { message: string } | null };

type Props = {
  kind: 'payment' | 'handover';
  choices: { id: string; label: string }[];
  evidence: Evidence[];
  canUpload: boolean;
  busy: boolean;
  client: Client;
  userId: string;
  perform: (task: () => PromiseLike<TaskResult>, success: string, form?: HTMLFormElement) => Promise<boolean>;
};

const allowed: Record<string, string> = {
  'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
};

export function EvidenceAttachment({ kind, choices, evidence, canUpload, busy, client, userId, perform }: Props) {
  const [error, setError] = useState('');
  const [openingId, setOpeningId] = useState<string | null>(null);
  const owned = evidence.filter(item => kind === 'payment' ? item.payment_id : item.delivery_id);
  const labels = new Map(choices.map(choice => [choice.id, choice.label]));
  const already = new Set(owned.map(item => kind === 'payment' ? item.payment_id : item.delivery_id));
  const pending = choices.filter(choice => !already.has(choice.id));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const ownerId = String(values.get('owner') ?? '');
    const input = form.elements.namedItem('file') as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!ownerId || !file || !allowed[file.type] || file.size > 10 * 1024 * 1024) {
      setError('Choose a record and a PDF, JPEG, PNG, or WebP file no larger than 10 MB.');
      return;
    }
    setError('');
    const folder = kind === 'payment' ? 'payments' : 'handover';
    const path = `${folder}/${userId}/${ownerId}/${crypto.randomUUID()}.${allowed[file.type]}`;
    void perform(async () => {
      const uploaded = await client.storage.from('erp-private-evidence').upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (uploaded.error) return { error: uploaded.error };
      return client.rpc('erp_attach_evidence', {
        p_payment_id: kind === 'payment' ? ownerId : null as unknown as string,
        p_delivery_id: kind === 'handover' ? ownerId : null as unknown as string,
        p_storage_path: path, p_file_name: file.name, p_mime_type: file.type,
      });
    }, `${kind === 'payment' ? 'Payment proof' : 'Signed handover'} attached.`, form);
  }

  async function openEvidence(item: Evidence) {
    setOpeningId(item.id); setError('');
    const result = await client.storage.from('erp-private-evidence').createSignedUrl(item.storage_path, 60);
    setOpeningId(null);
    if (result.error || !result.data?.signedUrl) {
      setError(result.error?.message ?? 'Could not open the private file.');
      return;
    }
    const link = document.createElement('a');
    link.href = result.data.signedUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  }

  return <section className="live-card">
    <h3>{kind === 'payment' ? 'Payment proof' : 'Signed handover documents'}</h3>
    <p className="live-hint">Files are private staff records. The database keeps the payment or handover reference even if a paper document is scanned later.</p>
    {canUpload && <form onSubmit={submit}>
      <label className="live-field"><span>{kind === 'payment' ? 'Recorded payment' : 'Signed handover'}</span>
        <select name="owner" required defaultValue=""><option value="" disabled>Choose…</option>
          {pending.map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
        </select></label>
      <label className="live-field"><span>PDF or image, maximum 10 MB</span><input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required /></label>
      {error && <p className="live-error" role="alert">{error}</p>}
      <button className="live-primary" disabled={busy || !pending.length}>Attach private file</button>
    </form>}
    {owned.length === 0 ? <p className="live-empty">No documents attached yet.</p> :
      <div className="live-table-wrap"><table><thead><tr><th>{kind === 'payment' ? 'Payment' : 'Handover'}</th><th>File</th><th>Attached</th><th>Action</th></tr></thead><tbody>
        {owned.map(item => <tr key={item.id}><td>{labels.get((kind === 'payment' ? item.payment_id : item.delivery_id) ?? '') ?? 'Record'}</td><td>{item.file_name}</td>
          <td>{new Date(item.created_at).toLocaleString()}</td>
          <td><button type="button" disabled={openingId === item.id} onClick={() => void openEvidence(item)}>
            {openingId === item.id ? 'Opening…' : 'Open private file'}
          </button></td></tr>)}
      </tbody></table></div>}
    {!canUpload && error && <p className="live-error" role="alert">{error}</p>}
  </section>;
}
