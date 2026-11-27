'use client';

import { useState, type FormEvent } from 'react';
import { ResourceState } from '@/components/resource-state';
import { sessionRequest } from '@/lib/session';
import { useResource } from '@/lib/use-resource';

type Preferences = { dietaryRestrictions: string[]; allergies: string[] };
type PreferencesDraft = { source: Preferences | undefined; dietaryRestrictions: string[]; allergies: string };
const options = [
  { value: 'VEGETARIAN', label: 'Vegetariana' },
  { value: 'VEGAN', label: 'Vegana' },
  { value: 'GLUTEN_FREE', label: 'Sin TACC' },
];

export function CustomerPreferences() {
  const resource = useResource<Preferences>('/api/v1/me/preferences');
  const [draft, setDraft] = useState<PreferencesDraft>();
  const currentDraft = !resource.data || draft?.source === resource.data ? draft : undefined;
  const dietaryRestrictions = currentDraft?.dietaryRestrictions ?? resource.data?.dietaryRestrictions ?? [];
  const allergies = currentDraft?.allergies ?? resource.data?.allergies.join(', ') ?? '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function updateDraft(nextRestrictions: string[], nextAllergies: string) {
    setDraft({ source: resource.data, dietaryRestrictions: nextRestrictions, allergies: nextAllergies });
  }

  function toggle(value: string) {
    const nextRestrictions = dietaryRestrictions.includes(value)
      ? dietaryRestrictions.filter(item => item !== value)
      : [...dietaryRestrictions, value];
    updateDraft(nextRestrictions, allergies);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const allergyList = allergies.split(',').map(item => item.trim()).filter(Boolean);
      await sessionRequest('/api/v1/me/preferences', { method: 'PATCH', body: JSON.stringify({ dietaryRestrictions, allergies: allergyList }) });
      setMessage('Preferencias guardadas. El catálogo aplicará estos filtros al abrirlo.');
      updateDraft(dietaryRestrictions, allergies);
      resource.reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron guardar tus preferencias.'); }
    finally { setBusy(false); }
  }

  return <main className="page form-stack"><h1>Perfil y preferencias</h1><p>Las restricciones y alergias se usan para filtrar productos en los buffets.</p><ResourceState {...resource} retry={resource.reload} />
    <form className="panel form-stack" onSubmit={save}><fieldset className="form-stack" disabled={busy}><legend>Preferencias dietarias</legend>{options.map(option => <label key={option.value}><span><input type="checkbox" checked={dietaryRestrictions.includes(option.value)} onChange={() => toggle(option.value)} />{option.label}</span></label>)}
      <label>Alergias<input value={allergies} onChange={event => updateDraft(dietaryRestrictions, event.target.value)} placeholder="Ej.: maní, leche" /></label><p>Separá cada alergia con una coma y usá los nombres que declara el buffet. Se ignoran diferencias de mayúsculas y tildes.</p>
      {error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}<button disabled={busy || resource.loading}>{busy ? 'Guardando…' : 'Guardar preferencias'}</button>
    </fieldset></form>
  </main>;
}
