"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { createDocument, uploadDocument } from "@/lib/api";
import { DOCUMENT_ACCEPT, DOCUMENT_MAX_BYTES } from "@/lib/constants";
import type { DocumentSummary } from "@/lib/types";
import { toast } from "sonner";

interface DocumentUploadProps {
  onCreated?: (document: DocumentSummary) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

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
    if (candidate.size > DOCUMENT_MAX_BYTES) {
      toast.error("File is too large (max 10 MB)");
      return;
    }
    setFile(candidate);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const document = await uploadDocument(file, fileTitle);
      toast.success("Document uploaded, indexing started");
      setFile(null);
      setFileTitle("");
      if (inputRef.current) inputRef.current.value = "";
      onCreated?.(document);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      const document = await createDocument({
        title: title.trim(),
        content: content.trim(),
      });
      toast.success("Document added, indexing started");
      setTitle("");
      setContent("");
      onCreated?.(document);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add document");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Plus className="h-5 w-5" />
          Add to knowledge base
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="upload">
          <TabsList className="mb-3">
            <TabsTrigger value="upload">Upload file</TabsTrigger>
            <TabsTrigger value="paste">Paste text</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-3">
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickFile(e.dataTransfer.files[0]);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm transition-colors hover:bg-muted/50",
                dragging && "border-primary bg-primary/5",
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept={DOCUMENT_ACCEPT}
                className="hidden"
                data-testid="document-file-input"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              {file ? (
                <>
                  <FileText className="h-6 w-6 text-primary" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(file.size)} &middot; click to change
                  </p>
                </>
              ) : (
                <>
                  <UploadCloud className="h-6 w-6 text-muted-foreground" />
                  <p>Drop a .txt, .md or .pdf file here, or click to browse</p>
                  <p className="text-xs text-muted-foreground">Up to 10 MB</p>
                </>
              )}
            </div>

            <Input
              placeholder="Title (optional, defaults to the file name)"
              value={fileTitle}
              onChange={(e) => setFileTitle(e.target.value)}
              maxLength={200}
            />

            <Button
              type="button"
              className="w-full gap-2"
              disabled={!file || uploading}
              onClick={handleUpload}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              {uploading ? "Uploading..." : "Upload and index"}
            </Button>
          </TabsContent>

          <TabsContent value="paste">
            <form onSubmit={handleCreate} className="space-y-3">
              <Input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
              />
              <Textarea
                placeholder="Paste the document text here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                className="min-h-[180px] resize-y"
                required
              />
              <Button
                type="submit"
                className="w-full gap-2"
                disabled={saving || !title.trim() || !content.trim()}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {saving ? "Adding..." : "Add and index"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
