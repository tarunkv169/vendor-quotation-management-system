import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRequestOptions, useVendorOptions } from '@/hooks/useLookups';
import PageHeader from '@/components/common/PageHeader';
import FormSection, { FormActions } from '@/components/common/FormSection';
import Select from '@/components/common/Select';
import Input, { Textarea } from '@/components/common/Input';
import EntitySelect, { isUuid } from '@/components/common/EntitySelect';
import Alert from '@/components/common/Alert';
import FileDrop from '@/components/common/FileDrop';
import { FEATURE_MESSAGES, reportStorageError } from '@/utils/features';
import { useDocumentStorage } from '@/hooks/useDocumentStorage';
import { DOCUMENT_TYPES, toOptions } from '@/utils/constants';
import { documentKeys, documentService } from '../documentService';

// Which reference each document type needs (DocumentUploadRequest + backend rules).
const TYPE_HINTS = {
  QUOTATION_PDF: 'Attach to the quotation it belongs to.',
  QUOTATION_EXCEL: 'Attach to the quotation it belongs to.',
  VENDOR_CERTIFICATE: 'Scoped to a vendor.',
  SUPPORTING_DOCUMENT: 'Attach to a quotation or a vendor profile.',
  PROCUREMENT_ATTACHMENT: 'Attach to a procurement request.',
};

export default function DocumentUploadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    documentType: searchParams.get('documentType') || 'QUOTATION_PDF',
    quotationId: searchParams.get('quotationId') || '',
    vendorId: searchParams.get('vendorId') || '',
    procurementRequestId: searchParams.get('procurementRequestId') || '',
    description: '',
  });
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const vendorOptions = useVendorOptions();
  const requestOptions = useRequestOptions();
  const storageEnabled = useDocumentStorage();

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const upload = useMutation({
    mutationFn: () =>
      documentService.upload({ ...form, file }, (event) => setProgress(event.total ? Math.round((event.loaded / event.total) * 100) : 0)),
    meta: { silent: true, successMessage: 'Document uploaded' },
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
      navigate(`/documents/${document.id}`, { replace: true });
    },
    onError: (err) => reportStorageError(err) || setError(err.fieldErrors && Object.keys(err.fieldErrors).length ? Object.values(err.fieldErrors).join(' ') : err.message),
  });

  const invalidId = ['quotationId', 'vendorId', 'procurementRequestId'].find((key) => form[key] && !isUuid(form[key]));
  const ready = storageEnabled && file && form.documentType && !invalidId;

  return (
    <>
      <PageHeader title="Upload document" description="Files are stored by the Document Service. Quotation files can be sent to AI extraction afterwards." />
      <form
        className="max-w-5xl"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          if (ready) upload.mutate();
        }}
      >
        {!storageEnabled && <Alert tone="warning" className="mb-5">{FEATURE_MESSAGES.documentStorage}</Alert>}
        {error && <Alert tone="error" className="mb-5">{error}</Alert>}
        <div className="card divide-y divide-line">
          <FormSection title="File" description="PDF, Excel or image, up to 20 MB.">
            <Select label="Document type" required options={toOptions(DOCUMENT_TYPES)} value={form.documentType} onChange={set('documentType')} hint={TYPE_HINTS[form.documentType]} className="sm:max-w-sm" />
            <FileDrop file={file} onFile={setFile} progress={upload.isPending ? progress : null} />
          </FormSection>
          <FormSection title="Link to" description="Connect the document to the record it belongs to. All links are optional.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Quotation ID" value={form.quotationId} onChange={set('quotationId')} placeholder="Optional" error={invalidId === 'quotationId' ? 'Enter a valid ID' : undefined} className="sm:col-span-2" />
              <EntitySelect label="Vendor" options={vendorOptions.data} loading={vendorOptions.isLoading} placeholder="None" value={form.vendorId} onChange={set('vendorId')} />
              <EntitySelect label="Procurement request" options={requestOptions.data} loading={requestOptions.isLoading} placeholder="None" value={form.procurementRequestId} onChange={set('procurementRequestId')} />
            </div>
          </FormSection>
          <FormSection title="Description" description="Optional note shown on the document page.">
            <Textarea label="Description" rows={2} maxLength={500} value={form.description} onChange={set('description')} />
          </FormSection>
          <FormActions note={file ? `${file.name} is ready to upload.` : 'Choose a file to continue.'} onCancel={() => navigate(-1)} loading={upload.isPending} disabled={!ready} submitLabel="Upload document" />
        </div>
      </form>
    </>
  );
}
