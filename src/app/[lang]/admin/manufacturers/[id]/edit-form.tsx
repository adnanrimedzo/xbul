import { RegistrationForm } from '@/app/[lang]/m/[company]/registration/registration-form';
import type { RegistrationValues } from '@/app/[lang]/m/[company]/registration/registration-values';
import { taxIdLabel } from '@/modules/supplier';
import { editRegistrationAction } from './actions';

// The owner's registration form, with the same fields and certificate rows, saved by an admin in any status.
export function EditForm({ companyId, country, saved, label }: { companyId: string; country: string; saved: RegistrationValues; label: string }) {
  return (
    <details className="card">
      <summary className="section-title cursor-pointer">{label}</summary>
      <div className="mt-6">
        <RegistrationForm action={editRegistrationAction.bind(null, companyId)} saved={saved} tr={country === 'TR'} taxLabel={taxIdLabel(country)} locked={false} />
      </div>
    </details>
  );
}
