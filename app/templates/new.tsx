// Template create route (TMPL-01/D-03). Thin wrapper mounting the shared
// TemplateBuilderForm in create mode (mirrors app/(tabs)/exercises/new.tsx's
// two-route-file split with [id]/[templateId]).

import { TemplateBuilderForm } from '../../components/TemplateBuilderForm';

export default function NewTemplateScreen() {
  return <TemplateBuilderForm />;
}
