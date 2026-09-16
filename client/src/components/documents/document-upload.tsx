"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pane } from "@/components/tui/pane";
import { Spin } from "@/components/tui/spin";
import { cn } from "@/lib/utils";
import { createDocument, uploadDocument } from "@/lib/api";
import { DOCUMENT_ACCEPT, DOCUMENT_MAX_BYTES } from "@/lib/constants";
import { formatBytes } from "@/lib/format";
import type { DocumentSummary } from "@/lib/types";
import { toast } from "sonner";

interface DocumentUploadProps {
  onCreated?: (document: DocumentSummary) => void;
}

/** Add a file or pasted text to the knowledge base; indexing starts on the queue. */
export function DocumentUpload({ onCreated }: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const pickFile = (candidate: File | undefined) => {
    if (!candidate) return;
    if (candidate.size > DOCUMENT_MAX_BYTES) { toast.error("File is too large (max 10 MB)"); return; }
    setFile(candidate);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const document = await uploadDocument(file, fileTitle);
      toast.success("Uploaded", { description: "Chunking and embedding started." });
      setFile(null); setFileTitle("");
      if (inputRef.current) inputRef.current.value = "";
      onCreated?.(document);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Upload failed"); }
    finally { setUploading(false); }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      const document = await createDocument({ title: title.trim(), content: content.trim() });
      toast.success("Added", { description: "Chunking and embedding started." });
      setTitle(""); setContent("");
      onCreated?.(document);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to add document"); }
    finally { setSaving(false); }
  };

  return (
    <Pane title="Add to the knowledge base" legend=".txt · .md · .pdf · up to 10 MB">
      <Tabs defaultValue="upload">
        <TabsList>
          <TabsTrigger value="upload">Upload a file</TabsTrigger>
          <TabsTrigger value="paste">Paste text</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="flex flex-col gap-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]); }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[24px] border-2 border-dashed border-white/15 bg-white/5 px-6 py-8 text-center transition-colors hover:border-white/25 hover:bg-white/10",
              dragging && "border-accent bg-white/8",
            )}
          >
            <input ref={inputRef} type="file" accept={DOCUMENT_ACCEPT} className="hidden" data-testid="document-file-input" onChange={(e) => pickFile(e.target.files?.[0])} />
            <span className="flex size-12 items-center justify-center rounded-[14px] glass-inner text-white/85">
              {file ? <FileText className="size-5" /> : <UploadCloud className="size-5" />}
            </span>
            {file ? (
              <>
                <p className="font-semibold">{file.name}</p>
                <p className="text-sm text-dim">{formatBytes(file.size)} · click to change</p>
              </>
            ) : (
              <>
                <p className="font-semibold">Drop a file here, or click to browse</p>
                <p className="text-sm text-dim">Text, Markdown or PDF</p>
              </>
            )}
          </div>
          <Input placeholder="Title (optional, defaults to the file name)" aria-label="Document title" value={fileTitle} onChange={(e) => setFileTitle(e.target.value)} maxLength={200} />
          <div className="flex justify-end">
            <button type="button" className="btn btn-primary" disabled={!file || uploading} onClick={handleUpload}>
              {uploading ? <Spin /> : <UploadCloud />}
              {uploading ? "Uploading" : "Upload and index"}
            </button>
          </div>
        </TabsContent>

        <TabsContent value="paste">
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <Input placeholder="Title" aria-label="Document title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
            <Textarea placeholder="Paste the document text here" aria-label="Document text" value={content} onChange={(e) => setContent(e.target.value)} rows={8} className="min-h-[180px]" required />
            <div className="flex justify-end">
              <button type="submit" className="btn btn-primary" disabled={saving || !title.trim() || !content.trim()}>
                {saving ? <Spin /> : <Plus />}
                {saving ? "Adding" : "Add and index"}
              </button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </Pane>
  );
}
