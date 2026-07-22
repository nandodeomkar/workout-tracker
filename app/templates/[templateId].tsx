// Template edit route (TMPL-01/D-03). Thin wrapper mounting the shared
// TemplateBuilderForm in edit mode, hydrated from :templateId (mirrors
// app/(tabs)/exercises/[id].tsx's load-on-mount pattern, delegated to the
// shared form).

import { useLocalSearchParams } from 'expo-router';

import { TemplateBuilderForm } from '../../components/TemplateBuilderForm';

export default function EditTemplateScreen() {
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  return <TemplateBuilderForm templateId={Number(templateId)} />;
}
