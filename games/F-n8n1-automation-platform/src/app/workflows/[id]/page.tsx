import Editor from "@/components/editor/Editor";
export const dynamic = "force-dynamic";
export default async function WorkflowEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Editor id={Number(id)} />;
}
