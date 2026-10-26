import { requireMill } from '@/server/viewer';
import { AddGarmentsForm } from './add-garments-form';

export default async function AddPage() {
  await requireMill();
  return <AddGarmentsForm />;
}
